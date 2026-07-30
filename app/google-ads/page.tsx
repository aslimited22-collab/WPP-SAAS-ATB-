// Landing page dedicada às campanhas de Google Ads — rota /google-ads
//
// Regras que esta página segue de propósito (não "melhorar" sem pensar):
//  • ZERO vocabulário religioso ou de crença. Nada de espiritual, alma, santos,
//    feitiço, mau-olhado, limpeza, benção, proteção, amarração. O ângulo é
//    tarot como ferramenta de reflexão e autoconhecimento — é o que passa na
//    política de deturpação do Google Ads.
//  • Server Component puro: nenhum JavaScript de cliente, nenhuma imagem
//    pesada. LCP é texto, o que mantém a nota de experiência da landing alta.
//  • Um único objetivo por dobra: assinar (R$29/mês) ou testar avulso
//    (3 perguntas, R$19,90). O checkout passa pelo roteador geográfico
//    /api/checkout/[plan] → Brasil vai para a Kiwify, exterior para o Stripe.
//  • Paleta roxo + dourado da ATB, mobile-first (barra fixa de CTA no celular).
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tarot Online Personalizado | Orientação e Autoconhecimento 24h",
  description:
    "Leitura de tarot personalizada no seu WhatsApp. Orientação pessoal 24 horas por dia para decisões, relacionamentos e autoconhecimento. A partir de R$29/mês.",
  keywords:
    "tarot online, leitura de tarot, tarot personalizado, autoconhecimento, tarot whatsapp, orientação pessoal",
  robots: "index, follow",
  openGraph: {
    title: "Tarot Online Personalizado — Orientação 24h no seu WhatsApp",
    description:
      "Leituras personalizadas para quem busca clareza e autoconhecimento. A partir de R$29/mês.",
    type: "website",
  },
};

// ─── Links ────────────────────────────────────────────────────────────────────
const CHECKOUT_ASSINATURA = "/api/checkout/basic";
const CHECKOUT_AVULSO = "/api/checkout/pergunta3";

// Número do WhatsApp em formato internacional, só dígitos (ex.: 5511999999999).
// Sem a env var configurada os botões de WhatsApp não são renderizados — link
// morto em campanha paga custa dinheiro e derruba a nota da landing page.
const WHATSAPP_NUMBER = (process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "").replace(
  /\D/g,
  ""
);
const WHATSAPP_URL = WHATSAPP_NUMBER
  ? `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
      "Olá! Vi o anúncio e quero saber mais sobre a leitura de tarot personalizada."
    )}`
  : null;

// ─── Conteúdo ─────────────────────────────────────────────────────────────────
const BENEFICIOS: { icon: string; title: string; desc: string }[] = [
  {
    icon: "✦",
    title: "Leitura personalizada",
    desc: "Nada de texto pronto: cada leitura é feita a partir da sua pergunta e do seu momento de vida.",
  },
  {
    icon: "◷",
    title: "Orientação pessoal 24h",
    desc: "Dúvida às três da manhã? Você escreve e recebe uma resposta na hora, todos os dias do ano.",
  },
  {
    icon: "✆",
    title: "Direto no seu WhatsApp",
    desc: "Sem instalar aplicativo e sem aprender site novo. Chega no mesmo lugar onde você já conversa.",
  },
  {
    icon: "◈",
    title: "Foco em autoconhecimento",
    desc: "As cartas organizam o que você já sente: o que pesa, o que muda e qual próximo passo faz sentido.",
  },
  {
    icon: "❖",
    title: "Histórico salvo",
    desc: "Suas leituras ficam guardadas no seu portal para reler quando quiser, quantas vezes quiser.",
  },
  {
    icon: "◎",
    title: "Cancele quando quiser",
    desc: "Assinatura sem fidelidade, sem ligação e sem burocracia. Você cancela em um clique.",
  },
];

const PASSOS: { title: string; desc: string }[] = [
  {
    title: "Escolha seu acesso",
    desc: "Assinatura mensal ou pacote avulso de perguntas. Pagamento por cartão ou Pix, em segundos.",
  },
  {
    title: "Receba o link por e-mail",
    desc: "Em poucos minutos chega o acesso ao seu portal. Um toque e você já está dentro.",
  },
  {
    title: "Faça sua pergunta",
    desc: "Escreva o que está te tirando o sono. A leitura chega no seu WhatsApp, escrita para o seu caso.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Como recebo minha leitura?",
    a: "Pelo WhatsApp, no número que você cadastrar. A leitura também fica salva no seu portal para você reler quando quiser.",
  },
  {
    q: "Quanto tempo leva para chegar?",
    a: "Minutos. Você faz a pergunta e recebe a leitura completa em seguida, a qualquer hora do dia ou da noite.",
  },
  {
    q: "Preciso assinar para experimentar?",
    a: "Não. Existe o pacote de 3 perguntas por R$19,90, pago uma única vez, sem assinatura e sem renovação automática.",
  },
  {
    q: "Posso cancelar a assinatura?",
    a: "Sim, quando quiser e sem justificar nada. Não há fidelidade nem multa, e você mantém o acesso até o fim do período já pago.",
  },
  {
    q: "O pagamento é seguro?",
    a: "Sim. O processamento é feito por plataformas de pagamento consolidadas (Kiwify no Brasil, Stripe no exterior). Seus dados de cartão nunca passam pelo nosso site.",
  },
];

// ⚠️ DEPOIMENTOS — preencher com depoimentos REAIS de clientes antes de ativar
// a campanha. A seção só aparece quando este array tem itens; deixei vazio de
// propósito, porque depoimento inventado em anúncio pago é violação da política
// de deturpação do Google Ads (e motivo comum de suspensão de conta).
// Formato: { nome: "Ana C.", texto: "...", detalhe: "Assinante desde 2024" }
const DEPOIMENTOS: { nome: string; texto: string; detalhe: string }[] = [];

// ─── Tokens de estilo (roxo + dourado) ────────────────────────────────────────
const CARD =
  "rounded-2xl border border-[#3b1f63] bg-[linear-gradient(160deg,#1d0c33_0%,#150726_60%,#0f0420_100%)]";
const BTN_GOLD =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#c9a84c_0%,#e4c97a_50%,#c9a84c_100%)] px-6 py-4 text-center text-base font-bold text-[#1a0b2e] shadow-[0_6px_24px_rgba(201,168,76,0.35)] transition-transform active:scale-[0.98] sm:w-auto sm:text-lg";
const BTN_OUTLINE =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#c9a84c]/60 px-6 py-4 text-center text-base font-semibold text-[#e4c97a] transition-colors active:scale-[0.98] sm:w-auto";

export default function GoogleAdsLandingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,#2a1050_0%,#120522_55%,#0b0318_100%)] pb-28 text-[#ece6f5] sm:pb-0">
      {/* ── TOPO ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <p className="font-serif text-lg font-bold tracking-wide">
          <span className="bg-[linear-gradient(135deg,#c9a84c,#e4c97a)] bg-clip-text text-transparent">
            ATB
          </span>
          <span className="ml-1 text-[#ece6f5]">TAROT</span>
        </p>
        {WHATSAPP_URL && (
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[#c9a84c]/50 px-4 py-2 text-sm font-semibold text-[#e4c97a]"
          >
            Falar no WhatsApp
          </a>
        )}
      </header>

      {/* ── HERO ──────────────────────────────────────────────────────────── */}
      <section className="px-5 pt-8 text-center sm:px-8 sm:pt-16">
        <p className="mx-auto mb-5 inline-block rounded-full border border-[#c9a84c]/40 bg-[#c9a84c]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-[#e4c97a]">
          Tarot online personalizado
        </p>
        <h1 className="mx-auto max-w-3xl font-serif text-3xl leading-tight sm:text-5xl md:text-6xl">
          Clareza para as decisões que{" "}
          <span className="bg-[linear-gradient(135deg,#c9a84c,#e4c97a,#c9a84c)] bg-clip-text text-transparent">
            você não consegue tomar sozinha
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#c9bede] sm:text-lg">
          Leitura de tarot feita para a <strong>sua</strong> pergunta, entregue
          no seu WhatsApp em minutos. Orientação pessoal disponível 24 horas por
          dia, para quem quer entender melhor o próprio momento e seguir em
          frente com mais confiança.
        </p>

        <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 sm:max-w-none sm:flex-row sm:justify-center">
          <a href={CHECKOUT_ASSINATURA} className={BTN_GOLD}>
            Começar agora — R$29/mês
          </a>
          {WHATSAPP_URL ? (
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={BTN_OUTLINE}
            >
              Tirar uma dúvida no WhatsApp
            </a>
          ) : (
            <a href={CHECKOUT_AVULSO} className={BTN_OUTLINE}>
              Só 3 perguntas — R$19,90
            </a>
          )}
        </div>

        <ul className="mx-auto mt-7 flex max-w-xl flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-[#a596c4]">
          <li>✓ Sem fidelidade</li>
          <li>✓ Resposta em minutos</li>
          <li>✓ Pagamento seguro</li>
          <li>✓ Atendimento em português</li>
        </ul>
      </section>

      {/* ── BENEFÍCIOS ────────────────────────────────────────────────────── */}
      <section className="px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-center font-serif text-2xl sm:text-4xl">
            O que você recebe
          </h2>
          <div className="mx-auto mt-3 h-0.5 w-16 bg-[linear-gradient(90deg,transparent,#c9a84c,transparent)]" />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFICIOS.map((b) => (
              <div key={b.title} className={`${CARD} p-6`}>
                <span
                  aria-hidden="true"
                  className="text-2xl text-[#c9a84c]"
                >
                  {b.icon}
                </span>
                <h3 className="mt-3 font-serif text-lg text-[#e4c97a]">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#c9bede]">
                  {b.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMO FUNCIONA ─────────────────────────────────────────────────── */}
      <section className="border-y border-[#3b1f63]/60 bg-[#0f0420]/60 px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-serif text-2xl sm:text-4xl">
            Como funciona
          </h2>
          <div className="mx-auto mt-3 h-0.5 w-16 bg-[linear-gradient(90deg,transparent,#c9a84c,transparent)]" />
          <ol className="mt-10 grid gap-5 sm:grid-cols-3">
            {PASSOS.map((p, i) => (
              <li key={p.title} className={`${CARD} p-6 text-center`}>
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#c9a84c] bg-[#c9a84c]/15 font-serif text-xl font-bold text-[#c9a84c]">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-serif text-lg text-[#e4c97a]">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#c9bede]">
                  {p.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── OFERTA ────────────────────────────────────────────────────────── */}
      <section id="planos" className="px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-serif text-2xl sm:text-4xl">
            Escolha como começar
          </h2>
          <div className="mx-auto mt-3 h-0.5 w-16 bg-[linear-gradient(90deg,transparent,#c9a84c,transparent)]" />

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {/* Assinatura — plano principal */}
            <div className="relative rounded-2xl border-2 border-[#c9a84c] bg-[linear-gradient(160deg,#25123f_0%,#180829_100%)] p-7 shadow-[0_8px_40px_rgba(201,168,76,0.18)]">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[linear-gradient(135deg,#c9a84c,#e4c97a)] px-4 py-1 text-xs font-bold uppercase tracking-wider text-[#1a0b2e]">
                Mais escolhido
              </span>
              <h3 className="font-serif text-xl text-[#e4c97a]">
                Acompanhamento mensal
              </h3>
              <p className="mt-4 font-serif text-4xl font-bold text-[#ece6f5]">
                R$29
                <span className="text-base font-normal text-[#a596c4]">
                  /mês
                </span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-[#c9bede]">
                <li>✦ 5 leituras completas por mês</li>
                <li>✦ 30 conversas para perguntas do dia a dia</li>
                <li>✦ Entrega no WhatsApp, 24h por dia</li>
                <li>✦ Histórico salvo no seu portal</li>
                <li>✦ Cancele quando quiser</li>
              </ul>
              <a
                href={CHECKOUT_ASSINATURA}
                className={`${BTN_GOLD} mt-7 sm:w-full`}
              >
                Assinar por R$29/mês
              </a>
            </div>

            {/* Avulso — entrada de baixo risco */}
            <div className={`${CARD} p-7`}>
              <h3 className="font-serif text-xl text-[#e4c97a]">
                Só quero testar
              </h3>
              <p className="mt-4 font-serif text-4xl font-bold text-[#ece6f5]">
                R$19,90
                <span className="text-base font-normal text-[#a596c4]">
                  {" "}
                  uma vez
                </span>
              </p>
              <ul className="mt-6 space-y-3 text-sm text-[#c9bede]">
                <li>✦ 3 perguntas para usar quando quiser</li>
                <li>✦ Sem assinatura e sem renovação automática</li>
                <li>✦ Resposta no WhatsApp em minutos</li>
                <li>✦ Ideal para uma dúvida específica</li>
              </ul>
              <a
                href={CHECKOUT_AVULSO}
                className={`${BTN_OUTLINE} mt-7 sm:w-full`}
              >
                Quero 3 perguntas
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS (só renderiza com depoimentos reais preenchidos) ──── */}
      {DEPOIMENTOS.length > 0 && (
        <section className="border-y border-[#3b1f63]/60 bg-[#0f0420]/60 px-5 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center font-serif text-2xl sm:text-4xl">
              Quem já acompanha
            </h2>
            <div className="mx-auto mt-3 h-0.5 w-16 bg-[linear-gradient(90deg,transparent,#c9a84c,transparent)]" />
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {DEPOIMENTOS.map((d) => (
                <figure key={d.nome} className={`${CARD} p-6`}>
                  <p aria-hidden="true" className="text-[#c9a84c]">
                    ★★★★★
                  </p>
                  <blockquote className="mt-3 text-sm leading-relaxed text-[#c9bede]">
                    “{d.texto}”
                  </blockquote>
                  <figcaption className="mt-4 text-sm font-semibold text-[#e4c97a]">
                    {d.nome}
                    <span className="block text-xs font-normal text-[#a596c4]">
                      {d.detalhe}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="px-5 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center font-serif text-2xl sm:text-4xl">
            Perguntas frequentes
          </h2>
          <div className="mx-auto mt-3 h-0.5 w-16 bg-[linear-gradient(90deg,transparent,#c9a84c,transparent)]" />
          <div className="mt-10 space-y-3">
            {FAQ.map((f) => (
              // <details> nativo: abre e fecha sem uma linha de JavaScript
              <details key={f.q} className={`${CARD} group px-6 py-4`}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-[#e4c97a]">
                  {f.q}
                  <span
                    aria-hidden="true"
                    className="text-xl text-[#c9a84c] transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-[#c9bede]">
                  {f.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ─────────────────────────────────────────────────────── */}
      <section className="px-5 pb-16 sm:px-8 sm:pb-24">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#c9a84c]/40 bg-[linear-gradient(160deg,#2a1050_0%,#160726_100%)] px-6 py-12 text-center">
          <h2 className="font-serif text-2xl sm:text-3xl">
            Sua próxima decisão pode ser mais leve
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-[#c9bede]">
            Comece hoje por R$29/mês, ou faça só 3 perguntas por R$19,90. Você
            escolhe o ritmo — e cancela quando quiser.
          </p>
          <div className="mx-auto mt-8 flex max-w-md flex-col items-center gap-3 sm:max-w-none sm:flex-row sm:justify-center">
            <a href={CHECKOUT_ASSINATURA} className={BTN_GOLD}>
              Começar agora — R$29/mês
            </a>
            {WHATSAPP_URL ? (
              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={BTN_OUTLINE}
              >
                Falar no WhatsApp
              </a>
            ) : (
              <a href={CHECKOUT_AVULSO} className={BTN_OUTLINE}>
                Só 3 perguntas — R$19,90
              </a>
            )}
          </div>
        </div>
      </section>

      {/* ── RODAPÉ ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#3b1f63]/60 px-5 py-10 text-center sm:px-8">
        <p className="mx-auto max-w-2xl text-xs leading-relaxed text-[#8d7fab]">
          As leituras da ATB TAROT têm finalidade de entretenimento e reflexão
          pessoal. Não substituem orientação médica, psicológica, jurídica ou
          financeira. Serviço para maiores de 18 anos.
        </p>
        <p className="mt-4 text-xs text-[#6f6390]">
          © ATB TAROT · Todos os direitos reservados
        </p>
      </footer>

      {/* ── BARRA FIXA DE CTA (celular) ───────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#c9a84c]/30 bg-[#120522]/95 px-4 py-3 backdrop-blur-md sm:hidden">
        <a
          href={CHECKOUT_ASSINATURA}
          className="flex w-full items-center justify-center rounded-xl bg-[linear-gradient(135deg,#c9a84c_0%,#e4c97a_50%,#c9a84c_100%)] px-6 py-3.5 text-base font-bold text-[#1a0b2e]"
        >
          Começar agora — R$29/mês
        </a>
      </div>
    </main>
  );
}
