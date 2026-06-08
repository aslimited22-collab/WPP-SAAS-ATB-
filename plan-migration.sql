-- ============================================================
-- ATB TAROT IA — Migration: coluna `plan` na tabela users
-- Execute no SQL Editor do Supabase APÓS rls-policies.sql.
-- É idempotente: pode ser executado mais de uma vez sem efeitos colaterais.
--
-- A coluna `plan` registra o plano vigente do usuário:
--   'basic'   → plano mensal (R$29) e compras avulsas (pergunta3, limpeza)
--   'premium' → plano de leituras ilimitadas (R$291,65)
-- Os webhooks Kiwify e Stripe preenchem esta coluna automaticamente.
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan TEXT
  CHECK (plan IS NULL OR plan IN ('basic', 'premium'));

-- Índice para consultas/segmentação por plano (opcional, mas barato).
CREATE INDEX IF NOT EXISTS idx_users_plan ON public.users(plan);
