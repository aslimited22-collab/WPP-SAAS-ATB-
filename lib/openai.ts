// ─── Cliente OpenAI (geração da Limpeza Espiritual) ──────────────────────────
// A leitura completa da limpeza usa a API OpenAI (modelo definido em
// OPENAI_MODEL, padrão gpt-5) — mesma API usada no projeto do chat.
// Implementado via fetch para não adicionar dependência.

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";

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

// ─── Geração de imagem ────────────────────────────────────────────────────────
// Usa gpt-image-1 (mesmo modelo do scripts/generate-images.js, que gerou as
// imagens do site) com fallback para dall-e-3. Devolve os bytes da imagem.
//
// A imagem é uma OBRA SIMBÓLICA criada a partir da intenção da pessoa — nunca
// é apresentada como fotografia de um ritual físico. Os prompts pedem
// explicitamente "no text, no words" porque modelos de imagem escrevem
// palavras deformadas.
export interface OpenAiImageResult {
  bytes: Buffer;
  contentType: string;
  extension: string;
}

export async function openaiImage(
  prompt: string,
  options?: { size?: "1024x1024" | "1536x1024"; timeoutMs?: number }
): Promise<OpenAiImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  const size = options?.size ?? "1024x1024";

  async function tentar(model: "gpt-image-1" | "dall-e-3"): Promise<OpenAiImageResult> {
    const body: Record<string, unknown> = { model, prompt, n: 1 };
    if (model === "gpt-image-1") {
      body.size = size;
      body.output_format = "webp";
      body.quality = "high";
    } else {
      // dall-e-3 aceita apenas 1024x1024, 1792x1024 e 1024x1792.
      body.size = size === "1536x1024" ? "1792x1024" : "1024x1024";
      body.response_format = "b64_json";
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      options?.timeoutMs ?? 120_000
    );
    try {
      const res = await fetch(OPENAI_IMAGE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`OpenAI imagem (${model}): ${res.status}`);

      const data = (await res.json()) as {
        data?: { b64_json?: string }[];
      };
      const b64 = data.data?.[0]?.b64_json;
      if (!b64) throw new Error(`OpenAI imagem (${model}): resposta sem imagem`);

      const isWebp = model === "gpt-image-1";
      return {
        bytes: Buffer.from(b64, "base64"),
        contentType: isWebp ? "image/webp" : "image/png",
        extension: isWebp ? "webp" : "png",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  try {
    return await tentar("gpt-image-1");
  } catch (err) {
    console.warn(
      "[OpenAI] gpt-image-1 falhou, tentando dall-e-3:",
      err instanceof Error ? err.message : ""
    );
    return tentar("dall-e-3");
  }
}
