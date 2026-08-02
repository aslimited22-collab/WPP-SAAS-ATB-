// ─── Templates de mensagens dos Trabalhos Espirituais (WhatsApp) ─────────────
// ARQUIVO EDITÁVEL: toda mensagem enviada ao cliente ou ao operador vive
// aqui. A copy final substituirá estes textos — mantenha os placeholders.
//
// COMPLIANCE (obrigatório em toda mensagem):
//   • Nunca prometer resultado material (dinheiro, emprego, processo,
//     retorno/afastamento de pessoa, cura). Nunca "garantido"/"infalível"/
//     "100%".
//   • A mensagem de confirmação NUNCA afirma que o ritual já foi realizado —
//     ela diz que SERÁ realizado em até 48h úteis. Só a mensagem de entrega
//     (disparada manualmente pelo operador no painel) fala de ritual feito.
//
// OBS: o marcador ||| não é usado aqui — mensagens operacionais saem em
// texto único para nunca se perderem no meio de um fluxo de conversa.

import { DISCLAIMER_GERAL } from "@/content/servicos";

// Follow-up D+3 é OPCIONAL e vem DESATIVADO por padrão.
// Ligue mudando para true quando decidir usar o acompanhamento.
export const FOLLOW_UP_D3_ATIVO = false;

function primeiroNome(nome: string | null | undefined): string {
  const first = (nome ?? "").trim().split(/\s+/)[0];
  return first || "querida alma";
}

// ─── 1. Confirmação + orientação de preparação ───────────────────────────────
// Enviada pelo webhook logo após a compra aprovada.
// `acolhimento` é o parágrafo personalizado do DeepSeek (opcional — se a IA
// falhar ou demorar >5s, entra o parágrafo estático padrão).
export function mensagemConfirmacao(opts: {
  nome: string | null | undefined;
  servicoNome: string;
  servicoSlug: string;
  acolhimento?: string | null;
}): string {
  const nome = primeiroNome(opts.nome);

  const acolhimentoFinal =
    (opts.acolhimento ?? "").trim() ||
    `${nome}, recebi o seu pedido com muito carinho. Pode ficar tranquila que a partir de agora ele está em boas mãos, com toda a fé e o respeito que esse momento seu merece.`;

  // Variação por produto: uma linha de contexto espiritual própria.
  const linhaProduto: Record<string, string> = {
    "limpeza-espiritual":
      "Vou preparar a sua Limpeza Espiritual com o seu nome, pedindo proteção e renovação das suas energias.",
    "corte-de-lacos":
      "Vou preparar o seu Divórcio Energético com o seu nome, pedindo a sua libertação, o encerramento desse ciclo e a abertura dos seus caminhos.",
    "ritual-de-prosperidade":
      "Vou preparar o seu Ritual de Prosperidade com o seu nome, pedindo o desbloqueio espiritual dos seus caminhos da fartura.",
    "devocao-a-xango":
      "Vou preparar a sua Devoção a Xangô com o seu nome, pedindo força, serenidade e fé para esse momento que você atravessa.",
    "harmonizacao-amorosa":
      "Vou preparar a sua Harmonização Amorosa com o seu nome, pedindo harmonia e paz para o seu coração e para a sua vida afetiva.",
  };

  return [
    `🕊️ ${nome}, aqui é a ATB. Sua compra do trabalho *${opts.servicoNome}* foi confirmada!`,
    ``,
    acolhimentoFinal,
    ``,
    linhaProduto[opts.servicoSlug] ??
      `Vou preparar o seu trabalho espiritual com o seu nome e a sua intenção.`,
    ``,
    `✦ *Como vai funcionar:*`,
    `1. Me responda AQUI com o seu *nome completo* e a sua *intenção* (o que você deseja trabalhar neste ritual).`,
    `2. Eu realizo o seu ritual pessoalmente, de forma individual, em até *48 horas úteis*.`,
    `3. Você recebe aqui no WhatsApp o registro do trabalho (foto e/ou áudio) e as minhas orientações.`,
    ``,
    `✦ *Preparação:* nesses dias, se puder, beba bastante água, use roupas claras e reserve um momento de silêncio para pensar na sua intenção com calma.`,
    ``,
    `Estou aqui com você. 💛`,
    ``,
    `_${DISCLAIMER_GERAL}_`,
  ].join("\n");
}

// ─── 2. Lembrete de dados pendentes ──────────────────────────────────────────
// Cliente não respondeu nome completo/intenção — disparo MANUAL pelo painel.
export function mensagemLembreteDados(opts: {
  nome: string | null | undefined;
  servicoNome: string;
}): string {
  const nome = primeiroNome(opts.nome);
  return [
    `${nome}, é a ATB de novo. 💛`,
    ``,
    `Estou com o seu trabalho *${opts.servicoNome}* separado aqui, mas para eu realizar o seu ritual do jeito certo eu preciso que você me responda com:`,
    ``,
    `1. Seu *nome completo*`,
    `2. A sua *intenção* — o que você deseja trabalhar neste ritual, com as suas palavras`,
    ``,
    `Pode escrever do seu jeito, sem pressa. Assim que você me responder, eu preparo tudo com muito carinho. 🕊️`,
  ].join("\n");
}

// ─── 3. Entrega final com o registro ─────────────────────────────────────────
// Enviada pelo operador no painel ("Realizar entrega"), acompanhada das
// mídias (foto/áudio) do ritual. SÓ aqui o sistema fala de ritual realizado —
// porque o operador marcou manualmente que realizou.
export function mensagemEntrega(opts: {
  nome: string | null | undefined;
  servicoNome: string;
}): string {
  const nome = primeiroNome(opts.nome);
  return [
    `🕊️ ${nome}, é a ATB. Seu trabalho *${opts.servicoNome}* foi realizado.`,
    ``,
    `Fiz tudo com muito respeito, com o seu nome e a sua intenção. Te envio junto o registro do seu ritual — guarde com carinho.`,
    ``,
    `✦ *Orientações para os próximos dias:* mantenha o coração tranquilo, beba bastante água e, quando puder, acenda uma vela branca em um lugar seguro, agradecendo com as suas palavras.`,
    ``,
    `Que você siga em paz, com proteção e leveza. Estou aqui. 💛`,
    ``,
    `_${DISCLAIMER_GERAL}_`,
  ].join("\n");
}

// ─── 4. Follow-up D+3 (opcional, DESATIVADO por padrão) ─────────────────────
// Mensagem de acompanhamento acolhedora, SEM pressão de venda.
export function mensagemFollowUpD3(opts: {
  nome: string | null | undefined;
}): string {
  const nome = primeiroNome(opts.nome);
  return [
    `${nome}, é a ATB passando só para te sentir. 💛`,
    ``,
    `Como você está desde o seu ritual? Como anda o seu coração?`,
    ``,
    `Se quiser me contar qualquer coisa, pode escrever aqui — leio com carinho. E lembre das orientações que te mandei, elas ajudam a manter a energia leve. 🕊️`,
  ].join("\n");
}

// ─── Notificação ao OPERADOR (novo pedido / reembolso / resposta) ────────────
export function mensagemOperadorNovoPedido(opts: {
  servicoNome: string;
  clienteNome: string | null | undefined;
  clienteEmail: string;
  clienteWhatsapp: string | null | undefined;
  kiwifyOrderId: string;
  adminUrl: string;
}): string {
  return [
    `🔔 NOVO PEDIDO — ${opts.servicoNome}`,
    ``,
    `Cliente: ${opts.clienteNome || "(sem nome)"}`,
    `E-mail: ${opts.clienteEmail}`,
    `WhatsApp: ${opts.clienteWhatsapp || "(não informado)"}`,
    `Pedido Kiwify: ${opts.kiwifyOrderId}`,
    ``,
    `Prazo do ritual: 48h úteis.`,
    `Painel: ${opts.adminUrl}`,
  ].join("\n");
}

export function mensagemOperadorReembolso(opts: {
  servicoNome: string;
  clienteEmail: string;
  kiwifyOrderId: string;
}): string {
  return [
    `⚠️ REEMBOLSO/CHARGEBACK — ${opts.servicoNome}`,
    ``,
    `E-mail: ${opts.clienteEmail}`,
    `Pedido Kiwify: ${opts.kiwifyOrderId}`,
    ``,
    `O pedido foi marcado como reembolsado. NÃO realizar o ritual.`,
  ].join("\n");
}
