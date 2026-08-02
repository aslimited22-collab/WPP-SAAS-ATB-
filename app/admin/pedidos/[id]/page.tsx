// ─── /admin/pedidos/[id] — detalhe do pedido (operador) ──────────────────────
// Server Component: carrega pedido + registros (com signed URLs de preview
// do bucket privado) e delega ações ao client component.

import { notFound } from "next/navigation";
import Link from "next/link";
import { getAdminUser } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase";
import PedidoDetailClient, { type PedidoData } from "./PedidoDetailClient";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREVIEW_URL_SECONDS = 60 * 60; // 1h — só para o operador visualizar

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
      "id, status, cliente_nome, cliente_email, cliente_whatsapp, nome_completo_ritual, intencao, intencao_bruta, intencao_aguardando_revisao, kiwify_order_id, amount_cents, pago_em, em_preparacao_em, ritual_realizado_em, entregue_em, reembolsado_em, lembrete_enviado_em, confirmacao_whatsapp_ok, confirmacao_email_ok, created_at, spiritual_services(nome, slug)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  const { data: deliverables } = await supabase
    .from("service_deliverables")
    .select("id, tipo, storage_path, conteudo_texto, enviado_em, created_at")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  // Signed URLs de preview (o bucket é privado).
  const previews: Record<string, string> = {};
  for (const d of deliverables ?? []) {
    if (d.storage_path) {
      const { data: signed } = await supabase.storage
        .from("service-deliverables")
        .createSignedUrl(d.storage_path, PREVIEW_URL_SECONDS);
      if (signed?.signedUrl) previews[d.id] = signed.signedUrl;
    }
  }

  const service = order.spiritual_services as {
    nome?: string;
    slug?: string;
  } | null;

  const pedido: PedidoData = {
    id: order.id,
    status: order.status,
    servicoNome: service?.nome ?? "Trabalho Espiritual",
    clienteNome: order.cliente_nome,
    clienteEmail: order.cliente_email,
    clienteWhatsapp: order.cliente_whatsapp,
    nomeCompletoRitual: order.nome_completo_ritual,
    intencao: order.intencao,
    intencaoBruta: order.intencao_bruta,
    intencaoAguardandoRevisao: order.intencao_aguardando_revisao,
    kiwifyOrderId: order.kiwify_order_id,
    amountCents: order.amount_cents,
    pagoEm: order.pago_em,
    emPreparacaoEm: order.em_preparacao_em,
    ritualRealizadoEm: order.ritual_realizado_em,
    entregueEm: order.entregue_em,
    reembolsadoEm: order.reembolsado_em,
    lembreteEnviadoEm: order.lembrete_enviado_em,
    confirmacaoWhatsappOk: order.confirmacao_whatsapp_ok,
    confirmacaoEmailOk: order.confirmacao_email_ok,
    createdAt: order.created_at,
    deliverables: (deliverables ?? []).map((d) => ({
      id: d.id,
      tipo: d.tipo,
      enviadoEm: d.enviado_em,
      previewUrl: previews[d.id] ?? null,
      conteudoTexto: d.conteudo_texto,
    })),
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
