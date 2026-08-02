// ─── /servicos/[slug] — landing de cada Trabalho Espiritual ──────────────────
// Server Component: valida o slug, lê preço + URL de checkout do banco
// (nunca hardcoded) e delega a renderização i18n ao client component.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { findServiceBySlug } from "@/lib/spiritual-services";
import { SERVICOS_CONTENT, type ServiceSlug } from "@/content/servicos";
import ServicoLandingClient from "./ServicoLandingClient";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const content = SERVICOS_CONTENT["pt-BR"][slug as ServiceSlug];
  if (!content) return { title: "Trabalhos Espirituais | ATB" };
  return {
    title: `${content.titulo} | ATB`,
    // Metadata segue as mesmas regras de compliance da página.
    description: content.subtitulo.slice(0, 160),
  };
}

export default async function ServicoPage({ params }: Props) {
  const { slug } = await params;

  // Slug precisa existir no conteúdo E no banco (ativo).
  const content = SERVICOS_CONTENT["pt-BR"][slug as ServiceSlug];
  if (!content) notFound();

  const supabase = createServiceSupabaseClient();
  const service = await findServiceBySlug(supabase, slug);
  if (!service || !service.ativo) notFound();

  return (
    <ServicoLandingClient
      service={{
        slug: service.slug,
        nome: service.nome,
        preco_centavos: service.preco_centavos,
        kiwify_checkout_url: service.kiwify_checkout_url,
      }}
    />
  );
}
