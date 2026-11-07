import type Stripe from "stripe";
import { sendServicoConfirmacaoEmail } from "./email";
import { channelLocale } from "./locale";
import { isRitualSlug } from "./ritual-pricing";
import { findServiceBySlug, pedidoUrl } from "./spiritual-services";
import type { createServiceSupabaseClient } from "./supabase";

type Database = ReturnType<typeof createServiceSupabaseClient>;

export async function reverseStripeRitual(db: Database, intentId: string) {
  const now = new Date().toISOString();
  const { error } = await db.from("service_orders")
    .update({ status: "reembolsado", reembolsado_em: now, updated_at: now })
    .eq("stripe_payment_intent", intentId).neq("status", "reembolsado");
  if (error) throw new Error("Could not record the ritual refund");
}

export async function deliverStripeRitual(db: Database, stripe: Stripe, session: Stripe.Checkout.Session, origin: string) {
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const slug = session.metadata?.service_slug;
  const locale = channelLocale(session.metadata?.locale);
  const email = session.customer_details?.email ?? session.customer_email;
  if (session.payment_status !== "paid" || session.mode !== "payment" || !intent || !email || !isRitualSlug(slug)
    || !locale || !session.amount_total || !["usd", "eur"].includes(session.currency ?? "")) {
    throw new Error("Incomplete paid ritual session");
  }
  const service = await findServiceBySlug(db, slug);
  if (!service || service.id !== session.metadata?.service_id) throw new Error("Unrecognized ritual in paid session");
  const { error } = await db.from("service_orders").upsert({
    service_id: service.id, stripe_payment_intent: intent, amount_cents: session.amount_total,
    currency: session.currency, cliente_email: email.toLowerCase(),
    cliente_nome: session.customer_details?.name?.slice(0, 100) || null,
    locale, status: "pago", pago_em: new Date(session.created * 1000).toISOString(),
  }, { onConflict: "stripe_payment_intent", ignoreDuplicates: true });
  if (error) throw new Error("Could not store the paid ritual");
  const saved = await db.from("service_orders").select("id,access_token,status,confirmacao_email_ok")
    .eq("stripe_payment_intent", intent).single();
  if (saved.error || !saved.data) throw new Error("Could not load the paid ritual");
  if (saved.data.status === "reembolsado" || saved.data.confirmacao_email_ok) return;
  // A refund or dispute may arrive before the checkout event.
  const payment = await stripe.paymentIntents.retrieve(intent, { expand: ["latest_charge"] });
  const charge = payment.latest_charge;
  if (!charge || typeof charge === "string") throw new Error("Could not verify the ritual charge");
  if (charge.refunded || charge.disputed) {
    await reverseStripeRitual(db, intent);
    return;
  }
  const sent = await sendServicoConfirmacaoEmail({
    email, nome: session.customer_details?.name, locale, servicoNome: service.nome, servicoSlug: slug,
    pedidoUrl: pedidoUrl(origin, saved.data.access_token), idempotencyKey: `ritual-confirmation/${saved.data.id}`,
  });
  if (!sent.ok) throw new Error("Ritual confirmation email was not accepted");
  const mark = await db.from("service_orders").update({ confirmacao_email_ok: true }).eq("id", saved.data.id);
  if (mark.error) throw new Error("Could not record ritual confirmation email");
}
