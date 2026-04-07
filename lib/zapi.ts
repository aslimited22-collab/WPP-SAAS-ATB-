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

export async function sendWhatsApp(
  phone: string,
  message: string
): Promise<SendWhatsAppResult> {
  const { instanceId, token, securityToken } = validateZapiCredentials();

  const sanitizedPhone = sanitizePhoneNumber(phone);
  if (!sanitizedPhone || sanitizedPhone.length < 8 || sanitizedPhone.length > 15) {
    return { success: false, error: "Número de telefone inválido" };
  }

  const truncatedMessage = truncateMessage(message);

  // URL construída somente com valores validados (sem path traversal possível)
  const url = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (securityToken) {
    headers["Client-Token"] = securityToken;
  }

  // AbortController com timeout de 15 segundos
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ phone: sanitizedPhone, message: truncatedMessage }),
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
