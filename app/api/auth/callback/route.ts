import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Redirecionar para a rota solicitada ou dashboard
      const redirectTo = next.startsWith("/") ? `${origin}${next}` : `${origin}/dashboard`;
      return NextResponse.redirect(redirectTo);
    }
  }

  // Em caso de erro, redirecionar para login
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
