// ─── /numerologia/dados — pós-compra: coleta nome + nascimento ───────────────
// A cliente chega do redirect de /numerologia/obrigado ou do e-mail, sempre
// com ?pedido=<access_token>. O client resolve o pedido via
// /api/numerologia/pedido (poll — webhook pode atrasar) e mostra o form.
// PT-hardcoded (funil BR-first). Página privada por natureza: noindex, e o
// GoogleAdsTag suprime page_location aqui (o token está na URL).

import type { Metadata } from "next";
import DadosClient from "./DadosClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seus dados — Numerologia | ATB",
  robots: { index: false, follow: false },
};

export default async function NumerologiaDadosPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido } = await searchParams;
  const token = (pedido ?? "").trim().slice(0, 64);
  return <DadosClient token={token} />;
}
