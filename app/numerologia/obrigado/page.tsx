// ─── /numerologia/obrigado — pós-compra da Numerologia ───────────────────────
// Usada pelos dois checkouts:
//   Stripe (intl): success_url → ?sid={CHECKOUT_SESSION_ID}&lang=&cur=
//   Kiwify (BR):   URL de obrigado do produto → ?kw={order_id} (configurar
//                  no painel da Kiwify; sem o parâmetro a página orienta a
//                  procurar o link no e-mail)
// O client faz poll de /api/numerologia/pedido até o webhook criar o pedido
// e então redireciona pro form /numerologia/dados?pedido=<access_token>.
//
// A conversão de compra do Google Ads dispara AQUI (a numerologia não passa
// por /obrigado): mesmo AdsConversion, com sid como transaction_id.

import type { Metadata } from "next";
import AdsConversion from "@/app/components/AdsConversion";
import { conversionValue, isCurrency, purchaseSendTo } from "@/lib/gtag";
import ObrigadoClient from "./ObrigadoClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Obrigado — Numerologia | ATB",
  robots: { index: false, follow: false },
};

export default async function NumerologiaObrigadoPage({
  searchParams,
}: {
  searchParams: Promise<{ sid?: string; kw?: string; cur?: string }>;
}) {
  const { sid, kw, cur } = await searchParams;

  const sendTo = purchaseSendTo();
  const money = conversionValue("numerologia", isCurrency(cur) ? cur : null);

  return (
    <>
      {sendTo && (
        <AdsConversion
          sendTo={sendTo}
          value={money?.value}
          currency={money?.currency}
          transactionId={sid}
        />
      )}
      <ObrigadoClient
        sid={(sid ?? "").trim().slice(0, 128)}
        kw={(kw ?? "").trim().slice(0, 128)}
      />
    </>
  );
}
