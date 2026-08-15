// ─── POST /api/numerologia/dados ─────────────────────────────────────────────
// A cliente preenche nome completo + data de nascimento depois de pagar.
// Grava no pedido e dispara a entrega (geração DeepSeek + PDF + e-mail com
// anexo) NA HORA, aguardando o resultado.
//
// Endpoint público (pós-compra por access_token UUID) — defesas: rate limit
// por IP, cap de body, validação zod (lib/validators.ts).
//
// Trava de sobrescrita: depois que o mapa foi GERADO, os dados não mudam mais
// — um re-POST (link antigo, curioso com o UUID) trocaria nome/nascimento e o
// PDF regenerado no download divergiria do mapa entregue. Quem precisar
// corrigir dados usa o suporte (admin regenera).

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { numerologiaDadosSchema } from "@/lib/validators";
import { deliverNumerologiaOrder } from "@/lib/numerologia-delivery";
import { sendOperadorEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Geração por IA + PDF + e-mail dentro da request — precisa de folga.
export const maxDuration = 120;

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rl = await checkRateLimit(`numerologia_dados:${ipAddress}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um instante." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Requisição inválida." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = numerologiaDadosSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("numerologia_orders")
    .select("id, status, email")
    .eq("access_token", parsed.data.token)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (order.status !== "paid") {
    return NextResponse.json(
      { error: "O pagamento deste pedido ainda não foi confirmado." },
      { status: 409 }
    );
  }

  // Trava de sobrescrita (ver comentário no topo).
  const { data: existing } = await supabase
    .from("numerologia_readings")
    .select("generation_status")
    .eq("order_id", order.id)
    .maybeSingle();
  if (existing?.generation_status === "completed") {
    return NextResponse.json({ ok: true, delivered: true, already: true });
  }

  const { error: updErr } = await supabase
    .from("numerologia_orders")
    .update({
      name: parsed.data.full_name,
      birth_date: parsed.data.birth_date,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  if (updErr) {
    console.error("[Numerologia] Falha ao salvar dados:", updErr.message);
    return NextResponse.json(
      { error: "Não conseguimos salvar. Tente de novo." },
      { status: 500 }
    );
  }

  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  ).replace(/\/$/, "");

  // Entrega na hora (geração + PDF + e-mail). Fail-soft: se falhar, o pedido
  // fica delivery_status=failed e o admin pode reentregar; a cliente vê a
  // mensagem de "chega em até 24h" de qualquer forma.
  const result = await deliverNumerologiaOrder(supabase, {
    orderId: order.id,
    baseUrl,
  }).catch((err) => {
    console.error(
      "[Numerologia] Entrega lançou exceção:",
      err instanceof Error ? err.message : ""
    );
    return null;
  });

  // Falha de geração/entrega NÃO pode ser beco sem saída: avisa o operador
  // pra reprocessar (mesmo padrão do POST /api/pedido/[token]). A resposta à
  // cliente continua fail-soft — ela já viu o "chega em até 24h".
  // "in_progress"/"pending" não alarmam: outro processo está entregando.
  if (result === null || result.finalDeliveryStatus === "failed") {
    await sendOperadorEmail({
      assunto: "⚠️ Falha na entrega — Numerologia R$45",
      linhas: [
        `Pedido: ${order.id}`,
        `Cliente: ${order.email}`,
        `Motivo: ${result?.error ?? "exceção na entrega (ver logs)"}`,
        "Os dados da cliente estão salvos. Reprocesse a entrega manualmente.",
      ],
    }).catch(() => {
      // Aviso é best-effort: falha dele não muda a resposta à cliente.
    });
  }

  return NextResponse.json({
    ok: true,
    delivered: result?.email === "sent",
  });
}
