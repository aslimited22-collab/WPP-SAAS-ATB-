// ─── GET /api/numerologia/pedido — resolve o pedido pro funil pós-compra ────
// A página /numerologia/obrigado chega com o identificador do gateway e a
// página /numerologia/dados com o access_token:
//   ?sid=cs_...  → stripe_session_id ({CHECKOUT_SESSION_ID} do success_url)
//   ?kw=...      → kiwify_order_id (URL de obrigado configurada na Kiwify)
//   ?token=uuid  → access_token do pedido (link do e-mail / redirect)
// O webhook pode demorar alguns segundos — as páginas fazem poll até found.
//
// Endpoint público: só expõe o mínimo (nunca e-mail/nome). O access_token é
// retornado porque sid/kw são credenciais que só o comprador conhece.

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OrderRow = {
  id: string;
  access_token: string;
  status: string;
  name: string | null;
  birth_date: string | null;
};

const FIELDS = "id, access_token, status, name, birth_date";

export async function GET(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = await checkRateLimit(`numerologia_pedido:${ipAddress}`);
  if (!rl.success) {
    return NextResponse.json({ error: "too many requests" }, { status: 429 });
  }

  const sp = request.nextUrl.searchParams;
  const sid = (sp.get("sid") ?? "").trim().slice(0, 128);
  const kw = (sp.get("kw") ?? "").trim().slice(0, 128);
  const token = (sp.get("token") ?? sp.get("pedido") ?? "").trim().slice(0, 64);

  if (!sid && !kw && !token) {
    return NextResponse.json({ found: false }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  let order: OrderRow | null = null;

  // 1) access_token (link do e-mail / redirect do obrigado)
  if (token && UUID_RE.test(token)) {
    const { data } = await supabase
      .from("numerologia_orders")
      .select(FIELDS)
      .eq("access_token", token)
      .maybeSingle();
    order = data;
  }

  // 2) sessão do Stripe (success_url)
  if (!order && sid) {
    const { data } = await supabase
      .from("numerologia_orders")
      .select(FIELDS)
      .eq("stripe_session_id", sid)
      .maybeSingle();
    order = data;
  }

  // 3) pedido da Kiwify (URL de obrigado do produto)
  if (!order && kw) {
    const { data } = await supabase
      .from("numerologia_orders")
      .select(FIELDS)
      .eq("kiwify_order_id", kw)
      .maybeSingle();
    order = data;
  }

  if (!order) {
    // Webhook ainda não processou (ou identificador inválido) — poll segue.
    return NextResponse.json({ found: false });
  }

  const { data: reading } = await supabase
    .from("numerologia_readings")
    .select("generation_status")
    .eq("order_id", order.id)
    .maybeSingle();

  return NextResponse.json({
    found: true,
    token: order.access_token,
    paid: order.status === "paid",
    needsData: !order.birth_date || !order.name,
    generated: reading?.generation_status === "completed",
  });
}
