-- ============================================================
-- ATB TAROT IA — Migration: Numerologia (Mapa Numerológico R$45)
--
-- Execute no SQL Editor do Supabase APÓS rls-policies.sql.
-- É idempotente: pode ser executado mais de uma vez.
--
-- Fluxo do produto:
--   compra (Kiwify BR / Stripe intl) → webhook cria o pedido PAGO aqui
--   → e-mail com o link único /numerologia/dados?pedido=<access_token>
--   → a cliente informa nome completo + data de nascimento
--   → geração por IA (DeepSeek) + PDF (pdf-lib) + e-mail com anexo
--   → download em /numerologia/download/<access_token> (30 dias).
-- ============================================================

-- ------------------------------------------------------------
-- 1. NUMEROLOGIA_ORDERS: pedidos do produto
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.numerologia_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Credencial do link único da cliente (/numerologia/dados?pedido=<token>
  -- e /numerologia/download/<token>). Nunca expor id interno em URL.
  access_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  email TEXT NOT NULL CHECK (char_length(email) <= 255),
  -- Nome completo informado pela CLIENTE no form pós-compra (o cálculo
  -- pitagórico usa cada letra). Na compra pode vir o nome do gateway.
  name TEXT CHECK (char_length(name) <= 200),
  birth_date DATE,
  locale TEXT NOT NULL DEFAULT 'pt-BR'
    CHECK (locale IN ('pt-BR', 'en', 'es', 'de', 'it')),
  amount_cents INT NOT NULL DEFAULT 4500,
  currency TEXT NOT NULL DEFAULT 'brl' CHECK (char_length(currency) <= 8),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'paid', 'refunded', 'cancelled'
  )),
  payment_provider TEXT CHECK (payment_provider IN ('kiwify', 'stripe')),
  kiwify_order_id TEXT CHECK (char_length(kiwify_order_id) <= 128),
  stripe_session_id TEXT CHECK (char_length(stripe_session_id) <= 128),
  -- payment_intent da sessão Stripe: o charge.refunded chega com ele — a
  -- revogação faz match direto aqui (como limpeza_orders.payment_id), sem
  -- depender do audit_log da compra ter sido gravado.
  stripe_payment_intent TEXT CHECK (char_length(stripe_payment_intent) <= 128),
  -- Entrega (e-mail com PDF anexo): pending → email_sent | failed
  delivery_status TEXT NOT NULL DEFAULT 'pending' CHECK (delivery_status IN (
    'pending', 'email_sent', 'failed'
  )),
  delivery_attempts INT NOT NULL DEFAULT 0,
  delivery_last_error TEXT CHECK (char_length(delivery_last_error) <= 1000),
  delivered_at TIMESTAMPTZ,
  -- Cron diário: lembrete pra quem pagou e não preencheu nome/nascimento
  -- (marca pra não re-enviar; NULL = nunca lembrada)
  dados_reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Anti-duplicata por gateway: o retry do webhook (ou entrega concorrente)
-- colide aqui (23505) em vez de criar dois pedidos da mesma compra.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_numerologia_orders_kiwify
  ON public.numerologia_orders(kiwify_order_id)
  WHERE kiwify_order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_numerologia_orders_stripe
  ON public.numerologia_orders(stripe_session_id)
  WHERE stripe_session_id IS NOT NULL;

-- Idempotência p/ quem já criou a tabela antes desta coluna existir.
ALTER TABLE public.numerologia_orders
  ADD COLUMN IF NOT EXISTS stripe_payment_intent TEXT
  CHECK (char_length(stripe_payment_intent) <= 128);

CREATE INDEX IF NOT EXISTS idx_numerologia_orders_stripe_pi
  ON public.numerologia_orders(stripe_payment_intent)
  WHERE stripe_payment_intent IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_numerologia_orders_email
  ON public.numerologia_orders(email);
CREATE INDEX IF NOT EXISTS idx_numerologia_orders_status
  ON public.numerologia_orders(status);
CREATE INDEX IF NOT EXISTS idx_numerologia_orders_created
  ON public.numerologia_orders(created_at DESC);

-- ------------------------------------------------------------
-- 2. NUMEROLOGIA_READINGS: leitura gerada por IA (1 por pedido)
-- O PDF é regenerado on-the-fly a partir de full_json — nada em storage.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.numerologia_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE
    REFERENCES public.numerologia_orders(id) ON DELETE CASCADE,
  full_json JSONB,
  full_text TEXT,
  generation_status TEXT NOT NULL DEFAULT 'pending' CHECK (generation_status IN (
    'pending', 'completed', 'error'
  )),
  error_message TEXT CHECK (char_length(error_message) <= 1000),
  model_used TEXT CHECK (char_length(model_used) <= 64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 3. RLS: acesso EXCLUSIVO via service_role.
-- A cliente nunca fala com o banco direto: as rotas validam o access_token
-- no servidor e usam a service key (mesmo modelo de service_orders).
-- ------------------------------------------------------------

ALTER TABLE public.numerologia_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numerologia_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "numerologia_orders_deny_all" ON public.numerologia_orders;
CREATE POLICY "numerologia_orders_deny_all"
  ON public.numerologia_orders FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "numerologia_readings_deny_all" ON public.numerologia_readings;
CREATE POLICY "numerologia_readings_deny_all"
  ON public.numerologia_readings FOR ALL
  USING (false)
  WITH CHECK (false);

GRANT ALL ON public.numerologia_orders TO service_role;
GRANT ALL ON public.numerologia_readings TO service_role;

REVOKE ALL ON public.numerologia_orders FROM anon;
REVOKE ALL ON public.numerologia_readings FROM anon;
