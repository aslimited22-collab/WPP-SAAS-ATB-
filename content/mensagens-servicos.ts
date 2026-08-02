// ─── Textos dos e-mails dos Trabalhos Espirituais ────────────────────────────
// ARQUIVO EDITÁVEL: todo texto enviado ao cliente ou ao operador vive aqui.
// A copy final substituirá estes textos — mantenha os placeholders.
//
// CANAL: 100% e-mail (Resend). Não há WhatsApp neste produto.
// O cliente recebe sempre o MESMO link (/pedido/<token>): primeiro para
// escrever nome completo e intenção, e ali mesmo o trabalho fica pronto.
//
// COMPLIANCE (obrigatório em todo texto):
//   • Nunca prometer resultado material (dinheiro, emprego, processo,
//     retorno/afastamento de pessoa, cura). Nunca "garantido"/"infalível"/
//     "100%".
//   • O e-mail de confirmação NUNCA afirma que o trabalho está pronto — ele
//     só é preparado depois que a cliente escreve a intenção na página dela.

import { DISCLAIMER_GERAL } from "@/content/servicos";

// Follow-up D+3 é OPCIONAL e vem DESATIVADO por padrão.
export const FOLLOW_UP_D3_ATIVO = false;

export function primeiroNome(nome: string | null | undefined): string {
  const first = (nome ?? "").trim().split(/\s+/)[0];
  return first || "querida alma";
}

// ─── 1. Confirmação + orientação de preparação ───────────────────────────────
// Enviada pelo webhook logo após a compra aprovada.
// `acolhimento` é o parágrafo personalizado do DeepSeek (opcional — se a IA
// falhar ou demorar >5s, entra o parágrafo estático padrão).
export interface ConfirmacaoCopy {
  assunto: string;
  titulo: string;
  acolhimento: string;
  linhaProduto: string;
  comoFunciona: [string, string, string];
  ctaLabel: string;
  ctaNota: string;
  preparacao: string;
  assinatura: string;
}

export function copyConfirmacao(opts: {
  nome: string | null | undefined;
  servicoNome: string;
  servicoSlug: string;
  acolhimento?: string | null;
}): ConfirmacaoCopy {
  const nome = primeiroNome(opts.nome);

  const acolhimentoFinal =
    (opts.acolhimento ?? "").trim() ||
    `${nome}, recebi o seu pedido com muito carinho. Pode ficar tranquila que a partir de agora ele está em boas mãos, com toda a fé e o respeito que esse momento seu merece.`;

  // Variação por produto: uma linha de contexto espiritual própria.
  const linhas: Record<string, string> = {
    "corte-de-lacos":
      "Vou preparar o seu Divórcio Energético com o seu nome, pedindo a sua libertação, o encerramento desse ciclo e a abertura dos seus caminhos.",
    "ritual-de-prosperidade":
      "Vou preparar o seu Ritual de Prosperidade com o seu nome, pedindo o desbloqueio espiritual dos seus caminhos da fartura.",
    "devocao-a-xango":
      "Vou preparar a sua Devoção a Xangô com o seu nome, pedindo força, serenidade e fé para esse momento que você atravessa.",
    "harmonizacao-amorosa":
      "Vou preparar a sua Harmonização Amorosa com o seu nome, pedindo harmonia e paz para o seu coração e para a sua vida afetiva.",
  };

  return {
    assunto: `🕊️ Seu trabalho "${opts.servicoNome}" foi confirmado`,
    titulo: "Seu pedido foi recebido",
    acolhimento: acolhimentoFinal,
    linhaProduto:
      linhas[opts.servicoSlug] ??
      "Vou preparar o seu trabalho espiritual com o seu nome e a sua intenção.",
    comoFunciona: [
      "Clique no botão abaixo e me diga o seu nome completo e a sua intenção — o que você deseja trabalhar.",
      "É a partir das suas palavras que eu preparo o seu trabalho, com o seu nome e a sua intenção.",
      "Na mesma página aparecem a sua leitura e a sua imagem espiritual, com as minhas orientações.",
    ],
    ctaLabel: "✦ Escrever meu nome e minha intenção",
    ctaNota:
      "Guarde este e-mail: esse mesmo link é a sua página, onde o seu trabalho fica guardado.",
    preparacao:
      "Nesses dias, se puder, beba bastante água, use roupas claras e reserve um momento de silêncio para pensar na sua intenção com calma.",
    assinatura: "Estou aqui com você. 💛 ATB",
  };
}

// ─── 2. Lembrete de dados pendentes ──────────────────────────────────────────
// Cliente comprou mas não escreveu a intenção — disparo pelo painel.
export function copyLembrete(opts: {
  nome: string | null | undefined;
  servicoNome: string;
}) {
  const nome = primeiroNome(opts.nome);
  return {
    assunto: `💛 Faltam só os seus dados para eu preparar o seu trabalho`,
    titulo: "Ainda preciso dos seus dados",
    corpo: `${nome}, é a ATB. Estou com o seu trabalho "${opts.servicoNome}" separado aqui, mas para eu preparar do jeito certo eu preciso que você me diga o seu nome completo e a sua intenção — o que você deseja trabalhar.`,
    ctaLabel: "✦ Preencher agora",
    nota: "Pode escrever do seu jeito, sem pressa. Assim que você preencher, seu trabalho fica pronto ali mesmo. 🕊️",
  };
}

// ─── 3. Entrega ──────────────────────────────────────────────────────────────
// Enviada automaticamente quando a leitura e a imagem ficam prontas.
export function copyEntrega(opts: {
  nome: string | null | undefined;
  servicoNome: string;
}) {
  const nome = primeiroNome(opts.nome);
  return {
    assunto: `🕊️ Seu trabalho "${opts.servicoNome}" está pronto`,
    titulo: "Seu trabalho está pronto",
    corpo: `${nome}, é a ATB. Preparei o seu trabalho "${opts.servicoNome}" com muito respeito, com o seu nome e a sua intenção. A sua leitura e a sua imagem espiritual estão guardadas na sua página — é só tocar no botão abaixo.`,
    ctaLabel: "✨ Ver o meu trabalho",
    orientacoes:
      "Nos próximos dias, mantenha o coração tranquilo, beba bastante água e, quando puder, acenda uma vela branca em um lugar seguro, agradecendo com as suas palavras.",
    assinatura: "Que você siga em paz, com proteção e leveza. Estou aqui. 💛 ATB",
  };
}

// ─── 4. Follow-up D+3 (opcional, DESATIVADO por padrão) ─────────────────────
// Acompanhamento acolhedor, SEM pressão de venda.
export function copyFollowUpD3(opts: { nome: string | null | undefined }) {
  const nome = primeiroNome(opts.nome);
  return {
    assunto: "💛 Passando para saber como você está",
    titulo: "Como está o seu coração?",
    corpo: `${nome}, é a ATB passando só para te sentir. Como você está desde o seu trabalho? Se quiser me contar qualquer coisa, é só responder este e-mail — leio com carinho. E lembre das orientações que te enviei, elas ajudam a manter a energia leve. 🕊️`,
  };
}

// ─── Avisos ao OPERADOR (por e-mail) ─────────────────────────────────────────
export function copyOperadorNovoPedido(opts: {
  servicoNome: string;
  clienteNome: string | null | undefined;
  clienteEmail: string;
  clienteTelefone: string | null | undefined;
  kiwifyOrderId: string;
  adminUrl: string;
}) {
  return {
    assunto: `🔔 Novo pedido — ${opts.servicoNome}`,
    linhas: [
      `Trabalho: ${opts.servicoNome}`,
      `Cliente: ${opts.clienteNome || "(sem nome)"}`,
      `E-mail: ${opts.clienteEmail}`,
      `Telefone (referência): ${opts.clienteTelefone || "(não informado)"}`,
      `Pedido Kiwify: ${opts.kiwifyOrderId}`,
    ],
    adminUrl: opts.adminUrl,
  };
}

export function copyOperadorReembolso(opts: {
  servicoNome: string;
  clienteEmail: string;
  kiwifyOrderId: string;
}) {
  return {
    assunto: `⚠️ Reembolso/chargeback — ${opts.servicoNome}`,
    linhas: [
      `Trabalho: ${opts.servicoNome}`,
      `E-mail: ${opts.clienteEmail}`,
      `Pedido Kiwify: ${opts.kiwifyOrderId}`,
      `O pedido foi marcado como reembolsado.`,
    ],
  };
}

// Rodapé legal usado em todos os e-mails do produto.
export const RODAPE_LEGAL = `${DISCLAIMER_GERAL} Você tem até 7 dias corridos após a compra para pedir reembolso integral (art. 49 do CDC).`;
