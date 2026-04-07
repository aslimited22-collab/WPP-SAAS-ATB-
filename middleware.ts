import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isSafeRedirectPath } from "@/lib/validators";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/obrigado",
  "/api/webhooks/kiwify",
  "/api/auth",
];

// Métodos que alteram estado — exigem verificação de Origin
const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

// ─── Proteção CSRF via verificação de Origin ──────────────────────────────────
// O header Origin é enviado pelo browser em requisições cross-site.
// Se Origin estiver presente e não bater com o app URL, rejeitar.
// Não se aplica ao webhook (rota pública) nem a GET/HEAD.
function isCsrfSafe(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    // Ausência de Origin é aceitável para requisições same-origin e non-browser
    return true;
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  // Permitir o próprio domínio e o Supabase (redirects de auth)
  const allowed = [appUrl, supabaseUrl].filter(Boolean);
  return allowed.some((url) => {
    try {
      return new URL(url).origin === origin;
    } catch {
      return false;
    }
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;

  // ── Sempre permitir assets estáticos e internos do Next.js ───────────────
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|woff|woff2|ttf|otf)$/)
  ) {
    return NextResponse.next();
  }

  // ── Rotas públicas ────────────────────────────────────────────────────────
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // ── Verificação CSRF para métodos que alteram estado ─────────────────────
  // Aplicar somente a rotas de API autenticadas (não ao webhook público)
  if (
    pathname.startsWith("/api/") &&
    STATE_CHANGING_METHODS.has(method) &&
    !isCsrfSafe(request)
  ) {
    return NextResponse.json(
      { error: "Origem da requisição não permitida" },
      { status: 403 }
    );
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const isApiRoute = pathname.startsWith("/api/");

  // ── Sem sessão → redirect seguro ou 401 ──────────────────────────────────
  if (!session) {
    if (isApiRoute) {
      return NextResponse.json(
        { error: "Não autorizado. Faça login para continuar." },
        { status: 401 }
      );
    }

    // Validar o parâmetro `next` para evitar open redirect
    // Aceitar apenas caminhos relativos seguros (ex: /dashboard)
    const rawNext = request.nextUrl.searchParams.get("next") ?? pathname;
    const safeNext = isSafeRedirectPath(rawNext) ? rawNext : "/dashboard";

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", safeNext);
    return NextResponse.redirect(loginUrl);
  }

  // ── Rotas que exigem assinatura ativa ─────────────────────────────────────
  const needsActiveSubscription =
    pathname.startsWith("/dashboard") || pathname.startsWith("/api/readings");

  if (needsActiveSubscription) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!subscription || subscription.status !== "active") {
      if (isApiRoute) {
        return NextResponse.json(
          {
            error:
              "Assinatura inativa. Assine o ATB TAROT IA para acessar este recurso.",
          },
          { status: 403 }
        );
      }
      return NextResponse.redirect(
        new URL("/assinatura-inativa", request.url)
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
