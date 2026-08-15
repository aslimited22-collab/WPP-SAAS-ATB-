"use client";

// Âncora de CTA de checkout que registra o "Iniciar finalização de compra"
// (Initiate Checkout) no Google Ads ANTES de navegar para /api/checkout/*.
//
// Por que existe: o site antigo disparava esse evento e o novo tinha perdido —
// com 600+ cliques pagos por semana e zero eventos, ficou impossível saber se
// as pessoas desistem na página ou dentro do checkout da Kiwify/Stripe.
//
// Comportamento: preventDefault + event_callback com fallback de 500ms (padrão
// recomendado pelo Google). Com adblock, gtag lento ou rótulo ausente, vira um
// link normal — a navegação NUNCA fica presa atrás do tracking.

import type { ReactNode } from "react";
import { fireBeginCheckoutAndNavigate } from "@/lib/gtag";

export default function CheckoutCta({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        fireBeginCheckoutAndNavigate(href);
      }}
    >
      {children}
    </a>
  );
}
