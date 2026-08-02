// ─── /pedido/[token] — página única do cliente ───────────────────────────────
// UM link para a jornada inteira (ideal para o público 60+: nada de app,
// nada de login, sempre o mesmo endereço):
//   • ainda não preencheu → formulário (nome completo + intenção)
//   • entregue            → a leitura e a imagem espiritual dela
//   • falhou              → convite a tentar de novo
//   • reembolsado         → aviso neutro
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
      "id, status, cliente_nome, nome_completo_ritual, intencao, form_respondido_em, leitura_json, spiritual_services(nome, slug)"
    )
    .eq("access_token", token)
    .maybeSingle();

  if (!order) notFound();

  // A imagem só é exposta depois da entrega.
  let imagemUrl: string | null = null;
  if (order.status === "entregue") {
    const { data: arte } = await supabase
      .from("service_deliverables")
      .select("storage_path")
      .eq("order_id", order.id)
      .eq("tipo", "foto")
      .maybeSingle();

    if (arte?.storage_path) {
      const { data: signed } = await supabase.storage
        .from("service-deliverables")
        .createSignedUrl(arte.storage_path, SIGNED_URL_SECONDS);
      imagemUrl = signed?.signedUrl ?? null;
    }
  }

  const pedido: PedidoPublico = {
    token,
    status: order.status,
    servicoNome: servicoNomeDe(order.spiritual_services),
    clienteNome: order.cliente_nome,
    nomeCompletoRitual: order.nome_completo_ritual,
    respondido: Boolean(order.form_respondido_em),
    leitura: (order.leitura_json as PedidoPublico["leitura"]) ?? null,
    imagemUrl,
  };

  return <PedidoClient pedido={pedido} />;
}
