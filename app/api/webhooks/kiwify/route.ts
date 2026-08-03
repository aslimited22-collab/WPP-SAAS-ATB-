// ─── Webhook Kiwify (Brasil) ──────────────────────────────────────────────────
// Formato real da Kiwify (comprovado em produção):
//   • assinatura = HMAC-SHA1(corpo bruto, KIWIFY_WEBHOOK_TOKEN)
//   • enviada como query param  ?signature=<hex>
//
// Produtos: basic/premium (assinaturas) · pergunta1/3/7 (créditos de chat)
//           limpeza (funil /limpeza com external_reference, ou compra direta)
//
// Após provisionar, envia o e-mail de acesso (Resend, idioma pt-BR) — a
// promessa "você receberá um e-mail" da página de vendas é cumprida aqui.

import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { checkWebhookRateLimit } from "@/lib/ratelimit";
import {
  provisionPlan,
  resolvePlanFromEnv,
  resolvePlanFromAmount,
  toCents,
  PLAN_CONFIG,
  AMOUNT_AMBIGUO,
  type PlanKey,
} from "@/lib/plans";
import { deliverLimpezaOrder } from "@/lib/delivery";
import { sendAccessEmail, sendAdminSaleNotification } from "@/lib/email";
import {
  findServiceByKiwifyProductId,
  processarCompraServico,
  notifyOperator,
  servicoNomeDe,
} from "@/lib/spiritual-services";
import { copyOperadorReembolso } from "@/content/mensagens-servicos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Entrega da limpeza gera leitura com IA dentro do webhook — precisa de folga.
export const maxDuration = 120;

const KIWIFY_WEBHOOK_TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN ?? "";
const MAX_BODY_BYTES = 64 * 1024;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Assinatura: HMAC-SHA1 do corpo bruto vs ?signature= ─────────────────────
function verifyKiwifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature || !KIWIFY_WEBHOOK_TOKEN) return false;
  if (!/^[a-f0-9]{20,128}$/i.test(signature)) return false;
  const expected = createHmac("sha1", KIWIFY_WEBHOOK_TOKEN)
    .update(rawBody)
    .digest("hex");
  try {
    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length === 0 || expectedBuf.length !== sigBuf.length) {
      return false;
    }
    return timingSafeEqual(expectedBuf, sigBuf);
  } catch {
    return false;
  }
}

// ─── Idempotência via audit_logs (marcador ANTES de processar) ───────────────
// O insert do marcador KIWIFY_RECEIPT_<evento> colide no índice único
// uniq_audit_kiwify_receipt para entregas duplicadas/concorrentes do mesmo
// (evento, order_id) — a segunda entrega é descartada antes de creditar.
// Em falha de processamento (500), releaseKiwifyEvent remove o marcador
// para o retry da Kiwify reprocessar.
function kiwifyReceiptAction(eventType: string): string {
  return `KIWIFY_RECEIPT_${eventType.toUpperCase().replace(/[^A-Z_]/g, "_")}`.slice(
    0,
    128
  );
}

async function claimKiwifyEvent(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  eventType: string,
  orderId: string,
  ipAddress: string
): Promise<"claimed" | "duplicate"> {
  const action = kiwifyReceiptAction(eventType);
  const { error } = await supabase.from("audit_logs").insert({
    user_id: null,
    action,
    ip_address: ipAddress,
    metadata: { order_id: orderId },
  });
  if (!error) return "claimed";
  if ((error as { code?: string }).code === "23505") return "duplicate";
  // Erro de banco inesperado: cai no check de leitura (fail-open controlado).
  const { data } = await supabase
    .from("audit_logs")
    .select("id")
    .eq("action", action)
    .filter("metadata->order_id", "eq", `"${orderId}"`)
    .limit(1)
    .maybeSingle();
  return data ? "duplicate" : "claimed";
}

async function releaseKiwifyEvent(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  eventType: string,
  orderId: string
) {
  await supabase
    .from("audit_logs")
    .delete()
    .eq("action", kiwifyReceiptAction(eventType))
    .filter("metadata->order_id", "eq", `"${orderId}"`);
}

async function logAudit(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  params: {
    userId?: string | null;
    action: string;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("audit_logs").insert({
    user_id: params.userId ?? null,
    action: params.action.slice(0, 128),
    ip_address: params.ipAddress ?? null,
    metadata: params.metadata ?? null,
  });
}

// ─── Resolver/criar usuário no Supabase Auth ─────────────────────────────────
// 1º tenta public.users por e-mail (indexado, O(1)); depois cria no Auth;
// por fim pagina o Auth (caso raro: existe no Auth mas não em public.users).
async function resolveUserId(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
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

  // createUser falhou — provavelmente o e-mail já existe; localizar paginando.
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
    "[Kiwify] Falha ao resolver usuário no Supabase Auth",
    createError?.message ?? ""
  );
  return null;
}

function appBaseUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  ).replace(/\/$/, "");
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

  if (!KIWIFY_WEBHOOK_TOKEN) {
    console.error("[Kiwify] KIWIFY_WEBHOOK_TOKEN ausente");
    return NextResponse.json({ error: "Webhook não configurado" }, { status: 500 });
  }

  // ── 2. Limitar tamanho do corpo ───────────────────────────────────────────
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  // ── 3. Validar assinatura (query param, HMAC-SHA1 do corpo bruto) ─────────
  const signature = request.nextUrl.searchParams.get("signature");
  if (!verifyKiwifySignature(rawBody, signature)) {
    console.warn("[Kiwify] Assinatura inválida de IP:", ipAddress);
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // ── 4. Parse leniente do payload (a Kiwify varia a estrutura) ─────────────
  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const order = payload.order ?? payload.Order ?? payload;
  // A Kiwify usa nomes em inglês (order_approved) E em português
  // (compra_aprovada, conforme os valores do painel de webhooks) dependendo
  // do contexto — normalizamos tudo para os nomes em inglês.
  const EVENT_ALIASES: Record<string, string> = {
    compra_aprovada: "order_approved",
    compra_reembolsada: "order_refunded",
    estorno: "order_refunded",
    assinatura_cancelada: "subscription_canceled",
    assinatura_renovada: "subscription_renewed",
    assinatura_atrasada: "subscription_late",
  };
  const rawEvent: string = String(
    order.webhook_event_type ??
      payload.webhook_event_type ??
      payload.event ??
      payload.type ??
      ""
  )
    .toLowerCase()
    .replace(/\./g, "_");
  const event = EVENT_ALIASES[rawEvent] ?? rawEvent;

  const orderId: string = String(
    order.order_id ?? order.order_ref ?? payload.order_id ?? ""
  ).slice(0, 128);

  const email: string = String(
    order.Customer?.email ??
      order.customer?.email ??
      payload.Customer?.email ??
      payload.customer?.email ??
      payload.email ??
      ""
  )
    .toLowerCase()
    .trim()
    .slice(0, 255);

  const nome: string = String(
    order.Customer?.full_name ??
      order.Customer?.first_name ??
      order.customer?.full_name ??
      order.customer?.first_name ??
      payload.Customer?.full_name ??
      ""
  ).slice(0, 100);

  const phone: string | null =
    order.Customer?.mobile ??
    order.Customer?.phone ??
    order.customer?.mobile ??
    payload.Customer?.mobile ??
    null;

  const productId: string | null =
    order.Product?.product_id ??
    order.product?.product_id ??
    payload.Product?.product_id ??
    null;

  const amountCents = toCents(
    order.Commissions?.charge_amount ??
      order.charge_amount ??
      payload.Commissions?.charge_amount ??
      payload.charge_amount ??
      null
  );

  const subscriberId: string | null =
    order.subscription_id ??
    order.subscription?.id ??
    payload.subscription?.id ??
    null;

  const renovacaoRaw: string | null =
    order.subscription?.next_payment ??
    order.subscription?.current_period_end ??
    payload.subscription?.current_period_end ??
    null;

  // O id do pedido do funil /limpeza pode chegar como external_reference ou
  // ecoado pela Kiwify nos TrackingParameters (s1, setado pelo roteador).
  const externalRef: string | null =
    order.external_reference ??
    order.externalReference ??
    payload.external_reference ??
    order.TrackingParameters?.s1 ??
    payload.TrackingParameters?.s1 ??
    request.nextUrl.searchParams.get("external_reference") ??
    null;

  if (!event || !orderId) {
    return NextResponse.json({ error: "Payload rejeitado" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const baseUrl = appBaseUrl(request);

  // ── 5. Idempotência (marcador único ANTES de processar) ──────────────────
  const claim = await claimKiwifyEvent(supabase, event, orderId, ipAddress);
  if (claim === "duplicate") {
    return NextResponse.json({ message: "Evento já processado" }, { status: 200 });
  }

  // ── 6. Processar evento ───────────────────────────────────────────────────
  switch (event) {
    case "order_approved": {
      if (!email || !EMAIL_RE.test(email)) {
        return NextResponse.json(
          { error: "E-mail do comprador ausente" },
          { status: 400 }
        );
      }

      try {
        // ── 6a-0. Trabalhos Espirituais (catálogo no banco) ─────────────────
        // Identificados EXCLUSIVAMENTE pelo kiwify_product_id gravado em
        // spiritual_services — nunca por valor (há três trabalhos de R$147).
        // Cliente compra → pedido `pago` → confirmação com orientações
        // (WhatsApp + e-mail) → operador notificado. A entrega é MANUAL.
        const spiritualService = await findServiceByKiwifyProductId(
          supabase,
          productId
        );
        if (spiritualService) {
          const resultado = await processarCompraServico(supabase, {
            service: spiritualService,
            kiwifyOrderId: orderId,
            email,
            nome: nome || null,
            phone,
            amountCents,
            baseUrl,
          });

          if (!resultado.ok) {
            await releaseKiwifyEvent(supabase, event, orderId);
            return NextResponse.json(
              { error: "Erro interno ao processar compra" },
              { status: 500 }
            );
          }

          await logAudit(supabase, {
            action: "KIWIFY_ORDER_APPROVED",
            ipAddress,
            metadata: {
              order_id: orderId,
              plan: `servico:${spiritualService.slug}`,
              service_order_id: resultado.orderId ?? null,
              duplicate: resultado.duplicate ?? false,
              emailDomain: email.split("@")[1] ?? "unknown",
            },
          });
          await sendAdminSaleNotification({
            plan: `servico:${spiritualService.slug}`,
            email,
            nome,
            amountCents,
            currency: "brl",
            provider: "kiwify",
          });
          return NextResponse.json({ ok: true, servico: spiritualService.slug });
        }

        // ── 6a. Resolver o produto comprado PRIMEIRO ────────────────────────
        // O external_reference só é honrado quando o produto pago É limpeza —
        // um UUID forjado anexado a outro produto não pode sequestrar a
        // entrega da limpeza nem pular o provisionamento do produto real.
        const planFromEnv = resolvePlanFromEnv(productId, "KIWIFY_PRODUCT");

        // ── 6a-1. GUARDA ANTI-COLISÃO DE PREÇO ─────────────────────────────
        // Os Trabalhos Espirituais são identificados só por kiwify_product_id
        // (três deles custam R$147 — valor nunca desambigua). Se o product_id
        // ainda não foi cadastrado em spiritual_services, o fallback por valor
        // abaixo classificaria a compra como outro produto: R$100 colide com
        // `limpeza` em AMOUNT_CENTS_TO_PLAN, e a cliente receberia a limpeza
        // automática gerada por IA em vez do ritual feito à mão — entregando
        // um "trabalho" que ninguém realizou.
        // Aqui paramos: registramos e avisamos o operador para cadastrar o
        // product_id e criar o pedido manualmente. 200 evita retry infinito.
        if (!planFromEnv && amountCents != null) {
          const { data: colisao } = await supabase
            .from("spiritual_services")
            .select("slug, nome")
            .eq("preco_centavos", amountCents)
            .limit(1)
            .maybeSingle();

          if (colisao) {
            await logAudit(supabase, {
              action: "KIWIFY_SERVICO_SEM_PRODUCT_ID",
              ipAddress,
              metadata: {
                order_id: orderId,
                product_id: productId,
                amount_cents: amountCents,
                possivel_servico: colisao.slug,
              },
            });
            await notifyOperator({
              assunto: `⚠️ Pedido não provisionado — ${colisao.nome}`,
              linhas: [
                `Chegou uma compra de ${(amountCents / 100).toFixed(2)} BRL, valor do trabalho "${colisao.nome}".`,
                `Mas o product_id da Kiwify (${productId ?? "não enviado"}) NÃO está cadastrado em spiritual_services.`,
                "",
                `Cliente: ${email}`,
                `Pedido Kiwify: ${orderId}`,
                "",
                "AÇÃO: cadastre o product_id na tabela spiritual_services (UPDATE ... WHERE slug='" +
                  colisao.slug +
                  "') e crie o pedido manualmente. Nada foi entregue à cliente.",
              ],
            });
            console.error(
              "[Kiwify] Trabalho Espiritual sem product_id cadastrado:",
              colisao.slug,
              amountCents
            );
            return NextResponse.json({ ok: true, unmapped: true });
          }
        }

        // ── 6a-2. VALOR AMBÍGUO ────────────────────────────────────────────
        // R$29,00 é ao mesmo tempo a renovação da assinatura `basic` e o
        // preço de `pergunta3`. Se o product_id não resolveu, NÃO chutamos:
        // entregar o produto errado aqui significa ou dar assinatura a quem
        // comprou 3 perguntas, ou dar créditos de chat a quem renovou o plano.
        if (!planFromEnv && amountCents != null && AMOUNT_AMBIGUO.has(amountCents)) {
          await logAudit(supabase, {
            action: "KIWIFY_VALOR_AMBIGUO",
            ipAddress,
            metadata: {
              order_id: orderId,
              product_id: productId,
              amount_cents: amountCents,
            },
          });
          await notifyOperator({
            assunto: "⚠️ Compra de R$29 sem product_id — não provisionada",
            linhas: [
              `Chegou uma compra de ${(amountCents / 100).toFixed(2)} BRL, que hoje pode ser`,
              "renovação do plano basic OU compra de 3 perguntas.",
              `O product_id (${productId ?? "não enviado"}) não bate com nenhum cadastrado.`,
              "",
              `Cliente: ${email}`,
              `Pedido Kiwify: ${orderId}`,
              "",
              "AÇÃO: confira na Kiwify qual produto foi vendido e ajuste as envs",
              "KIWIFY_PRODUCT_BASIC / KIWIFY_PRODUCT_PERGUNTA3. Nada foi entregue.",
            ],
          });
          console.error("[Kiwify] Valor ambíguo sem product_id:", amountCents);
          return NextResponse.json({ ok: true, ambiguous: true });
        }

        const planKey: PlanKey | null =
          planFromEnv ?? resolvePlanFromAmount(amountCents);

        // ── 6b. Limpeza vinda do funil /limpeza (external_reference UUID) ──
        if (planKey === "limpeza" && externalRef && UUID_RE.test(externalRef)) {
          const { data: limpezaOrder } = await supabase
            .from("limpeza_orders")
            .select("id, status")
            .eq("id", externalRef)
            .maybeSingle();

          if (limpezaOrder) {
            const wasAlreadyPaid = limpezaOrder.status === "paid";
            await supabase
              .from("limpeza_orders")
              .update({
                status: "paid",
                payment_provider: "kiwify",
                payment_id: orderId,
                amount_cents: amountCents,
                currency: "brl",
              })
              .eq("id", limpezaOrder.id);

            if (!wasAlreadyPaid) {
              await deliverLimpezaOrder(supabase, {
                orderId: limpezaOrder.id,
                baseUrl,
              });
            }

            await logAudit(supabase, {
              action: "KIWIFY_ORDER_APPROVED",
              ipAddress,
              metadata: {
                order_id: orderId,
                plan: "limpeza",
                limpeza_order_id: limpezaOrder.id,
                emailDomain: email.split("@")[1] ?? "unknown",
              },
            });
            await sendAdminSaleNotification({
              plan: "limpeza",
              email,
              nome,
              amountCents,
              currency: "brl",
              provider: "kiwify",
            });
            return NextResponse.json({ ok: true, plan: "limpeza" });
          }
        }

        if (!planKey) {
          // Produto desconhecido — registra para reconciliação manual e
          // responde 200 (a Kiwify não tem o que retentar aqui).
          await logAudit(supabase, {
            action: "KIWIFY_UNKNOWN_PRODUCT",
            ipAddress,
            metadata: {
              order_id: orderId,
              product_id: productId,
              amount_cents: amountCents,
            },
          });
          console.error("[Kiwify] Produto não mapeado:", productId, amountCents);
          return NextResponse.json({ ok: true, unmapped: true });
        }

        // ── 6c. Limpeza comprada DIRETO na Kiwify (sem passar pelo funil):
        // cria um pedido genérico e entrega mesmo assim.
        if (planKey === "limpeza") {
          const { data: createdOrder, error: orderErr } = await supabase
            .from("limpeza_orders")
            .insert({
              nome,
              email,
              phone,
              tema: "protecao_espiritual",
              pergunta: "",
              locale: "pt-BR",
              status: "paid",
              payment_provider: "kiwify",
              payment_id: orderId,
              amount_cents: amountCents,
              currency: "brl",
            })
            .select("id")
            .single();

          if (orderErr || !createdOrder) {
            console.error(
              "[Kiwify] Falha ao criar pedido de limpeza:",
              orderErr?.message
            );
            await releaseKiwifyEvent(supabase, event, orderId);
            return NextResponse.json(
              { error: "Erro interno ao processar compra" },
              { status: 500 }
            );
          }

          await deliverLimpezaOrder(supabase, {
            orderId: createdOrder.id,
            baseUrl,
          });

          await logAudit(supabase, {
            action: "KIWIFY_ORDER_APPROVED",
            ipAddress,
            metadata: {
              order_id: orderId,
              plan: "limpeza",
              limpeza_order_id: createdOrder.id,
              emailDomain: email.split("@")[1] ?? "unknown",
            },
          });
          await sendAdminSaleNotification({
            plan: "limpeza",
            email,
            nome,
            amountCents,
            currency: "brl",
            provider: "kiwify",
          });
          return NextResponse.json({ ok: true, plan: "limpeza" });
        }

        // ── 6d. Assinaturas e perguntas avulsas → conta + créditos ──────────
        const userId = await resolveUserId(supabase, email);
        if (!userId) {
          await releaseKiwifyEvent(supabase, event, orderId);
          return NextResponse.json(
            { error: "Erro interno ao processar compra" },
            { status: 500 }
          );
        }

        // Não sobrescrever um nome existente com vazio.
        const userRow: Record<string, unknown> = { id: userId, email };
        if (nome) userRow.nome = nome;
        await supabase.from("users").upsert(userRow, { onConflict: "id" });

        // Assinatura só para basic/premium.
        if (PLAN_CONFIG[planKey].isSubscription) {
          const renovacaoDate = renovacaoRaw ? new Date(renovacaoRaw) : null;
          const renovacaoEm =
            renovacaoDate && !isNaN(renovacaoDate.getTime())
              ? renovacaoDate.toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          await supabase.from("subscriptions").upsert(
            {
              user_id: userId,
              status: "active",
              kiwify_subscriber_id: subscriberId,
              kiwify_transaction_id: orderId,
              renovacao_em: renovacaoEm,
            },
            { onConflict: "kiwify_transaction_id" }
          );
        }

        const provision = await provisionPlan(supabase, userId, planKey, {
          locale: "pt-BR",
        });
        if (!provision.ok) {
          console.error("[Kiwify] provisionPlan falhou:", provision.errors);
          await releaseKiwifyEvent(supabase, event, orderId);
          return NextResponse.json(
            { error: "Erro interno ao provisionar" },
            { status: 500 }
          );
        }

        // E-mail de acesso com magic link (fail-soft).
        const accessEmail = await sendAccessEmail(supabase, {
          email,
          nome,
          locale: "pt-BR",
          baseUrl,
        });

        await logAudit(supabase, {
          userId,
          action: "KIWIFY_ORDER_APPROVED",
          ipAddress,
          metadata: {
            order_id: orderId,
            subscriberId,
            plan: planKey,
            access_email_sent: accessEmail.ok,
            emailDomain: email.split("@")[1] ?? "unknown",
          },
        });
        await sendAdminSaleNotification({
          plan: planKey,
          email,
          nome,
          amountCents,
          currency: "brl",
          provider: "kiwify",
        });
      } catch (err) {
        console.error(
          "[Kiwify] Erro inesperado ao processar order_approved",
          err instanceof Error ? err.message : ""
        );
        await releaseKiwifyEvent(supabase, event, orderId);
        return NextResponse.json(
          { error: "Erro interno ao processar compra" },
          { status: 500 }
        );
      }
      break;
    }

    // Assinatura atrasada (pagamento da renovação falhou): suspende o acesso
    // até a Kiwify confirmar a renovação (subscription_renewed reativa).
    case "subscription_late": {
      if (subscriberId) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("kiwify_subscriber_id", subscriberId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sub) {
          await supabase
            .from("subscriptions")
            .update({ status: "inactive" })
            .eq("user_id", sub.user_id);

          await logAudit(supabase, {
            userId: sub.user_id,
            action: "KIWIFY_SUBSCRIPTION_LATE",
            ipAddress,
            metadata: { order_id: orderId, subscriberId },
          });
        }
      }
      break;
    }

    case "subscription_canceled": {
      if (subscriberId) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("kiwify_subscriber_id", subscriberId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sub) {
          await supabase
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("user_id", sub.user_id);

          await logAudit(supabase, {
            userId: sub.user_id,
            action: "KIWIFY_SUBSCRIPTION_CANCELED",
            ipAddress,
            metadata: { order_id: orderId, subscriberId },
          });
        }
      }
      break;
    }

    // Reembolso e chargeback revogam da mesma forma.
    case "order_refunded":
    case "chargeback":
    case "order_chargedback": {
      // Revoga conforme o que foi entregue nesta transação.
      const { data: prior } = await supabase
        .from("audit_logs")
        .select("user_id, metadata")
        .eq("action", "KIWIFY_ORDER_APPROVED")
        .filter("metadata->order_id", "eq", `"${orderId}"`)
        .limit(1)
        .maybeSingle();

      const refundedPlan = (prior?.metadata as Record<string, unknown> | null)
        ?.plan as PlanKey | undefined;

      // Assinatura paga nesta transação → inativa.
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("kiwify_transaction_id", orderId)
        .maybeSingle();
      if (sub) {
        await supabase
          .from("subscriptions")
          .update({ status: "inactive" })
          .eq("kiwify_transaction_id", orderId);
      }

      // Créditos de chat avulsos → estorno atômico (sem ficar negativo).
      if (
        prior?.user_id &&
        refundedPlan &&
        PLAN_CONFIG[refundedPlan]?.chatCredits > 0
      ) {
        await supabase.rpc("revoke_chat_credits", {
          p_user_id: prior.user_id,
          p_amount: PLAN_CONFIG[refundedPlan].chatCredits,
        });
      }

      // Limpeza → marca o pedido como reembolsado.
      await supabase
        .from("limpeza_orders")
        .update({ status: "refunded" })
        .eq("payment_provider", "kiwify")
        .eq("payment_id", orderId);

      // Trabalho Espiritual → marca reembolsado e AVISA o operador
      // (para não realizar um ritual que foi estornado).
      const { data: refundedServiceOrder } = await supabase
        .from("service_orders")
        .select("id, cliente_email, spiritual_services(nome)")
        .eq("kiwify_order_id", orderId)
        .maybeSingle();
      if (refundedServiceOrder) {
        await supabase
          .from("service_orders")
          .update({
            status: "reembolsado",
            reembolsado_em: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", refundedServiceOrder.id);

        const servicoNome = servicoNomeDe(refundedServiceOrder.spiritual_services);
        const aviso = copyOperadorReembolso({
          servicoNome,
          clienteEmail: refundedServiceOrder.cliente_email,
          kiwifyOrderId: orderId,
        });
        await notifyOperator({ assunto: aviso.assunto, linhas: aviso.linhas });
      }

      await logAudit(supabase, {
        userId: prior?.user_id ?? sub?.user_id ?? null,
        action: `KIWIFY_${event.toUpperCase()}`,
        ipAddress,
        metadata: { order_id: orderId, plan: refundedPlan ?? null },
      });
      break;
    }

    // Renovação mensal da assinatura: reativa e reprovisiona as leituras
    // do plano vigente (equivalente ao invoice.payment_succeeded do Stripe).
    case "subscription_renewed": {
      if (subscriberId) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("kiwify_subscriber_id", subscriberId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sub) {
          const renovacaoDate = renovacaoRaw ? new Date(renovacaoRaw) : null;
          const renovacaoEm =
            renovacaoDate && !isNaN(renovacaoDate.getTime())
              ? renovacaoDate.toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          await supabase
            .from("subscriptions")
            .update({ status: "active", renovacao_em: renovacaoEm })
            .eq("user_id", sub.user_id);

          const { data: userRow } = await supabase
            .from("users")
            .select("plan")
            .eq("id", sub.user_id)
            .maybeSingle();
          const renewedPlan: PlanKey =
            userRow?.plan === "premium" ? "premium" : "basic";
          await provisionPlan(supabase, sub.user_id, renewedPlan);

          await logAudit(supabase, {
            userId: sub.user_id,
            action: "KIWIFY_SUBSCRIPTION_RENEWED",
            ipAddress,
            metadata: { order_id: orderId, subscriberId },
          });
        }
      }
      break;
    }

    case "subscription_reactivated": {
      if (subscriberId) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("user_id")
          .eq("kiwify_subscriber_id", subscriberId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sub) {
          const renovacaoDate = renovacaoRaw ? new Date(renovacaoRaw) : null;
          const renovacaoEm =
            renovacaoDate && !isNaN(renovacaoDate.getTime())
              ? renovacaoDate.toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          await supabase
            .from("subscriptions")
            .update({ status: "active", renovacao_em: renovacaoEm })
            .eq("user_id", sub.user_id);

          const { data: userRow } = await supabase
            .from("users")
            .select("plan")
            .eq("id", sub.user_id)
            .maybeSingle();
          const reactivatedPlan: PlanKey =
            userRow?.plan === "premium" ? "premium" : "basic";
          await provisionPlan(supabase, sub.user_id, reactivatedPlan);

          await logAudit(supabase, {
            userId: sub.user_id,
            action: "KIWIFY_SUBSCRIPTION_REACTIVATED",
            ipAddress,
            metadata: { order_id: orderId, subscriberId },
          });
        }
      }
      break;
    }

    default: {
      await logAudit(supabase, {
        action: "KIWIFY_EVENT_UNHANDLED",
        ipAddress,
        metadata: { webhook_event_type: event.slice(0, 64), order_id: orderId },
      });
      break;
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
