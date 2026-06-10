-- ============================================================
-- ATB TAROT IA — Migration: produtos de chat (DeepSeek) e
-- Limpeza Espiritual entregável + idioma do comprador.
-- Execute no SQL Editor do Supabase APÓS rls-policies.sql,
-- plan-migration.sql e stripe-migration.sql.
-- É idempotente: pode ser executado mais de uma vez.
-- ============================================================

-- ------------------------------------------------------------
-- 1. USERS: idioma do comprador + créditos/cota de chat
-- ------------------------------------------------------------

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'pt-BR'
    CHECK (locale IN ('pt-BR', 'en', 'es'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS chat_credits_balance INT NOT NULL DEFAULT 0
    CHECK (chat_credits_balance >= 0);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS chat_credits_total_purchased INT NOT NULL DEFAULT 0
    CHECK (chat_credits_total_purchased >= 0);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS messages_month INT NOT NULL DEFAULT 0
    CHECK (messages_month >= 0);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_message_month TEXT
    CHECK (last_message_month IS NULL OR last_message_month ~ '^\d{4}-\d{2}$');

-- ------------------------------------------------------------
-- 2. TRIGGER: impede que o próprio usuário altere colunas
-- privilegiadas (plan e contadores de chat) via RLS update.
-- Apenas o service_role (webhooks/APIs server-side) pode mudá-las.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_privileged_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.role() é NULL em conexões diretas (SQL editor) e 'service_role'
  -- com a service key — ambos são privilegiados.
  IF COALESCE(auth.role(), 'service_role') <> 'service_role' THEN
    IF NEW.plan IS DISTINCT FROM OLD.plan
       OR NEW.chat_credits_balance IS DISTINCT FROM OLD.chat_credits_balance
       OR NEW.chat_credits_total_purchased IS DISTINCT FROM OLD.chat_credits_total_purchased
       OR NEW.messages_month IS DISTINCT FROM OLD.messages_month
       OR NEW.last_message_month IS DISTINCT FROM OLD.last_message_month THEN
      RAISE EXCEPTION 'Campos de plano/créditos não podem ser alterados diretamente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_privileged_user_update ON public.users;
CREATE TRIGGER trg_prevent_privileged_user_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_privileged_user_update();

-- ------------------------------------------------------------
-- 3. CHAT_MESSAGES: histórico do chat com a ATB
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (char_length(content) <= 8000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_select_own" ON public.chat_messages;
CREATE POLICY "chat_messages_select_own"
  ON public.chat_messages FOR SELECT
  USING (auth.uid() = user_id);

-- Escrita exclusivamente via service_role (a rota /api/chat usa service key)
DROP POLICY IF EXISTS "chat_messages_insert_deny" ON public.chat_messages;
CREATE POLICY "chat_messages_insert_deny"
  ON public.chat_messages FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "chat_messages_update_deny" ON public.chat_messages;
CREATE POLICY "chat_messages_update_deny"
  ON public.chat_messages FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "chat_messages_delete_deny" ON public.chat_messages;
CREATE POLICY "chat_messages_delete_deny"
  ON public.chat_messages FOR DELETE
  USING (false);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
  ON public.chat_messages(user_id, created_at DESC);

-- ------------------------------------------------------------
-- 4. LIMPEZA_ORDERS: pedidos do funil /limpeza
-- (pré-pagamento; o webhook marca como paid e dispara a entrega)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.limpeza_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT CHECK (char_length(nome) <= 100),
  email TEXT NOT NULL CHECK (char_length(email) <= 255),
  phone TEXT CHECK (char_length(phone) <= 20),
  signo TEXT CHECK (signo IS NULL OR signo IN (
    'aries','touro','gemeos','cancer','leao','virgem',
    'libra','escorpiao','sagitario','capricornio','aquario','peixes'
  )),
  tema TEXT NOT NULL CHECK (tema IN (
    'energia_pesada','inveja','amor_travado','caminhos_fechados',
    'separacao','protecao_espiritual','dinheiro_trabalho','tristeza_coracao'
  )),
  pergunta TEXT CHECK (char_length(pergunta) <= 600),
  locale TEXT NOT NULL DEFAULT 'pt-BR' CHECK (locale IN ('pt-BR', 'en', 'es')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'refunded', 'cancelled')),
  payment_provider TEXT CHECK (payment_provider IN ('kiwify', 'stripe')),
  payment_id TEXT CHECK (char_length(payment_id) <= 255),
  amount_cents INT,
  currency TEXT CHECK (char_length(currency) <= 8),
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN (
      'pending', 'email_sent', 'whatsapp_sent', 'both_sent', 'failed'
    )),
  delivery_attempts INT NOT NULL DEFAULT 0,
  delivery_last_error TEXT,
  delivery_last_attempt_at TIMESTAMPTZ,
  delivery_email_sent_at TIMESTAMPTZ,
  delivery_whatsapp_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Acesso EXCLUSIVO via service_role (a página /entrega usa o UUID como
-- credencial e lê pelo servidor). Nenhum acesso anon/autenticado direto.
ALTER TABLE public.limpeza_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "limpeza_orders_deny_all" ON public.limpeza_orders;
CREATE POLICY "limpeza_orders_deny_all"
  ON public.limpeza_orders FOR ALL
  USING (false)
  WITH CHECK (false);

CREATE INDEX IF NOT EXISTS idx_limpeza_orders_email
  ON public.limpeza_orders(email);
CREATE INDEX IF NOT EXISTS idx_limpeza_orders_payment
  ON public.limpeza_orders(payment_provider, payment_id);
CREATE INDEX IF NOT EXISTS idx_limpeza_orders_delivery_status
  ON public.limpeza_orders(delivery_status);

-- ------------------------------------------------------------
-- 5. LIMPEZA_READINGS: leitura gerada (OpenAI) por pedido
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.limpeza_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE
    REFERENCES public.limpeza_orders(id) ON DELETE CASCADE,
  full_json JSONB NOT NULL,
  full_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.limpeza_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "limpeza_readings_deny_all" ON public.limpeza_readings;
CREATE POLICY "limpeza_readings_deny_all"
  ON public.limpeza_readings FOR ALL
  USING (false)
  WITH CHECK (false);

-- ------------------------------------------------------------
-- 6. GRANTS
-- ------------------------------------------------------------

GRANT ALL ON public.chat_messages TO service_role;
GRANT ALL ON public.limpeza_orders TO service_role;
GRANT ALL ON public.limpeza_readings TO service_role;

REVOKE ALL ON public.chat_messages FROM anon;
REVOKE ALL ON public.limpeza_orders FROM anon;
REVOKE ALL ON public.limpeza_readings FROM anon;
