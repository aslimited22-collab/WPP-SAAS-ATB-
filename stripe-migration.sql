-- ============================================================
-- ATB TAROT IA — Migration: suporte a Stripe (coexiste com Kiwify)
-- Execute este script no SQL Editor do Supabase APÓS rls-policies.sql
-- É idempotente: pode ser executado mais de uma vez sem efeitos colaterais.
-- ============================================================

-- ------------------------------------------------------------
-- COLUNAS STRIPE na tabela subscriptions
-- As colunas Kiwify (kiwify_subscriber_id, kiwify_transaction_id)
-- continuam existindo e funcionando em paralelo. Para linhas Stripe
-- elas ficam NULL; para linhas Kiwify as colunas Stripe ficam NULL.
-- Postgres permite múltiplos NULL em constraints UNIQUE, então as duas
-- integrações coexistem sem conflito.
-- ------------------------------------------------------------

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

-- Constraint UNIQUE em stripe_subscription_id habilita o upsert
-- com onConflict: "stripe_subscription_id" no webhook.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_stripe_subscription_id_key'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_stripe_subscription_id_key
      UNIQUE (stripe_subscription_id);
  END IF;
END$$;

-- ------------------------------------------------------------
-- ÍNDICES para busca por identificadores Stripe
-- ------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription
  ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
  ON public.subscriptions(stripe_customer_id);

-- Índice parcial para busca de idempotência no webhook Stripe
-- (espelha o índice idx_audit_logs_action usado pelo Kiwify)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_stripe
  ON public.audit_logs(action)
  WHERE action LIKE 'STRIPE_%';
