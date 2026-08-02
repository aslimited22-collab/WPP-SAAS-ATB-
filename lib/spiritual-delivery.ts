// ─── Entrega automática de um Trabalho Espiritual ────────────────────────────
// Orquestra: gera a leitura (texto) e a imagem simbólica, guarda tudo em
// service_deliverables (imagem no bucket privado), marca o pedido como
// entregue e avisa a cliente por e-mail.
//
// Idempotente: se já existe leitura para o pedido, não regera (evita gastar
// IA duas vezes e evita trocar o conteúdo que a cliente já viu).
// Fail-soft na imagem: se a arte falhar, a leitura é entregue mesmo assim —
// texto é o essencial, imagem é o acompanhamento.

import type { createServiceSupabaseClient } from "@/lib/supabase";
import type { ServiceSlug } from "@/content/servicos";
import { generateWorkReading, generateWorkImage } from "@/lib/spiritual-works";
import { sendServicoEntregaEmail } from "@/lib/email";
import { pedidoUrl } from "@/lib/spiritual-services";

type ServiceClient = ReturnType<typeof createServiceSupabaseClient>;

export interface EntregaResult {
  ok: boolean;
  jaEntregue?: boolean;
  texto: boolean;
  imagem: boolean;
  email: boolean;
  erro?: string;
}

export async function entregarTrabalho(
  supabase: ServiceClient,
  opts: { orderId: string; baseUrl: string }
): Promise<EntregaResult> {
  const base: EntregaResult = { ok: false, texto: false, imagem: false, email: false };

  const { data: order } = await supabase
    .from("service_orders")
    .select(
      "id, status, cliente_nome, cliente_email, nome_completo_ritual, intencao, access_token, spiritual_services(slug, nome)"
    )
    .eq("id", opts.orderId)
    .maybeSingle();

  if (!order) return { ...base, erro: "pedido_nao_encontrado" };
  if (order.status === "reembolsado") {
    return { ...base, erro: "pedido_reembolsado" };
  }
  if (!order.intencao || !order.nome_completo_ritual) {
    return { ...base, erro: "faltam_dados_do_cliente" };
  }

  const rel = order.spiritual_services as
    | { slug?: string; nome?: string }
    | Array<{ slug?: string; nome?: string }>
    | null;
  const row = Array.isArray(rel) ? rel[0] : rel;
  const slug = row?.slug as ServiceSlug | undefined;
  const servicoNome = row?.nome ?? "Trabalho Espiritual";
  if (!slug) return { ...base, erro: "servico_invalido" };

  // ── Idempotência: leitura já gerada? ───────────────────────────────────────
  const { data: jaTem } = await supabase
    .from("service_deliverables")
    .select("id")
    .eq("order_id", order.id)
    .eq("tipo", "mensagem")
    .maybeSingle();

  if (jaTem) {
    return { ...base, ok: true, jaEntregue: true, texto: true };
  }

  // ── 1. Texto (essencial — se falhar, a entrega falha) ──────────────────────
  let leitura: Awaited<ReturnType<typeof generateWorkReading>>;
  try {
    leitura = await generateWorkReading({
      slug,
      nomeCompleto: order.nome_completo_ritual,
      intencao: order.intencao,
    });
  } catch (err) {
    console.error(
      "[Trabalhos] Falha ao gerar leitura:",
      err instanceof Error ? err.message : ""
    );
    await supabase
      .from("service_orders")
      .update({ status: "falhou", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    return { ...base, erro: "geracao_texto_falhou" };
  }

  const { error: insTexto } = await supabase.from("service_deliverables").insert({
    order_id: order.id,
    tipo: "mensagem",
    conteudo_texto: leitura.text.slice(0, 4000),
  });
  if (insTexto) {
    console.error("[Trabalhos] Falha ao gravar leitura:", insTexto.message);
    return { ...base, erro: "persistencia_texto_falhou" };
  }
  base.texto = true;

  // Guarda o JSON estruturado para a página renderizar bonito.
  await supabase
    .from("service_orders")
    .update({
      leitura_json: leitura.json,
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);

  // ── 2. Imagem simbólica (fail-soft) ────────────────────────────────────────
  try {
    const img = await generateWorkImage(slug);
    const path = `${order.id}/arte.${img.extension}`;
    const { error: upErr } = await supabase.storage
      .from("service-deliverables")
      .upload(path, img.bytes, { contentType: img.contentType, upsert: true });

    if (upErr) {
      console.warn("[Trabalhos] Upload da imagem falhou:", upErr.message);
    } else {
      await supabase.from("service_deliverables").insert({
        order_id: order.id,
        tipo: "foto",
        storage_path: path,
      });
      base.imagem = true;
    }
  } catch (err) {
    console.warn(
      "[Trabalhos] Geração da imagem falhou (entrega segue sem ela):",
      err instanceof Error ? err.message : ""
    );
  }

  // ── 3. Marcar entregue + avisar por e-mail ─────────────────────────────────
  const nowIso = new Date().toISOString();
  await supabase
    .from("service_orders")
    .update({ status: "entregue", entregue_em: nowIso, updated_at: nowIso })
    .eq("id", order.id);

  await supabase
    .from("service_deliverables")
    .update({ enviado_em: nowIso })
    .eq("order_id", order.id)
    .is("enviado_em", null);

  const mail = await sendServicoEntregaEmail({
    email: order.cliente_email,
    nome: order.nome_completo_ritual ?? order.cliente_nome,
    servicoNome,
    pedidoUrl: pedidoUrl(opts.baseUrl, order.access_token as string),
  });
  base.email = mail.ok;

  return { ...base, ok: true };
}
