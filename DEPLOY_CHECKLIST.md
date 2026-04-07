# ATB TAROT IA — Checklist de Deploy na Vercel

## 1. Supabase (https://app.supabase.com)

- [ ] Criar novo projeto no Supabase
- [ ] Executar o arquivo `rls-policies.sql` no **SQL Editor** do Supabase
- [ ] Verificar que todas as tabelas foram criadas e RLS está ativo
- [ ] Em **Authentication → Settings**:
  - [ ] Habilitar **Email Magic Links**
  - [ ] Adicionar URL do site em **Site URL**: `https://seu-dominio.vercel.app`
  - [ ] Adicionar em **Redirect URLs**: `https://seu-dominio.vercel.app/api/auth/callback`
- [ ] Copiar as chaves em **Settings → API**:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` ⚠️ nunca expor no frontend

---

## 2. Anthropic (https://console.anthropic.com)

- [ ] Criar conta e gerar API Key
- [ ] Copiar `ANTHROPIC_API_KEY`
- [ ] Verificar que o modelo `claude-sonnet-4-20250514` está disponível na sua conta

---

## 3. Z-API (https://app.z-api.io)

- [ ] Criar instância e conectar WhatsApp via QR Code
- [ ] Copiar:
  - `ZAPI_INSTANCE_ID`
  - `ZAPI_TOKEN`
  - `ZAPI_SECURITY_TOKEN` (Client Token — em Segurança da instância)
- [ ] Manter o WhatsApp conectado (não desconectar o aparelho)

---

## 4. Kiwify

- [ ] Criar produto na Kiwify (R$29/mês, assinatura recorrente)
- [ ] Em **Configurações → Webhooks**, adicionar URL:
  `https://seu-dominio.vercel.app/api/webhooks/kiwify`
- [ ] Definir um **Token** de webhook (valor livre, ex: string aleatória longa) → `KIWIFY_WEBHOOK_TOKEN`
- [ ] Selecionar os eventos:
  - `order_approved`
  - `order_refunded`
  - `subscription_canceled`
  - `subscription_reactivated`
- [ ] Configurar **URL de obrigado** (pós-compra): `https://seu-dominio.vercel.app/obrigado`
- [ ] **Como a Kiwify valida o webhook:**
  - A Kiwify envia `token` e `Signature` no corpo JSON
  - `Signature = HMAC-SHA256(KIWIFY_WEBHOOK_TOKEN, order_id)`
  - O servidor valida que `token === KIWIFY_WEBHOOK_TOKEN` e recalcula o HMAC

---

## 5. Upstash Redis (https://console.upstash.com)

- [ ] Criar banco Redis (plano Free é suficiente para começar)
- [ ] Em **Connect → REST API**, copiar:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

---

## 6. Vercel (https://vercel.com)

### Deploy

- [ ] Conectar repositório GitHub/GitLab ao Vercel
- [ ] Framework: **Next.js** (detectado automaticamente)
- [ ] Build Command: `next build` (padrão)
- [ ] Output Directory: `.next` (padrão)

### Environment Variables (Settings → Environment Variables)

Adicionar **todas** as variáveis abaixo em **Production** (e opcionalmente Preview):

| Variável | Onde obter |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `ZAPI_INSTANCE_ID` | app.z-api.io |
| `ZAPI_TOKEN` | app.z-api.io |
| `ZAPI_SECURITY_TOKEN` | app.z-api.io |
| `KIWIFY_WEBHOOK_TOKEN` | Kiwify → Configurações → Webhooks → Token |
| `UPSTASH_REDIS_REST_URL` | console.upstash.com |
| `UPSTASH_REDIS_REST_TOKEN` | console.upstash.com |
| `NEXT_PUBLIC_APP_URL` | `https://seu-dominio.vercel.app` |

### Pós-deploy

- [ ] Testar login com magic link
- [ ] Testar webhook da Kiwify (usar o botão "Testar" na plataforma)
- [ ] Fazer uma compra de teste e verificar:
  - Usuário criado no Supabase
  - Subscription com status `active`
  - Credits com `leituras_restantes: 5`
- [ ] Testar solicitação de leitura no dashboard
- [ ] Confirmar que a mensagem chegou no WhatsApp

---

## 7. Segurança — verificações finais

- [ ] `.env.local` está no `.gitignore` ✓
- [ ] `SUPABASE_SERVICE_ROLE_KEY` não aparece em nenhum arquivo do frontend
- [ ] `ANTHROPIC_API_KEY` não aparece em nenhum arquivo do frontend
- [ ] RLS ativo em todas as tabelas do Supabase
- [ ] Headers de segurança funcionando (verificar em https://securityheaders.com)
- [ ] Rate limiting testado (Upstash Redis)
