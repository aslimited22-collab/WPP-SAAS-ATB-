-- ============================================================
-- ATB TAROT IA — Migration + RLS Policies (revisão de segurança)
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- ------------------------------------------------------------
-- TABELAS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nome TEXT CHECK (char_length(nome) <= 100),
  signo TEXT CHECK (signo IN (
    'Áries','Touro','Gêmeos','Câncer','Leão','Virgem',
    'Libra','Escorpião','Sagitário','Capricórnio','Aquário','Peixes'
  )),
  data_nascimento DATE,
  whatsapp TEXT CHECK (whatsapp ~ '^\+?[1-9]\d{7,14}$'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active','inactive','cancelled')),
  kiwify_subscriber_id TEXT,
  kiwify_transaction_id TEXT UNIQUE,
  renovacao_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- UNIQUE em user_id garante que o upsert com onConflict: "user_id" funcione
-- e que não existam dois registros de crédito para o mesmo usuário
CREATE TABLE IF NOT EXISTS public.credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  leituras_restantes INT NOT NULL DEFAULT 0 CHECK (leituras_restantes >= 0),
  mes_referencia TEXT CHECK (mes_referencia ~ '^\d{4}-\d{2}$'),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  prompt_usado TEXT CHECK (char_length(prompt_usado) <= 500),
  resposta_ia TEXT CHECK (char_length(resposta_ia) <= 8000),
  enviado_whatsapp BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  -- action limitado a evitar log injection
  action TEXT NOT NULL CHECK (char_length(action) <= 128),
  ip_address TEXT CHECK (char_length(ip_address) <= 45), -- IPv6 max = 45 chars
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- ATIVAR RLS EM TODAS AS TABELAS
-- ------------------------------------------------------------

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- POLÍTICAS: USERS
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "users_select_own" ON public.users;
CREATE POLICY "users_select_own"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Usuário pode atualizar apenas os campos de perfil — NÃO o email nem o id
-- O email é imutável via trigger (ver abaixo)
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- INSERT feito exclusivamente pelo service_role via webhook Kiwify
DROP POLICY IF EXISTS "users_insert_service" ON public.users;
CREATE POLICY "users_insert_service"
  ON public.users FOR INSERT
  WITH CHECK (false); -- service_role bypassa RLS automaticamente

-- DELETE bloqueado para todos os roles autenticados
-- (exclusão de conta é operação administrativa)
DROP POLICY IF EXISTS "users_delete_deny" ON public.users;
CREATE POLICY "users_delete_deny"
  ON public.users FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- TRIGGER: impede alteração de email na tabela users
-- O email é gerenciado exclusivamente pelo Supabase Auth (auth.users)
-- e sincronizado apenas pelo service_role no webhook.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_email_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'O campo email não pode ser alterado diretamente';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_email_update ON public.users;
CREATE TRIGGER trg_prevent_email_update
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_email_update();

-- ------------------------------------------------------------
-- POLÍTICAS: SUBSCRIPTIONS
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "subscriptions_insert_deny" ON public.subscriptions;
CREATE POLICY "subscriptions_insert_deny"
  ON public.subscriptions FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "subscriptions_update_deny" ON public.subscriptions;
CREATE POLICY "subscriptions_update_deny"
  ON public.subscriptions FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "subscriptions_delete_deny" ON public.subscriptions;
CREATE POLICY "subscriptions_delete_deny"
  ON public.subscriptions FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- POLÍTICAS: CREDITS
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "credits_select_own" ON public.credits;
CREATE POLICY "credits_select_own"
  ON public.credits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "credits_insert_deny" ON public.credits;
CREATE POLICY "credits_insert_deny"
  ON public.credits FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "credits_update_deny" ON public.credits;
CREATE POLICY "credits_update_deny"
  ON public.credits FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "credits_delete_deny" ON public.credits;
CREATE POLICY "credits_delete_deny"
  ON public.credits FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- POLÍTICAS: READINGS
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "readings_select_own" ON public.readings;
CREATE POLICY "readings_select_own"
  ON public.readings FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "readings_insert_deny" ON public.readings;
CREATE POLICY "readings_insert_deny"
  ON public.readings FOR INSERT
  WITH CHECK (false);

-- Leituras são imutáveis após criação
DROP POLICY IF EXISTS "readings_update_deny" ON public.readings;
CREATE POLICY "readings_update_deny"
  ON public.readings FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "readings_delete_deny" ON public.readings;
CREATE POLICY "readings_delete_deny"
  ON public.readings FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- POLÍTICAS: AUDIT_LOGS
-- Usuário pode ver seus próprios logs; escrita apenas via service_role
-- ------------------------------------------------------------

DROP POLICY IF EXISTS "audit_logs_select_own" ON public.audit_logs;
CREATE POLICY "audit_logs_select_own"
  ON public.audit_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "audit_logs_insert_deny" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_deny"
  ON public.audit_logs FOR INSERT
  WITH CHECK (false);

DROP POLICY IF EXISTS "audit_logs_update_deny" ON public.audit_logs;
CREATE POLICY "audit_logs_update_deny"
  ON public.audit_logs FOR UPDATE
  USING (false);

DROP POLICY IF EXISTS "audit_logs_delete_deny" ON public.audit_logs;
CREATE POLICY "audit_logs_delete_deny"
  ON public.audit_logs FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- ÍNDICES para performance
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_transaction
  ON public.subscriptions(kiwify_transaction_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber
  ON public.subscriptions(kiwify_subscriber_id);
CREATE INDEX IF NOT EXISTS idx_credits_user_id
  ON public.credits(user_id);
CREATE INDEX IF NOT EXISTS idx_readings_user_id
  ON public.readings(user_id);
CREATE INDEX IF NOT EXISTS idx_readings_created_at
  ON public.readings(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs(created_at DESC);
-- Índice parcial para busca de idempotência no webhook
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs(action)
  WHERE action LIKE 'KIWIFY_%';

-- ------------------------------------------------------------
-- GRANT: service_role acessa tudo (default no Supabase, explícito para clareza)
-- ------------------------------------------------------------

GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.credits TO service_role;
GRANT ALL ON public.readings TO service_role;
GRANT ALL ON public.audit_logs TO service_role;

-- Revogar acesso público desnecessário
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.subscriptions FROM anon;
REVOKE ALL ON public.credits FROM anon;
REVOKE ALL ON public.readings FROM anon;
REVOKE ALL ON public.audit_logs FROM anon;
