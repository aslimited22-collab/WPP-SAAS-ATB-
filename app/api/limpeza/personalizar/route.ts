// ─── POST /api/limpeza/personalizar ──────────────────────────────────────────
// O cliente que comprou DIRETO na Kiwify (sem passar pelo funil /limpeza)
// não informou tema, situação nem signo — a leitura sai genérica.
// Aqui ele completa os dados pela própria página de entrega e a leitura é
// REGERADA, agora personalizada.
//
// Credencial: o UUID do pedido (mesmo modelo da página /entrega/[orderId]).
// Só funciona em pedidos PAGOS e enquanto o cliente não personalizou ainda.

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { limpezaPersonalizarSchema } from "@/lib/validators";
import { normalizeLocale } from "@/lib/locale";
import {
  generateLimpezaReading,
  type LimpezaTheme,
  type LimpezaSign,
} from "@/lib/limpeza";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Regerar a leitura chama a IA — precisa de folga.
export const maxDuration = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rl = await checkRateLimit(`limpeza_personalizar:${ipAddress}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Muitas solicitações. Tente novamente em instantes." },
      { status: 429 }
    );
  }

  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Texto muito longo." }, { status: 413 });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Texto muito longo." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = limpezaPersonalizarSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const { orderId, tema, pergunta, signo } = parsed.data;
  if (!UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("limpeza_orders")
    .select("id, nome, status, locale, pergunta")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "Este pedido ainda não está confirmado." },
      { status: 409 }
    );
  }
  // Uma personalização por pedido: evita regerar a leitura em looping
  // (cada regeração é uma chamada paga de IA).
  if ((order.pergunta ?? "").trim()) {
    return NextResponse.json(
      { error: "Sua limpeza já foi personalizada." },
      { status: 409 }
    );
  }

  const locale = normalizeLocale(order.locale);

  // Gera a leitura ANTES de gravar: se a IA falhar, o pedido continua com a
  // leitura anterior e o cliente pode tentar de novo.
  let reading: Awaited<ReturnType<typeof generateLimpezaReading>>;
  try {
    reading = await generateLimpezaReading({
      nome: order.nome ?? "",
      tema: tema as LimpezaTheme,
      signo: (signo as LimpezaSign | null) ?? null,
      pergunta,
      locale,
    });
  } catch (err) {
    console.error(
      "[Limpeza] Falha ao personalizar:",
      err instanceof Error ? err.message : ""
    );
    return NextResponse.json(
      { error: "Não consegui preparar agora. Tente novamente em instantes." },
      { status: 502 }
    );
  }

  await supabase
    .from("limpeza_orders")
    .update({
      tema,
      pergunta,
      signo: signo ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  // Substitui a leitura anterior (genérica) pela personalizada.
  await supabase.from("limpeza_readings").upsert(
    {
      order_id: order.id,
      full_json: reading.json,
      full_text: reading.text,
    },
    { onConflict: "order_id" }
  );

  return NextResponse.json({ ok: true });
}
