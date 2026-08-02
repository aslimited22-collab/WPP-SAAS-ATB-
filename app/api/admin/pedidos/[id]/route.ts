// ─── PATCH /api/admin/pedidos/[id] ───────────────────────────────────────────
// A entrega é automática — este endpoint existe para os casos em que ela
// falhou ou em que a cliente pediu ajuste:
//   • corrigir nome_completo_ritual / intencao;
//   • REPROCESSAR a geração (acao: "reprocessar") de um pedido que ficou em
//     'falhou' ou 'pago' com os dados já preenchidos.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { entregarTrabalho } from "@/lib/spiritual-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function appBaseUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  ).replace(/\/$/, "");
}

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
    acao?: unknown;
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

  // ── Edição dos dados ──────────────────────────────────────────────────────
  const patch: Record<string, unknown> = {};
  if (typeof body.nome_completo_ritual === "string") {
    patch.nome_completo_ritual =
      body.nome_completo_ritual.trim().slice(0, 200) || null;
  }
  if (typeof body.intencao === "string") {
    patch.intencao = body.intencao.trim().slice(0, 4000) || null;
  }

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from("service_orders")
      .update(patch)
      .eq("id", id);
    if (error) {
      console.error("[Admin] Falha ao atualizar pedido:", error.message);
      return NextResponse.json({ error: "Erro ao salvar" }, { status: 500 });
    }
  }

  // ── Reprocessar a geração ─────────────────────────────────────────────────
  if (body.acao === "reprocessar") {
    if (order.status === "reembolsado") {
      return NextResponse.json(
        { error: "Pedido reembolsado — não reprocessar." },
        { status: 422 }
      );
    }
    const r = await entregarTrabalho(supabase, {
      orderId: id,
      baseUrl: appBaseUrl(request),
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `Não foi possível gerar: ${r.erro ?? "erro desconhecido"}` },
        { status: 502 }
      );
    }
    return NextResponse.json({
      ok: true,
      jaEntregue: r.jaEntregue ?? false,
      imagem: r.imagem,
      email: r.email,
    });
  }

  return NextResponse.json({ ok: true });
}
