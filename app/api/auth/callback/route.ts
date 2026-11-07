import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isSafeRedirectPath } from "@/lib/validators";
import { channelLocale } from "@/lib/locale";

// Callback de autenticação. Dois fluxos:
//   1. ?code=          → magic link iniciado no /login (PKCE, exchangeCodeForSession)
//   2. ?token_hash=    → link do e-mail de acesso pós-compra (gerado server-side
//                        via admin.generateLink; verificado com verifyOtp)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next = isSafeRedirectPath(rawNext) ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (tokenHash) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Em caso de erro, redirecionar para login
  const login = new URL("/login", origin);
  login.searchParams.set("error", "auth");
  login.searchParams.set("next", next);
  const lang = channelLocale(new URL(next, origin).searchParams.get("lang"))
    ?? channelLocale(request.cookies.get("atb_locale")?.value);
  if (lang) login.searchParams.set("lang", lang);
  return NextResponse.redirect(login);
}
