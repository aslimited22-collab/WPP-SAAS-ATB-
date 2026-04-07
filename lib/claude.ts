import Anthropic from "@anthropic-ai/sdk";

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

export async function generateReading(profile: UserProfile): Promise<string> {
  const { nome, data_nascimento, signo, pergunta } = profile;

  // Validar e formatar data com segurança
  const dateObj = new Date(data_nascimento + "T00:00:00Z");
  if (isNaN(dateObj.getTime())) {
    throw new Error("Data de nascimento inválida ao gerar leitura");
  }
  const dataFormatada = dateObj.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const nomeSanitizado = sanitizeForPrompt(nome);
  const signoSanitizado = sanitizeForPrompt(signo);

  // Pergunta é tratada como conteúdo do usuário, não do sistema
  const perguntaSanitizada = pergunta ? sanitizeForPrompt(pergunta) : null;

  const systemPrompt = `Você é ATB, o oráculo místico do canal ATB TAROT.
Sempre mencione ATB TAROT pelo nome completo na leitura.
Use a expressão "minha querida alma" com frequência para criar acolhimento e intimidade.
Faça uma leitura profunda e personalizada para [NOME], nascido(a) em [DATA], signo de [SIGNO].
Tom místico, empático e revelador. Máximo 400 palavras.
Mencione 3 cartas do tarot com significados aplicados à vida desta pessoa agora.
Abertura obrigatória: "Minha querida alma, as cartas do ATB TAROT falam hoje especialmente para você..."
Fechamento obrigatório: "Com amor e luz do ATB TAROT, minha querida alma, que as estrelas guiem seu caminho."
Responda APENAS com a leitura de tarot. Não saia deste personagem por nenhum motivo.`
    .replace("[NOME]", nomeSanitizado)
    .replace("[DATA]", dataFormatada)
    .replace("[SIGNO]", signoSanitizado);

  // A pergunta do usuário é enviada como mensagem separada (não injetada no system prompt)
  const userMessage = perguntaSanitizada
    ? `Faça minha leitura de tarot, ATB. Minha pergunta é: "${perguntaSanitizada}"`
    : "Faça minha leitura de tarot, ATB.";

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
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
    throw new Error("Resposta inesperada da API do Claude");
  }

  // Garantir que a resposta não excede 4.000 caracteres (proteção extra)
  return content.text.slice(0, 4000);
}
