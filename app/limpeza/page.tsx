import { getStoreMarket } from "@/lib/store-market";
import LimpezaForm from "./LimpezaForm";

export default async function LimpezaPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const { currency, locale } = await getStoreMarket((await searchParams).lang);
  return <LimpezaForm currency={currency} initialLocale={locale} />;
}
