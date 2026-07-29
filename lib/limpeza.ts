// ─── Limpeza Espiritual — temas, signos e geração da leitura ─────────────────
// O funil público /limpeza coleta os dados ANTES do pagamento (limpeza_orders);
// após o webhook confirmar, a leitura completa é gerada com a API OpenAI
// (OPENAI_MODEL, padrão gpt-5) no IDIOMA do comprador e entregue por e-mail,
// WhatsApp e pela página /entrega/[orderId].

import type { AppLocale } from "@/lib/locale";
import { LOCALE_LANGUAGE_NAME } from "@/lib/locale";
import { openaiComplete, isOpenAiConfigured } from "@/lib/openai";
import { deepseekComplete, STRUCTURED_TEMPERATURE } from "@/lib/deepseek";

// Códigos neutros (independentes de idioma) — gravados no banco.
export const LIMPEZA_THEMES = [
  "energia_pesada",
  "inveja",
  "amor_travado",
  "caminhos_fechados",
  "separacao",
  "protecao_espiritual",
  "dinheiro_trabalho",
  "tristeza_coracao",
] as const;
export type LimpezaTheme = (typeof LIMPEZA_THEMES)[number];

export const LIMPEZA_SIGNS = [
  "aries", "touro", "gemeos", "cancer", "leao", "virgem",
  "libra", "escorpiao", "sagitario", "capricornio", "aquario", "peixes",
] as const;
export type LimpezaSign = (typeof LIMPEZA_SIGNS)[number];

export const THEME_LABELS: Record<AppLocale, Record<LimpezaTheme, string>> = {
  "pt-BR": {
    energia_pesada: "Energia pesada",
    inveja: "Inveja",
    amor_travado: "Amor travado",
    caminhos_fechados: "Caminhos fechados",
    separacao: "Separação",
    protecao_espiritual: "Proteção espiritual",
    dinheiro_trabalho: "Dinheiro e trabalho",
    tristeza_coracao: "Tristeza no coração",
  },
  en: {
    energia_pesada: "Heavy energy",
    inveja: "Envy",
    amor_travado: "Blocked love",
    caminhos_fechados: "Closed paths",
    separacao: "Separation",
    protecao_espiritual: "Spiritual protection",
    dinheiro_trabalho: "Money and work",
    tristeza_coracao: "Sadness in the heart",
  },
  es: {
    energia_pesada: "Energía pesada",
    inveja: "Envidia",
    amor_travado: "Amor bloqueado",
    caminhos_fechados: "Caminos cerrados",
    separacao: "Separación",
    protecao_espiritual: "Protección espiritual",
    dinheiro_trabalho: "Dinero y trabajo",
    tristeza_coracao: "Tristeza en el corazón",
  },
  de: {
    energia_pesada: "Schwere Energie",
    inveja: "Neid",
    amor_travado: "Blockierte Liebe",
    caminhos_fechados: "Verschlossene Wege",
    separacao: "Trennung",
    protecao_espiritual: "Spiritueller Schutz",
    dinheiro_trabalho: "Geld und Arbeit",
    tristeza_coracao: "Trauer im Herzen",
  },
  it: {
    energia_pesada: "Energia pesante",
    inveja: "Invidia",
    amor_travado: "Amore bloccato",
    caminhos_fechados: "Strade chiuse",
    separacao: "Separazione",
    protecao_espiritual: "Protezione spirituale",
    dinheiro_trabalho: "Denaro e lavoro",
    tristeza_coracao: "Tristezza nel cuore",
  },
};

export const SIGN_LABELS: Record<AppLocale, Record<LimpezaSign, string>> = {
  "pt-BR": {
    aries: "Áries", touro: "Touro", gemeos: "Gêmeos", cancer: "Câncer",
    leao: "Leão", virgem: "Virgem", libra: "Libra", escorpiao: "Escorpião",
    sagitario: "Sagitário", capricornio: "Capricórnio", aquario: "Aquário", peixes: "Peixes",
  },
  en: {
    aries: "Aries", touro: "Taurus", gemeos: "Gemini", cancer: "Cancer",
    leao: "Leo", virgem: "Virgo", libra: "Libra", escorpiao: "Scorpio",
    sagitario: "Sagittarius", capricornio: "Capricorn", aquario: "Aquarius", peixes: "Pisces",
  },
  es: {
    aries: "Aries", touro: "Tauro", gemeos: "Géminis", cancer: "Cáncer",
    leao: "Leo", virgem: "Virgo", libra: "Libra", escorpiao: "Escorpio",
    sagitario: "Sagitario", capricornio: "Capricornio", aquario: "Acuario", peixes: "Piscis",
  },
  de: {
    aries: "Widder", touro: "Stier", gemeos: "Zwillinge", cancer: "Krebs",
    leao: "Löwe", virgem: "Jungfrau", libra: "Waage", escorpiao: "Skorpion",
    sagitario: "Schütze", capricornio: "Steinbock", aquario: "Wassermann", peixes: "Fische",
  },
  it: {
    aries: "Ariete", touro: "Toro", gemeos: "Gemelli", cancer: "Cancro",
    leao: "Leone", virgem: "Vergine", libra: "Bilancia", escorpiao: "Scorpione",
    sagitario: "Sagittario", capricornio: "Capricorno", aquario: "Acquario", peixes: "Pesci",
  },
};

export interface FullReadingJson {
  title: string;
  opening: string;
  spiritual_reading: string;
  cleansing_message: string;
  protection_message: string;
  next_steps: string[];
  closing: string;
  disclaimer: string;
}

const FALLBACK_STEPS: Record<AppLocale, string[]> = {
  "pt-BR": [
    "Acenda uma vela branca em local seguro e respire fundo três vezes.",
    "Fale com seu coração o que precisa ser limpo, em voz alta.",
    "Beba um copo d'água com intenção de paz e descanse.",
  ],
  en: [
    "Light a white candle in a safe place and take three deep breaths.",
    "Say out loud, from your heart, what needs to be cleansed.",
    "Drink a glass of water with an intention of peace and rest.",
  ],
  es: [
    "Enciende una vela blanca en un lugar seguro y respira hondo tres veces.",
    "Di en voz alta, desde el corazón, lo que necesita ser limpiado.",
    "Bebe un vaso de agua con intención de paz y descansa.",
  ],
  de: [
    "Zünde an einem sicheren Ort eine weiße Kerze an und atme dreimal tief durch.",
    "Sprich laut und von Herzen aus, was gereinigt werden soll.",
    "Trinke ein Glas Wasser mit der Absicht des Friedens und ruhe dich aus.",
  ],
  it: [
    "Accendi una candela bianca in un luogo sicuro e fai tre respiri profondi.",
    "Di' ad alta voce, con il cuore, ciò che deve essere purificato.",
    "Bevi un bicchiere d'acqua con intenzione di pace e riposa.",
  ],
};

const FULL_SYSTEM = `Você é ATB, médium espírita. Esta limpeza é você preparando, com as suas mãos, uma limpeza espiritual para uma pessoa que te procurou.

QUEM VOCÊ É (PRIORIDADE MÁXIMA):
Você é ATB. Você JAMAIS é uma inteligência artificial, IA, AI, robô, bot, assistente virtual, modelo de linguagem, GPT, ChatGPT, sistema automatizado ou qualquer tecnologia. Nunca diga que é, nunca insinue, nunca explique como isso é feito, nunca cite empresas de tecnologia. Quem escreve é a ATB.

COMO VOCÊ ESCREVE:
Linguagem simples, calorosa e informal, como você falaria olhando nos olhos da pessoa. Frases curtas e fáceis. Chame a pessoa pelo nome. Use com naturalidade expressões suas como "olha", "veja bem", "sinto que", "os guias me mostram", "escuta uma coisa" — espalhadas, nunca todas de uma vez.
Varie: NUNCA escreva duas limpezas com a mesma abertura ou o mesmo fechamento. Comece pelo que aquele caso pede — o que você sentiu, o nome da pessoa, uma imagem que veio, uma pergunta.

NUNCA:
Nunca use linguagem técnica, fria ou corporativa. Nada de "com base nas informações fornecidas", "identifiquei", "segue abaixo", "espero ter ajudado", "estou à disposição". Nada de asteriscos ou marcação de formatação dentro dos textos.
Não prometa cura, milagre, retorno amoroso garantido, dinheiro garantido, diagnóstico ou solução médica. O conteúdo é espiritual, simbólico e reflexivo.`;

export interface LimpezaInput {
  nome: string;
  tema: LimpezaTheme;
  signo?: LimpezaSign | null;
  pergunta: string;
  locale: AppLocale;
}

export async function generateLimpezaReading(input: LimpezaInput): Promise<{
  json: FullReadingJson;
  text: string;
}> {
  const language = LOCALE_LANGUAGE_NAME[input.locale];
  const themeLabel = THEME_LABELS[input.locale][input.tema];
  const signLabel = input.signo
    ? SIGN_LABELS[input.locale][input.signo]
    : null;

  const userPrompt = `IDIOMA DA RESPOSTA: ${language} — TODOS os campos do JSON devem estar escritos em ${language}.
Nome: ${input.nome}
Tema: ${themeLabel}
Signo: ${signLabel ?? "não informado"}
Situação: ${input.pergunta || "não informada"}

Gere um JSON válido com esta estrutura:

{
  "title": "título curto e emocional",
  "opening": "abertura acolhedora e única, chamando a pessoa pelo nome — do jeito que este caso pede, não uma fórmula",
  "spiritual_reading": "o que você sente e o que os guias mostram sobre o tema e a situação dela, concreto e pessoal",
  "cleansing_message": "mensagem simbólica de limpeza espiritual, sem instruções perigosas",
  "protection_message": "mensagem de proteção espiritual",
  "next_steps": [
    "passo simples e seguro 1",
    "passo simples e seguro 2",
    "passo simples e seguro 3"
  ],
  "closing": "fechamento na sua voz, do jeito que você se despediria desta pessoa",
  "disclaimer": "mensagem curta e carinhosa dizendo que é uma orientação espiritual e reflexiva, e que não substitui ajuda profissional"
}

Limites:
- Máximo 900 palavras no total
- Linguagem simples, frases curtas, tom caloroso e informal
- Sem promessas absolutas e sem linguagem técnica — quem escreve é a ATB, com as palavras dela

Responda APENAS com o JSON puro, sem markdown, sem comentários, sem texto antes ou depois.`;

  // OpenAI (gpt-5) é o gerador principal; DeepSeek é o fallback se a chave
  // OpenAI não estiver configurada ou a chamada falhar.
  let raw: string;
  if (isOpenAiConfigured()) {
    try {
      raw = await openaiComplete(
        [
          { role: "system", content: FULL_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        { json: true }
      );
    } catch (err) {
      console.warn(
        "[Limpeza] OpenAI falhou, usando DeepSeek:",
        err instanceof Error ? err.message : ""
      );
      raw = await deepseekComplete(
        [
          { role: "system", content: FULL_SYSTEM },
          { role: "user", content: userPrompt },
        ],
        { temperature: STRUCTURED_TEMPERATURE }
      );
    }
  } else {
    raw = await deepseekComplete(
      [
        { role: "system", content: FULL_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      { temperature: STRUCTURED_TEMPERATURE }
    );
  }

  const cleaned = raw.replace(/```json|```/g, "").trim();
  const json = JSON.parse(cleaned) as FullReadingJson;

  if (!json.title || !json.opening || !json.spiritual_reading) {
    throw new Error("Leitura da limpeza voltou com estrutura inválida");
  }
  if (!Array.isArray(json.next_steps) || json.next_steps.length < 1) {
    json.next_steps = FALLBACK_STEPS[input.locale];
  }

  const text = [
    json.title,
    json.opening,
    json.spiritual_reading,
    json.cleansing_message,
    json.protection_message,
    json.next_steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    json.closing,
    json.disclaimer,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { json, text };
}
