import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceSupabaseClient,
} from "@/lib/supabase";
import { checkRateLimit, checkProfileRateLimit } from "@/lib/ratelimit";
import { profileSchema } from "@/lib/validators";

// Limite de tamanho do corpo: 8 KB (perfil com campos limitados)
const MAX_BODY_BYTES = 8 * 1024;

export async function GET(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  // Rate limit por IP para leituras de perfil
  const rl = await checkRateLimit(`profile_get:${ipAddress}`);
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
  const { data: profile, error } = await supabase
    .from("users")
    .select("id, email, nome, signo, data_nascimento, whatsapp, created_at")
    .eq("id", session.user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    // Não expor detalhes do erro do banco
    return NextResponse.json({ error: "Erro ao buscar perfil" }, { status: 500 });
  }

  return NextResponse.json({ profile: profile ?? null }, { status: 200 });
}

export async function PUT(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  // ── 1. Verificar Content-Type ─────────────────────────────────────────────
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return NextResponse.json(
      { error: "Content-Type deve ser application/json" },
      { status: 415 }
    );
  }

  // ── 2. Verificar autenticação ─────────────────────────────────────────────
  const supabaseClient = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const userId = session.user.id;

  // ── 3. Rate limit por userId (10 req/min) ─────────────────────────────────
  const rl = await checkProfileRateLimit(userId);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Muitas atualizações de perfil. Aguarde um momento." },
      { status: 429 }
    );
  }

  // ── 4. Limitar tamanho e parsear corpo ────────────────────────────────────
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
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: "Corpo da requisição inválido" },
      { status: 400 }
    );
  }

  // ── 5. Validar com Zod (sanitiza + valida todos os campos) ────────────────
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos",
        details: parsed.error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      },
      { status: 400 }
    );
  }

  // ── 6. Obter email da sessão autenticada (não do payload) ─────────────────
  // O email nunca é aceito do corpo da requisição — sempre vem da sessão Supabase
  const email = session.user.email;
  if (!email) {
    return NextResponse.json(
      { error: "E-mail da sessão inválido" },
      { status: 400 }
    );
  }

  const supabase = createServiceSupabaseClient();

  const { error: dbError } = await supabase.from("users").upsert(
    {
      id: userId,
      email, // email imutável — sempre da sessão, nunca do frontend
      nome: parsed.data.nome,
      signo: parsed.data.signo,
      data_nascimento: parsed.data.data_nascimento,
      whatsapp: parsed.data.whatsapp,
    },
    { onConflict: "id" }
  );

  if (dbError) {
    // Log interno sem expor detalhes do erro do Supabase
    console.error("[Profile] Erro ao atualizar perfil:", dbError.code);
    return NextResponse.json({ error: "Erro ao salvar perfil" }, { status: 500 });
  }

  // Log de auditoria de atualização de perfil
  await supabase.from("audit_logs").insert({
    user_id: userId,
    action: "PROFILE_UPDATED",
    ip_address: ipAddress,
    metadata: { updatedFields: ["nome", "signo", "data_nascimento", "whatsapp"] },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
