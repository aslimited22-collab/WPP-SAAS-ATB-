// GET /api/checkout/[plan]
// Roteador de checkout global — decide o gateway pelo país do visitante:
//
//   Brasil (x-vercel-ip-country=BR) → 307 redirect para a Kiwify (env URL)
//   Resto do mundo                  → Stripe Checkout Session (USD/EUR/JPY)
//
// Produtos: basic, premium (assinaturas) · pergunta1/3/7, limpeza (one-time).
// Para a limpeza, aceita ?order=<uuid> (criado pelo funil /limpeza) e propaga
// como client_reference_id para o webhook casar o pagamento com o pedido.

import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { isBrazilRequest, normalizeLocale } from "@/lib/locale";
import {
  PRODUCT_PRICES,
  PRODUCT_TYPE,
  kiwifyUrlFor,
  productDisplayName,
  currencyForRequest,
  stripeCheckoutLocale,
  isValidProduct,
} from "@/lib/pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function appUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  ).replace(/\/$/, "");
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ plan: string }> }
) {
  const { plan: planParam } = await params;
  const plan = (planParam ?? "").toLowerCase();
  const baseUrl = appUrl(request);

  if (!isValidProduct(plan)) {
    return NextResponse.redirect(`${baseUrl}/#assinar`, 307);
  }

  // Pedido do funil da limpeza — SÓ é honrado no produto limpeza, para que
  // um order UUID forjado em outro produto não sequestre o provisionamento.
  const orderParam = request.nextUrl.searchParams.get("order");
  const orderId =
    plan === "limpeza" && orderParam && UUID_RE.test(orderParam)
      ? orderParam
      : null;

  // ── Brasil → Kiwify ────────────────────────────────────────────────────────
  if (isBrazilRequest(request)) {
    const kiwifyUrl = kiwifyUrlFor(plan);
    if (!kiwifyUrl) {
      console.warn("[Checkout] URL Kiwify ausente para o produto:", plan);
      return NextResponse.redirect(`${baseUrl}/#assinar`, 307);
    }
    // O id do pedido vai em external_reference E em s1 (TrackingParameters):
    // a Kiwify ecoa parâmetros de rastreio s1/s2/s3 no payload do webhook.
    const url = orderId
      ? `${kiwifyUrl}${kiwifyUrl.includes("?") ? "&" : "?"}external_reference=${orderId}&s1=${orderId}`
      : kiwifyUrl;
    return NextResponse.redirect(url, 307);
  }

  // ── Internacional → Stripe ────────────────────────────────────────────────
  const stripe = getStripe();
  if (!stripe) {
    console.error("[Checkout] STRIPE_SECRET_KEY não configurada");
    return NextResponse.redirect(`${baseUrl}/#assinar?error=stripe`, 307);
  }

  const { currency, locale } = currencyForRequest(request);

  // Defesa em profundidade: o caminho internacional NUNCA cobra em BRL.
  // Se headers contaminados levarem a BRL aqui, volta para a Kiwify.
  if (currency === "brl") {
    const kiwifyUrl = kiwifyUrlFor(plan);
    if (kiwifyUrl) return NextResponse.redirect(kiwifyUrl, 307);
    return NextResponse.redirect(`${baseUrl}/#assinar`, 307);
  }

  const amount = PRODUCT_PRICES[plan][currency];
  const isSubscription = PRODUCT_TYPE[plan] === "subscription";
  const appLocale = normalizeLocale(locale);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? "subscription" : "payment",
      payment_method_types: ["card"],
      // Comprador internacional vê SEMPRE o preço na moeda definida aqui.
      adaptive_pricing: { enabled: false },
      locale: stripeCheckoutLocale(locale) as "auto",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amount,
            product_data: {
              name: productDisplayName(plan, appLocale),
            },
            ...(isSubscription
              ? { recurring: { interval: "month" as const } }
              : {}),
          },
        },
      ],
      ...(orderId ? { client_reference_id: orderId } : {}),
      success_url: `${baseUrl}/obrigado?plan=${plan}&lang=${appLocale}`,
      cancel_url: plan === "limpeza" ? `${baseUrl}/limpeza` : `${baseUrl}/#assinar`,
      billing_address_collection: "auto",
      metadata: {
        plan,
        source: "international",
        locale: appLocale,
        currency,
        ...(orderId ? { order_id: orderId } : {}),
      },
    });

    if (!session.url) {
      console.error("[Checkout] Stripe não retornou URL de sessão");
      return NextResponse.redirect(`${baseUrl}/#assinar?error=session`, 307);
    }

    return NextResponse.redirect(session.url, 303);
  } catch (err) {
    console.error(
      "[Checkout] Falha ao criar sessão Stripe:",
      err instanceof Error ? err.message : ""
    );
    return NextResponse.redirect(`${baseUrl}/#assinar?error=stripe`, 307);
  }
}
