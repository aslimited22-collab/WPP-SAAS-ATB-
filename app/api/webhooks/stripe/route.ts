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
import {
  sendAccessEmail,
  sendAdminSaleNotification,
  sendNumerologiaDadosEmail,
  sendOperadorEmail,
} from "@/lib/email";

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

// ─── Idempotência via audit_logs (marcador ANTES de processar) ───────────────
// O insert do marcador STRIPE_RECEIPT colide no índice único
// uniq_audit_stripe_receipt para entregas duplicadas/concorrentes do mesmo
// event.id — a segunda entrega é descartada antes de tocar em créditos.
// Em falha de processamento (500), releaseEvent remove o marcador para que
// o retry do Stripe consiga reprocessar.
async function claimEvent(
  supabase: ServiceClient,
  eventId: string,
  ipAddress: string
): Promise<"claimed" | "duplicate"> {
  const { error } = await supabase.from("audit_logs").insert({
    user_id: null,
    action: "STRIPE_RECEIPT",
    ip_address: ipAddress,
    metadata: { event_id: eventId },
  });
  if (!error) return "claimed";
  if ((error as { code?: string }).code === "23505") return "duplicate";
  // Erro de banco inesperado: cai no check de leitura (fail-open controlado).
  const { data } = await supabase
    .from("audit_logs")
    .select("id")
    .eq("action", "STRIPE_RECEIPT")
    .eq("metadata->>event_id", eventId)
    .limit(1)
    .maybeSingle();
  return data ? "duplicate" : "claimed";
}

async function releaseEvent(supabase: ServiceClient, eventId: string) {
  await supabase
    .from("audit_logs")
    .delete()
    .eq("action", "STRIPE_RECEIPT")
    .eq("metadata->>event_id", eventId);
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
// 1º tenta public.users por e-mail (indexado, O(1)); depois cria no Auth;
// por fim pagina o Auth (caso raro: existe no Auth mas não em public.users).
async function resolveUserId(
  supabase: ServiceClient,
  email: string
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("users")
    .select("id")
    .eq("email", email.toLowerCase())
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id;

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
  // O ramo de limpeza SÓ é acionado quando o produto pago É limpeza
  // (metadata.plan) — um order UUID anexado a outro produto é ignorado,
  // senão uma compra barata com order forjado receberia a limpeza e o
  // produto realmente pago nunca seria provisionado.
  const orderRef =
    session.metadata?.order_id ?? session.client_reference_id ?? null;
  const planMeta = session.metadata?.plan ?? null;

  if (planMeta === "limpeza") {
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
    if (!limpezaOrderId) {
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
        await releaseEvent(supabase, eventId);
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

  // ── Numerologia: cria o pedido pago e pede nome + nascimento ───────────────
  // A entrega (mapa em PDF) só acontece depois do form em /numerologia/dados —
  // o e-mail leva ao link único. Idempotente pelo índice único em
  // stripe_session_id (23505 = evento duplicado da mesma sessão).
  if (planMeta === "numerologia") {
    let numOrder: { id: string; access_token: string } | null = null;
    const { data: createdNum, error: numErr } = await supabase
      .from("numerologia_orders")
      .insert({
        email,
        name: nome || null,
        locale: buyerLocale,
        status: "paid",
        payment_provider: "stripe",
        stripe_session_id: session.id,
        // Gravado no pedido para o refund/disputa revogar por match direto
        // (o audit_log pode nunca existir se o processo morrer antes dele).
        stripe_payment_intent: paymentIntentId,
        amount_cents: session.amount_total ?? null,
        currency,
      })
      .select("id, access_token")
      .single();
    numOrder = createdNum ?? null;

    if (numErr) {
      if ((numErr as { code?: string }).code === "23505") {
        const { data: existingNum } = await supabase
          .from("numerologia_orders")
          .select("id, access_token")
          .eq("stripe_session_id", session.id)
          .maybeSingle();
        numOrder = existingNum ?? null;
      }
      if (!numOrder) {
        console.error(
          "[Stripe] Falha ao criar pedido de numerologia:",
          numErr.message
        );
        await releaseEvent(supabase, eventId);
        return NextResponse.json(
          { error: "Erro interno ao processar compra" },
          { status: 500 }
        );
      }
    }
    if (!numOrder) {
      // .single() sem erro sempre traz a linha — guarda por segurança.
      await releaseEvent(supabase, eventId);
      return NextResponse.json(
        { error: "Erro interno ao processar compra" },
        { status: 500 }
      );
    }

    const dadosEmail = await sendNumerologiaDadosEmail({
      email,
      nome,
      locale: buyerLocale,
      dadosUrl: `${baseUrl}/numerologia/dados?pedido=${numOrder.access_token}`,
    });

    await logAudit(supabase, {
      action: "STRIPE_CHECKOUT_SESSION_COMPLETED",
      ipAddress,
      eventId,
      metadata: {
        session_id: session.id,
        payment_intent: paymentIntentId,
        plan: "numerologia",
        numerologia_order_id: numOrder.id,
        dados_email_sent: dadosEmail.ok,
        locale: buyerLocale,
        emailDomain: email.split("@")[1] ?? "unknown",
      },
    });
    await sendAdminSaleNotification({
      plan: "numerologia",
      email,
      nome,
      amountCents: session.amount_total ?? null,
      currency,
      provider: "stripe",
    });
    return NextResponse.json({ ok: true, plan: "numerologia" });
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

    // Numerologia identificada só pelo price id (sessão sem metadata.plan,
    // ex. Payment Link manual): o provisionamento genérico abaixo criaria
    // usuário/plano — errado para este produto, que vive em
    // numerologia_orders. Sem metadata não dá pra criar o pedido com
    // segurança: avisa o operador pra criar manualmente e encerra.
    if (planKey === "numerologia") {
      console.warn(
        "[Stripe] Sessão de numerologia SEM metadata.plan — pedido não criado",
        session.id
      );
      await logAudit(supabase, {
        action: "STRIPE_NUMEROLOGIA_NO_METADATA",
        ipAddress,
        eventId,
        metadata: {
          session_id: session.id,
          payment_intent: paymentIntentId,
          amount_total: session.amount_total,
          currency,
        },
      });
      await sendOperadorEmail({
        assunto: "⚠️ Stripe: sessão numerologia sem metadata.plan",
        linhas: [
          `Sessão: ${session.id}`,
          `Cliente: ${email}`,
          `Valor: ${session.amount_total ?? "?"} ${currency}`,
          "Sessão criada fora do roteador (ex. Payment Link). Crie o pedido de numerologia manualmente.",
        ],
      });
      return NextResponse.json({ received: true, manual: true });
    }
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
    await releaseEvent(supabase, eventId);
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
    await releaseEvent(supabase, eventId);
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
//
// Assinaturas (mode=subscription) NÃO têm payment_intent na sessão de
// checkout — a cobrança vem do invoice. Para esses casos, o fallback
// stripeCustomerId localiza e inativa a assinatura pelo customer.
async function revokeByPaymentIntent(
  supabase: ServiceClient,
  opts: {
    paymentIntentId: string | null;
    stripeCustomerId: string | null;
    action: string;
    eventId: string;
    ipAddress: string;
  }
) {
  const { paymentIntentId, stripeCustomerId, action, eventId, ipAddress } = opts;

  let prior: { user_id: string | null; metadata: unknown } | null = null;
  if (paymentIntentId) {
    const { data } = await supabase
      .from("audit_logs")
      .select("user_id, metadata")
      .eq("action", "STRIPE_CHECKOUT_SESSION_COMPLETED")
      .filter("metadata->payment_intent", "eq", `"${paymentIntentId}"`)
      .limit(1)
      .maybeSingle();
    prior = data ?? null;
  }

  const meta = (prior?.metadata ?? {}) as Record<string, unknown>;
  const plan = meta.plan as PlanKey | undefined;
  let revokedUserId: string | null = prior?.user_id ?? null;

  if (prior?.user_id && plan && PLAN_CONFIG[plan]?.isSubscription) {
    await supabase
      .from("subscriptions")
      .update({ status: "inactive" })
      .eq("user_id", prior.user_id);
  }

  if (prior?.user_id && plan && PLAN_CONFIG[plan]?.chatCredits > 0) {
    await supabase.rpc("revoke_chat_credits", {
      p_user_id: prior.user_id,
      p_amount: PLAN_CONFIG[plan].chatCredits,
    });
  }

  // Fallback para cobranças de assinatura (sem payment_intent no checkout):
  // inativa a assinatura localizada pelo stripe_customer_id.
  if (!prior && stripeCustomerId) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", stripeCustomerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sub?.user_id) {
      revokedUserId = sub.user_id;
      await supabase
        .from("subscriptions")
        .update({ status: "inactive" })
        .eq("user_id", sub.user_id);
    }
  }

  if (paymentIntentId) {
    await supabase
      .from("limpeza_orders")
      .update({ status: "refunded" })
      .eq("payment_provider", "stripe")
      .eq("payment_id", paymentIntentId);

    // Numerologia — match DIRETO no pedido (stripe_payment_intent gravado na
    // compra), como a limpeza faz acima. Não depende do audit_log existir.
    // O download/entrega exige status 'paid', então o acesso morre junto.
    await supabase
      .from("numerologia_orders")
      .update({ status: "refunded", updated_at: new Date().toISOString() })
      .eq("stripe_payment_intent", paymentIntentId);
  }

  // Numerologia (fallback legado) → pedidos criados ANTES da coluna
  // stripe_payment_intent: localiza pela session_id gravada no audit da compra.
  const refundedSessionId =
    typeof meta.session_id === "string" ? meta.session_id : null;
  if (plan === "numerologia" && refundedSessionId) {
    await supabase
      .from("numerologia_orders")
      .update({ status: "refunded", updated_at: new Date().toISOString() })
      .eq("stripe_session_id", refundedSessionId);
  }

  await logAudit(supabase, {
    userId: revokedUserId,
    action,
    ipAddress,
    eventId,
    metadata: {
      payment_intent: paymentIntentId,
      stripe_customer_id: stripeCustomerId,
      plan: plan ?? null,
    },
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

  // ── 5. Idempotência universal (marcador único ANTES de processar) ─────────
  const claim = await claimEvent(supabase, event.id, ipAddress);
  if (claim === "duplicate") {
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
        await releaseEvent(supabase, event.id);
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
        await releaseEvent(supabase, event.id);
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
        await releaseEvent(supabase, event.id);
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
        await releaseEvent(supabase, event.id);
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
        await releaseEvent(supabase, event.id);
        return NextResponse.json(
          { error: "Erro interno ao cancelar assinatura" },
          { status: 500 }
        );
      }
      break;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      // O evento também dispara em reembolso PARCIAL — só revogamos quando a
      // cobrança foi integralmente devolvida (charge.refunded === true).
      if (!charge.refunded) {
        await logAudit(supabase, {
          action: "STRIPE_CHARGE_PARTIAL_REFUND",
          ipAddress,
          eventId: event.id,
          metadata: {
            charge_id: charge.id,
            amount_refunded: charge.amount_refunded,
            amount: charge.amount,
          },
        });
        break;
      }
      await revokeByPaymentIntent(supabase, {
        paymentIntentId: idFromExpandable(
          charge.payment_intent as string | { id: string } | null
        ),
        stripeCustomerId: idFromExpandable(
          charge.customer as string | { id: string } | null
        ),
        action: "STRIPE_CHARGE_REFUNDED",
        eventId: event.id,
        ipAddress,
      });
      break;
    }

    case "charge.dispute.created": {
      const dispute = event.data.object as Stripe.Dispute;
      const paymentIntentId = idFromExpandable(
        dispute.payment_intent as string | { id: string } | null
      );
      // A disputa não traz o customer — recupera da charge para permitir o
      // fallback de revogação de assinaturas.
      let disputeCustomerId: string | null = null;
      const chargeId = idFromExpandable(
        dispute.charge as string | { id: string } | null
      );
      if (chargeId) {
        try {
          const charge = await stripe.charges.retrieve(chargeId);
          disputeCustomerId = idFromExpandable(
            charge.customer as string | { id: string } | null
          );
        } catch {
          // segue sem customer — revogação por payment_intent ainda funciona
        }
      }
      await revokeByPaymentIntent(supabase, {
        paymentIntentId,
        stripeCustomerId: disputeCustomerId,
        action: "STRIPE_CHARGE_DISPUTED",
        eventId: event.id,
        ipAddress,
      });
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
