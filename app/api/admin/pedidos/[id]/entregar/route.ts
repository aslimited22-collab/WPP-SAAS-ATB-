// ─── POST /api/admin/pedidos/[id]/entregar ───────────────────────────────────
// "Realizar entrega": envia ao cliente o e-mail de encerramento apontando
// para o link único do pedido (/pedido/<access_token>), onde o registro do
// ritual (foto/áudio) passa a aparecer, e marca o pedido como `entregue`.
//
// Guarda-corpo do modelo de entrega: só entrega pedidos já marcados
// MANUALMENTE como `ritual_realizado` pelo operador.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { sendServicoEntregaEmail } from "@/lib/email";
import { pedidoUrl, servicoNomeDe } from "@/lib/spiritual-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
      "id, status, cliente_nome, cliente_email, nome_completo_ritual, access_token, spiritual_services(nome)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  if (order.status !== "ritual_realizado") {
    return NextResponse.json(
      {
        error:
          "Só é possível entregar depois de marcar o ritual como realizado (status ritual_realizado).",
      },
      { status: 422 }
    );
  }

  // O registro precisa existir — é o que o cliente vai ver na página.
  const { data: deliverables } = await supabase
    .from("service_deliverables")
    .select("id")
    .eq("order_id", id);

  if (!deliverables || deliverables.length === 0) {
    return NextResponse.json(
      { error: "Nenhum registro anexado — envie a foto/áudio do ritual antes." },
      { status: 422 }
    );
  }

  const servicoNome = servicoNomeDe(order.spiritual_services);
  const link = pedidoUrl(appBaseUrl(request), order.access_token as string);

  const enviado = await sendServicoEntregaEmail({
    email: order.cliente_email,
    nome: order.nome_completo_ritual ?? order.cliente_nome,
    servicoNome,
    pedidoUrl: link,
  });

  if (!enviado.ok) {
    // Não marca entregue se o e-mail não saiu — o operador tenta de novo.
    return NextResponse.json(
      { error: `Falha ao enviar o e-mail de entrega (${enviado.reason ?? "erro"}).` },
      { status: 502 }
    );
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("service_deliverables")
    .update({ enviado_em: nowIso })
    .eq("order_id", id)
    .is("enviado_em", null);

  await supabase
    .from("service_orders")
    .update({ status: "entregue", entregue_em: nowIso, updated_at: nowIso })
    .eq("id", id);

  return NextResponse.json({ ok: true, registros: deliverables.length });
}
