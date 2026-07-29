import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { generateReading } from "@/lib/claude";
import { normalizeLocale } from "@/lib/locale";
import { sendWhatsApp } from "@/lib/zapi";
import { checkRateLimit, checkReadingRateLimit } from "@/lib/ratelimit";
import { readingRequestSchema } from "@/lib/validators";

// Limite de tamanho do corpo: 4 KB (o campo "pergunta" tem max 500 chars)
const MAX_BODY_BYTES = 4 * 1024;

export async function POST(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  // ── 1. Rate limit por IP (20 req/min) ────────────────────────────────────
  const ipRl = await checkRateLimit(`readings_ip:${ipAddress}`);
  if (!ipRl.success) {
    return NextResponse.json(
      { error: "Muitas solicitações. Tente novamente em alguns instantes." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(ipRl.limit),
          "X-RateLimit-Remaining": String(ipRl.remaining),
          "Retry-After": String(Math.ceil((ipRl.reset - Date.now()) / 1000)),
        },
      }
    );
  }

  // ── 2. Verificar Content-Type ─────────────────────────────────────────────
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type deve ser application/json" },
      { status: 415 }
    );
  }

  // ── 3. Verificar autenticação ─────────────────────────────────────────────
  // getUser() revalida o token junto ao servidor de auth; getSession() apenas
  // lê o cookie local e não deve ser usado como gate no servidor.
  const supabaseClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Não autorizado. Faça login para continuar." },
      { status: 401 }
    );
  }

  const userId = user.id;

  // ── 4. Rate limit por userId (5 req/hora) — mais restritivo que o de IP ──
  // Evita que um usuário abuse mesmo trocando de IP / usando VPN.
  const userRl = await checkReadingRateLimit(userId);
  if (!userRl.success) {
    return NextResponse.json(
      {
        error:
          "Limite de solicitações por hora atingido. Tente novamente mais tarde.",
      },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": String(userRl.limit),
          "X-RateLimit-Remaining": String(userRl.remaining),
          "Retry-After": String(Math.ceil((userRl.reset - Date.now()) / 1000)),
        },
      }
    );
  }

  // ── 5. Validar tamanho e conteúdo do corpo ────────────────────────────────
  const contentLength = parseInt(
    request.headers.get("content-length") ?? "0",
    10
  );
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload muito grande" }, { status: 413 });
    }
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    body = {};
  }

  const parsed = readingRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const { pergunta } = parsed.data;

  // ── 6. Verificações server-side com service_role (nunca confiar no frontend)
  const supabase = createServiceSupabaseClient();

  // Verificar assinatura ativa
  // maybeSingle: não ter linha é caso normal (nunca assinou) — single() geraria
  // um erro PGRST116 no log a cada requisição desse tipo.
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!subscription || subscription.status !== "active") {
    return NextResponse.json(
      {
        error:
          "Assinatura inativa. Assine o ATB TAROT IA para solicitar leituras.",
      },
      { status: 403 }
    );
  }

  // Verificar créditos
  const { data: credits } = await supabase
    .from("credits")
    .select("id, leituras_restantes")
    .eq("user_id", userId)
    .maybeSingle();

  if (!credits || credits.leituras_restantes <= 0) {
    return NextResponse.json(
      {
        error:
          "Você não tem leituras disponíveis este mês. Aguarde a renovação no próximo ciclo.",
      },
      { status: 403 }
    );
  }

  // Buscar perfil (locale define o idioma da leitura)
  const { data: userProfile } = await supabase
    .from("users")
    .select("nome, data_nascimento, signo, whatsapp, locale")
    .eq("id", userId)
    .single();

  if (
    !userProfile?.nome ||
    !userProfile?.data_nascimento ||
    !userProfile?.signo
  ) {
    return NextResponse.json(
      {
        error:
          "Complete seu perfil (nome, signo e data de nascimento) antes de solicitar uma leitura.",
      },
      { status: 400 }
    );
  }

  if (!userProfile.whatsapp) {
    return NextResponse.json(
      { error: "Cadastre seu WhatsApp no perfil para receber a leitura." },
      { status: 400 }
    );
  }

  // ── 7. Decrementar créditos ANTES de gerar a leitura ─────────────────────
  // Garante atomicidade: se o decremento falhar (ex: race condition), a leitura
  // não é gerada e nenhum crédito é consumido sem registro.
  // O `count` do postgrest só é preenchido quando se pede `{ count: ... }` —
  // sem isso ele volta null e a checagem nunca detectaria a corrida. Por isso
  // o veredito vem do NÚMERO DE LINHAS retornadas pelo update condicional.
  const { data: creditRows, error: creditError } = await supabase
    .from("credits")
    .update({
      leituras_restantes: credits.leituras_restantes - 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", credits.id)
    .eq("leituras_restantes", credits.leituras_restantes) // optimistic lock
    .select("id");

  if (creditError || !creditRows || creditRows.length === 0) {
    // Concorrência detectada: outro request já consumiu o crédito
    return NextResponse.json(
      {
        error:
          "Não foi possível processar sua solicitação. Verifique seus créditos e tente novamente.",
      },
      { status: 409 }
    );
  }

  // ── 8. Gerar leitura com Claude ───────────────────────────────────────────
  let reading: string;
  try {
    reading = await generateReading({
      nome: userProfile.nome,
      data_nascimento: userProfile.data_nascimento,
      signo: userProfile.signo,
      pergunta,
      locale: normalizeLocale(userProfile.locale),
    });
  } catch (err) {
    // Leitura falhou — estornar o crédito decrementado.
    // O estorno é CONDICIONAL ao saldo ainda ser o que deixamos: se uma
    // renovação (webhook) ou outra requisição mexeu no saldo nesse meio-tempo,
    // uma escrita absoluta apagaria esse valor mais novo. Nesse caso o estorno
    // é abandonado — errar a favor da cliente, nunca reduzir o saldo dela.
    await supabase
      .from("credits")
      .update({
        leituras_restantes: credits.leituras_restantes, // restaurar valor anterior
        updated_at: new Date().toISOString(),
      })
      .eq("id", credits.id)
      .eq("leituras_restantes", credits.leituras_restantes - 1);

    console.error("[Readings] Erro ao gerar leitura (crédito estornado)");
    await supabase.from("audit_logs").insert({
      user_id: userId,
      action: "READING_CLAUDE_ERROR_REFUNDED",
      ip_address: ipAddress,
      metadata: { creditRestored: true },
    });
    return NextResponse.json(
      { error: "Erro ao gerar sua leitura. Tente novamente." },
      { status: 500 }
    );
  }

  // ── 9. Enviar via WhatsApp (Z-API) ────────────────────────────────────────
  let enviadoWhatsapp = false;
  try {
    const zapiResult = await sendWhatsApp(userProfile.whatsapp, reading);
    enviadoWhatsapp = zapiResult.success;
  } catch {
    // Não abortar — salvar leitura mesmo sem envio
  }

  // ── 10. Salvar leitura no histórico ───────────────────────────────────────
  const { data: savedReading } = await supabase
    .from("readings")
    .insert({
      user_id: userId,
      prompt_usado: pergunta ?? null,
      resposta_ia: reading,
      enviado_whatsapp: enviadoWhatsapp,
    })
    .select("id")
    .single();

  // ── 11. Audit log ─────────────────────────────────────────────────────────
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "READING_GENERATED",
    ip_address: ipAddress,
    metadata: {
      readingId: savedReading?.id ?? null,
      enviadoWhatsapp,
      creditsRemaining: credits.leituras_restantes - 1,
    },
  });

  return NextResponse.json(
    {
      success: true,
      reading,
      enviado_whatsapp: enviadoWhatsapp,
      leituras_restantes: credits.leituras_restantes - 1,
    },
    { status: 200 }
  );
}
