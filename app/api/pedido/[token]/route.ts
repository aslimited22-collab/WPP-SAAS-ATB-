// ─── POST /api/pedido/[token] ────────────────────────────────────────────────
// O CLIENTE envia o nome completo e a intenção do ritual pelo link único
// (/pedido/<access_token>). Sem login: o token UUID é a credencial.
//
// Regras:
//   • só aceita pedidos em 'pago' ou 'em_preparacao' (não faz sentido depois
//     do ritual realizado/entregue, nem em reembolsado);
//   • grava marcando intencao_aguardando_revisao = true — o OPERADOR revisa
//     antes de realizar o ritual;
//   • permite reenvio enquanto o ritual não começou (cliente pode corrigir),
//     e nesse caso o operador vê o texto atualizado.

import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { servicoPedidoFormSchema } from "@/lib/validators";
import { sendOperadorEmail } from "@/lib/email";
import { servicoNomeDe } from "@/lib/spiritual-services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const rl = await checkRateLimit(`pedido_form:${ipAddress}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um instante e tente novamente." },
      { status: 429 }
    );
  }

  const { token } = await params;
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: "Link inválido." }, { status: 400 });
  }

  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Texto muito longo." }, { status: 413 });
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Texto muito longo." }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const parsed = servicoPedidoFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos." },
      { status: 400 }
    );
  }

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("service_orders")
    .select("id, status, cliente_email, spiritual_services(nome)")
    .eq("access_token", token)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (order.status === "reembolsado") {
    return NextResponse.json(
      { error: "Este pedido foi cancelado." },
      { status: 422 }
    );
  }
  if (order.status === "ritual_realizado" || order.status === "entregue") {
    return NextResponse.json(
      {
        error:
          "Seu ritual já foi realizado — não é mais possível alterar os dados. Se precisar de ajuda, responda o e-mail da sua compra.",
      },
      { status: 422 }
    );
  }

  const nowIso = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("service_orders")
    .update({
      nome_completo_ritual: parsed.data.nome_completo,
      intencao: parsed.data.intencao,
      intencao_aguardando_revisao: true,
      form_respondido_em: nowIso,
      updated_at: nowIso,
    })
    .eq("id", order.id);

  if (updErr) {
    console.error("[Pedido] Falha ao salvar formulário:", updErr.message);
    return NextResponse.json(
      { error: "Não foi possível salvar. Tente novamente." },
      { status: 500 }
    );
  }

  // Avisa o operador que há dados novos para revisar (fail-soft).
  const baseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  ).replace(/\/$/, "");
  await sendOperadorEmail({
    assunto: `✉️ Dados recebidos — ${servicoNomeDe(order.spiritual_services)}`,
    linhas: [
      `Cliente: ${order.cliente_email}`,
      `Nome para o ritual: ${parsed.data.nome_completo}`,
      "O cliente preencheu a intenção. Revise no painel antes de realizar o ritual.",
    ],
    adminUrl: `${baseUrl}/admin/pedidos/${order.id}`,
  });

  return NextResponse.json({ ok: true });
}
