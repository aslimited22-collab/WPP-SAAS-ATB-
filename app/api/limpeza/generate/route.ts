// POST /api/limpeza/generate — reentrega manual/automática de um pedido PAGO.
// Protegida por token interno (X-Internal-Token = INTERNAL_GEN_TOKEN).
// Útil para reprocessar entregas que falharam (delivery_status = failed).

import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { deliverLimpezaOrder } from "@/lib/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tokenOk(received: string | null): boolean {
  const expected = process.env.INTERNAL_GEN_TOKEN ?? "";
  if (!expected || !received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!tokenOk(request.headers.get("x-internal-token"))) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: { orderId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const orderId = String(body?.orderId ?? "");
  if (!UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "orderId inválido" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("limpeza_orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  if (order.status !== "paid") {
    return NextResponse.json(
      { error: `Pedido não está pago (status: ${order.status})` },
      { status: 409 }
    );
  }

  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  ).replace(/\/$/, "");

  const result = await deliverLimpezaOrder(supabase, { orderId, baseUrl });
  return NextResponse.json({ ok: true, result });
}
