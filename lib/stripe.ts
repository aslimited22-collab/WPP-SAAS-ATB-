// Cliente Stripe compartilhado (checkout internacional + webhook).
import Stripe from "stripe";

let stripeClient: Stripe | null = null;

// Sem apiVersion explícita: o SDK usa a versão pinada para a qual os tipos
// foram gerados. Retorna null se a chave não estiver configurada — quem chama
// decide se isso é erro fatal (webhook) ou fallback (checkout).
export function getStripe(): Stripe | null {
  if (stripeClient) return stripeClient;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  stripeClient = new Stripe(key);
  return stripeClient;
}
