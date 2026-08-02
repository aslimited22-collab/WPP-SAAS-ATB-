// ─── POST /api/admin/pedidos/[id]/lembrete ───────────────────────────────────
// Disparo MANUAL (pelo painel) do lembrete de dados pendentes — cliente que
// não preencheu nome completo/intenção no link do pedido.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { sendServicoLembreteEmail } from "@/lib/email";
import { pedidoUrl, servicoNomeDe } from "@/lib/spiritual-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function appBaseUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  ).replace(/\/$/, "");
}

export async function POST(
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

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("service_orders")
    .select(
      "id, status, cliente_nome, cliente_email, access_token, spiritual_services(nome)"
    )
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

  const enviado = await sendServicoLembreteEmail({
    email: order.cliente_email,
    nome: order.cliente_nome,
    servicoNome: servicoNomeDe(order.spiritual_services),
    pedidoUrl: pedidoUrl(appBaseUrl(request), order.access_token as string),
  });

  if (!enviado.ok) {
    return NextResponse.json(
      { error: `Falha ao enviar o lembrete (${enviado.reason ?? "erro"}).` },
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
