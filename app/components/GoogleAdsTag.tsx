// Tag base do Google Ads (gtag.js), injetada no layout raiz.
// Não renderiza nada quando NEXT_PUBLIC_GOOGLE_ADS_ID está ausente/inválido.
//
// Server Component: só emite os <Script>. O snippet inline define window.gtag
// (função global) e chama gtag('config', ...) — a página de conversão usa
// ensureGtag() para não depender da ordem de carregamento.
import Script from "next/script";
import { GOOGLE_ADS_ID, isAdsEnabled } from "@/lib/gtag";

export default function GoogleAdsTag() {
  if (!isAdsEnabled()) return null;

  return (
    <>
      <Script
        id="gtag-src"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
      />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GOOGLE_ADS_ID}');`}
      </Script>
    </>
  );
}
