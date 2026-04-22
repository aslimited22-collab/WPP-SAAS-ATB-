"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase";
import {
  profileSchema,
  type ProfileInput,
  SIGNOS,
  CATEGORIAS_GUIA,
  type CategoriaGuia,
} from "@/lib/validators";

interface UserProfile {
  id: string;
  email: string;
  nome: string | null;
  signo: string | null;
  data_nascimento: string | null;
  whatsapp: string | null;
}

interface Reading {
  id: string;
  resposta_ia: string;
  enviado_whatsapp: boolean;
  created_at: string;
}

interface Credits {
  leituras_restantes: number;
  mes_referencia: string | null;
}

type TabType = "leitura" | "guia" | "perfil" | "historico";

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [credits, setCredits] = useState<Credits>({ leituras_restantes: 0, mes_referencia: null });
  const [readings, setReadings] = useState<Reading[]>([]);
  const [activeTab, setActiveTab] = useState<TabType>("leitura");
  const [loading, setLoading] = useState(true);
  const [requestingReading, setRequestingReading] = useState(false);
  const [readingResult, setReadingResult] = useState<string | null>(null);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileApiError, setProfileApiError] = useState<string | null>(null);
  const [expandedReading, setExpandedReading] = useState<string | null>(null);
  const [pergunta, setPergunta] = useState("");
  const [guiaLoading, setGuiaLoading] = useState(false);
  const [guiaResult, setGuiaResult] = useState<string | null>(null);
  const [guiaError, setGuiaError] = useState<string | null>(null);
  const [guiaCategoria, setGuiaCategoria] = useState<CategoriaGuia | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, creditsRes, readingsRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/credits"),
        fetch("/api/readings/history").catch(() => null),
      ]);

      if (profileRes.ok) {
        const profileData = (await profileRes.json()) as { profile: UserProfile | null };
        if (profileData.profile) {
          setProfile(profileData.profile);
          reset({
            nome: profileData.profile.nome ?? "",
            signo: (profileData.profile.signo as ProfileInput["signo"]) ?? undefined,
            data_nascimento: profileData.profile.data_nascimento ?? "",
            whatsapp: profileData.profile.whatsapp ?? "",
          });
        }
      }

      if (creditsRes.ok) {
        const creditsData = (await creditsRes.json()) as Credits;
        setCredits(creditsData);
      }

      if (readingsRes?.ok) {
        const readingsData = (await readingsRes.json()) as { readings: Reading[] };
        setReadings(readingsData.readings ?? []);
      }
    } catch (err) {
      console.error("Erro ao carregar dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleRequestReading() {
    setRequestingReading(true);
    setReadingResult(null);
    setReadingError(null);

    try {
      const res = await fetch("/api/readings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pergunta: pergunta.trim() || undefined }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        reading?: string;
        leituras_restantes?: number;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setReadingError(data.error ?? "Erro ao solicitar leitura. Tente novamente.");
        return;
      }

      setReadingResult(data.reading ?? null);
      setCredits((prev) => ({
        ...prev,
        leituras_restantes: data.leituras_restantes ?? prev.leituras_restantes - 1,
      }));
      setPergunta("");

      // Recarregar histórico
      setTimeout(() => fetchData(), 1500);
    } catch {
      setReadingError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setRequestingReading(false);
    }
  }

  async function onProfileSubmit(data: ProfileInput) {
    setSavingProfile(true);
    setProfileSuccess(false);
    setProfileApiError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = (await res.json()) as {
        success?: boolean;
        error?: string;
        details?: Array<{ field: string; message: string }>;
      };

      if (!res.ok) {
        setProfileApiError(result.error ?? "Erro ao salvar perfil.");
        return;
      }

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
      fetchData();
    } catch {
      setProfileApiError("Erro de conexão. Tente novamente.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleGuiaVicios(categoria: CategoriaGuia) {
    setGuiaLoading(true);
    setGuiaResult(null);
    setGuiaError(null);
    setGuiaCategoria(categoria);

    try {
      const res = await fetch("/api/guia-vicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoria }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        reading?: string;
        leituras_restantes?: number;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setGuiaError(data.error ?? "Erro ao solicitar leitura. Tente novamente.");
        return;
      }

      setGuiaResult(data.reading ?? null);
      setCredits((prev) => ({
        ...prev,
        leituras_restantes: data.leituras_restantes ?? prev.leituras_restantes - 1,
      }));

      setTimeout(() => fetchData(), 1500);
    } catch {
      setGuiaError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setGuiaLoading(false);
    }
  }

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const profileComplete =
    profile?.nome && profile?.signo && profile?.data_nascimento && profile?.whatsapp;

  if (loading) {
    return (
      <main className="min-h-screen bg-mystic-gradient stars-bg flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl animate-float mb-4">🔮</div>
          <p className="text-[#c9a84c] font-serif">Consultando os astros...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] stars-bg">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="font-serif text-lg">
            <span className="gold-gradient-text font-bold">ATB</span>
            <span className="text-[#e8e0d0] ml-1">TAROT IA</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[#555] text-sm hidden sm:block">
              {profile?.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-[#555] hover:text-[#888] text-sm transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ── BOAS-VINDAS + CRÉDITOS ──────────────────────────────────────── */}
        <div className="mystic-card p-6 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl text-[#c9a84c] mb-1">
              {profile?.nome ? `Olá, ${profile.nome}` : "Bem-vinda ao ATB TAROT IA"}
            </h1>
            <p className="text-[#666] text-sm">
              {profile?.signo && `✦ ${profile.signo}`}
              {profile?.signo && profile?.data_nascimento && " · "}
              {profile?.data_nascimento &&
                new Date(profile.data_nascimento).toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
            </p>
          </div>
          <div className="text-center sm:text-right">
            <div className="text-3xl font-serif gold-gradient-text font-bold">
              {credits.leituras_restantes}
            </div>
            <div className="text-[#666] text-xs">
              {credits.leituras_restantes === 1 ? "leitura disponível" : "leituras disponíveis"}
              {credits.mes_referencia && (
                <span className="block text-[#444]">
                  em {credits.mes_referencia}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Aviso de perfil incompleto */}
        {!profileComplete && (
          <div className="bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-lg p-4 mb-6">
            <p className="text-[#c9a84c] text-sm">
              <strong>Complete seu perfil</strong> para solicitar leituras. Precisamos do
              seu nome, signo, data de nascimento e WhatsApp.{" "}
              <button
                className="underline"
                onClick={() => setActiveTab("perfil")}
              >
                Ir para Perfil
              </button>
            </p>
          </div>
        )}

        {/* ── TABS ───────────────────────────────────────────────────────── */}
        <div className="flex gap-1 mb-8 bg-[#111111] p-1 rounded-lg border border-[#2a2a2a]">
          {(
            [
              { id: "leitura", label: "✦ Solicitar Leitura" },
              { id: "guia", label: "🌿 Guia de Vícios" },
              { id: "historico", label: "Histórico" },
              { id: "perfil", label: "Meu Perfil" },
            ] as { id: TabType; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-[#1a1a1a] text-[#c9a84c] border border-[#c9a84c]/30 shadow-gold"
                  : "text-[#555] hover:text-[#888]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: SOLICITAR LEITURA ──────────────────────────────────────── */}
        {activeTab === "leitura" && (
          <div className="animate-fade-in">
            <div className="mystic-card p-8">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4 animate-float">🔮</div>
                <h2 className="font-serif text-2xl text-[#c9a84c] mb-2">
                  Consultar ATB
                </h2>
                <p className="text-[#666] text-sm max-w-md mx-auto">
                  ATB irá revelar as cartas do destino especialmente para você
                  e entregar sua leitura no WhatsApp.
                </p>
              </div>

              {/* Pergunta opcional */}
              <div className="mb-6">
                <label className="block text-sm text-[#888] mb-2">
                  Pergunta opcional{" "}
                  <span className="text-[#444] text-xs">(deixe em branco para uma leitura geral)</span>
                </label>
                <textarea
                  value={pergunta}
                  onChange={(e) => setPergunta(e.target.value.slice(0, 500))}
                  placeholder="O que você gostaria de perguntar às cartas?"
                  className="input-mystic resize-none h-24"
                  disabled={requestingReading}
                />
                <p className="text-[#333] text-xs mt-1 text-right">
                  {pergunta.length}/500
                </p>
              </div>

              {/* Aviso de créditos zerados */}
              {credits.leituras_restantes === 0 && (
                <div className="bg-[#8b0000]/20 border border-[#8b0000]/40 rounded-lg p-4 mb-6 text-center">
                  <p className="text-red-400 text-sm">
                    Você utilizou todas as suas leituras deste mês. Seus créditos
                    renovam automaticamente no início do próximo ciclo.
                  </p>
                </div>
              )}

              {/* Aviso de perfil incompleto */}
              {!profileComplete && (
                <div className="bg-[#8b0000]/20 border border-[#8b0000]/40 rounded-lg p-4 mb-6 text-center">
                  <p className="text-red-400 text-sm">
                    Complete seu perfil antes de solicitar uma leitura.
                  </p>
                </div>
              )}

              <button
                onClick={handleRequestReading}
                disabled={
                  requestingReading ||
                  credits.leituras_restantes === 0 ||
                  !profileComplete
                }
                className="btn-gold w-full py-4 text-base"
              >
                {requestingReading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8z"
                      />
                    </svg>
                    ATB está consultando as cartas...
                  </span>
                ) : credits.leituras_restantes === 0 ? (
                  "Sem leituras disponíveis este mês"
                ) : (
                  "✦ Solicitar Minha Leitura"
                )}
              </button>

              {/* Resultado da leitura */}
              {readingResult && (
                <div className="mt-8 animate-fade-in">
                  <div className="bg-[#1a0a2e]/50 border border-[#c9a84c]/30 rounded-lg p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[#c9a84c]">✦</span>
                      <h3 className="text-[#c9a84c] font-serif text-lg">
                        Sua Leitura
                      </h3>
                      <span className="text-[#555] text-xs ml-auto">
                        Enviada ao WhatsApp
                      </span>
                    </div>
                    <p className="text-[#e8e0d0]/90 text-sm leading-relaxed whitespace-pre-wrap font-serif italic">
                      {readingResult}
                    </p>
                  </div>
                </div>
              )}

              {readingError && (
                <div className="mt-6 bg-red-900/20 border border-red-800/40 rounded-lg p-4">
                  <p className="text-red-400 text-sm">{readingError}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB: GUIA DE VÍCIOS ────────────────────────────────────────── */}
        {activeTab === "guia" && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <h2 className="font-serif text-xl text-[#c9a84c] mb-2">
                Guia de Vícios
              </h2>
              <p className="text-[#666] text-sm">
                Escolha uma categoria e ATB revelará as cartas para iluminar seu
                caminho de cura e transformação.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              {CATEGORIAS_GUIA.map((categoria) => {
                const icones: Record<CategoriaGuia, string> = {
                  "Alimentação Emocional": "🍫",
                  "Relacionamentos Tóxicos": "💔",
                  Procrastinação: "⏳",
                  "Vício em Redes Sociais": "📱",
                  "Ansiedade Crônica": "🌪️",
                  Cigarro: "🚬",
                  Álcool: "🍷",
                };
                return (
                  <button
                    key={categoria}
                    onClick={() => handleGuiaVicios(categoria)}
                    disabled={
                      guiaLoading ||
                      credits.leituras_restantes === 0 ||
                      !profileComplete
                    }
                    className={`mystic-card p-6 text-left transition-all hover:border-[#c9a84c]/50 disabled:opacity-50 disabled:cursor-not-allowed ${
                      guiaCategoria === categoria && guiaLoading
                        ? "border-[#c9a84c]/50"
                        : ""
                    }`}
                  >
                    <div className="text-3xl mb-3">{icones[categoria]}</div>
                    <div className="font-serif text-[#c9a84c] text-base mb-1">
                      {categoria}
                    </div>
                    {guiaCategoria === categoria && guiaLoading && (
                      <p className="text-[#555] text-xs">
                        ATB está consultando as cartas...
                      </p>
                    )}
                  </button>
                );
              })}
            </div>

            {guiaError && (
              <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-4 mb-6">
                <p className="text-red-400 text-sm">{guiaError}</p>
              </div>
            )}

            {guiaResult && guiaCategoria && (
              <div className="animate-fade-in">
                <div className="bg-[#1a0a2e]/50 border border-[#c9a84c]/30 rounded-lg p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-[#c9a84c]">✦</span>
                    <h3 className="text-[#c9a84c] font-serif text-lg">
                      {guiaCategoria}
                    </h3>
                    <span className="text-[#555] text-xs ml-auto">
                      Enviada ao WhatsApp
                    </span>
                  </div>
                  <p className="text-[#e8e0d0]/90 text-sm leading-relaxed whitespace-pre-wrap font-serif italic">
                    {guiaResult}
                  </p>
                </div>
              </div>
            )}

            {credits.leituras_restantes === 0 && (
              <div className="bg-[#8b0000]/20 border border-[#8b0000]/40 rounded-lg p-4 text-center">
                <p className="text-red-400 text-sm">
                  Você utilizou todas as suas leituras deste mês.
                </p>
              </div>
            )}

            {!profileComplete && (
              <div className="bg-[#8b0000]/20 border border-[#8b0000]/40 rounded-lg p-4 text-center">
                <p className="text-red-400 text-sm">
                  Complete seu perfil antes de solicitar uma leitura.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: HISTÓRICO ─────────────────────────────────────────────── */}
        {activeTab === "historico" && (
          <div className="animate-fade-in">
            <h2 className="font-serif text-xl text-[#c9a84c] mb-6">
              Últimas Leituras
            </h2>

            {readings.length === 0 ? (
              <div className="mystic-card p-12 text-center">
                <div className="text-4xl mb-4 opacity-30">📜</div>
                <p className="text-[#555]">
                  Você ainda não tem leituras. Solicite sua primeira!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {readings.map((reading) => (
                  <div key={reading.id} className="mystic-card p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[#c9a84c]">✦</span>
                        <span className="text-[#e8e0d0] text-sm font-medium">
                          {new Date(reading.created_at).toLocaleDateString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {reading.enviado_whatsapp && (
                          <span className="text-green-500/70 text-xs">
                            ✓ WhatsApp
                          </span>
                        )}
                        <button
                          onClick={() =>
                            setExpandedReading(
                              expandedReading === reading.id ? null : reading.id
                            )
                          }
                          className="text-[#555] hover:text-[#c9a84c] text-xs transition-colors"
                        >
                          {expandedReading === reading.id ? "Recolher" : "Ver leitura"}
                        </button>
                      </div>
                    </div>

                    {expandedReading === reading.id && (
                      <div className="mt-4 pt-4 border-t border-[#2a2a2a] animate-fade-in">
                        <p className="text-[#e8e0d0]/80 text-sm leading-relaxed whitespace-pre-wrap font-serif italic">
                          {reading.resposta_ia}
                        </p>
                      </div>
                    )}

                    {expandedReading !== reading.id && (
                      <p className="text-[#555] text-xs mt-1 line-clamp-2 italic">
                        {reading.resposta_ia?.substring(0, 120)}...
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: PERFIL ────────────────────────────────────────────────── */}
        {activeTab === "perfil" && (
          <div className="animate-fade-in max-w-xl">
            <h2 className="font-serif text-xl text-[#c9a84c] mb-6">
              Meu Perfil
            </h2>

            <div className="mystic-card p-8">
              <p className="text-[#666] text-sm mb-6">
                Mantenha seus dados atualizados para que ATB possa personalizar
                suas leituras com precisão.
              </p>

              <form onSubmit={handleSubmit(onProfileSubmit)} noValidate>
                {/* Nome */}
                <div className="mb-5">
                  <label htmlFor="nome" className="block text-sm text-[#888] mb-2">
                    Nome completo
                  </label>
                  <input
                    id="nome"
                    type="text"
                    autoComplete="name"
                    placeholder="Seu nome"
                    className="input-mystic"
                    {...register("nome")}
                    disabled={savingProfile}
                  />
                  {errors.nome && (
                    <p className="text-red-400 text-xs mt-1">{errors.nome.message}</p>
                  )}
                </div>

                {/* Signo */}
                <div className="mb-5">
                  <label htmlFor="signo" className="block text-sm text-[#888] mb-2">
                    Signo
                  </label>
                  <select
                    id="signo"
                    className="input-mystic"
                    {...register("signo")}
                    disabled={savingProfile}
                  >
                    <option value="">Selecione seu signo</option>
                    {SIGNOS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {errors.signo && (
                    <p className="text-red-400 text-xs mt-1">{errors.signo.message}</p>
                  )}
                </div>

                {/* Data de nascimento */}
                <div className="mb-5">
                  <label
                    htmlFor="data_nascimento"
                    className="block text-sm text-[#888] mb-2"
                  >
                    Data de nascimento
                  </label>
                  <input
                    id="data_nascimento"
                    type="date"
                    className="input-mystic"
                    {...register("data_nascimento")}
                    disabled={savingProfile}
                  />
                  {errors.data_nascimento && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.data_nascimento.message}
                    </p>
                  )}
                </div>

                {/* WhatsApp */}
                <div className="mb-6">
                  <label
                    htmlFor="whatsapp"
                    className="block text-sm text-[#888] mb-2"
                  >
                    WhatsApp{" "}
                    <span className="text-[#444] text-xs">
                      (formato internacional: +5511999999999)
                    </span>
                  </label>
                  <input
                    id="whatsapp"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+5511999999999"
                    className="input-mystic"
                    {...register("whatsapp")}
                    disabled={savingProfile}
                  />
                  {errors.whatsapp && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.whatsapp.message}
                    </p>
                  )}
                </div>

                {profileApiError && (
                  <div className="bg-red-900/20 border border-red-800/40 rounded-lg p-3 mb-4">
                    <p className="text-red-400 text-sm">{profileApiError}</p>
                  </div>
                )}

                {profileSuccess && (
                  <div className="bg-green-900/20 border border-green-800/40 rounded-lg p-3 mb-4">
                    <p className="text-green-400 text-sm">
                      ✓ Perfil atualizado com sucesso!
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={savingProfile}
                  className="btn-gold w-full py-3"
                >
                  {savingProfile ? "Salvando..." : "Salvar Perfil"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
