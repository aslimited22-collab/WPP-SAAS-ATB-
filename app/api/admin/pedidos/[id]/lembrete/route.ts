// ─── POST /api/admin/pedidos/[id]/lembrete ───────────────────────────────────
// Disparo MANUAL (pelo painel) do lembrete de dados pendentes — cliente que
// não respondeu com nome completo/intenção em ~24h.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { sendWhatsApp } from "@/lib/zapi";
import { mensagemLembreteDados } from "@/content/mensagens-servicos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
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

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("service_orders")
    .select("id, status, cliente_nome, cliente_whatsapp, spiritual_services(nome)")
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  if (order.status !== "pago" && order.status !== "em_preparacao") {
    return NextResponse.json(
      { error: "Lembrete só se aplica a pedidos pagos/em preparação." },
      { status: 422 }
    );
  }
  if (!order.cliente_whatsapp) {
    return NextResponse.json(
      { error: "Pedido sem WhatsApp cadastrado." },
      { status: 422 }
    );
  }

  const servicoNome =
    (order.spiritual_services as { nome?: string } | null)?.nome ??
    "Trabalho Espiritual";

  const r = await sendWhatsApp(
    order.cliente_whatsapp,
    mensagemLembreteDados({ nome: order.cliente_nome, servicoNome }),
    { humanTyping: false }
  );
  if (!r.success) {
    return NextResponse.json(
      { error: `Falha ao enviar lembrete: ${r.error ?? "Z-API"}` },
      { status: 502 }
    );
  }

  await supabase
    .from("service_orders")
    .update({
      lembrete_enviado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}
