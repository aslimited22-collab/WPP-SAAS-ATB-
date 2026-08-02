// ─── Envio de WhatsApp via Z-API ──────────────────────────────────────────────
// Toda mensagem sai com "digitando..." antes: primeiro a presença (composing),
// que aparece na hora no aparelho da cliente, e depois o texto com delayTyping,
// que faz a própria Z-API segurar a mensagem pelo tempo proporcional ao
// tamanho dela. Sem isso a leitura chega instantânea e entrega o jogo.

import { typingDelaySeconds } from "@/lib/human-typing";

// ─── Validação de env vars no carregamento do módulo ─────────────────────────
// IDs e tokens não devem conter caracteres que permitam path traversal na URL
const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

function getEnvVar(name: string, required = true): string {
  const val = process.env[name] ?? "";
  if (required && !val) {
    throw new Error(`Variável de ambiente obrigatória não configurada: ${name}`);
  }
  return val;
}

function validateZapiCredentials(): {
  instanceId: string;
  token: string;
  securityToken: string;
} {
  const instanceId = getEnvVar("ZAPI_INSTANCE_ID");
  const token = getEnvVar("ZAPI_TOKEN");
  const securityToken = getEnvVar("ZAPI_SECURITY_TOKEN", false);

  if (!SAFE_ID_RE.test(instanceId)) {
    throw new Error("ZAPI_INSTANCE_ID contém caracteres inválidos");
  }
  if (!SAFE_ID_RE.test(token)) {
    throw new Error("ZAPI_TOKEN contém caracteres inválidos");
  }

  return { instanceId, token, securityToken };
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Remove tudo que não for dígito (mantém apenas números)
function sanitizePhoneNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}

// Trunca a mensagem para evitar payload excessivamente grande (~10 KB)
function truncateMessage(message: string, maxChars = 4000): string {
  if (message.length <= maxChars) return message;
  return message.slice(0, maxChars - 3) + "...";
}

function zapiHeaders(securityToken: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (securityToken) {
    headers["Client-Token"] = securityToken;
  }
  return headers;
}

/**
 * Mostra "digitando..." no WhatsApp da cliente imediatamente.
 * Best-effort: se a Z-API recusar a presença, o envio do texto continua
 * normalmente (o delayTyping da própria mensagem já segura o ritmo).
 */
export async function sendTypingPresence(
  phone: string,
  durationSeconds: number
): Promise<boolean> {
  let credentials: ReturnType<typeof validateZapiCredentials>;
  try {
    credentials = validateZapiCredentials();
  } catch {
    return false;
  }
  const { instanceId, token, securityToken } = credentials;

  const sanitizedPhone = sanitizePhoneNumber(phone);
  if (!sanitizedPhone) return false;

  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-presence`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: zapiHeaders(securityToken),
      body: JSON.stringify({
        phone: sanitizedPhone,
        status: "composing",
        duration: Math.max(1, Math.round(durationSeconds)),
      }),
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    // Falha na presença não impede o envio da mensagem
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface SendWhatsAppOptions {
  /**
   * Simula digitação humana antes de entregar a mensagem (padrão: true).
   * Só passe false para avisos operacionais que precisam sair na hora.
   */
  humanTyping?: boolean;
}

export async function sendWhatsApp(
  phone: string,
  message: string,
  options: SendWhatsAppOptions = {}
): Promise<SendWhatsAppResult> {
  const { humanTyping = true } = options;
  const { instanceId, token, securityToken } = validateZapiCredentials();

  const sanitizedPhone = sanitizePhoneNumber(phone);
  if (!sanitizedPhone || sanitizedPhone.length < 8 || sanitizedPhone.length > 15) {
    return { success: false, error: "Número de telefone inválido" };
  }

  const truncatedMessage = truncateMessage(message);

  // Tempo proporcional ao tamanho: mensagem curta ~2-5s, leitura longa até 15s
  // (teto da Z-API). Quem lê vê "digitando..." esse tempo todo antes do texto.
  const typingSeconds = humanTyping
    ? typingDelaySeconds(truncatedMessage)
    : 0;

  // A presença aparece na hora no aparelho; o delayTyping abaixo é o que
  // realmente segura a mensagem do lado da Z-API.
  if (typingSeconds > 0) {
    await sendTypingPresence(sanitizedPhone, typingSeconds);
  }

  // URL construída somente com valores validados (sem path traversal possível)
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

  const headers = zapiHeaders(securityToken);

  // AbortController com timeout de 15 segundos
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: sanitizedPhone,
        message: truncatedMessage,
        // A Z-API segura a mensagem e mantém "digitando..." por esses segundos
        // — o tempo de espera corre no lado deles, não na nossa função.
        ...(typingSeconds > 0 ? { delayTyping: typingSeconds } : {}),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      // Não logar o body da resposta para evitar vazamento de dados da Z-API
      console.error("[Z-API] Resposta não-ok:", response.status);
      return { success: false, error: `Z-API retornou status ${response.status}` };
    }

    const data = (await response.json()) as {
      zaapId?: string;
      messageId?: string;
    };

    return { success: true, messageId: data.zaapId ?? data.messageId };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[Z-API] Timeout ao enviar mensagem");
      return { success: false, error: "Timeout ao conectar com Z-API" };
    }
    // Não logar o erro completo (pode conter dados sensíveis da requisição)
    console.error("[Z-API] Erro ao enviar mensagem");
    return { success: false, error: "Erro ao enviar mensagem via Z-API" };
  } finally {
    clearTimeout(timeoutId);
  }
}
