// ─── /admin/pedidos/[id] — detalhe do pedido ─────────────────────────────────
// A entrega é automática; o painel acompanha e permite agir quando falha.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { servicoNomeDe } from "@/lib/spiritual-services";
import PedidoDetailClient, { type PedidoData } from "./PedidoDetailClient";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdminPedidoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getAdminUser();
  if (!admin) notFound();

  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("service_orders")
    .select(
      "id, status, cliente_nome, cliente_email, cliente_telefone, access_token, nome_completo_ritual, intencao, form_respondido_em, leitura_json, kiwify_order_id, amount_cents, pago_em, entregue_em, reembolsado_em, lembrete_enviado_em, confirmacao_email_ok, created_at, spiritual_services(nome, slug)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const { data: deliverables } = await supabase
    .from("service_deliverables")
    .select("tipo")
    .eq("order_id", id);

  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  const pedido: PedidoData = {
    id: order.id,
    status: order.status,
    servicoNome: servicoNomeDe(order.spiritual_services),
    clienteNome: order.cliente_nome,
    clienteEmail: order.cliente_email,
    clienteTelefone: order.cliente_telefone,
    pedidoUrl: `${baseUrl}/pedido/${order.access_token}`,
    nomeCompletoRitual: order.nome_completo_ritual,
    intencao: order.intencao,
    formRespondidoEm: order.form_respondido_em,
    kiwifyOrderId: order.kiwify_order_id,
    amountCents: order.amount_cents,
    pagoEm: order.pago_em,
    entregueEm: order.entregue_em,
    reembolsadoEm: order.reembolsado_em,
    lembreteEnviadoEm: order.lembrete_enviado_em,
    confirmacaoEmailOk: order.confirmacao_email_ok,
    createdAt: order.created_at,
    temLeitura: Boolean(order.leitura_json),
    temImagem: (deliverables ?? []).some((d) => d.tipo === "foto"),
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] px-6 py-10">
      <div className="max-w-4xl mx-auto">
        <nav className="mb-6">
          <Link
            href="/admin/pedidos"
            className="text-[#888] hover:text-[#c9a84c] text-sm"
          >
            ← Todos os pedidos
          </Link>
        </nav>
        <PedidoDetailClient pedido={pedido} />
      </div>
    </main>
  );
}
