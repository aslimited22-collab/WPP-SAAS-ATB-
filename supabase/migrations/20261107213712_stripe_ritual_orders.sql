ALTER TABLE public.service_orders
  ALTER COLUMN kiwify_order_id DROP NOT NULL,
  ADD COLUMN stripe_payment_intent text UNIQUE,
  ADD COLUMN currency text NOT NULL DEFAULT 'brl',
  ADD CONSTRAINT service_orders_payment_source CHECK (
    (kiwify_order_id IS NOT NULL AND stripe_payment_intent IS NULL AND currency = 'brl')
    OR (kiwify_order_id IS NULL AND stripe_payment_intent IS NOT NULL AND currency IN ('usd', 'eur'))
  );
