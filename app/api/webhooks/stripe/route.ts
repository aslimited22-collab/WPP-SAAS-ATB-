// ─── Webhook Stripe (internacional) ───────────────────────────────────────────
// Recebe os checkouts criados pelo roteador /api/checkout/[plan].
// O produto é resolvido por metadata.plan (gravado na criação da sessão) —
// NUNCA por valor, pois moedas diferentes (USD/EUR/JPY) colidiriam.
//
// Eventos tratados:
//   checkout.session.completed / async_payment_succeeded → provisiona
//   checkout.session.async_payment_failed                → registra falha
//   invoice.payment_succeeded                            → renovação
//   invoice.payment_failed                               → assinatura inativa
//   customer.subscription.deleted                        → cancelamento
//   charge.refunded / charge.dispute.created             → revoga acesso

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { checkWebhookRateLimit } from "@/lib/ratelimit";
import {
  provisionPlan,
  resolvePlanFromEnv,
  PLAN_CONFIG,
  type PlanKey,
} from "@/lib/plans";
import { getStripe } from "@/lib/stripe";
import { normalizeLocale, type AppLocale } from "@/lib/locale";
import { isValidProduct } from "@/lib/pricing";
import { deliverLimpezaOrder } from "@/lib/delivery";
import { sendAccessEmail, sendAdminSaleNotification } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Entrega da limpeza gera leitura com IA dentro do webhook — precisa de folga.
export const maxDuration = 120;

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const MAX_BODY_BYTES = 256 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ServiceClient = ReturnType<typeof createServiceSupabaseClient>;

// Campos como `customer`/`subscription` podem vir como string (id) ou objeto
// expandido — normaliza sempre para o id (string) ou null.
function idFromExpandable(
  value: string | { id: string } | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id ?? null;
}

function unixToRenovacaoEm(unixSeconds: number | null | undefined): string {
  if (typeof unixSeconds === "number" && Number.isFinite(unixSeconds)) {
    const d = new Date(unixSeconds * 1000);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

// Na API dahlia o current_period_end fica em cada item da assinatura.
function periodEndFromSubscription(sub: Stripe.Subscription): number | null {
  const item = sub.items?.data?.[0];
  return item?.current_period_end ?? null;
}

// ─── Idempotência via audit_logs ──────────────────────────────────────────────
async function isEventProcessed(
  supabase: ServiceClient,
  eventId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("audit_logs")
    .select("id")
    .eq("metadata->>event_id", eventId)
    .limit(1)
    .maybeSingle();
  return !!data;
}

async function logAudit(
  supabase: ServiceClient,
  params: {
    userId?: string | null;
    action: string;
    ipAddress?: string;
    eventId: string;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("audit_logs").insert({
    user_id: params.userId ?? null,
    action: params.action,
    ip_address: params.ipAddress ?? null,
    metadata: { event_id: params.eventId, ...(params.metadata ?? {}) },
  });
}

// ─── Resolver/criar usuário no Supabase Auth ─────────────────────────────────
async function resolveUserId(
  supabase: ServiceClient,
  email: string
): Promise<string | null> {
  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({ email, email_confirm: true });
  if (created?.user) return created.user.id;

  let page = 1;
  const perPage = 200;
  const MAX_PAGES = 50;
  while (page <= MAX_PAGES) {
    const { data: list, error: listError } =
      await supabase.auth.admin.listUsers({ page, perPage });
    if (listError) break;
    const found = list.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );
    if (found) return found.id;
    if (list.users.length < perPage) break;
    page++;
  }

  console.error(
    "[Stripe] Falha ao resolver usuário no Supabase Auth",
    createError?.message ?? ""
  );
  return null;
}

async function findSubscriptionUserId(
  supabase: ServiceClient,
  stripeSubscriptionId: string | null,
  stripeCustomerId: string | null
): Promise<string | null> {
  if (stripeSubscriptionId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_subscription_id", stripeSubscriptionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }

  if (stripeCustomerId) {
    const { data } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.user_id) return data.user_id;
  }

  return null;
}

function appBaseUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  ).replace(/\/$/, "");
}

// ─── Provisionamento de um checkout pago ──────────────────────────────────────
// Compartilhado por checkout.session.completed (pagamento síncrono) e
// checkout.session.async_payment_succeeded (boleto e afins).
async function handlePaidCheckout(opts: {
  supabase: ServiceClient;
  stripe: Stripe;
  session: Stripe.Checkout.Session;
  eventId: string;
  ipAddress: string;
  baseUrl: string;
}): Promise<NextResponse> {
  const { supabase, stripe, session, eventId, ipAddress, baseUrl } = opts;

  const email = (
    session.customer_details?.email ??
    session.customer_email ??
    ""
  ).toLowerCase();
  const nome = (session.customer_details?.name ?? "").slice(0, 100);
  const phone = session.customer_details?.phone ?? null;
  const stripeCustomerId = idFromExpandable(session.customer);
  const stripeSubscriptionId = idFromExpandable(session.subscription);
  const paymentIntentId = idFromExpandable(
    session.payment_intent as string | { id: string } | null
  );
  const currency = String(session.currency ?? "usd").toLowerCase();

  // Idioma do comprador: o locale que mostramos no checkout (metadata.locale,
  // gravado pelo roteador) > locale da sessão Stripe > país do cartão.
  const buyerLocale: AppLocale = normalizeLocale(
    session.metadata?.locale ??
      (session.locale && session.locale !== "auto" ? session.locale : null) ??
      (session.customer_details?.address?.country === "BR" ? "pt-BR" : null)
  );

  if (!email) {
    await logAudit(supabase, {
      action: "STRIPE_CHECKOUT_NO_EMAIL",
      ipAddress,
      eventId,
      metadata: { session_id: session.id },
    });
    return NextResponse.json({ received: true }, { status: 200 });
  }

  // ── Limpeza vinda do funil (order_id em metadata/client_reference_id) ──────
  const orderRef =
    session.metadata?.order_id ?? session.client_reference_id ?? null;
  const planMeta = session.metadata?.plan ?? null;

  if (planMeta === "limpeza" || (orderRef && UUID_RE.test(orderRef))) {
    let limpezaOrderId: string | null = null;

    if (orderRef && UUID_RE.test(orderRef)) {
      const { data: existing } = await supabase
        .from("limpeza_orders")
        .select("id, status")
        .eq("id", orderRef)
        .maybeSingle();
      if (existing) {
        limpezaOrderId = existing.id;
        const wasAlreadyPaid = existing.status === "paid";
        await supabase
          .from("limpeza_orders")
          .update({
            status: "paid",
            payment_provider: "stripe",
            payment_id: paymentIntentId ?? session.id,
            amount_cents: session.amount_total ?? null,
            currency,
          })
          .eq("id", existing.id);
        if (!wasAlreadyPaid) {
          await deliverLimpezaOrder(supabase, {
            orderId: existing.id,
            baseUrl,
          });
        }
      }
    }

    // Compra de limpeza sem pedido do funil → cria pedido genérico e entrega.
    if (!limpezaOrderId && planMeta === "limpeza") {
      const { data: createdOrder, error: orderErr } = await supabase
        .from("limpeza_orders")
        .insert({
          nome,
          email,
          phone,
          tema: "protecao_espiritual",
          pergunta: "",
          locale: buyerLocale,
          status: "paid",
          payment_provider: "stripe",
          payment_id: paymentIntentId ?? session.id,
          amount_cents: session.amount_total ?? null,
          currency,
        })
        .select("id")
        .single();
      if (orderErr || !createdOrder) {
        console.error(
          "[Stripe] Falha ao criar pedido de limpeza:",
          orderErr?.message
        );
        return NextResponse.json(
          { error: "Erro interno ao processar compra" },
          { status: 500 }
        );
      }
      limpezaOrderId = createdOrder.id;
      await deliverLimpezaOrder(supabase, { orderId: createdOrder.id, baseUrl });
    }

    await logAudit(supabase, {
      action: "STRIPE_CHECKOUT_SESSION_COMPLETED",
      ipAddress,
      eventId,
      metadata: {
        session_id: session.id,
        payment_intent: paymentIntentId,
        plan: "limpeza",
        limpeza_order_id: limpezaOrderId,
        locale: buyerLocale,
        emailDomain: email.split("@")[1] ?? "unknown",
      },
    });
    await sendAdminSaleNotification({
      plan: "limpeza",
      email,
      nome,
      amountCents: session.amount_total ?? null,
      currency,
      provider: "stripe",
    });
    return NextResponse.json({ ok: true, plan: "limpeza" });
  }

  // ── Demais produtos: metadata.plan → env price id ──────────────────────────
  let planKey: PlanKey | null =
    planMeta && isValidProduct(planMeta) ? planMeta : null;

  if (!planKey) {
    // Sessão criada fora do roteador (ex.: Payment Link antigo) — tenta o
    // price id configurado em env. Valor NUNCA é usado (moedas colidem).
    let priceId: string | null = null;
    try {
      const lineItems = await stripe.checkout.sessions.listLineItems(
        session.id,
        { limit: 1 }
      );
      priceId = lineItems.data[0]?.price?.id ?? null;
    } catch {
      // segue com null
    }
    planKey = resolvePlanFromEnv(priceId, "STRIPE_PRICE");
  }

  if (!planKey) {
    await logAudit(supabase, {
      action: "STRIPE_UNKNOWN_PRODUCT",
      ipAddress,
      eventId,
      metadata: {
        session_id: session.id,
        amount_total: session.amount_total,
        currency,
      },
    });
    console.error("[Stripe] Produto não mapeado na sessão", session.id);
    return NextResponse.json({ ok: true, unmapped: true });
  }

  const userId = await resolveUserId(supabase, email);
  if (!userId) {
    return NextResponse.json(
      { error: "Erro interno ao processar compra" },
      { status: 500 }
    );
  }

  // Não sobrescrever um nome existente com vazio.
  const userRow: Record<string, unknown> = { id: userId, email };
  if (nome) userRow.nome = nome;
  await supabase.from("users").upsert(userRow, { onConflict: "id" });

  // Assinatura só para basic/premium — compras avulsas não criam registro
  // em subscriptions (o acesso delas é por crédito de chat).
  if (PLAN_CONFIG[planKey].isSubscription) {
    let renovacaoEm = unixToRenovacaoEm(null);
    if (stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        renovacaoEm = unixToRenovacaoEm(periodEndFromSubscription(sub));
      } catch (e) {
        console.warn(
          "[Stripe] Falha ao recuperar subscription no checkout",
          e instanceof Error ? e.message : ""
        );
      }
    }

    await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        status: "active",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId ?? `session_${session.id}`,
        renovacao_em: renovacaoEm,
      },
      { onConflict: "stripe_subscription_id" }
    );
  }

  const provision = await provisionPlan(supabase, userId, planKey, {
    locale: buyerLocale,
  });
  if (!provision.ok) {
    console.error("[Stripe] provisionPlan falhou:", provision.errors);
    return NextResponse.json(
      { error: "Erro interno ao provisionar" },
      { status: 500 }
    );
  }

  // E-mail de acesso com magic link, no idioma do comprador (fail-soft).
  const accessEmail = await sendAccessEmail(supabase, {
    email,
    nome,
    locale: buyerLocale,
    baseUrl,
  });

  await logAudit(supabase, {
    userId,
    action: "STRIPE_CHECKOUT_SESSION_COMPLETED",
    ipAddress,
    eventId,
    metadata: {
      session_id: session.id,
      payment_intent: paymentIntentId,
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      plan: planKey,
      locale: buyerLocale,
      access_email_sent: accessEmail.ok,
      emailDomain: email.split("@")[1] ?? "unknown",
    },
  });
  await sendAdminSaleNotification({
    plan: planKey,
    email,
    nome,
    amountCents: session.amount_total ?? null,
    currency,
    provider: "stripe",
  });

  return NextResponse.json({ ok: true, plan: planKey });
}

// ─── Revogação por reembolso/disputa ─────────────────────────────────────────
// Localiza o que foi entregue pela transação (audit_logs.payment_intent) e
// desfaz: assinatura → inactive · créditos de chat → estorno · limpeza →
// pedido marcado como refunded.
async function revokeByPaymentIntent(
  supabase: ServiceClient,
  paymentIntentId: string,
  action: string,
  eventId: string,
  ipAddress: string
) {
  const { data: prior } = await supabase
    .from("audit_logs")
    .select("user_id, metadata")
    .eq("action", "STRIPE_CHECKOUT_SESSION_COMPLETED")
    .filter("metadata->payment_intent", "eq", `"${paymentIntentId}"`)
    .limit(1)
    .maybeSingle();

  const meta = (prior?.metadata ?? {}) as Record<string, unknown>;
  const plan = meta.plan as PlanKey | undefined;

  if (prior?.user_id && plan && PLAN_CONFIG[plan]?.isSubscription) {
    await supabase
      .from("subscriptions")
      .update({ status: "inactive" })
      .eq("user_id", prior.user_id);
  }

  if (prior?.user_id && plan && PLAN_CONFIG[plan]?.chatCredits > 0) {
    const { data: u } = await supabase
      .from("users")
      .select("chat_credits_balance")
      .eq("id", prior.user_id)
      .maybeSingle();
    const newBalance = Math.max(
      0,
      (u?.chat_credits_balance ?? 0) - PLAN_CONFIG[plan].chatCredits
    );
    await supabase
      .from("users")
      .update({ chat_credits_balance: newBalance })
      .eq("id", prior.user_id);
  }

  await supabase
    .from("limpeza_orders")
    .update({ status: "refunded" })
    .eq("payment_provider", "stripe")
    .eq("payment_id", paymentIntentId);

  await logAudit(supabase, {
    userId: prior?.user_id ?? null,
    action,
    ipAddress,
    eventId,
    metadata: { payment_intent: paymentIntentId, plan: plan ?? null },
  });
}

export async function POST(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // ── 1. Rate limit por IP ──────────────────────────────────────────────────
  const rl = await checkWebhookRateLimit(ipAddress);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)),
        },
      }
    );
  }

  // ── 2. Configuração obrigatória ───────────────────────────────────────────
  const stripe = getStripe();
  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    console.error("[Stripe] STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET ausente");
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 500 });
  }

  // ── 3. Limitar tamanho do corpo ───────────────────────────────────────────
  const contentLength = parseInt(
    request.headers.get("content-length") ?? "0",
    10
  );
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  // ── 4. Verificar assinatura Stripe ────────────────────────────────────────
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Assinatura ausente" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.warn(
      "[Stripe] Assinatura inválida de IP:",
      ipAddress,
      err instanceof Error ? err.message : ""
    );
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  const baseUrl = appBaseUrl(request);

  // ── 5. Idempotência universal ─────────────────────────────────────────────
  const alreadyDone = await isEventProcessed(supabase, event.id);
  if (alreadyDone) {
    return NextResponse.json({ message: "Evento já processado" }, { status: 200 });
  }

  // ── 6. Processar evento ───────────────────────────────────────────────────
  switch (event.type) {
    case "checkout.session.completed": {
      try {
        const session = event.data.object as Stripe.Checkout.Session;

        // Pagamentos assíncronos (boleto etc.): NÃO provisiona até o dinheiro
        // confirmar — o evento async_payment_succeeded fará isso.
        if (
          session.payment_status !== "paid" &&
          session.payment_status !== "no_payment_required"
        ) {
          await logAudit(supabase, {
            action: "STRIPE_CHECKOUT_PENDING_PAYMENT",
            ipAddress,
            eventId: event.id,
            metadata: {
              session_id: session.id,
              payment_status: session.payment_status,
            },
          });
          return NextResponse.json({ received: true, pending: true });
        }

        return await handlePaidCheckout({
          supabase,
          stripe,
          session,
          eventId: event.id,
          ipAddress,
          baseUrl,
        });
      } catch (err) {
        console.error(
          "[Stripe] Erro inesperado em checkout.session.completed",
          err instanceof Error ? err.message : ""
        );
        return NextResponse.json(
          { error: "Erro interno ao processar compra" },
          { status: 500 }
        );
      }
    }

    case "checkout.session.async_payment_succeeded": {
      try {
        const session = event.data.object as Stripe.Checkout.Session;
        return await handlePaidCheckout({
          supabase,
          stripe,
          session,
          eventId: event.id,
          ipAddress,
          baseUrl,
        });
      } catch (err) {
        console.error(
          "[Stripe] Erro em async_payment_succeeded",
          err instanceof Error ? err.message : ""
        );
        return NextResponse.json(
          { error: "Erro interno ao processar compra" },
          { status: 500 }
        );
      }
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await logAudit(supabase, {
        action: "STRIPE_ASYNC_PAYMENT_FAILED",
        ipAddress,
        eventId: event.id,
        metadata: { session_id: session.id },
      });
      break;
    }

    case "invoice.payment_succeeded": {
      try {
        const invoice = event.data.object as Stripe.Invoice;

        const stripeCustomerId = idFromExpandable(invoice.customer);
        // Na API dahlia a referência à assinatura fica em
        // invoice.parent.subscription_details.subscription.
        const stripeSubscriptionId = idFromExpandable(
          invoice.parent?.subscription_details?.subscription
        );

        const userId = await findSubscriptionUserId(
          supabase,
          stripeSubscriptionId,
          stripeCustomerId
        );

        if (!userId) {
          // Pode acontecer se o invoice chegar antes do checkout.session.
          await logAudit(supabase, {
            action: "STRIPE_INVOICE_PAID_NO_SUB",
            ipAddress,
            eventId: event.id,
            metadata: {
              invoice_id: invoice.id,
              stripe_subscription_id: stripeSubscriptionId,
              stripe_customer_id: stripeCustomerId,
            },
          });
          break;
        }

        const renovacaoEm = unixToRenovacaoEm(
          invoice.lines?.data?.[0]?.period?.end
        );

        await supabase
          .from("subscriptions")
          .update({ status: "active", renovacao_em: renovacaoEm })
          .eq("user_id", userId);

        // Renovação: reprovisiona conforme o plano ATUAL do usuário.
        // Valor pago não identifica plano (moedas internacionais variam).
        const { data: invoiceUserRow } = await supabase
          .from("users")
          .select("plan")
          .eq("id", userId)
          .maybeSingle();
        const renewalPlan: PlanKey =
          invoiceUserRow?.plan === "premium" ? "premium" : "basic";

        await provisionPlan(supabase, userId, renewalPlan);

        await logAudit(supabase, {
          userId,
          action: "STRIPE_INVOICE_PAYMENT_SUCCEEDED",
          ipAddress,
          eventId: event.id,
          metadata: {
            invoice_id: invoice.id,
            stripe_subscription_id: stripeSubscriptionId,
            stripe_customer_id: stripeCustomerId,
            plan: renewalPlan,
          },
        });
      } catch (err) {
        console.error(
          "[Stripe] Erro inesperado em invoice.payment_succeeded",
          err instanceof Error ? err.message : ""
        );
        return NextResponse.json(
          { error: "Erro interno ao renovar créditos" },
          { status: 500 }
        );
      }
      break;
    }

    case "invoice.payment_failed": {
      try {
        const invoice = event.data.object as Stripe.Invoice;

        const stripeCustomerId = idFromExpandable(invoice.customer);
        const stripeSubscriptionId = idFromExpandable(
          invoice.parent?.subscription_details?.subscription
        );

        const userId = await findSubscriptionUserId(
          supabase,
          stripeSubscriptionId,
          stripeCustomerId
        );

        if (userId) {
          await supabase
            .from("subscriptions")
            .update({ status: "inactive" })
            .eq("user_id", userId);
        }

        await logAudit(supabase, {
          userId,
          action: userId
            ? "STRIPE_INVOICE_PAYMENT_FAILED"
            : "STRIPE_INVOICE_FAILED_NO_SUB",
          ipAddress,
          eventId: event.id,
          metadata: {
            invoice_id: invoice.id,
            stripe_subscription_id: stripeSubscriptionId,
            stripe_customer_id: stripeCustomerId,
          },
        });
      } catch (err) {
        console.error(
          "[Stripe] Erro inesperado em invoice.payment_failed",
          err instanceof Error ? err.message : ""
        );
        return NextResponse.json(
          { error: "Erro interno ao processar falha de pagamento" },
          { status: 500 }
        );
      }
      break;
    }

    case "customer.subscription.deleted": {
      try {
        const sub = event.data.object as Stripe.Subscription;

        const stripeSubscriptionId = sub.id;
        const stripeCustomerId = idFromExpandable(sub.customer);

        const userId = await findSubscriptionUserId(
          supabase,
          stripeSubscriptionId,
          stripeCustomerId
        );

        if (userId) {
          await supabase
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("user_id", userId);
        }

        await logAudit(supabase, {
          userId,
          action: userId
            ? "STRIPE_CUSTOMER_SUBSCRIPTION_DELETED"
            : "STRIPE_SUB_DELETED_NO_SUB",
          ipAddress,
          eventId: event.id,
          metadata: {
            stripe_subscription_id: stripeSubscriptionId,
            stripe_customer_id: stripeCustomerId,
          },
        });
      } catch (err) {
        console.error(
          "[Stripe] Erro inesperado em customer.subscription.deleted",
          err instanceof Error ? err.message : ""
        );
        return NextResponse.json(
          { error: "Erro interno ao cancelar assinatura" },
          { status: 500 }
        );
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId = idFromExpandable(
        charge.payment_intent as string | { id: string } | null
      );
      if (paymentIntentId) {
        await revokeByPaymentIntent(
          supabase,
          paymentIntentId,
          "STRIPE_CHARGE_REFUNDED",
          event.id,
          ipAddress
        );
      }
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId = idFromExpandable(
        dispute.payment_intent as string | { id: string } | null
      );
      if (paymentIntentId) {
        await revokeByPaymentIntent(
          supabase,
          paymentIntentId,
          "STRIPE_CHARGE_DISPUTED",
          event.id,
          ipAddress
        );
      }
      break;
    }

    default: {
      await logAudit(supabase, {
        action: "STRIPE_EVENT_UNHANDLED",
        ipAddress,
        eventId: event.id,
        metadata: { event_type: event.type },
      });
      break;
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
