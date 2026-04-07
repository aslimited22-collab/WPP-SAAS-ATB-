import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// ─── Singleton Redis ──────────────────────────────────────────────────────────
let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) return redis;
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    throw new Error(
      "Upstash Redis não configurado: UPSTASH_REDIS_REST_URL e UPSTASH_REDIS_REST_TOKEN são obrigatórios"
    );
  }
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redis;
}

// ─── Rate limiters (lazy) ─────────────────────────────────────────────────────
let generalLimiter: Ratelimit | null = null;
let readingLimiter: Ratelimit | null = null;
let profileLimiter: Ratelimit | null = null;
let webhookLimiter: Ratelimit | null = null;

function makeRatelimiter(
  requests: number,
  window: `${number} ${"ms" | "s" | "m" | "h" | "d"}`,
  prefix: string
): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(requests, window),
    analytics: true,
    prefix,
  });
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

// ─── 1. Rate limit geral por IP — 20 req/min ─────────────────────────────────
// Usado em todas as rotas de API que não têm limiter próprio.
export async function checkRateLimit(
  identifier: string
): Promise<RateLimitResult> {
  if (!generalLimiter)
    generalLimiter = makeRatelimiter(20, "1 m", "atb_rl_general");
  const r = await generalLimiter.limit(identifier);
  return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
}

// ─── 2. Rate limit de leituras por userId — 5 req/hora ───────────────────────
// Mais restritivo: um usuário não pode solicitar mais de 5 leituras por hora,
// mesmo que tenha créditos disponíveis (evita abusos e custos excessivos na API).
export async function checkReadingRateLimit(
  userId: string
): Promise<RateLimitResult> {
  if (!readingLimiter)
    readingLimiter = makeRatelimiter(5, "1 h", "atb_rl_reading");
  const r = await readingLimiter.limit(`user:${userId}`);
  return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
}

// ─── 3. Rate limit de perfil por userId — 10 req/min ─────────────────────────
// Evita spam de atualizações de perfil.
export async function checkProfileRateLimit(
  userId: string
): Promise<RateLimitResult> {
  if (!profileLimiter)
    profileLimiter = makeRatelimiter(10, "1 m", "atb_rl_profile");
  const r = await profileLimiter.limit(`user:${userId}`);
  return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
}

// ─── 4. Rate limit de webhook por IP — 60 req/min ────────────────────────────
// Protege o webhook Kiwify contra replay/flood. A Kiwify legítima raramente
// dispara mais de alguns eventos por minuto.
export async function checkWebhookRateLimit(
  ip: string
): Promise<RateLimitResult> {
  if (!webhookLimiter)
    webhookLimiter = makeRatelimiter(60, "1 m", "atb_rl_webhook");
  const r = await webhookLimiter.limit(`ip:${ip}`);
  return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
}
