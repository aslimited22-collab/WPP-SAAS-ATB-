// ─── Conteúdo das páginas dos Trabalhos Espirituais ──────────────────────────
// COPY INICIAL FUNCIONAL — a copy final está sendo produzida em paralelo e
// substituirá os textos abaixo. Por isso TODO texto de página vive aqui,
// isolado por produto: para trocar a copy, edite apenas este arquivo.
//
// REGRAS DE COMPLIANCE (valem para qualquer texto novo):
//   • NUNCA prometer resultado material: emprego, dinheiro, aposentadoria,
//     benefícios, vitória em processo, retorno/afastamento de pessoa
//     específica, cura de doenças.
//   • NUNCA usar "garantido", "infalível", "100%", percentuais de sucesso.
//   • Posicionamento permitido: experiência espiritual, tradição, fé,
//     intenção, proteção energética, renovação, acolhimento, bem-estar
//     espiritual.
//
// Guardrails específicos:
//   • corte-de-lacos: o trabalho é sobre a libertação DA PRÓPRIA PESSOA —
//     nunca sobre afastar/influenciar alguém específico; "novo amor" entra
//     como intenção e abertura, nunca como resultado garantido.
//   • ritual-de-prosperidade: nunca prometer clientes, emprego,
//     aposentadoria, benefícios ou valores.
//   • devocao-a-xango: nunca prometer vitória ou resultado de processo,
//     indenização ou pensão; disclaimer jurídico adicional OBRIGATÓRIO.
//   • harmonizacao-amorosa: nunca direcionado a influenciar a vontade de
//     pessoa específica nem prometer retorno de alguém.
//
// i18n: o site usa dicionários Record<UiLocale, ...> por página. A copy
// inicial existe em pt-BR; os demais idiomas reutilizam o pt-BR até a
// tradução final chegar (basta substituir as referências abaixo).

import type { UiLocale } from "@/lib/use-locale";

export type ServiceSlug =
  | "limpeza-espiritual"
  | "corte-de-lacos"
  | "ritual-de-prosperidade"
  | "devocao-a-xango"
  | "harmonizacao-amorosa";

export const SERVICE_SLUGS: ServiceSlug[] = [
  "limpeza-espiritual",
  "corte-de-lacos",
  "ritual-de-prosperidade",
  "devocao-a-xango",
  "harmonizacao-amorosa",
];

export interface ServiceFaqItem {
  pergunta: string;
  resposta: string;
}

export interface ServiceContent {
  // Hero
  badge: string;
  titulo: string;
  subtitulo: string;
  cta: string;
  // "Como funciona" — sempre 3 passos (pedido → ritual → registro)
  comoFuncionaTitulo: string;
  comoFunciona: [string, string, string];
  // "O que você recebe"
  oQueRecebeTitulo: string;
  oQueRecebe: string[];
  // FAQ (prazo, reembolso, natureza espiritual, sigilo)
  faqTitulo: string;
  faq: ServiceFaqItem[];
  // Disclaimer adicional específico do produto (ex.: jurídico no Xangô)
  disclaimerExtra?: string;
  // Emoji ilustrativo do card no índice
  emoji: string;
}

// Disclaimer obrigatório em TODAS as páginas e mensagens.
export const DISCLAIMER_GERAL =
  "Serviço de natureza espiritual e religiosa. Não substitui acompanhamento médico, psicológico, jurídico ou financeiro.";

// Direito de arrependimento (CDC, art. 49) — visível na página e no FAQ.
export const DIREITO_ARREPENDIMENTO =
  "Você tem até 7 dias corridos após a compra para se arrepender e receber reembolso integral, conforme o Código de Defesa do Consumidor (art. 49).";

// FAQ comum a todos os trabalhos (prazo / reembolso / natureza / sigilo).
const FAQ_COMUM: ServiceFaqItem[] = [
  {
    pergunta: "Em quanto tempo o trabalho é realizado?",
    resposta:
      "Seu ritual é preparado e realizado individualmente em até 48 horas úteis após a confirmação do pagamento. Assim que for realizado, você recebe o registro (foto e/ou áudio) e as orientações no seu WhatsApp.",
  },
  {
    pergunta: "Posso pedir reembolso?",
    resposta: DIREITO_ARREPENDIMENTO,
  },
  {
    pergunta: "Qual é a natureza deste serviço?",
    resposta:
      "Este é um serviço de natureza espiritual e religiosa, realizado com fé, tradição e intenção. Ele não substitui acompanhamento médico, psicológico, jurídico ou financeiro, e não há promessa de resultado material.",
  },
  {
    pergunta: "Meus dados e minha intenção ficam em sigilo?",
    resposta:
      "Sim. Seu nome e sua intenção são usados exclusivamente na realização do seu ritual e nunca são compartilhados. O registro do trabalho é enviado somente para o seu WhatsApp.",
  },
];

const PT_BR: Record<ServiceSlug, ServiceContent> = {
  "limpeza-espiritual": {
    emoji: "🕊️",
    badge: "✦ Trabalho espiritual individual ✦",
    titulo: "Limpeza Espiritual",
    subtitulo:
      "Um ritual de limpeza energética e proteção, realizado individualmente com o seu nome. Para quem sente o peso de energias densas e busca renovação, leveza e amparo espiritual.",
    cta: "🕊️ Quero minha Limpeza Espiritual",
    comoFuncionaTitulo: "Como funciona",
    comoFunciona: [
      "Você faz o pedido e recebe no WhatsApp as orientações de preparação, junto com o pedido do seu nome completo e da sua intenção.",
      "Seu ritual de limpeza é realizado individualmente, com o seu nome, em até 48 horas úteis.",
      "Você recebe no WhatsApp o registro do trabalho (foto e/ou áudio) e as orientações para os próximos dias.",
    ],
    oQueRecebeTitulo: "O que você recebe",
    oQueRecebe: [
      "Ritual de limpeza espiritual individual, realizado com o seu nome",
      "Foto do trabalho realizado para você",
      "Mensagem ou áudio com orientações espirituais para os próximos dias",
      "Acolhimento e sigilo do início ao fim",
    ],
    faqTitulo: "Perguntas frequentes",
    faq: FAQ_COMUM,
  },

  "corte-de-lacos": {
    emoji: "🕯️",
    badge: "✦ Trabalho espiritual individual ✦",
    titulo: "Divórcio Energético",
    subtitulo:
      "Um ritual de libertação energética para encerrar ciclos que já cumpriram seu papel. Para quem busca desapego, paz interior e abertura espiritual para um novo amor — começando por dentro, na sua própria energia.",
    cta: "🕯️ Quero meu Divórcio Energético",
    comoFuncionaTitulo: "Como funciona",
    comoFunciona: [
      "Você faz o pedido e recebe no WhatsApp as orientações de preparação, junto com o pedido do seu nome completo e da sua intenção.",
      "Seu ritual de libertação é realizado individualmente, com o seu nome, em até 48 horas úteis.",
      "Você recebe no WhatsApp o registro do trabalho (foto e/ou áudio) e as orientações para os próximos dias.",
    ],
    oQueRecebeTitulo: "O que você recebe",
    oQueRecebe: [
      "Ritual individual de encerramento de ciclos, realizado com o seu nome",
      "Foto do trabalho realizado para você",
      "Mensagem ou áudio com orientações de desapego e renovação",
      "Acolhimento e sigilo do início ao fim",
    ],
    faqTitulo: "Perguntas frequentes",
    faq: [
      {
        pergunta: "Este trabalho afasta ou traz alguém de volta?",
        resposta:
          "Não. O Divórcio Energético é um trabalho sobre VOCÊ: a sua libertação, o seu desapego e o encerramento de ciclos na sua própria energia. Ele não é direcionado a afastar, amarrar ou influenciar nenhuma pessoa específica. A abertura para um novo amor entra como intenção e renovação interior — nunca como resultado garantido.",
      },
      ...FAQ_COMUM,
    ],
  },

  "ritual-de-prosperidade": {
    emoji: "🌾",
    badge: "✦ Trabalho espiritual individual ✦",
    titulo: "Ritual de Prosperidade",
    subtitulo:
      "Um ritual de desbloqueio espiritual dos caminhos da fartura, para alinhar a sua energia com a abundância. Para quem sente os caminhos pesados e busca renovar a fé, a intenção e a própria relação com a prosperidade.",
    cta: "🌾 Quero meu Ritual de Prosperidade",
    comoFuncionaTitulo: "Como funciona",
    comoFunciona: [
      "Você faz o pedido e recebe no WhatsApp as orientações de preparação, junto com o pedido do seu nome completo e da sua intenção.",
      "Seu ritual de prosperidade é realizado individualmente, com o seu nome, em até 48 horas úteis.",
      "Você recebe no WhatsApp o registro do trabalho (foto e/ou áudio) e as orientações para os próximos dias.",
    ],
    oQueRecebeTitulo: "O que você recebe",
    oQueRecebe: [
      "Ritual individual de desbloqueio espiritual, realizado com o seu nome",
      "Foto do trabalho realizado para você",
      "Mensagem ou áudio com orientações de alinhamento com a abundância",
      "Acolhimento e sigilo do início ao fim",
    ],
    faqTitulo: "Perguntas frequentes",
    faq: [
      {
        pergunta: "Este ritual traz dinheiro, emprego ou benefício?",
        resposta:
          "Não há promessa de resultado material — nenhum trabalho espiritual sério pode garantir dinheiro, emprego, clientes, aposentadoria ou benefícios. O Ritual de Prosperidade é uma experiência espiritual de desbloqueio, fé e intenção: ele trabalha a sua energia e a sua relação com a abundância.",
      },
      ...FAQ_COMUM,
    ],
  },

  "devocao-a-xango": {
    emoji: "⚖️",
    badge: "✦ Trabalho devocional individual ✦",
    titulo: "Devoção a Xangô",
    subtitulo:
      "Um trabalho devocional ao orixá da justiça, para quem atravessa uma disputa e busca força, serenidade e fé para caminhar com dignidade. Kaô Kabecilê!",
    cta: "⚖️ Quero minha Devoção a Xangô",
    comoFuncionaTitulo: "Como funciona",
    comoFunciona: [
      "Você faz o pedido e recebe no WhatsApp as orientações de preparação, junto com o pedido do seu nome completo e da sua intenção.",
      "Sua devoção a Xangô é realizada individualmente, com o seu nome, em até 48 horas úteis.",
      "Você recebe no WhatsApp o registro do trabalho (foto e/ou áudio) e as orientações para os próximos dias.",
    ],
    oQueRecebeTitulo: "O que você recebe",
    oQueRecebe: [
      "Trabalho devocional individual a Xangô, realizado com o seu nome",
      "Foto do trabalho realizado para você",
      "Mensagem ou áudio com orientações de força e serenidade",
      "Acolhimento e sigilo do início ao fim",
    ],
    faqTitulo: "Perguntas frequentes",
    faq: [
      {
        pergunta: "Este trabalho garante que eu ganhe meu processo?",
        resposta:
          "Não. Nenhum trabalho espiritual pode prometer vitória em processo, indenização, pensão ou qualquer resultado jurídico. A Devoção a Xangô é uma experiência devocional que busca força interior, serenidade e fé para quem atravessa uma disputa. Questões jurídicas devem sempre ser acompanhadas por um advogado.",
      },
      ...FAQ_COMUM,
    ],
    disclaimerExtra:
      "Este é um serviço devocional e espiritual. Não é serviço jurídico e não substitui a orientação de um advogado.",
  },

  "harmonizacao-amorosa": {
    emoji: "💛",
    badge: "✦ Trabalho espiritual individual ✦",
    titulo: "Harmonização Amorosa",
    subtitulo:
      "Um ritual de harmonia para a sua vida afetiva: fortalecimento da relação, serenidade no coração e abertura dos caminhos do amor — trabalhando a SUA energia, com fé e intenção.",
    cta: "💛 Quero minha Harmonização Amorosa",
    comoFuncionaTitulo: "Como funciona",
    comoFunciona: [
      "Você faz o pedido e recebe no WhatsApp as orientações de preparação, junto com o pedido do seu nome completo e da sua intenção.",
      "Seu ritual de harmonização é realizado individualmente, com o seu nome, em até 48 horas úteis.",
      "Você recebe no WhatsApp o registro do trabalho (foto e/ou áudio) e as orientações para os próximos dias.",
    ],
    oQueRecebeTitulo: "O que você recebe",
    oQueRecebe: [
      "Ritual individual de harmonização afetiva, realizado com o seu nome",
      "Foto do trabalho realizado para você",
      "Mensagem ou áudio com orientações para o coração",
      "Acolhimento e sigilo do início ao fim",
    ],
    faqTitulo: "Perguntas frequentes",
    faq: [
      {
        pergunta: "Este trabalho faz alguém voltar para mim?",
        resposta:
          "Não. A Harmonização Amorosa não é amarração: ela não é direcionada a influenciar a vontade de nenhuma pessoa específica e não promete o retorno de ninguém. É um ritual sobre a SUA energia afetiva — harmonia, serenidade e abertura dos caminhos do amor na sua vida.",
      },
      ...FAQ_COMUM,
    ],
  },
};

// ─── Conteúdo da página índice /servicos ─────────────────────────────────────
export interface ServicosIndexContent {
  badge: string;
  titulo: string;
  subtitulo: string;
  verTrabalho: string;
  emBreve: string;
  disclaimer: string;
  arrependimento: string;
}

const PT_BR_INDEX: ServicosIndexContent = {
  badge: "✦ Trabalhos espirituais individuais ✦",
  titulo: "Trabalhos Espirituais da ATB",
  subtitulo:
    "Rituais realizados individualmente, com o seu nome e a sua intenção. Você recebe o registro do trabalho (foto e/ou áudio) e as orientações direto no seu WhatsApp, em até 48 horas úteis.",
  verTrabalho: "Ver este trabalho",
  emBreve: "Em breve",
  disclaimer: DISCLAIMER_GERAL,
  arrependimento: DIREITO_ARREPENDIMENTO,
};

// ─── Dicionários por idioma ──────────────────────────────────────────────────
// A copy final por idioma substituirá as referências PT_BR abaixo.
// TODO(copy): substituir pelos textos traduzidos quando a copy final chegar.
export const SERVICOS_CONTENT: Record<UiLocale, Record<ServiceSlug, ServiceContent>> = {
  "pt-BR": PT_BR,
  en: PT_BR,
  es: PT_BR,
  de: PT_BR,
  it: PT_BR,
};

export const SERVICOS_INDEX_CONTENT: Record<UiLocale, ServicosIndexContent> = {
  "pt-BR": PT_BR_INDEX,
  en: PT_BR_INDEX,
  es: PT_BR_INDEX,
  de: PT_BR_INDEX,
  it: PT_BR_INDEX,
};

// Rótulos compartilhados das landings (etapas, selos etc.)
export interface ServicoPageLabels {
  passo: string;
  precoUnico: string;
  entrega48h: string;
  sigilo: string;
  voltarTrabalhos: string;
  disclaimer: string;
  arrependimento: string;
  emBreve: string;
}

const PT_BR_LABELS: ServicoPageLabels = {
  passo: "Passo",
  precoUnico: "pagamento único",
  entrega48h: "Ritual realizado em até 48h úteis",
  sigilo: "Sigilo absoluto",
  voltarTrabalhos: "← Todos os trabalhos",
  disclaimer: DISCLAIMER_GERAL,
  arrependimento: DIREITO_ARREPENDIMENTO,
  emBreve: "Em breve — este trabalho ainda não está disponível para compra.",
};

export const SERVICOS_LABELS: Record<UiLocale, ServicoPageLabels> = {
  "pt-BR": PT_BR_LABELS,
  en: PT_BR_LABELS,
  es: PT_BR_LABELS,
  de: PT_BR_LABELS,
  it: PT_BR_LABELS,
};
