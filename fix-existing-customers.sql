-- ============================================================
-- ATB TAROT IA — Correção manual de clientes que já compraram
-- Execute no SQL Editor do Supabase.
--
-- Pré-requisito: a coluna users.plan deve existir (plan-migration.sql).
-- Este script já inclui o ALTER idempotente, então é seguro rodá-lo sozinho.
--
-- O que faz para cada cliente:
--   1. Garante que a linha em public.users exista (copia de auth.users).
--   2. Atualiza users.plan.
--   3. Cria/garante uma subscription com status 'active'.
--   4. Define o saldo de créditos (valor ABSOLUTO final desejado).
--
-- É idempotente: pode ser executado mais de uma vez sem duplicar dados.
-- ============================================================

-- Garante a coluna `plan` (idempotente).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS plan TEXT
  CHECK (plan IS NULL OR plan IN ('basic', 'premium'));

BEGIN;

-- ------------------------------------------------------------
-- 1) cahfalcao.cf@gmail.com
--    Comprou "limpeza" (R$100) → plan = 'basic', 1 crédito.
-- ------------------------------------------------------------
INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users WHERE email = 'cahfalcao.cf@gmail.com'
ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET plan = 'basic' WHERE email = 'cahfalcao.cf@gmail.com';

INSERT INTO public.subscriptions (user_id, status, kiwify_transaction_id)
SELECT id, 'active', 'manual-fix-cahfalcao'
FROM public.users WHERE email = 'cahfalcao.cf@gmail.com'
ON CONFLICT (kiwify_transaction_id) DO NOTHING;

INSERT INTO public.credits (user_id, leituras_restantes, mes_referencia)
SELECT id, 1, to_char(now(), 'YYYY-MM')
FROM public.users WHERE email = 'cahfalcao.cf@gmail.com'
ON CONFLICT (user_id) DO UPDATE
  SET leituras_restantes = EXCLUDED.leituras_restantes,
      mes_referencia = EXCLUDED.mes_referencia,
      updated_at = now();

-- ------------------------------------------------------------
-- 2) rosimara.16sampaio@gmil.com
--    Pagou R$291,65 → plan = 'premium', 999 créditos (ilimitado).
--    ATENÇÃO: o domínio "gmil.com" parece um typo de "gmail.com".
--    Foi mantido exatamente como informado. Se nada for atualizado,
--    confira o e-mail real do cliente em auth.users.
-- ------------------------------------------------------------
INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users WHERE email = 'rosimara.16sampaio@gmil.com'
ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET plan = 'premium' WHERE email = 'rosimara.16sampaio@gmil.com';

INSERT INTO public.subscriptions (user_id, status, kiwify_transaction_id)
SELECT id, 'active', 'manual-fix-rosimara'
FROM public.users WHERE email = 'rosimara.16sampaio@gmil.com'
ON CONFLICT (kiwify_transaction_id) DO NOTHING;

INSERT INTO public.credits (user_id, leituras_restantes, mes_referencia)
SELECT id, 999, to_char(now(), 'YYYY-MM')
FROM public.users WHERE email = 'rosimara.16sampaio@gmil.com'
ON CONFLICT (user_id) DO UPDATE
  SET leituras_restantes = EXCLUDED.leituras_restantes,
      mes_referencia = EXCLUDED.mes_referencia,
      updated_at = now();

-- ------------------------------------------------------------
-- 3) imperatricezen@gmail.com
--    Comprou "pergunta3". Já tinha 1 crédito; +2 = 3 no total.
--    Definimos o valor ABSOLUTO final = 3. plan = 'basic'.
-- ------------------------------------------------------------
INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users WHERE email = 'imperatricezen@gmail.com'
ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET plan = 'basic' WHERE email = 'imperatricezen@gmail.com';

INSERT INTO public.subscriptions (user_id, status, kiwify_transaction_id)
SELECT id, 'active', 'manual-fix-imperatricezen'
FROM public.users WHERE email = 'imperatricezen@gmail.com'
ON CONFLICT (kiwify_transaction_id) DO NOTHING;

INSERT INTO public.credits (user_id, leituras_restantes, mes_referencia)
SELECT id, 3, to_char(now(), 'YYYY-MM')
FROM public.users WHERE email = 'imperatricezen@gmail.com'
ON CONFLICT (user_id) DO UPDATE
  SET leituras_restantes = EXCLUDED.leituras_restantes,
      mes_referencia = EXCLUDED.mes_referencia,
      updated_at = now();

-- ------------------------------------------------------------
-- 4) santos.marypoppins@gmail.com
--    Já está 'basic'; garantir o plano e 5 créditos.
-- ------------------------------------------------------------
INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users WHERE email = 'santos.marypoppins@gmail.com'
ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET plan = 'basic' WHERE email = 'santos.marypoppins@gmail.com';

INSERT INTO public.subscriptions (user_id, status, kiwify_transaction_id)
SELECT id, 'active', 'manual-fix-santos'
FROM public.users WHERE email = 'santos.marypoppins@gmail.com'
ON CONFLICT (kiwify_transaction_id) DO NOTHING;

INSERT INTO public.credits (user_id, leituras_restantes, mes_referencia)
SELECT id, 5, to_char(now(), 'YYYY-MM')
FROM public.users WHERE email = 'santos.marypoppins@gmail.com'
ON CONFLICT (user_id) DO UPDATE
  SET leituras_restantes = EXCLUDED.leituras_restantes,
      mes_referencia = EXCLUDED.mes_referencia,
      updated_at = now();

-- ------------------------------------------------------------
-- 5) kleialeite@live.com
--    Já está 'basic'; garantir o plano e 5 créditos.
-- ------------------------------------------------------------
INSERT INTO public.users (id, email)
SELECT id, email FROM auth.users WHERE email = 'kleialeite@live.com'
ON CONFLICT (id) DO NOTHING;

UPDATE public.users SET plan = 'basic' WHERE email = 'kleialeite@live.com';

INSERT INTO public.subscriptions (user_id, status, kiwify_transaction_id)
SELECT id, 'active', 'manual-fix-kleialeite'
FROM public.users WHERE email = 'kleialeite@live.com'
ON CONFLICT (kiwify_transaction_id) DO NOTHING;

INSERT INTO public.credits (user_id, leituras_restantes, mes_referencia)
SELECT id, 5, to_char(now(), 'YYYY-MM')
FROM public.users WHERE email = 'kleialeite@live.com'
ON CONFLICT (user_id) DO UPDATE
  SET leituras_restantes = EXCLUDED.leituras_restantes,
      mes_referencia = EXCLUDED.mes_referencia,
      updated_at = now();

COMMIT;

-- ------------------------------------------------------------
-- Conferência (rode após o COMMIT):
-- ------------------------------------------------------------
-- SELECT u.email, u.plan, s.status, c.leituras_restantes, c.mes_referencia
-- FROM public.users u
-- LEFT JOIN public.subscriptions s ON s.user_id = u.id
-- LEFT JOIN public.credits c ON c.user_id = u.id
-- WHERE u.email IN (
--   'cahfalcao.cf@gmail.com',
--   'rosimara.16sampaio@gmil.com',
--   'imperatricezen@gmail.com',
--   'santos.marypoppins@gmail.com',
--   'kleialeite@live.com'
-- );
