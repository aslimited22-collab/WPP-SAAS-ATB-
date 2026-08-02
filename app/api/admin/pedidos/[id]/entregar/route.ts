// ─── POST /api/admin/pedidos/[id]/entregar ───────────────────────────────────
// "Realizar entrega": envia ao cliente, via Z-API, a mensagem de encerramento
// + as mídias do registro (signed URLs do bucket privado) e marca o pedido
// como `entregue`.
//
// Guarda-corpo do modelo de entrega: só entrega pedidos já marcados
// MANUALMENTE como `ritual_realizado` pelo operador.

import { NextRequest, NextResponse } from "next/server";
import { getAdminUser } from "@/lib/admin";
import { createServiceSupabaseClient } from "@/lib/supabase";
import {
  sendWhatsApp,
  sendWhatsAppImage,
  sendWhatsAppAudio,
} from "@/lib/zapi";
import { mensagemEntrega } from "@/content/mensagens-servicos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Validade das signed URLs: 7 dias — a Z-API baixa na hora, mas a folga
// permite reenvio manual pelo painel sem regerar.
const SIGNED_URL_SECONDS = 7 * 24 * 60 * 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getAdminUser();
  if (!admin) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Pedido inválido" }, { status: 400 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("service_orders")
    .select(
      "id, status, cliente_nome, cliente_whatsapp, nome_completo_ritual, spiritual_services(nome)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  if (order.status !== "ritual_realizado") {
    return NextResponse.json(
      {
        error:
          "Só é possível entregar depois de marcar o ritual como realizado (status ritual_realizado).",
      },
      { status: 422 }
    );
  }
  if (!order.cliente_whatsapp) {
    return NextResponse.json(
      { error: "Pedido sem WhatsApp cadastrado — entrega manual impossível." },
      { status: 422 }
    );
  }

  const { data: deliverables } = await supabase
    .from("service_deliverables")
    .select("id, tipo, storage_path, conteudo_texto")
    .eq("order_id", id)
    .order("created_at", { ascending: true });

  if (!deliverables || deliverables.length === 0) {
    return NextResponse.json(
      { error: "Nenhum registro anexado — envie a foto/áudio do ritual antes." },
      { status: 422 }
    );
  }

  const servicoNome =
    (order.spiritual_services as { nome?: string } | null)?.nome ??
    "Trabalho Espiritual";
  const nomeCliente = order.nome_completo_ritual ?? order.cliente_nome;
  const phone = order.cliente_whatsapp;

  // ── 1. Mensagem de encerramento ───────────────────────────────────────────
  const texto = mensagemEntrega({ nome: nomeCliente, servicoNome });
  const msgResult = await sendWhatsApp(phone, texto, { humanTyping: false });
  if (!msgResult.success) {
    return NextResponse.json(
      { error: `Falha ao enviar mensagem: ${msgResult.error ?? "Z-API"}` },
      { status: 502 }
    );
  }

  // ── 2. Mídias do registro (signed URLs do bucket privado) ─────────────────
  const falhas: string[] = [];
  const enviadosIds: string[] = [];

  for (const d of deliverables) {
    try {
      if (d.tipo === "mensagem") {
        if (d.conteudo_texto) {
          const r = await sendWhatsApp(phone, d.conteudo_texto, {
            humanTyping: false,
          });
          if (r.success) enviadosIds.push(d.id);
          else falhas.push(`mensagem:${r.error}`);
        }
        continue;
      }

      if (!d.storage_path) {
        falhas.push(`${d.tipo}:sem_arquivo`);
        continue;
      }
      const { data: signed, error: signErr } = await supabase.storage
        .from("service-deliverables")
        .createSignedUrl(d.storage_path, SIGNED_URL_SECONDS);
      if (signErr || !signed?.signedUrl) {
        falhas.push(`${d.tipo}:signed_url`);
        continue;
      }

      const r =
        d.tipo === "foto"
          ? await sendWhatsAppImage(phone, signed.signedUrl)
          : await sendWhatsAppAudio(phone, signed.signedUrl);
      if (r.success) enviadosIds.push(d.id);
      else falhas.push(`${d.tipo}:${r.error}`);
    } catch {
      falhas.push(`${d.tipo}:exception`);
    }
  }

  const nowIso = new Date().toISOString();
  if (enviadosIds.length > 0) {
    await supabase
      .from("service_deliverables")
      .update({ enviado_em: nowIso })
      .in("id", enviadosIds);
  }

  // ── 3. Alguma mídia falhou → NÃO marca entregue (operador tenta de novo) ──
  if (falhas.length > 0) {
    return NextResponse.json(
      {
        error: `Mensagem enviada, mas ${falhas.length} mídia(s) falharam: ${falhas.join(
          ", "
        )}. Tente novamente.`,
        parcial: true,
      },
      { status: 502 }
    );
  }

  await supabase
    .from("service_orders")
    .update({ status: "entregue", entregue_em: nowIso, updated_at: nowIso })
    .eq("id", id);

  return NextResponse.json({ ok: true, entregues: enviadosIds.length });
}
