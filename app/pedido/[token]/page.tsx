// ─── /pedido/[token] — página única do cliente ───────────────────────────────
// UM link para a jornada inteira (ideal para o público 60+: nada de app,
// nada de login, sempre o mesmo endereço):
//   • ainda não preencheu  → formulário (nome completo + intenção)
//   • preencheu, sem entrega → status "ritual será realizado em até 48h úteis"
//   • entregue              → registro do ritual (foto/áudio) + orientações
//   • reembolsado           → aviso neutro
//
// Pública: o access_token (UUID v4) é a credencial. A página é renderizada
// no servidor com a service key; o cliente nunca fala com o banco.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { servicoNomeDe } from "@/lib/spiritual-services";
import PedidoClient, { type PedidoPublico } from "./PedidoClient";

export const dynamic = "force-dynamic";

// Página privada por natureza — não deve ser indexada.
export const metadata: Metadata = {
  title: "Meu trabalho espiritual | ATB",
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Validade das URLs assinadas do registro (bucket privado).
const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;

export default async function PedidoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("service_orders")
    .select(
      "id, status, cliente_nome, nome_completo_ritual, intencao, form_respondido_em, spiritual_services(nome, slug)"
    )
    .eq("access_token", token)
    .maybeSingle();

  if (!order) notFound();

  // Registros só são expostos depois da entrega — antes disso o cliente não
  // vê nada, mesmo que o operador já tenha anexado arquivos.
  const registros: PedidoPublico["registros"] = [];
  if (order.status === "entregue") {
    const { data: deliverables } = await supabase
      .from("service_deliverables")
      .select("id, tipo, storage_path, conteudo_texto")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    for (const d of deliverables ?? []) {
      let url: string | null = null;
      if (d.storage_path) {
        const { data: signed } = await supabase.storage
          .from("service-deliverables")
          .createSignedUrl(d.storage_path, SIGNED_URL_SECONDS);
        url = signed?.signedUrl ?? null;
      }
      registros.push({
        id: d.id,
        tipo: d.tipo as "foto" | "audio" | "mensagem",
        url,
        texto: d.conteudo_texto,
      });
    }
  }

  const pedido: PedidoPublico = {
    token,
    status: order.status,
    servicoNome: servicoNomeDe(order.spiritual_services),
    clienteNome: order.cliente_nome,
    nomeCompletoRitual: order.nome_completo_ritual,
    intencao: order.intencao,
    respondido: Boolean(order.form_respondido_em),
    registros,
  };

  return <PedidoClient pedido={pedido} />;
}
