-- ============================================================
-- ATB TAROT IA — Migration: Trabalhos Espirituais Individuais
-- (Limpeza Espiritual, Divórcio Energético, Ritual de Prosperidade,
--  Devoção a Xangô, Harmonização Amorosa)
--
-- Execute no SQL Editor do Supabase APÓS rls-policies.sql e
-- produtos-chat-limpeza-migration.sql.
-- É idempotente: pode ser executado mais de uma vez.
--
-- Modelo de entrega (100% por E-MAIL, sem WhatsApp):
--   compra → e-mail de confirmação com o LINK ÚNICO do pedido
--   (/pedido/<access_token>) → cliente preenche nome completo e intenção
--   nesse link → o OPERADOR realiza o ritual pessoalmente em até 48h
--   úteis e marca manualmente no painel → operador anexa o registro
--   (foto/áudio) e envia o e-mail de entrega, que aponta para o MESMO
--   link, onde o registro passa a aparecer.
--
-- O status `ritual_realizado` SÓ é marcado manualmente pelo operador —
-- nada no sistema afirma que um ritual aconteceu antes disso.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SPIRITUAL_SERVICES: catálogo dos trabalhos
-- Preço vem SEMPRE daqui (nunca hardcoded nas páginas) — os valores
-- dos produtos 3–5 são placeholders em validação de mercado e serão
-- ajustados direto no banco.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.spiritual_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,64}$'),
  nome TEXT NOT NULL CHECK (char_length(nome) <= 100),
  preco_centavos INT NOT NULL CHECK (preco_centavos > 0),
  descricao_curta TEXT CHECK (char_length(descricao_curta) <= 300),
  ativo BOOLEAN NOT NULL DEFAULT true,
  -- Vínculo com a Kiwify: o webhook identifica o trabalho comprado pelo
  -- product_id; o CTA da landing usa a checkout_url. Preencher no painel
  -- da Kiwify e atualizar aqui (UPDATE) quando os produtos forem criados.
  kiwify_product_id TEXT UNIQUE CHECK (char_length(kiwify_product_id) <= 128),
  kiwify_checkout_url TEXT CHECK (
    kiwify_checkout_url IS NULL
    OR kiwify_checkout_url ~ '^https://[a-z0-9.-]+\.kiwify\.com'
  ),
  -- Ordem de exibição na página /servicos
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed dos trabalhos. ON CONFLICT DO NOTHING: re-executar a migration
-- NÃO sobrescreve preços/URLs já ajustados manualmente no banco.
--
-- A LIMPEZA ESPIRITUAL (R$100) NÃO entra aqui de propósito: ela já existe
-- como produto próprio, com funil (/limpeza), geração automática e entrega
-- em /entrega/[orderId] (tabelas limpeza_orders/limpeza_readings). É o
-- MESMO produto — duplicá-la aqui criaria dois caminhos para a mesma venda
-- e colidiria com AMOUNT_CENTS_TO_PLAN (10000 → "limpeza") em lib/plans.ts.
INSERT INTO public.spiritual_services
  (slug, nome, preco_centavos, descricao_curta, ativo, ordem)
VALUES
  ('corte-de-lacos', 'Divórcio Energético', 14700,
   'Libertação energética e encerramento de ciclos — desapego para abrir espaço ao novo.', true, 2),
  ('ritual-de-prosperidade', 'Ritual de Prosperidade', 14700,
   'Desbloqueio espiritual dos caminhos da fartura e alinhamento com a abundância.', true, 3),
  ('devocao-a-xango', 'Devoção a Xangô', 19700,
   'Devoção ao orixá da justiça: força, serenidade e fé para quem atravessa uma disputa.', true, 4),
  ('harmonizacao-amorosa', 'Harmonização Amorosa', 14700,
   'Harmonia e fortalecimento da relação, abertura dos caminhos do amor.', true, 5)
ON CONFLICT (slug) DO NOTHING;

-- ------------------------------------------------------------
-- 2. SERVICE_ORDERS: pedidos dos trabalhos
-- Fluxo: pago → em_preparacao → ritual_realizado → entregue
--        (+ reembolsado, a qualquer momento)
-- Cada transição tem seu timestamp próprio, gravado pelo código no
-- momento da mudança de status.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.service_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.spiritual_services(id),
  cliente_nome TEXT CHECK (char_length(cliente_nome) <= 100),
  cliente_email TEXT NOT NULL CHECK (char_length(cliente_email) <= 255),
  -- Telefone informado na compra. Guardado apenas como referência de
  -- contato para o operador — NÃO é usado para envio (o canal é e-mail).
  cliente_telefone TEXT CHECK (char_length(cliente_telefone) <= 20),
  -- Credencial do link único do cliente: /pedido/<access_token>.
  -- A mesma URL serve para preencher os dados e, depois, para ver o
  -- registro do ritual — o cliente guarda um link só.
  access_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- Preenchidos pelo CLIENTE no formulário do link acima e revisados
  -- pelo operador antes do ritual.
  nome_completo_ritual TEXT CHECK (char_length(nome_completo_ritual) <= 200),
  intencao TEXT CHECK (char_length(intencao) <= 4000),
  intencao_aguardando_revisao BOOLEAN NOT NULL DEFAULT false,
  form_respondido_em TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pago' CHECK (status IN (
    'pago', 'em_preparacao', 'ritual_realizado', 'entregue', 'reembolsado'
  )),
  kiwify_order_id TEXT NOT NULL UNIQUE CHECK (char_length(kiwify_order_id) <= 128),
  amount_cents INT,
  locale TEXT NOT NULL DEFAULT 'pt-BR'
    CHECK (locale IN ('pt-BR', 'en', 'es', 'de', 'it')),
  -- Timestamps de cada transição de status
  pago_em TIMESTAMPTZ,
  em_preparacao_em TIMESTAMPTZ,
  ritual_realizado_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,
  reembolsado_em TIMESTAMPTZ,
  -- Última vez que o lembrete de dados pendentes foi disparado (manual)
  lembrete_enviado_em TIMESTAMPTZ,
  -- E-mail de confirmação pós-compra
  confirmacao_email_ok BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_orders_status
  ON public.service_orders(status);
CREATE INDEX IF NOT EXISTS idx_service_orders_service
  ON public.service_orders(service_id);
CREATE INDEX IF NOT EXISTS idx_service_orders_email
  ON public.service_orders(cliente_email);
CREATE INDEX IF NOT EXISTS idx_service_orders_created
  ON public.service_orders(created_at DESC);
-- Busca pelo link único do cliente (rota /pedido/[token])
CREATE INDEX IF NOT EXISTS idx_service_orders_access_token
  ON public.service_orders(access_token);

-- ------------------------------------------------------------
-- 3. SERVICE_DELIVERABLES: registros do ritual (foto/áudio/mensagem)
-- storage_path aponta para o bucket privado `service-deliverables`;
-- enviado_em marca quando o registro foi entregue ao cliente.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.service_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.service_orders(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('foto', 'audio', 'mensagem')),
  storage_path TEXT CHECK (char_length(storage_path) <= 500),
  -- Para tipo 'mensagem' o conteúdo fica aqui (não vai ao Storage)
  conteudo_texto TEXT CHECK (char_length(conteudo_texto) <= 4000),
  enviado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_deliverables_order
  ON public.service_deliverables(order_id);

-- ------------------------------------------------------------
-- 4. RLS: acesso EXCLUSIVO via service_role.
-- O cliente nunca fala com o banco direto: a página /pedido/[token] é
-- renderizada no servidor, que valida o token e usa a service key.
-- ------------------------------------------------------------

ALTER TABLE public.spiritual_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_deliverables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spiritual_services_deny_all" ON public.spiritual_services;
CREATE POLICY "spiritual_services_deny_all"
  ON public.spiritual_services FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "service_orders_deny_all" ON public.service_orders;
CREATE POLICY "service_orders_deny_all"
  ON public.service_orders FOR ALL
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "service_deliverables_deny_all" ON public.service_deliverables;
CREATE POLICY "service_deliverables_deny_all"
  ON public.service_deliverables FOR ALL
  USING (false)
  WITH CHECK (false);

GRANT ALL ON public.spiritual_services TO service_role;
GRANT ALL ON public.service_orders TO service_role;
GRANT ALL ON public.service_deliverables TO service_role;

REVOKE ALL ON public.spiritual_services FROM anon;
REVOKE ALL ON public.service_orders FROM anon;
REVOKE ALL ON public.service_deliverables FROM anon;

-- ------------------------------------------------------------
-- 5. STORAGE: bucket PRIVADO para fotos/áudios dos rituais.
-- Sem policies em storage.objects → apenas o service_role acessa
-- (uploads e signed URLs são gerados pelo servidor).
-- ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('service-deliverables', 'service-deliverables', false)
ON CONFLICT (id) DO NOTHING;
