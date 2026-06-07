import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { checkWebhookRateLimit } from "@/lib/ratelimit";

// Stripe usa a API "dahlia" (pinada pelo SDK). O webhook precisa do corpo
// bruto da requisição para validar a assinatura, por isso roda no runtime
// Node.js (e nunca no Edge, que não expõe o crypto necessário).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
const CREDITS_PER_MONTH = 5;

// Limite de tamanho do corpo: payloads do Stripe podem ser maiores que os da
// Kiwify (eventos com objetos expandidos), então usamos 256 KB de folga.
const MAX_BODY_BYTES = 256 * 1024;

// ─── Cliente Stripe (singleton lazy) ──────────────────────────────────────────
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (stripeClient) return stripeClient;
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY não configurada");
  }
  // Sem apiVersion explícita: o SDK usa a versão pinada (2026-05-27.dahlia),
  // que é exatamente a versão para a qual os tipos foram gerados.
  stripeClient = new Stripe(STRIPE_SECRET_KEY);
  return stripeClient;
}

// ─── Helpers para extrair IDs de campos possivelmente expandidos ──────────────
// Campos como `customer` e `subscription` no Stripe podem vir como string (id)
// ou como objeto expandido. Aqui normalizamos sempre para o id (string) ou null.
function idFromExpandable(
  value: string | { id: string } | null | undefined
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id ?? null;
}

// Converte um timestamp Unix (segundos) do Stripe em ISO string.
// Retorna fallback de +30 dias se o valor for inválido/ausente.
function unixToRenovacaoEm(unixSeconds: number | null | undefined): string {
  if (typeof unixSeconds === "number" && Number.isFinite(unixSeconds)) {
    const d = new Date(unixSeconds * 1000);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

// Extrai o current_period_end de uma assinatura. Na API dahlia esse campo
// fica em cada item da assinatura (subscription.items.data[].current_period_end).
function periodEndFromSubscription(sub: Stripe.Subscription): number | null {
  const item = sub.items?.data?.[0];
  return item?.current_period_end ?? null;
}

// ─── Idempotência via audit_logs ──────────────────────────────────────────────
// Cada evento do Stripe tem um id único (evt_...). Registramos esse id em
// metadata.event_id; se já existir um log com o mesmo event_id, o evento já
// foi processado e deve ser ignorado.
async function isEventProcessed(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
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
  supabase: ReturnType<typeof createServiceSupabaseClient>,
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
    // event_id sempre presente — é a chave de idempotência
    metadata: { event_id: params.eventId, ...(params.metadata ?? {}) },
  });
}

// ─── Resolver o usuário no Supabase Auth ──────────────────────────────────────
// Mesmo padrão do webhook Kiwify: o SDK não expõe getUserByEmail, então
// tentamos criar o usuário; se o e-mail já existir, localizamos via listUsers
// (paginado). Retorna o userId ou null em caso de falha total.
async function resolveUserId(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  email: string
): Promise<string | null> {
  const { data: created, error: createError } =
    await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
    });

  if (created?.user) {
    return created.user.id;
  }

  // createUser falhou — provavelmente o e-mail já está registrado.
  // Procurar o usuário existente percorrendo as páginas.
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

// Localiza a subscription no banco a partir dos identificadores Stripe.
// Tenta primeiro por stripe_subscription_id; se não encontrar, por customer.
async function findSubscriptionUserId(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
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

export async function POST(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // ── 1. Rate limit por IP (reutiliza o limiter do webhook) ─────────────────
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
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
    console.error("[Stripe] STRIPE_SECRET_KEY ou STRIPE_WEBHOOK_SECRET ausente");
    return NextResponse.json(
      { error: "Webhook não configurado" },
      { status: 500 }
    );
  }

  // ── 3. Limitar tamanho do corpo ───────────────────────────────────────────
  const contentLength = parseInt(
    request.headers.get("content-length") ?? "0",
    10
  );
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  // O corpo BRUTO é obrigatório para a verificação de assinatura — não parsear
  // como JSON antes de validar.
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  // ── 4. Verificar assinatura Stripe ────────────────────────────────────────
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Assinatura ausente" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    // constructEventAsync usa o SubtleCrypto/Node crypto de forma assíncrona —
    // funciona tanto no runtime Node quanto em ambientes serverless.
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

  // ── 5. Idempotência universal (cobre TODOS os eventos) ────────────────────
  const alreadyDone = await isEventProcessed(supabase, event.id);
  if (alreadyDone) {
    return NextResponse.json({ message: "Evento já processado" }, { status: 200 });
  }

  const mesReferencia = new Date().toISOString().slice(0, 7);

  // ── 6. Processar evento ───────────────────────────────────────────────────
  switch (event.type) {
    case "checkout.session.completed": {
      try {
        const session = event.data.object as Stripe.Checkout.Session;

        const email =
          session.customer_details?.email ?? session.customer_email ?? null;
        const nome = session.customer_details?.name ?? "";
        const stripeCustomerId = idFromExpandable(session.customer);
        let stripeSubscriptionId = idFromExpandable(session.subscription);

        if (!email) {
          // Sem e-mail não há como provisionar o acesso. Logamos e retornamos
          // 200 para o Stripe não reenviar indefinidamente.
          await logAudit(supabase, {
            action: "STRIPE_CHECKOUT_NO_EMAIL",
            ipAddress,
            eventId: event.id,
            metadata: { session_id: session.id },
          });
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const userId = await resolveUserId(supabase, email);
        if (!userId) {
          return NextResponse.json(
            { error: "Erro interno ao processar compra" },
            { status: 500 }
          );
        }

        await supabase.from("users").upsert(
          { id: userId, email, nome: nome.slice(0, 100) },
          { onConflict: "id" }
        );

        // Buscar a assinatura no Stripe para obter o fim do período atual.
        // Em checkout de assinatura o id sempre existe; se por algum motivo
        // não vier, usamos o fallback de +30 dias.
        let renovacaoEm = unixToRenovacaoEm(null);
        if (stripeSubscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(
              stripeSubscriptionId
            );
            renovacaoEm = unixToRenovacaoEm(periodEndFromSubscription(sub));
          } catch (e) {
            console.warn(
              "[Stripe] Falha ao recuperar subscription no checkout",
              e instanceof Error ? e.message : ""
            );
          }
        } else {
          // Sem subscription (ex.: checkout de pagamento único). Usamos o id da
          // própria sessão como chave estável para o upsert/idempotência.
          stripeSubscriptionId = `session_${session.id}`;
        }

        await supabase.from("subscriptions").upsert(
          {
            user_id: userId,
            status: "active",
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            renovacao_em: renovacaoEm,
          },
          { onConflict: "stripe_subscription_id" }
        );

        await supabase.from("credits").upsert(
          {
            user_id: userId,
            leituras_restantes: CREDITS_PER_MONTH,
            mes_referencia: mesReferencia,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

        await logAudit(supabase, {
          userId,
          action: "STRIPE_CHECKOUT_SESSION_COMPLETED",
          ipAddress,
          eventId: event.id,
          metadata: {
            session_id: session.id,
            stripe_customer_id: stripeCustomerId,
            stripe_subscription_id: stripeSubscriptionId,
            emailDomain: email.split("@")[1] ?? "unknown",
          },
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
          // Logamos e retornamos 200; a renovação subsequente corrige o estado.
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

        // Fim do período atual a partir da linha do invoice.
        const renovacaoEm = unixToRenovacaoEm(
          invoice.lines?.data?.[0]?.period?.end
        );

        await supabase
          .from("subscriptions")
          .update({ status: "active", renovacao_em: renovacaoEm })
          .eq("user_id", userId);

        await supabase
          .from("credits")
          .update({
            leituras_restantes: CREDITS_PER_MONTH,
            mes_referencia: mesReferencia,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        await logAudit(supabase, {
          userId,
          action: "STRIPE_INVOICE_PAYMENT_SUCCEEDED",
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

          await logAudit(supabase, {
            userId,
            action: "STRIPE_INVOICE_PAYMENT_FAILED",
            ipAddress,
            eventId: event.id,
            metadata: {
              invoice_id: invoice.id,
              stripe_subscription_id: stripeSubscriptionId,
              stripe_customer_id: stripeCustomerId,
            },
          });
        } else {
          await logAudit(supabase, {
            action: "STRIPE_INVOICE_FAILED_NO_SUB",
            ipAddress,
            eventId: event.id,
            metadata: {
              invoice_id: invoice.id,
              stripe_subscription_id: stripeSubscriptionId,
              stripe_customer_id: stripeCustomerId,
            },
          });
        }
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

          await logAudit(supabase, {
            userId,
            action: "STRIPE_CUSTOMER_SUBSCRIPTION_DELETED",
            ipAddress,
            eventId: event.id,
            metadata: {
              stripe_subscription_id: stripeSubscriptionId,
              stripe_customer_id: stripeCustomerId,
            },
          });
        } else {
          await logAudit(supabase, {
            action: "STRIPE_SUB_DELETED_NO_SUB",
            ipAddress,
            eventId: event.id,
            metadata: {
              stripe_subscription_id: stripeSubscriptionId,
              stripe_customer_id: stripeCustomerId,
            },
          });
        }
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

    default: {
      // Evento não mapeado — registramos (com idempotência) e retornamos 200
      // para o Stripe não reenviar. event.type vem do payload já validado pela
      // assinatura, então é seguro logar.
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
