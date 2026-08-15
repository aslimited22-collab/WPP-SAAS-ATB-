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
gtag('config', '${GOOGLE_ADS_ID}', {
  // A URL de páginas privadas carrega a CREDENCIAL do pedido
  // (/pedido/<access_token>, /entrega/<orderId>, /numerologia/dados?pedido=
  // <access_token>, /numerologia/obrigado?sid= — o sid é trocável por
  // access_token via /api/numerologia/pedido). O page_view padrão manda
  // page_location para o Google — o que vazaria esse token para terceiro.
  // Em rotas privadas não enviamos page_view nem a URL.
  send_page_view: !/^\\/(pedido|entrega|numerologia\\/(dados|obrigado))(\\/|$)/.test(window.location.pathname),
  page_location: /^\\/(pedido|entrega|numerologia\\/(dados|obrigado))(\\/|$)/.test(window.location.pathname)
    ? window.location.origin + '/[privado]'
    : window.location.href
});`}
      </Script>
    </>
  );
}
