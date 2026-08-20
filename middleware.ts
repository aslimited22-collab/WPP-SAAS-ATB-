import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { isSafeRedirectPath } from "@/lib/validators";

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/obrigado",
  "/limpeza",
  "/entrega",
  // Landing das campanhas de Google Ads: tráfego pago chega deslogado.
  // Sem estar aqui, todo clique no anúncio seria redirecionado para /login.
  "/google-ads",
  // Landings dos Trabalhos Espirituais: páginas públicas de venda.
  "/servicos",
  // Link único do cliente (o access_token do pedido é a credencial):
  // formulário de dados do ritual e, depois, o registro entregue.
  "/pedido",
  "/api/pedido",
  "/api/webhooks/kiwify",
  "/api/webhooks/stripe",
  "/api/auth",
  "/api/checkout",
  "/api/limpeza",
  // Funil da Numerologia (R$45): landing, obrigado, form de dados e download
  // são públicos (o access_token do pedido é a credencial). Sem estar aqui,
  // a cliente deslogada cairia em /login no meio da compra.
  "/numerologia",
  "/api/numerologia",
  // Crons da Vercel chegam sem sessão Supabase — sem estar aqui o middleware
  // devolve 401 ANTES do check de CRON_SECRET e o cron nunca executa.
  // A rota em si é fail-closed: exige Authorization: Bearer <CRON_SECRET>.
  "/api/cron",
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

  // Um redirect novo não herda os cookies que o cliente Supabase gravou em
  // `response` — nem o token renovado, nem a limpeza de um token expirado.
  // Sem copiá-los, a renovação é perdida e a requisição seguinte reautentica
  // de novo (ou o cookie morto persiste e vira loop de redirect no /login).
  const redirectPreservingCookies = (url: URL) => {
    const redirect = NextResponse.redirect(url);
    for (const cookie of response.cookies.getAll()) {
      redirect.cookies.set(cookie);
    }
    return redirect;
  };

  // getUser() revalida o token junto ao servidor de auth (recomendado pelo
  // Supabase), ao contrário de getSession() que apenas lê o cookie local.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isApiRoute = pathname.startsWith("/api/");

  // ── Sem sessão → redirect seguro ou 401 ──────────────────────────────────
  if (!user) {
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
    return redirectPreservingCookies(loginUrl);
  }

  // ── Rotas que exigem acesso pago ──────────────────────────────────────────
  // /api/readings: exige assinatura ATIVA (leituras de tarot são do plano).
  //
  // /dashboard NÃO tem portão: quem está logado ENTRA. Até 20/08 o dashboard
  // exigia assinatura ativa OU chat_credits_balance > 0, e isso EXPULSAVA a
  // cliente que comprou perguntas assim que ela usava a última — 12 das 20
  // compradoras recentes estavam trancadas do lado de fora, sem conseguir
  // reler as respostas que PAGARAM, e vendo "você precisa de uma assinatura
  // ativa — R$29/mês" (assinatura que nunca tiveram e que está descontinuada).
  // Era a reclamação "não consigo acessar o produto".
  //
  // Soltar o portão não dá pergunta grátis: quem cobra o crédito é o servidor
  // do chat (app/api/chat/route.ts devolve 402 sem saldo), e o painel já tem
  // a tela "suas perguntas acabaram → comprar mais 3 ou 7" — que ninguém via
  // porque o middleware barrava antes.
  const needsSubscription = pathname.startsWith("/api/readings");

  if (needsSubscription) {
    // maybeSingle: não ter assinatura é caso normal (quem só comprou créditos
    // avulsos) — single() devolveria erro PGRST116 a cada requisição.
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscription?.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Assinatura inativa. Assine o ATB TAROT IA para acessar este recurso.",
        },
        { status: 403 }
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
