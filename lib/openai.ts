// ─── Cliente OpenAI (geração da Limpeza Espiritual) ──────────────────────────
// A leitura completa da limpeza usa a API OpenAI (modelo definido em
// OPENAI_MODEL, padrão gpt-5) — mesma API usada no projeto do chat.
// Implementado via fetch para não adicionar dependência.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export interface OpenAiMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export function isOpenAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export async function openaiComplete(
  messages: OpenAiMsg[],
  options?: { json?: boolean }
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  const model = process.env.OPENAI_MODEL || "gpt-5";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(options?.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`OpenAI: ${res.status}`);
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}
