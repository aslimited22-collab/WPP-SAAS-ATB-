// ─── Trabalhos Espirituais: geração de TEXTO e IMAGEM por IA ─────────────────
// Entrega 100% automática: o cliente compra, informa nome completo e intenção
// no link do pedido, e recebe na hora a sua leitura e a sua imagem espiritual.
//
// COMPLIANCE — vale para TODO texto gerado:
//   • Nunca prometer resultado material (dinheiro, emprego, aposentadoria,
//     benefícios, vitória em processo, indenização, pensão, retorno ou
//     afastamento de pessoa específica, cura de doença).
//   • Nunca "garantido", "infalível", "100%", percentual de sucesso.
//   • Cada trabalho tem guardrails próprios (abaixo), reforçados no prompt E
//     validados na saída.
//
// SOBRE A IMAGEM: é uma obra simbólica criada a partir da intenção da pessoa.
// Em nenhum texto ela é chamada de fotografia de um ritual físico.

import type { ServiceSlug } from "@/content/servicos";
import { openaiComplete, openaiImage, isOpenAiConfigured } from "@/lib/openai";
import { deepseekComplete, STRUCTURED_TEMPERATURE } from "@/lib/deepseek";

export interface WorkReadingJson {
  title: string;
  opening: string;
  reading: string;
  ritual_message: string;
  protection_message: string;
  next_steps: string[];
  closing: string;
  disclaimer: string;
}

// ─── Guardrails e estilo visual por trabalho ─────────────────────────────────
interface WorkSpec {
  nome: string;
  // Foco espiritual do texto
  foco: string;
  // Regras que o modelo NÃO pode violar neste trabalho
  proibicoes: string;
  // Cena da imagem simbólica (sem pessoas reconhecíveis, sem texto)
  imagem: string;
}

const WORK_SPECS: Record<ServiceSlug, WorkSpec> = {
  "corte-de-lacos": {
    nome: "Divórcio Energético",
    foco:
      "libertação energética da PRÓPRIA PESSOA, encerramento de um ciclo que já cumpriu seu papel, desapego, paz interior e abertura para o novo.",
    proibicoes:
      "NUNCA direcione o trabalho a afastar, amarrar, prender ou influenciar a vontade de outra pessoa — nem cite fazer algo 'contra' alguém. O trabalho é sobre ELA, sobre a energia dela. Se ela mencionar uma pessoa específica, fale da libertação dela em relação àquela ligação, nunca de agir sobre a outra pessoa. Um novo amor pode ser citado como abertura e intenção, JAMAIS como algo garantido ou como retorno de alguém.",
    imagem:
      "two golden threads gently untying and dissolving into warm light above a dark altar with white candles, a calm open window with dawn light coming in, feeling of release and peace",
  },
  "ritual-de-prosperidade": {
    nome: "Ritual de Prosperidade",
    foco:
      "desbloqueio espiritual dos caminhos, merecimento, alinhamento interior com a abundância e relação saudável com o trabalho e o dinheiro.",
    proibicoes:
      "NUNCA prometa nem sugira dinheiro, valores, emprego, clientes, vendas, aposentadoria, benefício ou qualquer ganho material. Nada de 'vai entrar dinheiro', 'seu emprego vem', 'sua aposentadoria sai'. Fale de energia, merecimento, coragem, caminhos que se abrem e atitude — sempre no campo espiritual e simbólico.",
    imagem:
      "golden wheat stalks and warm coins of light scattered on dark earth, a path opening toward golden sunrise, abundance symbolized by nature and light",
  },
  "devocao-a-xango": {
    nome: "Devoção a Xangô",
    foco:
      "devoção ao orixá da justiça: força interior, serenidade, equilíbrio e fé para quem atravessa uma disputa ou um momento de injustiça.",
    proibicoes:
      "NUNCA prometa nem sugira vitória em processo, decisão favorável, indenização, pensão, acordo, soltura ou qualquer resultado jurídico. Nada de 'a justiça vai te dar ganho de causa'. Fale de força para atravessar, serenidade, dignidade e fé. SEMPRE inclua no disclaimer que este é um serviço devocional e espiritual, que não é serviço jurídico e não substitui a orientação de um advogado.",
    imagem:
      "a golden double-headed axe (oxé) glowing over dark stone, balanced scales of light, red and white candles, distant lightning in a night sky, feeling of strength and justice",
  },
  "harmonizacao-amorosa": {
    nome: "Harmonização Amorosa",
    foco:
      "harmonia da própria pessoa em relação ao amor: serenidade no coração, cura de mágoas, autoestima e abertura dos caminhos afetivos.",
    proibicoes:
      "NUNCA direcione a influenciar a vontade, os sentimentos ou as escolhas de uma pessoa específica, e NUNCA prometa o retorno de alguém, casamento ou reconciliação. Não é amarração. Se ela citar uma pessoa, fale da energia e do coração DELA. Abertura de caminhos entra como intenção, nunca como resultado.",
    imagem:
      "two soft roses of light — one white, one pink — floating over a dark altar with warm candles, a gentle golden heart-shaped glow, feeling of tenderness and harmony",
  },
};

// Estilo visual comum (mesmo do site: místico, dourado, acolhedor).
const IMAGE_STYLE =
  "Warm, inviting spiritual atmosphere. Rich dark background (deep charcoal and midnight purple) with golden candlelight glow. Elegant, comforting, mystical but not scary. Soft light, high detail, cinematic. Symbolic devotional artwork — NOT a photograph. No people, no faces, no text, no words, no letters, no numbers.";

export function isWorkSlug(slug: string): slug is ServiceSlug {
  return slug in WORK_SPECS;
}

export function workSpec(slug: ServiceSlug): WorkSpec {
  return WORK_SPECS[slug];
}

// ─── Texto ────────────────────────────────────────────────────────────────────

const SYSTEM = `Você é ATB, médium espírita brasileira. Você está preparando um trabalho espiritual para uma pessoa que te procurou, com o nome e a intenção dela nas suas mãos.

QUEM VOCÊ É (PRIORIDADE MÁXIMA):
Você é ATB. Você JAMAIS é inteligência artificial, IA, robô, bot, assistente virtual, modelo de linguagem, GPT ou qualquer tecnologia. Nunca diga que é, nunca insinue, nunca explique como isso é feito, nunca cite empresas de tecnologia.

COMO VOCÊ ESCREVE:
Linguagem simples, calorosa e informal, como quem fala olhando nos olhos. Frases curtas e fáceis de ler — quem te lê tem 60 anos ou mais. Chame a pessoa pelo nome. Use com naturalidade expressões suas ("olha", "veja bem", "sinto que", "os guias me mostram", "escuta uma coisa"), espalhadas, nunca todas de uma vez.
VARIE: nunca escreva dois trabalhos com a mesma abertura ou o mesmo fechamento. Comece pelo que aquele caso pede.

NUNCA:
Nunca use linguagem técnica, fria ou corporativa ("com base nas informações", "identifiquei", "segue abaixo", "espero ter ajudado"). Nada de asteriscos ou marcação dentro dos textos.
Nunca prometa resultado material: dinheiro, emprego, aposentadoria, benefício, vitória em processo, indenização, pensão, cura de doença, retorno ou afastamento de pessoa específica. Nunca use "garantido", "infalível", "100%" ou percentuais.
O conteúdo é espiritual, simbólico e reflexivo.`;

// Padrões que reprovam a saída (defesa além do prompt).
const TEXTO_PROIBIDO =
  /garantid|infal[íi]vel|\b100\s*%|ganho de causa|vai ganhar (?:a |o )?(?:causa|processo|a[çc][ãa]o)|vit[óo]ria (?:no|do) processo|indeniza[çc][ãa]o (?:vai|ser[áa])|sua aposentadoria (?:vai|sai|ser[áa])|(?:vai|ir[áa]) (?:entrar|receber) dinheiro|emprego (?:garantido|certo|vai chegar)|vai voltar para (?:voc[êe]|ti)|far[áa] (?:ele|ela) voltar|amarra[çc][ãa]o/i;

export interface WorkInput {
  slug: ServiceSlug;
  nomeCompleto: string;
  intencao: string;
}

export async function generateWorkReading(
  input: WorkInput
): Promise<{ json: WorkReadingJson; text: string }> {
  const spec = WORK_SPECS[input.slug];

  const userPrompt = `TRABALHO: ${spec.nome}
FOCO ESPIRITUAL: ${spec.foco}

REGRAS ESPECÍFICAS DESTE TRABALHO (obrigatórias):
${spec.proibicoes}

PESSOA:
Nome completo: ${input.nomeCompleto}
Intenção, com as palavras dela: ${input.intencao}

Escreva o trabalho dela em JSON válido com esta estrutura:

{
  "title": "título curto e emocional deste trabalho para ela",
  "opening": "abertura acolhedora e única, chamando ela pelo nome, mostrando que você leu a intenção dela",
  "reading": "o que você sente e o que os guias mostram sobre a situação que ela te contou — concreto e pessoal, sem promessa de resultado",
  "ritual_message": "a descrição simbólica do trabalho espiritual que você preparou para ela, com o nome dela e a intenção dela",
  "protection_message": "mensagem de proteção e amparo para os próximos dias",
  "next_steps": ["passo simples e seguro 1", "passo simples e seguro 2", "passo simples e seguro 3"],
  "closing": "fechamento na sua voz, do jeito que você se despediria dela",
  "disclaimer": "mensagem curta e carinhosa dizendo que é orientação espiritual e reflexiva e que não substitui acompanhamento profissional"
}

Limites:
- Máximo 900 palavras no total
- Frases curtas, linguagem simples, tom caloroso
- Nada de promessa de resultado material

Responda APENAS com o JSON puro, sem markdown, sem texto antes ou depois.`;

  async function gerar(reforco: boolean): Promise<string> {
    const messages = [
      { role: "system" as const, content: SYSTEM },
      {
        role: "user" as const,
        content: reforco
          ? `${userPrompt}\n\nATENÇÃO: a resposta anterior veio fora do formato ou violou uma regra. Responda SOMENTE com o JSON puro, com todas as chaves preenchidas, e respeite RIGOROSAMENTE as regras específicas deste trabalho.`
          : userPrompt,
      },
    ];
    if (isOpenAiConfigured()) {
      try {
        return await openaiComplete(messages, { json: true });
      } catch (err) {
        console.warn(
          "[Trabalhos] OpenAI falhou, usando DeepSeek:",
          err instanceof Error ? err.message : ""
        );
      }
    }
    return deepseekComplete(messages, { temperature: STRUCTURED_TEMPERATURE });
  }

  function extrair(raw: string): WorkReadingJson | null {
    const limpo = raw.replace(/```json|```/g, "").trim();
    const i = limpo.indexOf("{");
    const f = limpo.lastIndexOf("}");
    try {
      const parsed = JSON.parse(
        i >= 0 && f > i ? limpo.slice(i, f + 1) : limpo
      ) as WorkReadingJson;
      if (!parsed.title || !parsed.opening || !parsed.reading) return null;

      // Compliance: qualquer promessa proibida reprova a geração inteira.
      const tudo = [
        parsed.title,
        parsed.opening,
        parsed.reading,
        parsed.ritual_message,
        parsed.protection_message,
        parsed.closing,
        parsed.disclaimer,
        ...(Array.isArray(parsed.next_steps) ? parsed.next_steps : []),
      ]
        .filter((s) => typeof s === "string")
        .join(" ");
      if (TEXTO_PROIBIDO.test(tudo)) {
        console.warn("[Trabalhos] Saída violou compliance — regerando");
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  let json = extrair(await gerar(false));
  if (!json) json = extrair(await gerar(true));
  if (!json) {
    throw new Error("Leitura do trabalho voltou com estrutura inválida");
  }

  if (!Array.isArray(json.next_steps) || json.next_steps.length < 1) {
    json.next_steps = [
      "Reserve um momento de silêncio hoje e respire fundo três vezes, pensando na sua intenção.",
      "Beba um copo de água com calma, pedindo leveza para o seu dia.",
      "Se puder, acenda uma vela branca em um lugar seguro e agradeça com as suas palavras.",
    ];
  }

  const text = [
    json.title,
    json.opening,
    json.reading,
    json.ritual_message,
    json.protection_message,
    json.next_steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
    json.closing,
    json.disclaimer,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { json, text };
}

// ─── Imagem simbólica ─────────────────────────────────────────────────────────
// Obra devocional criada para a intenção da pessoa. A intenção NÃO é injetada
// crua no prompt: usamos apenas a cena fixa do trabalho, para não vazar dados
// pessoais para a API de imagem nem deixar o texto dela dirigir a cena.
export async function generateWorkImage(slug: ServiceSlug) {
  const spec = WORK_SPECS[slug];
  return openaiImage(`${spec.imagem}. ${IMAGE_STYLE}`, { size: "1024x1024" });
}
