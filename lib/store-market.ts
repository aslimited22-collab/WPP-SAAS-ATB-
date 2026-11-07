import { cookies, headers } from "next/headers";
import { cache } from "react";
import { channelLocale, detectRequestLocale } from "./locale";
import { currencyForRequest } from "./pricing";

export const getStoreMarket = cache(async (lang?: string) => {
  const request = { headers: await headers() };
  const locale = channelLocale(lang) ?? channelLocale((await cookies()).get("atb_locale")?.value)
    ?? detectRequestLocale(request);
  return { locale, currency: currencyForRequest(request).currency };
});
