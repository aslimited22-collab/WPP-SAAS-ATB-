"use client";

// Form pós-compra da Numerologia:
// 1) resolve o pedido pelo access_token (poll — o webhook pode levar segundos);
// 2) coleta nome completo + data de nascimento;
// 3) POST /api/numerologia/dados → entrega na hora (PDF no e-mail).
//
// Trava de sobrescrita: se a leitura já foi gerada (needsData=false), mostra
// só o download — o form não reaparece (os dados não mudam mais).
// PT-hardcoded (funil BR-first). Público 45+: textos grandes, 1 coluna.

import { useCallback, useEffect, useRef, useState } from "react";

type Phase = "resolving" | "not_found" | "form" | "submitting" | "done" | "already";

export default function DadosClient({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>(token ? "resolving" : "not_found");
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [error, setError] = useState("");
  const [delivered, setDelivered] = useState(false);
  const attemptsRef = useRef(0);

  const resolveOrder = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/numerologia/pedido?token=${encodeURIComponent(token)}`
      );
      const d = await res.json().catch(() => ({}));
      if (d?.found && d?.paid) {
        setPhase(d.needsData ? "form" : "already");
        return true;
      }
    } catch {
      // segue no poll
    }
    return false;
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const ok = await resolveOrder();
      if (ok || cancelled) return;
      attemptsRef.current += 1;
      if (attemptsRef.current >= 30) {
        // ~2min sem achar: o webhook não chegou (ou token inválido)
        setPhase("not_found");
        return;
      }
      setTimeout(tick, 4000);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [token, resolveOrder]);

  const today = new Date().toISOString().slice(0, 10);
  const nameOk = name.trim().length >= 5 && name.trim().includes(" ");
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(birthDate);
  const downloadHref = `/numerologia/download/${encodeURIComponent(token)}`;

  async function submit() {
    if (!nameOk || !dateOk || phase === "submitting") return;
    setError("");
    setPhase("submitting");
    try {
      const res = await fetch("/api/numerologia/dados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          full_name: name.trim(),
          birth_date: birthDate,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(d?.error || "Não conseguimos salvar. Tente de novo.");
        setPhase("form");
        return;
      }
      setDelivered(!!d?.delivered);
      setPhase(d?.already ? "already" : "done");
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente de novo.");
      setPhase("form");
    }
  }

  return (
    <main className="min-h-screen bg-mystic-gradient stars-bg px-5 py-12">
      <div className="max-w-lg mx-auto">
        <div className="text-center font-serif text-xl mb-8">
          <span className="gold-gradient-text font-bold">ATB</span>
          <span className="text-[#e8e0d0] ml-1">TAROT</span>
        </div>

        <div className="mystic-card border border-[#c9a84c]/30 p-8 text-center">
          {phase === "resolving" && (
            <>
              <div className="text-5xl mb-4 animate-float" aria-hidden="true">
                🕊️
              </div>
              <h1 className="font-serif text-2xl gold-gradient-text mb-3">
                Confirmando seu pagamento…
              </h1>
              <p className="text-[#c2b9a4] leading-relaxed">
                Pode levar até 2 minutos se o banco demorar. Não feche esta
                página.
              </p>
            </>
          )}

          {phase === "not_found" && (
            <>
              <div className="text-5xl mb-4" aria-hidden="true">
                🔎
              </div>
              <h1 className="font-serif text-2xl gold-gradient-text mb-3">
                Não encontramos seu pedido ainda
              </h1>
              <p className="text-[#c2b9a4] leading-relaxed mb-6">
                Se você acabou de pagar, espere 1 minuto e toque no botão
                abaixo. Também enviamos o link certo pro seu e-mail de compra —
                procure por{" "}
                <strong className="text-[#e4c97a]">&quot;Numerologia&quot;</strong>{" "}
                (olhe o spam).
              </p>
              <button
                type="button"
                className="btn-gold w-full px-6 py-4 rounded-xl text-base"
                onClick={() => window.location.reload()}
              >
                🔄 Tentar de novo
              </button>
            </>
          )}

          {(phase === "form" || phase === "submitting") && (
            <>
              <div className="text-5xl mb-4" aria-hidden="true">
                🔢
              </div>
              <h1 className="font-serif text-2xl gold-gradient-text mb-2">
                Pagamento confirmado! ✅
              </h1>
              <p className="text-[#c2b9a4] leading-relaxed mb-6">
                Agora a ATB precisa de 2 informações pra calcular os seus
                números:
              </p>

              <div className="text-left">
                <label
                  htmlFor="nm-nome"
                  className="block font-bold text-[#e8e0d0] mb-2"
                >
                  Seu nome completo
                </label>
                <input
                  id="nm-nome"
                  className="input-mystic w-full mb-1"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Maria Aparecida da Silva"
                  autoComplete="name"
                  maxLength={120}
                />
                <p className="text-[#a39878] text-sm mb-5">
                  Do jeito que está nos seus documentos — o cálculo usa cada
                  letra.
                </p>

                <label
                  htmlFor="nm-nascimento"
                  className="block font-bold text-[#e8e0d0] mb-2"
                >
                  Sua data de nascimento
                </label>
                <input
                  id="nm-nascimento"
                  className="input-mystic w-full mb-6"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  min="1900-01-01"
                  max={today}
                />
              </div>

              {error && (
                <p className="text-red-300 text-sm leading-relaxed mb-4">
                  {error}
                </p>
              )}

              <button
                type="button"
                className="btn-gold w-full px-6 py-4 rounded-xl text-base"
                onClick={submit}
                disabled={!nameOk || !dateOk || phase === "submitting"}
              >
                {phase === "submitting"
                  ? "A ATB está preparando seu mapa…"
                  : "✨ Receber meu mapa em PDF"}
              </button>
              <p className="text-[#a39878] text-sm mt-3">
                {phase === "submitting"
                  ? "Isso leva menos de 1 minuto. Não feche esta página."
                  : "Seu mapa chega no e-mail que você usou na compra."}
              </p>
            </>
          )}

          {phase === "done" && (
            <>
              <div className="text-5xl mb-4" aria-hidden="true">
                💌
              </div>
              <h1 className="font-serif text-2xl gold-gradient-text mb-3">
                {delivered ? "Seu mapa foi enviado!" : "Dados recebidos!"}
              </h1>
              <p className="text-[#c2b9a4] leading-relaxed mb-5">
                {delivered
                  ? "Olhe o seu e-mail: seu mapa de Numerologia chegou em PDF (confira também o spam)."
                  : "A ATB está preparando o seu mapa. Ele chega em PDF no seu e-mail em até 24h — normalmente em poucos minutos."}
              </p>
              {/* Botão só quando a entrega CONFIRMOU — senão o clique cai num
                  409 "ainda preparando" e contradiz o "chega em até 24h". */}
              {delivered && (
                <a
                  href={downloadHref}
                  className="btn-gold inline-block px-7 py-4 rounded-xl text-base no-underline"
                >
                  📥 Baixar meu PDF agora
                </a>
              )}
            </>
          )}

          {phase === "already" && (
            <>
              <div className="text-5xl mb-4" aria-hidden="true">
                💌
              </div>
              <h1 className="font-serif text-2xl gold-gradient-text mb-3">
                Já recebemos seus dados!
              </h1>
              <p className="text-[#c2b9a4] leading-relaxed mb-5">
                Seu mapa está no seu e-mail (confira o spam). Se quiser, baixe
                de novo:
              </p>
              <a
                href={downloadHref}
                className="btn-gold inline-block px-7 py-4 rounded-xl text-base no-underline"
              >
                📥 Baixar meu PDF
              </a>
            </>
          )}
        </div>

        <p className="text-center text-[#a39878] text-xs mt-6 leading-relaxed">
          Orientação espiritual e reflexiva — não substitui aconselhamento
          profissional.
          <br />
          ATB · atbtartot.com
        </p>
      </div>
    </main>
  );
}
