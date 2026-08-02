// ─── Trabalhos Espirituais: catálogo, pedidos e confirmação pós-compra ───────
// Modelo de entrega híbrida, com E-MAIL como canal único (sem WhatsApp):
// compra → e-mail de confirmação com o LINK ÚNICO do pedido (/pedido/<token>)
// → cliente preenche nome completo e intenção nesse link → o OPERADOR realiza
// o ritual em até 48h úteis → entrega manual pelo painel /admin/pedidos, que
// envia o e-mail apontando para o MESMO link, onde o registro aparece.
//
// Nada aqui afirma que um ritual foi realizado — isso só acontece quando o
// operador marca manualmente no painel.

import type { createServiceSupabaseClient } from "@/lib/supabase";
import { deepseekComplete } from "@/lib/deepseek";
import { sendServicoConfirmacaoEmail, sendOperadorEmail } from "@/lib/email";
import { copyOperadorNovoPedido } from "@/content/mensagens-servicos";

type ServiceClient = ReturnType<typeof createServiceSupabaseClient>;

export interface SpiritualService {
  id: string;
  slug: string;
  nome: string;
  preco_centavos: number;
  descricao_curta: string | null;
  ativo: boolean;
  kiwify_product_id: string | null;
  kiwify_checkout_url: string | null;
  ordem: number;
}

export const SERVICE_ORDER_STATUSES = [
  "pago",
  "em_preparacao",
  "ritual_realizado",
  "entregue",
  "reembolsado",
] as const;
export type ServiceOrderStatus = (typeof SERVICE_ORDER_STATUSES)[number];

// Coluna de timestamp correspondente a cada transição de status.
export const STATUS_TIMESTAMP_COLUMN: Record<ServiceOrderStatus, string> = {
  pago: "pago_em",
  em_preparacao: "em_preparacao_em",
  ritual_realizado: "ritual_realizado_em",
  entregue: "entregue_em",
  reembolsado: "reembolsado_em",
};

// Mantém apenas dígitos — telefone guardado só como referência de contato
// para o operador (o canal de comunicação do produto é e-mail).
export function soDigitos(phone: string | null | undefined): string {
  return (phone ?? "").replace(/\D/g, "");
}

// URL do link único do cliente — a mesma página serve para preencher os
// dados e, depois, para ver o registro do ritual.
export function pedidoUrl(baseUrl: string, accessToken: string): string {
  return `${baseUrl.replace(/\/$/, "")}/pedido/${accessToken}`;
}

// Nome do serviço vindo de um join `spiritual_services(nome)`.
// O PostgREST devolve OBJETO quando infere relação para-um e ARRAY quando
// infere para-muitos — ler `.nome` direto quebraria silenciosamente num dos
// casos. Este helper aceita os dois e nunca lança.
export function servicoNomeDe(rel: unknown): string {
  const fallback = "Trabalho Espiritual";
  if (!rel) return fallback;
  const row = Array.isArray(rel) ? rel[0] : rel;
  const nome = (row as { nome?: unknown } | null)?.nome;
  return typeof nome === "string" && nome.trim() ? nome : fallback;
}

// ─── Catálogo ────────────────────────────────────────────────────────────────

export async function listActiveServices(
  supabase: ServiceClient
): Promise<SpiritualService[]> {
  const { data } = await supabase
    .from("spiritual_services")
    .select(
      "id, slug, nome, preco_centavos, descricao_curta, ativo, kiwify_product_id, kiwify_checkout_url, ordem"
    )
    .eq("ativo", true)
    .order("ordem", { ascending: true });
  return (data ?? []) as SpiritualService[];
}

export async function findServiceBySlug(
  supabase: ServiceClient,
  slug: string
): Promise<SpiritualService | null> {
  const { data } = await supabase
    .from("spiritual_services")
    .select(
      "id, slug, nome, preco_centavos, descricao_curta, ativo, kiwify_product_id, kiwify_checkout_url, ordem"
    )
    .eq("slug", slug)
    .maybeSingle();
  return (data as SpiritualService | null) ?? null;
}

export async function findServiceByKiwifyProductId(
  supabase: ServiceClient,
  productId: string | null
): Promise<SpiritualService | null> {
  if (!productId) return null;
  const { data } = await supabase
    .from("spiritual_services")
    .select(
      "id, slug, nome, preco_centavos, descricao_curta, ativo, kiwify_product_id, kiwify_checkout_url, ordem"
    )
    .eq("kiwify_product_id", productId)
    .maybeSingle();
  return (data as SpiritualService | null) ?? null;
}

// ─── Acolhimento personalizado (DeepSeek — opcional por pedido) ──────────────
// UM parágrafo de acolhimento, inserido no template fixo de confirmação.
// Regras rígidas (reforçadas no prompt E validadas na saída):
//   • é acolhimento + orientação de preparação, nada além;
//   • NUNCA afirma que o ritual já foi feito (ele SERÁ feito em até 48h úteis);
//   • NUNCA promete resultado.
// Fallback automático para o parágrafo estático se a API falhar, demorar
// mais de 5s ou a saída violar as regras.

const ACOLHIMENTO_TIMEOUT_MS = 5_000;

// Padrões proibidos na saída da IA (defesa em profundidade além do prompt).
const ACOLHIMENTO_PROIBIDO =
  /garantid|infal[ií]vel|100%|\bj[áa] (?:realizei|fiz|conclu)|ritual (?:foi|est[áa]) (?:feito|realizado|pronto)|vai voltar|vit[óo]ria no processo|vai ganhar|dinheiro certo|emprego certo/i;

export async function gerarAcolhimento(opts: {
  nome: string | null | undefined;
  servicoNome: string;
}): Promise<string | null> {
  const nome = (opts.nome ?? "").trim().split(/\s+/)[0] || "querida alma";

  const prompt = `Escreva UM único parágrafo curto (no máximo 3 frases, sem quebras de linha) de acolhimento para ${nome}, que acabou de comprar o trabalho espiritual "${opts.servicoNome}".

REGRAS OBRIGATÓRIAS:
- Tom: acolhedor, caloroso, espiritual, em português brasileiro coloquial.
- Diga que o pedido foi recebido com carinho e que o ritual dela SERÁ preparado e realizado pessoalmente em até 48 horas úteis. Use o futuro — o ritual AINDA NÃO foi feito.
- NUNCA afirme que o ritual já foi realizado, iniciado ou está pronto.
- NUNCA prometa nenhum resultado (nada de dinheiro, amor de pessoa específica, vitória, cura, "vai dar certo"). Fale de fé, intenção, cuidado e acolhimento.
- Sem markdown, sem asteriscos, sem emojis, sem listas. Texto puro.`;

  try {
    const result = await Promise.race([
      deepseekComplete([{ role: "user", content: prompt }], {
        temperature: 1.0,
      }),
      new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), ACOLHIMENTO_TIMEOUT_MS)
      ),
    ]);

    if (!result) return null;

    // Sanitização: remove markdown/quebras, limita tamanho.
    const clean = result
      .replace(/[*_#`>|]/g, "")
      .replace(/\s*\n+\s*/g, " ")
      .trim()
      .slice(0, 500);

    if (clean.length < 30) return null;
    if (ACOLHIMENTO_PROIBIDO.test(clean)) {
      console.warn("[Servicos] Acolhimento da IA violou regras — usando fallback");
      return null;
    }
    return clean;
  } catch {
    return null;
  }
}

// ─── Notificação do operador por e-mail ──────────────────────────────────────
// Vai para ADMIN_NOTIFY_EMAIL. Sem a env, é silenciosamente pulada.
export async function notifyOperator(opts: {
  assunto: string;
  linhas: string[];
  adminUrl?: string;
}): Promise<boolean> {
  try {
    const r = await sendOperadorEmail(opts);
    return r.ok;
  } catch {
    return false;
  }
}

// ─── Compra aprovada: criar pedido + confirmação + avisos ────────────────────
// Idempotente: a UNIQUE em kiwify_order_id descarta duplicatas (além do
// marcador de idempotência do próprio webhook).
export async function processarCompraServico(
  supabase: ServiceClient,
  opts: {
    service: SpiritualService;
    kiwifyOrderId: string;
    email: string;
    nome: string | null;
    phone: string | null;
    amountCents: number | null;
    baseUrl: string;
  }
): Promise<{ ok: boolean; orderId?: string; duplicate?: boolean }> {
  const telefone = soDigitos(opts.phone);
  const nowIso = new Date().toISOString();

  // upsert com ignoreDuplicates: pedido já existente (reentrega do webhook)
  // não é recriado nem re-notificado.
  const { data: inserted, error } = await supabase
    .from("service_orders")
    .upsert(
      {
        service_id: opts.service.id,
        cliente_nome: opts.nome,
        cliente_email: opts.email,
        cliente_telefone: telefone || null,
        status: "pago",
        kiwify_order_id: opts.kiwifyOrderId,
        amount_cents: opts.amountCents,
        locale: "pt-BR",
        pago_em: nowIso,
      },
      { onConflict: "kiwify_order_id", ignoreDuplicates: true }
    )
    .select("id, access_token");

  if (error) {
    console.error("[Servicos] Falha ao criar service_order:", error.message);
    return { ok: false };
  }
  if (!inserted || inserted.length === 0) {
    // Conflito em kiwify_order_id — pedido já processado antes.
    return { ok: true, duplicate: true };
  }
  const orderId = inserted[0].id as string;
  const accessToken = inserted[0].access_token as string;
  const linkPedido = pedidoUrl(opts.baseUrl, accessToken);

  // ── E-mail de confirmação com o link único do pedido ──────────────────────
  // O acolhimento personalizado (DeepSeek) é opcional: se falhar ou demorar,
  // o template usa o parágrafo estático.
  const acolhimento = await gerarAcolhimento({
    nome: opts.nome,
    servicoNome: opts.service.nome,
  });

  const emailResult = await sendServicoConfirmacaoEmail({
    email: opts.email,
    nome: opts.nome,
    servicoNome: opts.service.nome,
    servicoSlug: opts.service.slug,
    pedidoUrl: linkPedido,
    acolhimento,
  });

  await supabase
    .from("service_orders")
    .update({
      confirmacao_email_ok: emailResult.ok,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId);

  // ── Aviso ao operador ─────────────────────────────────────────────────────
  const aviso = copyOperadorNovoPedido({
    servicoNome: opts.service.nome,
    clienteNome: opts.nome,
    clienteEmail: opts.email,
    clienteTelefone: telefone,
    kiwifyOrderId: opts.kiwifyOrderId,
    adminUrl: `${opts.baseUrl}/admin/pedidos/${orderId}`,
  });
  await notifyOperator({
    assunto: aviso.assunto,
    linhas: aviso.linhas,
    adminUrl: aviso.adminUrl,
  });

  return { ok: true, orderId };
}
