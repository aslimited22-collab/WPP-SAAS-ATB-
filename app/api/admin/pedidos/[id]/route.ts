// ─── PATCH /api/admin/pedidos/[id] ───────────────────────────────────────────
// Edição do pedido pelo OPERADOR: nome_completo_ritual, intencao (confirmação
// do texto bruto do WhatsApp) e transições de status manuais.
//
// Transições permitidas aqui (sempre para frente):
//   pago → em_preparacao → ritual_realizado
// `entregue` SÓ via /entregar (envia o registro junto) e `reembolsado` SÓ
// via webhook da Kiwify. `ritual_realizado` é a marcação MANUAL exigida pelo
// modelo de entrega — nada afirma ritual feito antes dela.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TRANSICOES: Record<string, string[]> = {
  pago: ["em_preparacao"],
  em_preparacao: ["ritual_realizado"],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  let body: {
    nome_completo_ritual?: unknown;
    intencao?: unknown;
    status?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("service_orders")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.nome_completo_ritual === "string") {
    patch.nome_completo_ritual = body.nome_completo_ritual.trim().slice(0, 200) || null;
  }

  if (typeof body.intencao === "string") {
    patch.intencao = body.intencao.trim().slice(0, 4000) || null;
    // Operador organizou o texto bruto — some o aviso de revisão pendente.
    if (patch.intencao) patch.intencao_aguardando_revisao = false;
  }

  if (typeof body.status === "string") {
    const destino = body.status;
    const permitidos = TRANSICOES[order.status] ?? [];
    if (!permitidos.includes(destino)) {
      return NextResponse.json(
        {
          error: `Transição de status inválida: ${order.status} → ${destino}`,
        },
        { status: 422 }
      );
    }
    patch.status = destino;
    if (destino === "em_preparacao") patch.em_preparacao_em = new Date().toISOString();
    if (destino === "ritual_realizado")
      patch.ritual_realizado_em = new Date().toISOString();
  }

  const { error } = await supabase
    .from("service_orders")
    .update(patch)
    .eq("id", id);
  if (error) {
    console.error("[Admin] Falha ao atualizar pedido:", error.message);
    return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
