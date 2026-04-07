import { createHmac, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { checkWebhookRateLimit } from "@/lib/ratelimit";
import { kiwifyWebhookSchema } from "@/lib/validators";

const KIWIFY_WEBHOOK_TOKEN = process.env.KIWIFY_WEBHOOK_TOKEN ?? "";
const CREDITS_PER_MONTH = 5;

// Limite de tamanho do corpo: 64 KB (payloads legítimos da Kiwify são <5 KB)
const MAX_BODY_BYTES = 64 * 1024;

// ─── Comparação timing-safe para strings de tamanho variável ─────────────────
// Preenche ambos os buffers para o mesmo tamanho antes de comparar,
// evitando que diferenças de comprimento vazem via timing.
function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  const maxLen = Math.max(aBuf.length, bBuf.length);
  const aPadded = Buffer.alloc(maxLen);
  const bPadded = Buffer.alloc(maxLen);
  aBuf.copy(aPadded);
  bBuf.copy(bPadded);
  // timingSafeEqual garante tempo constante; &&-length evita false-positive em strings de tamanhos diferentes
  return (
    timingSafeEqual(aPadded, bPadded) && aBuf.length === bBuf.length
  );
}

// ─── Validação de assinatura Kiwify ──────────────────────────────────────────
// 1. token no payload deve bater com KIWIFY_WEBHOOK_TOKEN (timing-safe)
// 2. Signature = HMAC-SHA256(KIWIFY_WEBHOOK_TOKEN, order_id)  (timing-safe)
function verifyKiwifySignature(
  orderId: string,
  receivedToken: string,
  receivedSignature: string
): boolean {
  if (!KIWIFY_WEBHOOK_TOKEN) return false;

  // Ambas as comparações são timing-safe para evitar oráculos de timing
  const tokenOk = timingSafeStringEqual(receivedToken, KIWIFY_WEBHOOK_TOKEN);

  const expected = createHmac("sha256", KIWIFY_WEBHOOK_TOKEN)
    .update(orderId)
    .digest("hex");

  let hmacOk = false;
  try {
    hmacOk = timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(receivedSignature, "hex")
    );
  } catch {
    // Buffer.from com hex inválido lança — já tratado pelo schema Zod (regex /^[a-f0-9]+$/)
    return false;
  }

  return tokenOk && hmacOk;
}

// ─── Idempotência via audit_logs ──────────────────────────────────────────────
// Registra o par (event_type, order_id) como processado. Retorna true se
// o evento JÁ foi processado antes (e portanto deve ser ignorado).
async function isAlreadyProcessed(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  eventType: string,
  orderId: string
): Promise<boolean> {
  const action = `KIWIFY_${eventType.toUpperCase()}`;
  const { data } = await supabase
    .from("audit_logs")
    .select("id")
    .eq("action", action)
    .filter("metadata->order_id", "eq", `"${orderId}"`)
    .limit(1)
    .single();
  return !!data;
}

async function logAudit(
  supabase: ReturnType<typeof createServiceSupabaseClient>,
  params: {
    userId?: string;
    action: string;
    ipAddress?: string;
    metadata?: Record<string, unknown>;
  }
) {
  await supabase.from("audit_logs").insert({
    user_id: params.userId ?? null,
    action: params.action,
    ip_address: params.ipAddress ?? null,
    metadata: params.metadata ?? null,
  });
}

// Desabilitar o body parser padrão do Next.js para ler o raw body manualmente
export const config = { api: { bodyParser: false } };

export async function POST(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

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

  // ── 2. Verificar Content-Type ─────────────────────────────────────────────
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json({ error: "Content-Type inválido" }, { status: 415 });
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

  // ── 4. Parsear JSON ───────────────────────────────────────────────────────
  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  // ── 5. Validar estrutura com Zod (inclui sanitização de comprimentos) ─────
  const parsed = kiwifyWebhookSchema.safeParse(body);
  if (!parsed.success) {
    // Não retornar detalhes do erro de validação para não vazar info estrutural
    return NextResponse.json(
      { error: "Payload rejeitado" },
      { status: 400 }
    );
  }

  const {
    webhook_event_type,
    order_id,
    token,
    Signature,
    customer,
    subscription,
  } = parsed.data;

  // ── 6. Validar assinatura HMAC (timing-safe em ambas as comparações) ──────
  if (!verifyKiwifySignature(order_id, token, Signature)) {
    // Log silencioso — não informar ao caller o motivo exato
    console.warn("[Kiwify] Assinatura inválida de IP:", ipAddress);
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401 }
    );
  }

  const email = customer?.email;
  const nome = customer?.name ?? "";
  const transactionId = order_id;
  const subscriberId = subscription?.id ?? null;

  const supabase = createServiceSupabaseClient();

  // ── 7. Idempotência universal (cobre TODOS os eventos) ────────────────────
  const alreadyDone = await isAlreadyProcessed(
    supabase,
    webhook_event_type,
    transactionId
  );
  if (alreadyDone) {
    return NextResponse.json({ message: "Evento já processado" }, { status: 200 });
  }

  // ── 8. Processar evento ───────────────────────────────────────────────────
  switch (webhook_event_type) {
    case "order_approved": {
      if (!email) {
        return NextResponse.json(
          { error: "E-mail do comprador ausente" },
          { status: 400 }
        );
      }

      let userId: string;
      const { data: authUser } =
        await supabase.auth.admin.getUserByEmail(email);

      if (authUser?.user) {
        userId = authUser.user.id;
      } else {
        const { data: newUser, error: createError } =
          await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
          });
        if (createError || !newUser.user) {
          // Log interno sem detalhes do erro para não expor stack traces
          console.error("[Kiwify] Falha ao criar usuário no Supabase Auth");
          return NextResponse.json(
            { error: "Erro interno ao processar compra" },
            { status: 500 }
          );
        }
        userId = newUser.user.id;
      }

      await supabase.from("users").upsert(
        { id: userId, email, nome: nome.slice(0, 100) },
        { onConflict: "id" }
      );

      // Validar data de renovação antes de usar (vem do payload externo)
      const rawRenovacao = subscription?.current_period_end;
      const renovacaoDate = rawRenovacao ? new Date(rawRenovacao) : null;
      const renovacaoEm =
        renovacaoDate && !isNaN(renovacaoDate.getTime())
          ? renovacaoDate.toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          status: "active",
          kiwify_subscriber_id: subscriberId,
          kiwify_transaction_id: transactionId,
          renovacao_em: renovacaoEm,
        },
        { onConflict: "kiwify_transaction_id" }
      );

      const mesReferencia = new Date().toISOString().slice(0, 7);
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
        action: "KIWIFY_ORDER_APPROVED",
        ipAddress,
        // Não logar email completo — apenas domínio para diagnóstico
        metadata: {
          order_id: transactionId,
          subscriberId,
          emailDomain: email.split("@")[1] ?? "unknown",
        },
      });
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
          .single();

        if (sub) {
          await supabase
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("user_id", sub.user_id);

          await logAudit(supabase, {
            userId: sub.user_id,
            action: "KIWIFY_SUBSCRIPTION_CANCELED",
            ipAddress,
            metadata: { order_id: transactionId, subscriberId },
          });
        }
      }
      break;
    }

    case "order_refunded": {
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("user_id")
        .eq("kiwify_transaction_id", transactionId)
        .single();

      if (sub) {
        await supabase
          .from("subscriptions")
          .update({ status: "inactive" })
          .eq("user_id", sub.user_id);

        await logAudit(supabase, {
          userId: sub.user_id,
          action: "KIWIFY_ORDER_REFUNDED",
          ipAddress,
          metadata: { order_id: transactionId },
        });
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
          .single();

        if (sub) {
          const rawRenovacao = subscription?.current_period_end;
          const renovacaoDate = rawRenovacao ? new Date(rawRenovacao) : null;
          const renovacaoEm =
            renovacaoDate && !isNaN(renovacaoDate.getTime())
              ? renovacaoDate.toISOString()
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

          await supabase
            .from("subscriptions")
            .update({ status: "active", renovacao_em: renovacaoEm })
            .eq("user_id", sub.user_id);

          const mesReferencia = new Date().toISOString().slice(0, 7);
          await supabase
            .from("credits")
            .update({
              leituras_restantes: CREDITS_PER_MONTH,
              mes_referencia: mesReferencia,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", sub.user_id);

          await logAudit(supabase, {
            userId: sub.user_id,
            action: "KIWIFY_SUBSCRIPTION_REACTIVATED",
            ipAddress,
            metadata: { order_id: transactionId, subscriberId },
          });
        }
      }
      break;
    }

    default: {
      // Evento não mapeado — logar e retornar 200 para Kiwify não retentar.
      // webhook_event_type já foi validado pelo schema (regex /^[a-z_]+$/)
      // então é seguro usar em strings de log.
      await logAudit(supabase, {
        action: `KIWIFY_EVENT_UNHANDLED`,
        ipAddress,
        metadata: { webhook_event_type, order_id: transactionId },
      });
      break;
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}
