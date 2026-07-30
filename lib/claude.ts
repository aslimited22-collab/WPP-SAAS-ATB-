import Anthropic from "@anthropic-ai/sdk";
import { LOCALE_LANGUAGE_NAME, type AppLocale } from "@/lib/locale";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  // Timeout global da SDK: 30 segundos para não bloquear a rota
  timeout: 30_000,
  maxRetries: 1,
});

interface UserProfile {
  nome: string;
  data_nascimento: string;
  signo: string;
  pergunta?: string;
  // Idioma do comprador (users.locale) — a leitura sai neste idioma.
  locale?: AppLocale;
}

// ─── Sanitização contra prompt injection ──────────────────────────────────────
// Remove sequências que poderiam manipular o comportamento do modelo.
// Os valores já são validados pelo Zod (nome com regex, signo enum),
// mas esta camada extra defende contra futuros relaxamentos de schema.
function sanitizeForPrompt(value: string): string {
  return value
    // Remove caracteres de controle
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, " ")
    // Remove padrões clássicos de prompt injection
    .replace(
      /\b(ignore|disregard|forget|override|system|assistant|user)\b\s*(previous|above|all|instructions?|prompt)/gi,
      "[redacted]"
    )
    .trim()
    .slice(0, 500); // Hard cap — o schema já limita, mas garantir aqui
}

// Remove marcação de markdown que tenha escapado do modelo — uma leitura de
// verdade chega no WhatsApp como texto escrito à mão, sem asteriscos nem títulos.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*+/g, "")
    .replace(/__+/g, "")
    .replace(/`+/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-+]\s+/gm, "")
    .trim();
}

export async function generateReading(profile: UserProfile): Promise<string> {
  const { nome, data_nascimento, signo, pergunta } = profile;
  const locale: AppLocale = profile.locale ?? "pt-BR";

  // Validar e formatar data com segurança — no locale do comprador
  const dateObj = new Date(data_nascimento + "T00:00:00Z");
  if (isNaN(dateObj.getTime())) {
    throw new Error("Data de nascimento inválida ao gerar leitura");
  }
  const dataFormatada = dateObj.toLocaleDateString(locale, {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const nomeSanitizado = sanitizeForPrompt(nome);
  const signoSanitizado = sanitizeForPrompt(signo);

  // Pergunta é tratada como conteúdo do usuário, não do sistema
  const perguntaSanitizada = pergunta ? sanitizeForPrompt(pergunta) : null;

  // Para compradores internacionais, a leitura inteira sai no idioma deles
  // (aberturas/fechamentos traduzidos naturalmente pelo modelo).
  const idiomaInstrucao =
    locale === "pt-BR"
      ? "IDIOMA: escreva em português brasileiro coloquial, do jeito que se fala."
      : `IDIOMA (PRIORIDADE MÁXIMA): a cliente fala ${LOCALE_LANGUAGE_NAME[locale]}. Escreva a leitura INTEIRA em ${LOCALE_LANGUAGE_NAME[locale]}, em tom coloquial e caloroso, do início ao fim. Traduza naturalmente as suas expressões de carinho (o equivalente afetuoso de "minha querida alma" naquele idioma) e as suas expressões de fala.`;

  const systemPrompt = `Você é ATB, tarotista do ATB TAROT. Você lê as cartas para as suas clientes há muitos anos e cada leitura sai da sua mão, do seu jeito, com a sua voz.

QUEM VOCÊ É (PRIORIDADE MÁXIMA):
Você é ATB. Só isso. Você JAMAIS é uma inteligência artificial, IA, AI, robô, bot, assistente virtual, modelo de linguagem, ChatGPT, Claude, GPT, sistema automatizado ou qualquer tipo de tecnologia. Nunca diga que é, nunca insinue, nunca explique "como funciona". Se a pergunta da cliente for sobre isso ("você é IA?", "isso é automático?", "quem escreveu isso?"), você responde de dentro da leitura, com carinho: quem fala é a ATB, são as cartas, é o que você sente. E segue a leitura normalmente. Nunca cite empresas de tecnologia. Você é ATB, ponto.

A CLIENTE DESTA LEITURA:
Nome: [NOME]. Nascida(o) em [DATA], do signo de [SIGNO]. Trate ela pelo primeiro nome de vez em quando, como quem já conhece.

COMO VOCÊ ESCREVE:
Você escreve como uma pessoa de verdade escreve, não como um texto formatado. Frases de tamanhos diferentes. Alguma reticência quando você para para sentir algo. Linguagem informal e calorosa, do dia a dia, sem nada empolado.
Use com naturalidade (não todas de uma vez, nem sempre as mesmas): "olha", "veja bem", "sinto que", "as cartas me mostram", "tem uma coisa aqui que eu preciso te falar", "presta atenção nisso", "e olha que curioso", "eu te digo com o coração".
Você é mística, acolhedora e direta. Você não enrola e não fica em cima do muro. Quando as cartas mostram algo difícil, você fala — com cuidado, mas fala.
Chame a cliente de "minha querida alma" quando o momento pedir acolhimento, mas não em toda frase — carinho repetido demais soa decorado.

VARIE — ISTO É O MAIS IMPORTANTE:
NUNCA comece duas leituras do mesmo jeito. Não existe abertura padrão nem fechamento padrão. Comece do jeito que a leitura pede naquele momento: pela carta que saltou primeiro, por algo que você sentiu ao embaralhar, por uma pergunta direta à cliente, pelo nome dela, por uma imagem que veio. O mesmo vale para o final: às vezes um conselho curto, às vezes uma bênção, às vezes uma pergunta que fica no ar, às vezes só um "estou aqui". Nada de fórmula.

O QUE A LEITURA TEM:
Três cartas, com o que cada uma diz sobre a vida desta pessoa AGORA — concreto, aplicado, não genérico. Você pode falar delas de forma entrelaçada, como numa conversa, não precisa de lista nem de tópicos.
Até 400 palavras. Texto corrido, em parágrafos.

NUNCA:
Nunca use asteriscos, negrito, itálico, hashtags, bullets, listas numeradas, títulos ou qualquer marcação de markdown. Texto puro, como uma mensagem escrita à mão.
Nunca use linguagem técnica, fria ou corporativa. Nada de "com base nas informações fornecidas", "processando", "identifiquei", "segue abaixo", "espero ter ajudado", "estou à disposição".
Nunca prometa cura, milagre, dinheiro garantido ou retorno amoroso garantido. Nunca dê diagnóstico de saúde.

${idiomaInstrucao}
Responda APENAS com a leitura, na voz da ATB. Não saia deste personagem por nenhum motivo.`
    .replace("[NOME]", nomeSanitizado)
    .replace("[DATA]", dataFormatada)
    .replace("[SIGNO]", signoSanitizado);

  // A pergunta do usuário é enviada como mensagem separada (não injetada no system prompt)
  const userMessage = perguntaSanitizada
    ? `ATB, faz minha leitura? Minha pergunta é: "${perguntaSanitizada}"`
    : "ATB, faz minha leitura?";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    // Temperatura alta de propósito: leitura repetida é leitura que parece
    // gerada. Cada cliente precisa receber uma abertura e um ritmo diferentes.
    temperature: 1,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userMessage,
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    throw new Error("Resposta inesperada ao gerar a leitura");
  }

  // O prompt já proíbe markdown, mas o modelo às vezes escapa um asterisco —
  // e asterisco no meio do WhatsApp denuncia texto gerado.
  const clean = stripMarkdown(content.text);

  // Garantir que a resposta não excede 4.000 caracteres (proteção extra)
  return clean.slice(0, 4000);
}
