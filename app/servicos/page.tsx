// ─── /servicos — índice dos Trabalhos Espirituais ────────────────────────────
// Server Component: lê o catálogo (e os PREÇOS) do banco — nunca hardcoded.
// A renderização com i18n fica no client component.

import type { Metadata } from "next";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { listActiveServices } from "@/lib/spiritual-services";
import ServicosIndexClient from "./ServicosIndexClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trabalhos Espirituais Individuais | ATB",
  description:
    "Rituais espirituais realizados individualmente com o seu nome: limpeza espiritual, encerramento de ciclos, prosperidade, devoção e harmonização. Serviço de natureza espiritual e religiosa.",
};

export default async function ServicosPage() {
  const supabase = createServiceSupabaseClient();
  const services = await listActiveServices(supabase);

  return <ServicosIndexClient services={services} />;
}
