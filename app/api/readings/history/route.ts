import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceSupabaseClient } from "@/lib/supabase";

export async function GET(_request: NextRequest) {
  const supabaseClient = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();
  const { data: readings, error } = await supabase
    .from("readings")
    .select("id, resposta_ia, enviado_whatsapp, created_at")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: "Erro ao buscar histórico" }, { status: 500 });
  }

  return NextResponse.json({ readings: readings ?? [] }, { status: 200 });
}
