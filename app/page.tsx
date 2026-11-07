import type { Metadata } from "next";
import Storefront from "./Storefront";
import { getStoreMarket } from "@/lib/store-market";
import { isProdutoAVenda } from "@/lib/pricing";
import { APP_LOCALES } from "@/lib/locale";
import { storefront } from "@/content/storefront";

type PageProps = { searchParams: Promise<{ lang?: string; error?: string }> };

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const { lang } = await searchParams;
  const { locale } = await getStoreMarket(lang);
  const t = storefront[locale];
  const title = `ATB Tarot — ${t.catalog}`;
  const path = locale === "pt-BR" ? "/" : `/?lang=${locale}`;
  const images = [{ url: "/images/soleil-share.jpg", width: 1200, height: 630, alt: "ATB Tarot" }];
  return { title, description: t.intro,
    alternates: { canonical: path, languages: Object.fromEntries(APP_LOCALES.map(l => [l, `/?lang=${l}`])) },
    openGraph: { title, description: t.intro, type: "website", url: path, images },
    twitter: { card: "summary_large_image", title, description: t.intro, images },
  };
}

export default async function Home({ searchParams }: PageProps) {
  const { lang, error } = await searchParams;
  const { locale, currency } = await getStoreMarket(lang);
  return <Storefront initialLocale={locale} currency={currency} showMap={isProdutoAVenda("numerologia")} checkoutFailed={error === "checkout"} />;
}
