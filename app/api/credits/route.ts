import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceSupabaseClient,
} from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";

export async function GET(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  // Rate limit por IP (20 req/min compartilhado com o limiter geral)
  const rl = await checkRateLimit(`credits_get:${ipAddress}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Muitas solicitações. Tente novamente em breve." },
      { status: 429 }
    );
  }

  const supabaseClient = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();

  const { data: credits, error } = await supabase
    .from("credits")
    .select("leituras_restantes, mes_referencia, updated_at")
    .eq("user_id", session.user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: "Erro ao buscar créditos" }, { status: 500 });
  }

  // Retornar apenas os campos necessários — nunca expor campos internos como `id`
  return NextResponse.json(
    {
      leituras_restantes: credits?.leituras_restantes ?? 0,
      mes_referencia: credits?.mes_referencia ?? null,
      updated_at: credits?.updated_at ?? null,
    },
    { status: 200 }
  );
}
