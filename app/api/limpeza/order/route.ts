// POST /api/limpeza/order — cria o pedido do funil da Limpeza Espiritual
// (status pending) e devolve o orderId. O cliente então segue para
// /api/checkout/limpeza?order=<id>, que roteia Kiwify (BR) ou Stripe (intl).

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { limpezaOrderSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rl = await checkRateLimit(`limpeza_order:${ipAddress}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Muitas solicitações. Tente novamente em instantes." },
      { status: 429 }
    );
  }

  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const parsed = limpezaOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const supabase = createServiceSupabaseClient();
  const { data: order, error } = await supabase
    .from("limpeza_orders")
    .insert({
      nome: parsed.data.nome,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      signo: parsed.data.signo ?? null,
      tema: parsed.data.tema,
      pergunta: parsed.data.pergunta,
      locale: parsed.data.locale,
      status: "pending",
    })
    .select("id")
    .single();

  if (error || !order) {
    console.error("[Limpeza] Falha ao criar pedido:", error?.message);
    return NextResponse.json(
      { error: "Erro interno. Tente novamente." },
      { status: 500 }
    );
  }

  return NextResponse.json({ orderId: order.id }, { status: 201 });
}
