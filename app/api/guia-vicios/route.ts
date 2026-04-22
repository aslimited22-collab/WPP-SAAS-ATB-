import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceSupabaseClient,
} from "@/lib/supabase";
import { generateReading } from "@/lib/claude";
import { sendWhatsApp } from "@/lib/zapi";
import { checkRateLimit, checkReadingRateLimit } from "@/lib/ratelimit";
import {
  guiaViciosSchema,
  type CategoriaGuia,
} from "@/lib/validators";

const MAX_BODY_BYTES = 4 * 1024;

const CATEGORIA_CONTEXTO: Record<CategoriaGuia, string> = {
  "Alimentação Emocional":
    "Faça minha leitura de tarot com foco em alimentação emocional e minha relação com a comida como escape emocional.",
  "Relacionamentos Tóxicos":
    "Faça minha leitura de tarot com foco em relacionamentos tóxicos e como me libertar de padrões afetivos que me fazem mal.",
  Procrastinação:
    "Faça minha leitura de tarot com foco em procrastinação e como superar os bloqueios que me impedem de agir.",
  "Vício em Redes Sociais":
    "Faça minha leitura de tarot com foco no vício em redes sociais e como recuperar minha atenção e presença.",
  "Ansiedade Crônica":
    "Faça minha leitura de tarot com foco em ansiedade crônica e como encontrar paz interior e equilíbrio.",
};

export async function POST(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  const ipRl = await checkRateLimit(`guia_ip:${ipAddress}`);
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

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type deve ser application/json" },
      { status: 415 }
    );
  }

  const supabaseClient = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    return NextResponse.json(
      { error: "Não autorizado. Faça login para continuar." },
      { status: 401 }
    );
  }

  const userId = session.user.id;

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

  const parsed = guiaViciosSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message ?? "Dados inválidos" },
      { status: 400 }
    );
  }

  const { categoria } = parsed.data;

  const supabase = createServiceSupabaseClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!subscription || subscription.status !== "active") {
    return NextResponse.json(
      {
        error:
          "Assinatura inativa. Assine o ATB TAROT IA para solicitar leituras.",
      },
      { status: 403 }
    );
  }

  const { data: credits } = await supabase
    .from("credits")
    .select("id, leituras_restantes")
    .eq("user_id", userId)
    .single();

  if (!credits || credits.leituras_restantes <= 0) {
    return NextResponse.json(
      {
        error:
          "Você não tem leituras disponíveis este mês. Aguarde a renovação no próximo ciclo.",
      },
      { status: 403 }
    );
  }

  const { data: userProfile } = await supabase
    .from("users")
    .select("nome, data_nascimento, signo, whatsapp")
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

  const { error: creditError, count: rowsUpdated } = await supabase
    .from("credits")
    .update({
      leituras_restantes: credits.leituras_restantes - 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", credits.id)
    .eq("leituras_restantes", credits.leituras_restantes)
    .select();

  if (creditError || rowsUpdated === 0) {
    return NextResponse.json(
      {
        error:
          "Não foi possível processar sua solicitação. Verifique seus créditos e tente novamente.",
      },
      { status: 409 }
    );
  }

  let reading: string;
  try {
    reading = await generateReading({
      nome: userProfile.nome,
      data_nascimento: userProfile.data_nascimento,
      signo: userProfile.signo,
      pergunta: CATEGORIA_CONTEXTO[categoria],
    });
  } catch {
    await supabase
      .from("credits")
      .update({
        leituras_restantes: credits.leituras_restantes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", credits.id);

    return NextResponse.json(
      { error: "Erro ao gerar sua leitura. Tente novamente." },
      { status: 500 }
    );
  }

  let enviadoWhatsapp = false;
  try {
    const zapiResult = await sendWhatsApp(userProfile.whatsapp, reading);
    enviadoWhatsapp = zapiResult.success;
  } catch {
    // não abortar
  }

  const { data: savedReading } = await supabase
    .from("readings")
    .insert({
      user_id: userId,
      prompt_usado: `[Guia de Vícios: ${categoria}]`,
      resposta_ia: reading,
      enviado_whatsapp: enviadoWhatsapp,
    })
    .select("id")
    .single();

  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "GUIA_VICIOS_READING_GENERATED",
    ip_address: ipAddress,
    metadata: {
      categoria,
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
