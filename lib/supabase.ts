import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

// O cliente de SERVIDOR (com cookies/next-headers) vive em
// lib/supabase-server.ts — não pode ser importado por Client Components.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─── Client-side (browser) ────────────────────────────────────────────────────
export function createBrowserSupabaseClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// ─── Service Role (apenas no servidor, nunca no cliente) ─────────────────────
// Usa SUPABASE_SERVICE_ROLE_KEY — bypassa RLS para operações administrativas
export function createServiceSupabaseClient() {
  if (!supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada");
  }
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
