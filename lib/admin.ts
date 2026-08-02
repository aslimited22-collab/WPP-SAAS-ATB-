// ─── Autenticação do painel admin ────────────────────────────────────────────
// O app não tinha área admin até os Trabalhos Espirituais. O acesso usa a
// MESMA autenticação Supabase do site (magic link em /login) + uma allowlist
// de e-mails na env ADMIN_EMAILS (separados por vírgula).
//
//   ADMIN_EMAILS=aslimited22@gmail.com,operador@exemplo.com
//
// O middleware já exige sessão para /admin e /api/admin; aqui validamos que
// a sessão pertence a um admin. Sem ADMIN_EMAILS configurada, NINGUÉM é
// admin (fail-closed).

import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export function isAdminEmail(email: string | null | undefined): boolean {
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowlist.length === 0) return false;
  return allowlist.includes((email ?? "").toLowerCase());
}

// Retorna o usuário logado SE for admin; senão null.
// getUser() revalida o token no servidor de auth (não confia só no cookie).
export async function getAdminUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
