// ─── Chat com a ATB (DeepSeek) ────────────────────────────────────────────────
// POST: envia mensagem e streama a resposta da ATB.
// GET:  histórico + saldo (créditos avulsos ou cota mensal do plano).
//
// Gating:
//   • chat_credits_balance > 0 (pergunta1/3/7) → usa créditos, ignora cota
//   • senão, exige assinatura ativa (basic: 30 msgs/mês, premium: 100)
// A cobrança só acontece se a IA realmente responder.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceSupabaseClient } from "@/lib/supabase";
import { atbSystemPrompt, deepseekStream } from "@/lib/deepseek";
import {
  MESSAGE_LIMITS_MONTH,
  THROTTLE_SECONDS,
  currentMonthKey,
  type UserPlan,
} from "@/lib/plans";
import { normalizeLocale } from "@/lib/locale";
import { checkRateLimit } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_MESSAGE_CHARS = 1500;

// Remove markdown defensivo — o prompt JÁ proíbe, mas o modelo às vezes desobedece.
function stripMarkdown(text: string): string {
  return text
    .replace(/\*+/g, "")
    .replace(/__+/g, "")
    .replace(/`+/g, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[-+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "");
}

function stripControlChars(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

export async function POST(request: NextRequest) {
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // Rate limit por IP (20 req/min — limiter geral)
  const rl = await checkRateLimit(`chat_ip:${ipAddress}`);
  if (!rl.success) {
    return NextResponse.json(
      { error: "Muitas solicitações. Aguarde um momento." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rl.reset - Date.now()) / 1000)) },
      }
    );
  }

  const supabaseClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const userId = user.id;

  // Tamanho/validação do corpo
  const contentLength = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Mensagem muito longa" }, { status: 413 });
  }
  let body: { message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const message = stripControlChars(String(body?.message ?? "")).trim();
  if (!message || message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 });
  }

  // ── Perfil + assinatura (service role: fonte da verdade) ──────────────────
  const supabase = createServiceSupabaseClient();

  const { data: profile } = await supabase
    .from("users")
    .select("plan, chat_credits_balance, messages_month, last_message_month, locale")
    .eq("id", userId)
    .maybeSingle();

  const creditsBalance = profile?.chat_credits_balance ?? 0;
  const usingCredits = creditsBalance > 0;
  const locale = normalizeLocale(profile?.locale);

  let plan: UserPlan | "free" = "free";
  if (profile?.plan === "basic" || profile?.plan === "premium") {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subscription?.status === "active") {
      plan = profile.plan;
    }
  }

  if (!usingCredits && plan === "free") {
    return NextResponse.json(
      {
        error:
          "Para conversar com a ATB, assine um plano ou compre uma pergunta avulsa.",
        needsUpgrade: true,
      },
      { status: 402 }
    );
  }

  const monthKey = currentMonthKey();

  // ── Throttle entre mensagens ────────────────────────────────────────────────
  const { data: lastMsg } = await supabase
    .from("chat_messages")
    .select("created_at")
    .eq("user_id", userId)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const throttle = THROTTLE_SECONDS[plan];
  if (lastMsg?.created_at) {
    const diff = (Date.now() - new Date(lastMsg.created_at).getTime()) / 1000;
    if (diff < throttle) {
      const wait = Math.ceil(throttle - diff);
      return NextResponse.json(
        { error: `Aguarde ${wait}s antes de enviar outra mensagem.` },
        { status: 429, headers: { "Retry-After": String(wait) } }
      );
    }
  }

  // ── Reservar a cobrança ATOMICAMENTE antes de chamar a IA ──────────────────
  // RPCs com UPDATE condicional impedem gasto duplo por requisições
  // concorrentes e não sobrescrevem créditos somados por webhook no meio
  // do streaming. Em falha da IA, o estorno devolve a reserva.
  if (usingCredits) {
    const { data: consumed, error: rpcErr } = await supabase.rpc(
      "consume_chat_credit",
      { p_user_id: userId }
    );
    if (rpcErr || !consumed) {
      return NextResponse.json(
        { error: "Você não tem créditos disponíveis.", needsUpgrade: true },
        { status: 402 }
      );
    }
  } else {
    const planLimit = MESSAGE_LIMITS_MONTH[plan as UserPlan];
    const { data: consumed, error: rpcErr } = await supabase.rpc(
      "consume_monthly_message",
      { p_user_id: userId, p_month: monthKey, p_limit: planLimit }
    );
    if (rpcErr || !consumed) {
      return NextResponse.json(
        {
          error: `Você atingiu o limite de ${planLimit} mensagens deste mês no seu plano.`,
        },
        { status: 429 }
      );
    }
  }

  const refundCharge = async () => {
    if (usingCredits) {
      await supabase.rpc("restore_chat_credit", { p_user_id: userId });
    } else {
      await supabase.rpc("restore_monthly_message", {
        p_user_id: userId,
        p_month: monthKey,
      });
    }
  };

  // ── Histórico (últimas 20) + registro da mensagem do usuário ───────────────
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  const prior = (history ?? [])
    .reverse()
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));

  const { data: insertedMsg } = await supabase
    .from("chat_messages")
    .insert({ user_id: userId, role: "user", content: message })
    .select("id")
    .single();

  const rollbackUserMessage = async () => {
    if (insertedMsg?.id) {
      await supabase.from("chat_messages").delete().eq("id", insertedMsg.id);
    }
  };

  // ── Stream DeepSeek ─────────────────────────────────────────────────────────
  let upstream: Response;
  try {
    upstream = await deepseekStream([
      { role: "system", content: atbSystemPrompt(locale) },
      ...prior,
      { role: "user", content: message },
    ]);
  } catch {
    await rollbackUserMessage();
    await refundCharge();
    return NextResponse.json({ error: "Erro na consulta" }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    await rollbackUserMessage();
    await refundCharge();
    return NextResponse.json({ error: "Erro na consulta" }, { status: 502 });
  }

  let full = "";
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const payload = t.slice(5).trim();
            if (payload === "[DONE]") continue;
            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                const cleanDelta = stripMarkdown(delta);
                full += cleanDelta;
                if (cleanDelta) controller.enqueue(encoder.encode(cleanDelta));
              }
            } catch {
              // chunk parcial — ignora
            }
          }
        }
      } catch (e) {
        controller.error(e);
        return;
      } finally {
        if (full) {
          // A cobrança já foi reservada atomicamente antes do stream.
          await supabase.from("chat_messages").insert({
            user_id: userId,
            role: "assistant",
            content: full.slice(0, 8000),
          });
        } else {
          // Stream abriu mas não veio conteúdo — devolve a reserva.
          await rollbackUserMessage();
          await refundCharge();
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

export async function GET() {
  const supabaseClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createServiceSupabaseClient();

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: profile } = await supabase
    .from("users")
    .select("plan, chat_credits_balance, messages_month, last_message_month")
    .eq("id", user.id)
    .maybeSingle();

  const creditsBalance = profile?.chat_credits_balance ?? 0;

  let plan: UserPlan | "free" = "free";
  if (profile?.plan === "basic" || profile?.plan === "premium") {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subscription?.status === "active") plan = profile.plan;
  }

  let remaining: number;
  if (creditsBalance > 0) {
    remaining = creditsBalance;
  } else if (plan === "free") {
    remaining = 0;
  } else {
    const monthKey = currentMonthKey();
    const usedMonth =
      profile?.last_message_month === monthKey
        ? profile?.messages_month ?? 0
        : 0;
    remaining = Math.max(0, MESSAGE_LIMITS_MONTH[plan] - usedMonth);
  }

  return NextResponse.json({
    messages: (messages ?? []).reverse(),
    plan,
    remaining,
    usingCredits: creditsBalance > 0,
  });
}
