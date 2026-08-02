// ─── Webhook Z-API: mensagens RECEBIDAS no WhatsApp ──────────────────────────
// Configurar na Z-API (Instância → Webhooks → "Ao receber"):
//   https://<dominio>/api/webhooks/zapi?token=<ZAPI_INBOUND_TOKEN>
//
// Função: capturar a resposta do cliente de um Trabalho Espiritual (nome
// completo + intenção) e anexá-la ao pedido aberto mais recente daquele
// número, marcada como "aguardando revisão". O OPERADOR revisa e organiza
// no painel — a mensagem pode conter nome e intenção juntos, então NUNCA
// tentamos separar automaticamente.
//
// Mensagens de números sem pedido aberto são ignoradas (respondemos 200
// para a Z-API não retentar).

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { checkWebhookRateLimit } from "@/lib/ratelimit";
import { soDigitos } from "@/lib/spiritual-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128 * 1024;

// Compara tokens em tempo constante (evita oráculo de timing).
function tokenOk(received: string | null): boolean {
  const expected = process.env.ZAPI_INBOUND_TOKEN ?? "";
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Últimos 8 dígitos — tolera variações de formato do mesmo número
// (com/sem 55, com/sem o nono dígito).
function sufixo(phone: string): string {
  return phone.slice(-8);
}

export async function POST(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // ── 1. Rate limit ─────────────────────────────────────────────────────────
  const rl = await checkWebhookRateLimit(ipAddress);
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // ── 2. Autenticação por token compartilhado (query string) ────────────────
  // Fail-closed: sem ZAPI_INBOUND_TOKEN configurado, o endpoint não aceita nada.
  if (!tokenOk(request.nextUrl.searchParams.get("token"))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // ── 3. Corpo ──────────────────────────────────────────────────────────────
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  // ── 4. Filtrar o que não é mensagem de cliente ────────────────────────────
  // fromMe: mensagens enviadas por NÓS; isGroup/newsletter/status: ruído.
  if (
    payload.fromMe === true ||
    payload.isGroup === true ||
    payload.isNewsletter === true ||
    payload.isStatusReply === true
  ) {
    return NextResponse.json({ ok: true, ignored: "not_customer_message" });
  }

  // Instância errada (defesa extra além do token).
  const envInstance = process.env.ZAPI_INSTANCE_ID ?? "";
  if (
    envInstance &&
    typeof payload.instanceId === "string" &&
    payload.instanceId !== envInstance
  ) {
    return NextResponse.json({ ok: true, ignored: "wrong_instance" });
  }

  const phone = soDigitos(String(payload.phone ?? ""));
  if (phone.length < 8) {
    return NextResponse.json({ ok: true, ignored: "no_phone" });
  }

  // Texto da mensagem; áudio vira um marcador para o operador ouvir no
  // aparelho (público 60+ manda muita mensagem de voz).
  const text =
    typeof (payload.text as { message?: unknown } | undefined)?.message ===
    "string"
      ? ((payload.text as { message: string }).message ?? "").trim()
      : "";
  const temAudio = Boolean(payload.audio);
  const conteudo =
    text || (temAudio ? "[áudio recebido — ouvir no WhatsApp]" : "");

  if (!conteudo) {
    return NextResponse.json({ ok: true, ignored: "empty_message" });
  }

  // ── 5. Localizar o pedido aberto mais recente deste número ────────────────
  // Aberto = status pago/em_preparacao e SEM intenção confirmada pelo operador.
  const supabase = createServiceSupabaseClient();
  const { data: candidatos } = await supabase
    .from("service_orders")
    .select("id, cliente_whatsapp, intencao_bruta, created_at")
    .in("status", ["pago", "em_preparacao"])
    .is("intencao", null)
    .not("cliente_whatsapp", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const alvo = (candidatos ?? []).find(
    (o) => sufixo(soDigitos(o.cliente_whatsapp ?? "")) === sufixo(phone)
  );

  if (!alvo) {
    // Número sem pedido aberto — ignorar silenciosamente.
    return NextResponse.json({ ok: true, ignored: "no_open_order" });
  }

  // ── 6. Anexar como intenção pendente (aguardando revisão) ─────────────────
  // Mensagens sucessivas são ACUMULADAS (cliente costuma mandar nome e
  // intenção em mensagens separadas). O operador vê o texto bruto completo.
  const anterior = (alvo.intencao_bruta ?? "").trim();
  const novoBruto = (anterior ? `${anterior}\n` : "") + conteudo;

  await supabase
    .from("service_orders")
    .update({
      intencao_bruta: novoBruto.slice(0, 8000),
      intencao_aguardando_revisao: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", alvo.id);

  return NextResponse.json({ ok: true, captured: true });
}
