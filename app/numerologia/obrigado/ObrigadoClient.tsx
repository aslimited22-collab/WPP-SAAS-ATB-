"use client";

// Poll pós-compra da Numerologia: o webhook (Kiwify/Stripe) pode levar alguns
// segundos pra criar o pedido. Assim que /api/numerologia/pedido responder
// found+paid, redireciona pro form /numerologia/dados?pedido=<access_token>.
// Sem sid/kw (ou depois de ~2min sem achar), orienta a procurar o link no
// e-mail — o webhook também envia o link único por lá.

import { useEffect, useRef, useState } from "react";

type Phase = "polling" | "not_found";

export default function ObrigadoClient({ sid, kw }: { sid: string; kw: string }) {
  const hasRef = Boolean(sid || kw);
  const [phase, setPhase] = useState<Phase>(hasRef ? "polling" : "not_found");
  const attemptsRef = useRef(0);

  useEffect(() => {
    if (!hasRef) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const qs = sid
          ? `sid=${encodeURIComponent(sid)}`
          : `kw=${encodeURIComponent(kw)}`;
        const res = await fetch(`/api/numerologia/pedido?${qs}`);
        const d = await res.json().catch(() => ({}));
        if (d?.found && d?.paid && d?.token) {
          window.location.replace(
            `/numerologia/dados?pedido=${encodeURIComponent(d.token)}`
          );
          return;
        }
      } catch {
        // segue no poll
      }
      attemptsRef.current += 1;
      if (attemptsRef.current >= 30) {
        // ~2min sem achar: o webhook não chegou (ou referência inválida)
        setPhase("not_found");
        return;
      }
      setTimeout(tick, 4000);
    };

    tick();
    return () => {
      cancelled = true;
    };
  }, [hasRef, sid, kw]);

  return (
    <main className="min-h-screen bg-mystic-gradient stars-bg flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="font-serif text-xl mb-8">
          <span className="gold-gradient-text font-bold">ATB</span>
          <span className="text-[#e8e0d0] ml-1">TAROT</span>
        </div>

        <div className="mystic-card p-8 border border-[#c9a84c]/30">
          {phase === "polling" && (
            <>
              <div className="text-6xl mb-4 animate-float" aria-hidden="true">
                🔢
              </div>
              <h1 className="font-serif text-3xl gold-gradient-text mb-4">
                Confirmando seu pagamento…
              </h1>
              <p className="text-[#c2b9a4] leading-relaxed">
                Pode levar até 2 minutos se o banco demorar. Não feche esta
                página — vamos te levar direto pro próximo passo.
              </p>
            </>
          )}

          {phase === "not_found" && (
            <>
              <div className="text-6xl mb-4" aria-hidden="true">
                💌
              </div>
              <h1 className="font-serif text-3xl gold-gradient-text mb-4">
                Compra recebida!
              </h1>
              <p className="text-[#c2b9a4] leading-relaxed mb-6">
                Enviamos pro seu e-mail de compra o link pra você informar seu
                nome completo e sua data de nascimento — é dele que o seu mapa
                nasce. Procure por{" "}
                <strong className="text-[#e4c97a]">&quot;Numerologia&quot;</strong>{" "}
                (olhe também o spam).
              </p>
              {hasRef && (
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="btn-gold px-8 py-4 rounded-xl text-base w-full"
                >
                  🔄 Tentar de novo
                </button>
              )}
            </>
          )}
        </div>

        <p className="text-[#a39878] text-xs mt-6 leading-relaxed">
          Orientação espiritual e reflexiva — não substitui aconselhamento
          profissional.
        </p>
      </div>
    </main>
  );
}
