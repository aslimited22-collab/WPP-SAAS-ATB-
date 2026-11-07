import { NextRequest, NextResponse } from "next/server";
import { getStoreMarket } from "@/lib/store-market";
import { kiwifyCheckoutUrl } from "@/lib/locale";
import { isRitualSlug, ritualPrice } from "@/lib/ritual-pricing";
import { findServiceBySlug } from "@/lib/spiritual-services";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { getStripe } from "@/lib/stripe";
import { rituals } from "@/content/rituals";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { locale, currency } = await getStoreMarket(request.nextUrl.searchParams.get("lang") ?? undefined);
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin;
  const failed = () => NextResponse.redirect(`${origin}/?error=checkout&lang=${locale}#produtos`, 307);
  if (!isRitualSlug(slug)) return failed();
  try {
    const service = await findServiceBySlug(createServiceSupabaseClient(), slug);
    if (!service?.ativo) return failed();
    const price = ritualPrice(slug, currency, service.preco_centavos);
    if (price.currency === "brl") {
      return service.kiwify_checkout_url ? NextResponse.redirect(kiwifyCheckoutUrl(service.kiwify_checkout_url, locale), 307) : failed();
    }
    const stripe = getStripe();
    if (!stripe) return failed();
    const metadata = { plan: "ritual", service_slug: slug, service_id: service.id, locale };
    const session = await stripe.checkout.sessions.create({
      mode: "payment", payment_method_types: ["card"], locale,
      adaptive_pricing: { enabled: false },
      line_items: [{ quantity: 1, price_data: {
        currency: price.currency, unit_amount: price.cents,
        product_data: { name: `ATB Tarot — ${rituals[locale].services[slug].title}` },
      } }],
      metadata, payment_intent_data: { metadata },
      success_url: `${origin}/obrigado?ritual=${slug}&lang=${locale}&sid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/servicos/${slug}?lang=${locale}`,
    });
    return session.url ? NextResponse.redirect(session.url, 303) : failed();
  } catch (error) {
    console.error("[Ritual checkout]", error instanceof Error ? error.message : "unavailable");
    return failed();
  }
}
