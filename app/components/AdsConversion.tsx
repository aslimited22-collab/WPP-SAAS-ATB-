"use client";

// Dispara a conversão de compra do Google Ads na página de obrigado.
//
// Deduplicação: o Google conta duas vezes se o comprador der F5. Com o Stripe
// usamos o id da sessão de checkout como transaction_id (o próprio Google
// deduplica por transaction_id) e, em qualquer caso, um guard em sessionStorage
// impede o reenvio dentro da mesma aba.
import { useEffect } from "react";
import { ensureGtag } from "@/lib/gtag";

export default function AdsConversion({
  sendTo,
  value,
  currency,
  transactionId,
}: {
  sendTo: string;
  value?: number;
  currency?: string;
  transactionId?: string;
}) {
  useEffect(() => {
    if (!sendTo) return;

    const guardKey = `atb_ads_conv:${transactionId ?? sendTo}`;
    try {
      if (window.sessionStorage.getItem(guardKey)) return;
      window.sessionStorage.setItem(guardKey, "1");
    } catch {
      // sessionStorage bloqueado (modo privado/cookies off): segue e dispara.
      // Perder a dedupe é melhor do que perder a conversão.
    }

    const gtag = ensureGtag();
    if (!gtag) return;

    gtag("event", "conversion", {
      send_to: sendTo,
      ...(typeof value === "number" && currency ? { value, currency } : {}),
      ...(transactionId ? { transaction_id: transactionId } : {}),
    });
  }, [sendTo, value, currency, transactionId]);

  return null;
}
