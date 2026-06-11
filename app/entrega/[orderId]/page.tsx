// Página de entrega da Limpeza Espiritual — /entrega/[orderId]
// Pública: o UUID do pedido é a credencial de acesso (link enviado por
// e-mail/WhatsApp). Renderiza a leitura no IDIOMA do comprador.

import { createServiceSupabaseClient } from "@/lib/supabase";
import { normalizeLocale, type AppLocale } from "@/lib/locale";
import type { FullReadingJson } from "@/lib/limpeza";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COPY: Record<
  AppLocale,
  {
    notFound: string;
    pendingTitle: string;
    pendingBody: string;
    preparingTitle: string;
    preparingBody: string;
    stepsTitle: string;
  }
> = {
  "pt-BR": {
    notFound: "Pedido não encontrado. Verifique o link do seu e-mail.",
    pendingTitle: "Aguardando confirmação do pagamento",
    pendingBody:
      "Assim que o pagamento for confirmado, sua Limpeza será preparada e você receberá um e-mail. Esta página atualiza sozinha.",
    preparingTitle: "Sua Limpeza está sendo preparada",
    preparingBody:
      "A ATB está preparando sua leitura sagrada. Atualize esta página em alguns instantes.",
    stepsTitle: "Seus passos",
  },
  en: {
    notFound: "Order not found. Please check the link in your email.",
    pendingTitle: "Waiting for payment confirmation",
    pendingBody:
      "As soon as your payment is confirmed, your Cleansing will be prepared and you will receive an email. This page refreshes automatically.",
    preparingTitle: "Your Cleansing is being prepared",
    preparingBody:
      "ATB is preparing your sacred reading. Refresh this page in a few moments.",
    stepsTitle: "Your steps",
  },
  es: {
    notFound: "Pedido no encontrado. Verifica el enlace de tu correo.",
    pendingTitle: "Esperando la confirmación del pago",
    pendingBody:
      "En cuanto se confirme tu pago, tu Limpieza será preparada y recibirás un correo. Esta página se actualiza sola.",
    preparingTitle: "Tu Limpieza está siendo preparada",
    preparingBody:
      "ATB está preparando tu lectura sagrada. Actualiza esta página en unos instantes.",
    stepsTitle: "Tus pasos",
  },
};

function Shell({
  children,
  refresh,
}: {
  children: React.ReactNode;
  refresh?: boolean;
}) {
  return (
    <main className="min-h-screen bg-mystic-gradient stars-bg px-6 py-16">
      {refresh ? <meta httpEquiv="refresh" content="20" /> : null}
      <div className="max-w-xl mx-auto animate-fade-in">{children}</div>
    </main>
  );
}

export default async function EntregaPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  if (!UUID_RE.test(orderId)) {
    return (
      <Shell>
        <p className="text-center text-[#c2b9a4]">{COPY["pt-BR"].notFound}</p>
      </Shell>
    );
  }

  const supabase = createServiceSupabaseClient();
  const { data: order } = await supabase
    .from("limpeza_orders")
    .select("id, nome, status, locale")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) {
    return (
      <Shell>
        <p className="text-center text-[#c2b9a4]">{COPY["pt-BR"].notFound}</p>
      </Shell>
    );
  }

  const locale = normalizeLocale(order.locale);
  const t = COPY[locale];

  if (order.status !== "paid") {
    return (
      <Shell refresh>
        <div className="text-center">
          <div className="text-5xl mb-6 animate-float">⏳</div>
          <h1 className="font-serif text-3xl gold-gradient-text mb-4">
            {t.pendingTitle}
          </h1>
          <p className="text-[#c2b9a4] leading-relaxed">{t.pendingBody}</p>
        </div>
      </Shell>
    );
  }

  const { data: reading } = await supabase
    .from("limpeza_readings")
    .select("full_json")
    .eq("order_id", order.id)
    .maybeSingle();

  if (!reading?.full_json) {
    return (
      <Shell refresh>
        <div className="text-center">
          <div className="text-5xl mb-6 animate-float">🕯️</div>
          <h1 className="font-serif text-3xl gold-gradient-text mb-4">
            {t.preparingTitle}
          </h1>
          <p className="text-[#c2b9a4] leading-relaxed">{t.preparingBody}</p>
        </div>
      </Shell>
    );
  }

  const r = reading.full_json as FullReadingJson;

  return (
    <Shell>
      <div className="text-center mb-10">
        <div className="text-5xl mb-4 animate-float">🕊️</div>
        <h1 className="font-serif text-4xl gold-gradient-text mb-2">{r.title}</h1>
        <div className="divider-gold" />
      </div>

      <div className="space-y-6">
        <div className="mystic-card p-8 border border-[#c9a84c]/30">
          <p className="text-[#e8e0d0]/90 leading-relaxed whitespace-pre-line">
            {r.opening}
          </p>
        </div>

        <div className="mystic-card p-8">
          <p className="text-[#e8e0d0]/85 leading-relaxed whitespace-pre-line">
            {r.spiritual_reading}
          </p>
        </div>

        <div className="mystic-card p-8">
          <p className="text-[#e8e0d0]/85 leading-relaxed whitespace-pre-line">
            {r.cleansing_message}
          </p>
        </div>

        <div className="mystic-card p-8">
          <p className="text-[#e8e0d0]/85 leading-relaxed whitespace-pre-line">
            {r.protection_message}
          </p>
        </div>

        {Array.isArray(r.next_steps) && r.next_steps.length > 0 && (
          <div className="mystic-card p-8 border border-[#c9a84c]/20">
            <h2 className="font-serif text-xl text-[#c9a84c] mb-4">
              ✦ {t.stepsTitle}
            </h2>
            <ol className="space-y-3">
              {r.next_steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-sm text-[#e8e0d0]/85">
                  <span className="text-[#c9a84c] font-bold">{i + 1}.</span>
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="mystic-card p-8 border border-[#c9a84c]/30 text-center">
          <p className="text-[#e8e0d0]/90 leading-relaxed italic whitespace-pre-line">
            {r.closing}
          </p>
        </div>

        <p className="text-[#a39878] text-xs text-center leading-relaxed px-4">
          {r.disclaimer}
        </p>
      </div>
    </Shell>
  );
}
