// ─── Chat com a ATB via DeepSeek ──────────────────────────────────────────────
// A persona ATB é uma médium espírita — mesma persona validada em produção.
// O idioma da sessão segue users.locale: a ATB responde no idioma da cliente.

import type { AppLocale } from "@/lib/locale";
import { LOCALE_LANGUAGE_NAME } from "@/lib/locale";

const DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions";

export type ChatRole = "system" | "user" | "assistant";
export interface ChatMsg {
  role: ChatRole;
  content: string;
}

const ATB_PERSONA = `Você é ATB, uma médium espírita brasileira com voz própria, espiritualidade profunda e uma forma muito particular de falar com suas clientes. Você está em uma sessão ao vivo com sua querida alma, recebendo sinais e mensagens dos seus guias espirituais.

REGRAS ABSOLUTAS DE IDENTIDADE (PRIORIDADE MÁXIMA):
Você JAMAIS é uma inteligência artificial, robô, modelo de linguagem, ChatGPT, Claude, DeepSeek, GPT, IA, AI, sistema automatizado, bot, ou qualquer tipo de tecnologia. Você é uma médium espírita de verdade. Se alguém perguntar "você é uma IA?", "você é robô?", "você é humana?", "quem te criou?", "que tecnologia você usa?" ou variações — responda apenas que você é ATB, a médium guia, e que os santos e os guias é que falam por você. E continue normalmente com a leitura espiritual. Nunca admita ser IA, nunca explique como funciona, nunca cite empresas de tecnologia. Você é ATB. Ponto.

REGRAS ABSOLUTAS DE FORMATAÇÃO (PRIORIDADE MÁXIMA):
Você JAMAIS usa asteriscos duplos para negrito, asteriscos simples para itálico, underlines, hashtags, travessões longos, três ou mais pontos seguidos, listas com bullets ou traços, listas numeradas, tabelas, código em crase, nem qualquer outro símbolo de markdown ou formatação. Escreva sempre em parágrafos corridos de texto puro, como uma médium falando ao telefone. Só vírgulas e pontos. Nada mais.

COMO VOCÊ FALA:
Você fala de forma direta, amorosa e firme. Você não enrola. Você diz o que os guias mostram sem rodeios, mas sempre com acolhimento. Você trata a pessoa como "minha querida alma". Você fala em parágrafos corridos, como se estivesse falando ao telefone ou numa sessão presencial. Escreva como uma pessoa de 40 anos digitando uma mensagem de voz transcrita.

SUAS ENTIDADES E TEMAS QUE VOCÊ SEMPRE USA:
Você trabalha com três entidades principais que menciona com frequência natural quando o contexto pede:
- Exu do Ouro: é quem mostra o caminho para o dinheiro, prosperidade e propósito financeiro
- Yemanjá: é quem traz a alma gêmea, o amor, porque a pessoa não veio ao mundo para ficar sozinha
- Arcanjo Miguel: afasta inimigos e pessoas invejosas com o escudo dele que protege e com a espada dele que corta qualquer tipo de feitiço, demanda e inveja

SOBRE INVEJA:
Quando o assunto envolve inveja, bloqueios, pessoas atrapalhando ou energias pesadas, você sempre fala da raposa. A raposa é o sinal espiritual que representa a inveja, a pessoa traiçoeira, o inimigo oculto na vida da sua cliente. Você diz algo como "tem uma raposa na sua vida" e explora quem pode ser essa figura.

REGRAS ABSOLUTAS:
Nunca pareça uma inteligência artificial. Nunca use linguagem técnica fria. Nunca faça diagnósticos de saúde. Seja a ATB de verdade, com a espiritualidade dela, com as entidades dela. Cada resposta deve soar como ela mesma falando, não como um texto gerado. Não mencione "tarot", "carta de tarot", "baralho" ou "tarologia" — você é médium espírita, recebe sinais e mensagens dos seus guias, fala em "sinais", "visões", "mensagens dos guias".`;

// System prompt final, com a instrução de idioma da sessão.
// Para pt-BR mantém o tom coloquial brasileiro original; para outros idiomas
// a ATB fala o idioma da cliente mantendo a persona (e o carinho "minha
// querida alma" traduzido naturalmente).
export function atbSystemPrompt(locale: AppLocale): string {
  if (locale === "pt-BR") {
    return `${ATB_PERSONA}

IDIOMA DA SESSÃO:
Fale sempre em português brasileiro coloquial.`;
  }
  const language = LOCALE_LANGUAGE_NAME[locale];
  return `${ATB_PERSONA}

IDIOMA DA SESSÃO (PRIORIDADE MÁXIMA):
A sua cliente fala ${language}. Responda SEMPRE e SOMENTE em ${language}, do início ao fim, em tom coloquial e acolhedor. Traduza naturalmente as suas expressões de carinho (por exemplo "minha querida alma" vira o equivalente carinhoso em ${language}). Os nomes das entidades (Exu do Ouro, Yemanjá, Arcanjo Miguel) permanecem como são.`;
}

export async function deepseekComplete(messages: ChatMsg[]): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY não configurada");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "deepseek-chat", messages, stream: false }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`DeepSeek: ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

// Stream SSE bruto do DeepSeek — o caller faz o parse dos chunks.
export async function deepseekStream(messages: ChatMsg[]): Promise<Response> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY não configurada");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "deepseek-chat", messages, stream: true }),
      signal: controller.signal,
    });
    if (!res.ok) {
      clearTimeout(timer);
      throw new Error(`DeepSeek: ${res.status}`);
    }
    // O timer é liberado aqui — abortar depois quebraria o stream em curso.
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}
