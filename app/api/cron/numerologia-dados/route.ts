// ─── Cron diário: cobra os dados de quem pagou a Numerologia e não preencheu ──
// Vercel Cron (vercel.json) chama GET 1x/dia com Authorization: Bearer
// <CRON_SECRET> (a Vercel injeta o header quando a env existe no projeto).
// Sem CRON_SECRET configurado a rota recusa tudo (fail-closed — é melhor o
// cron não rodar do que ficar aberto pra qualquer um disparar e-mail).
//
// Regra do produto: o e-mail com o link do form sai NA COMPRA (webhook).
// Este cron é o segundo toque: pedidos pagos há 1h+ sem birth_date e que
// ainda não receberam lembrete (dados_reminder_sent_at IS NULL).

import { NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { sendNumerologiaDadosEmail } from "@/lib/email";
import type { AppLocale } from "@/lib/locale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: Request): boolean {
  const secret = (process.env.CRON_SECRET || "").trim();
  if (!secret) return false;
  return (req.headers.get("authorization") || "") === `Bearer ${secret}`;
}

async function handler(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: pendentes, error } = await supabase
    .from("numerologia_orders")
    .select("id, access_token, email, name, locale, created_at")
    .eq("status", "paid")
    .is("birth_date", null)
    .is("dados_reminder_sent_at", null)
    .lte("created_at", oneHourAgo)
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!pendentes || pendentes.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // NEXT_PUBLIC_APP_URL é a env de base-url da casa (webhooks, layout,
  // checkout). Fallback fixo no domínio de produção — o cron roda sem
  // depender do host da requisição.
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL || "https://atbtartot.com"
  ).replace(/\/$/, "");
  let sent = 0;
  for (const order of pendentes) {
    const result = await sendNumerologiaDadosEmail({
      email: order.email,
      nome: order.name,
      locale: (order.locale || "pt-BR") as AppLocale,
      dadosUrl: `${baseUrl}/numerologia/dados?pedido=${order.access_token}`,
    });
    if (result.ok) {
      sent++;
      // Marca mesmo em caso de sucesso parcial da rodada — 1 lembrete por
      // pedido, nunca spam (quem não abrir cai no suporte humano).
      await supabase
        .from("numerologia_orders")
        .update({ dados_reminder_sent_at: new Date().toISOString() })
        .eq("id", order.id);
    }
  }

  return NextResponse.json({ ok: true, checked: pendentes.length, sent });
}

export async function GET(req: Request) {
  return handler(req);
}
export async function POST(req: Request) {
  return handler(req);
}
