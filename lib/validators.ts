import { z } from "zod";

export const SIGNOS = [
  "Áries",
  "Touro",
  "Gêmeos",
  "Câncer",
  "Leão",
  "Virgem",
  "Libra",
  "Escorpião",
  "Sagitário",
  "Capricórnio",
  "Aquário",
  "Peixes",
] as const;

export type Signo = (typeof SIGNOS)[number];

// Remove null bytes e caracteres de controle (exceto tab/newline legítimos)
function stripControlChars(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

// ─── Perfil do usuário ────────────────────────────────────────────────────────
export const profileSchema = z.object({
  nome: z
    .string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .transform(stripControlChars)
    .pipe(
      z
        .string()
        .regex(/^[a-zA-ZÀ-ÿ\s'-]+$/, "Nome contém caracteres inválidos")
        .min(2)
    )
    .transform((v) => v.trim()),
  signo: z.enum(SIGNOS, { errorMap: () => ({ message: "Signo inválido" }) }),
  data_nascimento: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida (use YYYY-MM-DD)")
    .refine((d) => {
      // Verificar se é uma data real (ex: rejeita 2023-02-31)
      const date = new Date(d + "T00:00:00Z");
      return (
        !isNaN(date.getTime()) &&
        date.toISOString().startsWith(d) &&
        date < new Date() &&
        date > new Date("1900-01-01T00:00:00Z")
      );
    }, "Data de nascimento inválida"),
  whatsapp: z
    .string()
    .min(8, "WhatsApp muito curto")
    .max(16, "WhatsApp muito longo")
    .regex(
      /^\+?[1-9]\d{7,14}$/,
      "WhatsApp inválido. Use formato internacional: +5511999999999"
    )
    .transform((v) => v.replace(/\s/g, "")),
});

export type ProfileInput = z.infer<typeof profileSchema>;

// ─── Guia de Vícios ───────────────────────────────────────────────────────────
export const CATEGORIAS_GUIA = [
  "Alimentação Emocional",
  "Relacionamentos Tóxicos",
  "Procrastinação",
  "Vício em Redes Sociais",
  "Ansiedade Crônica",
  "Cigarro",
  "Álcool",
] as const;

export type CategoriaGuia = (typeof CATEGORIAS_GUIA)[number];

export const guiaViciosSchema = z.object({
  categoria: z.enum(CATEGORIAS_GUIA, {
    errorMap: () => ({ message: "Categoria inválida." }),
  }),
});

export type GuiaViciosInput = z.infer<typeof guiaViciosSchema>;

// ─── Solicitação de leitura ───────────────────────────────────────────────────
export const readingRequestSchema = z.object({
  pergunta: z
    .string()
    .max(500, "Pergunta deve ter no máximo 500 caracteres")
    .transform(stripControlChars)
    // Rejeitar strings que parecem injeção de prompt
    .refine(
      (v) =>
        !/ignore\s+(previous|all|above)|disregard|system\s+prompt|jailbreak/i.test(v),
      "Pergunta contém conteúdo inválido"
    )
    .optional()
    .transform((v) => {
      const trimmed = v?.trim();
      // Converter string vazia para undefined
      return trimmed === "" ? undefined : trimmed;
    }),
});

export type ReadingRequestInput = z.infer<typeof readingRequestSchema>;

// ─── Pedido do funil da Limpeza Espiritual (/limpeza) ────────────────────────
// Criado ANTES do pagamento; o webhook (Kiwify external_reference ou Stripe
// metadata.order_id) marca como pago e dispara a entrega.
// Nome aceita qualquer alfabeto (\p{L}) — compradores internacionais.
export const LIMPEZA_TEMAS = [
  "energia_pesada",
  "inveja",
  "amor_travado",
  "caminhos_fechados",
  "separacao",
  "protecao_espiritual",
  "dinheiro_trabalho",
  "tristeza_coracao",
] as const;

export const LIMPEZA_SIGNOS = [
  "aries", "touro", "gemeos", "cancer", "leao", "virgem",
  "libra", "escorpiao", "sagitario", "capricornio", "aquario", "peixes",
] as const;

export const limpezaOrderSchema = z.object({
  nome: z
    .string()
    .min(2, "Nome muito curto")
    .max(100, "Nome muito longo")
    .transform(stripControlChars)
    .pipe(
      z
        .string()
        .regex(/^[\p{L}\p{M}\s'.-]+$/u, "Nome contém caracteres inválidos")
        .min(2)
    )
    .transform((v) => v.trim()),
  email: z
    .string()
    .min(5, "E-mail muito curto")
    .email("E-mail inválido")
    .max(255)
    .toLowerCase()
    .trim(),
  phone: z
    .string()
    .max(20)
    .regex(/^\+?[0-9\s()-]*$/, "Telefone inválido")
    .optional()
    .transform((v) => {
      const digits = (v ?? "").replace(/\D/g, "");
      return digits.length >= 8 ? digits : undefined;
    }),
  signo: z.enum(LIMPEZA_SIGNOS).optional(),
  tema: z.enum(LIMPEZA_TEMAS, {
    errorMap: () => ({ message: "Tema inválido" }),
  }),
  pergunta: z
    .string()
    .max(600, "Texto muito longo")
    .transform(stripControlChars)
    .optional()
    .transform((v) => (v ?? "").trim()),
  locale: z.enum(["pt-BR", "en", "es", "de", "it"]).default("pt-BR"),
});

export type LimpezaOrderInput = z.infer<typeof limpezaOrderSchema>;

// ─── Magic link login ─────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: z
    .string()
    .min(5, "E-mail muito curto")
    .email("E-mail inválido")
    .max(255, "E-mail muito longo")
    .toLowerCase()
    .trim(),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Helpers de validação de URL de redirect ──────────────────────────────────
// Permite apenas caminhos relativos seguros para evitar open redirect
export function isSafeRedirectPath(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  // Deve começar com / mas não com // (que seria um redirect externo)
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  // Rejeitar URLs absolutas
  if (/^\/[a-zA-Z][a-zA-Z\d+\-.]*:/.test(path)) return false;
  // Permitir apenas caracteres seguros em caminhos
  return /^\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]*$/.test(path);
}
