# Arquitetura — mapa rápido

Este arquivo existe para quem (humano ou IA) precisa decidir *onde* mexer antes de editar. Para o que cada arquivo faz em detalhe, veja o `README.md`.

## Quem chama quem

```
Navegador (dist/*.js, sem framework, sem build de JS)
  │
  ├─ leitura/escrita direta ─► Supabase REST/RPC (PostgREST) ─► Postgres + PostGIS, RLS por tabela
  ├─ autenticação ───────────► Supabase Auth
  ├─ fotos ───────────────────► Supabase Storage (bucket privado, URLs assinadas)
  └─ operações privilegiadas ─► Supabase Edge Functions (supabase/functions/*)
                                   │ verificam o JWT do usuário, chamam Postgres
                                   │ com a service role, nunca aceitam um user_id
                                   │ vindo do cliente
                                   └─► terra-operations (challenge/exclusão de conta)
                                       terra-billing (Stripe Checkout/portal)
                                       terra-billing-webhook (eventos do Stripe)
                                       terra-storage-cleanup (rotina de limpeza)
                                       terra-rayx (Raio-X — leitura geográfica pública)

server/site-worker.mjs (Cloudflare Worker `terramapa`)
  serve dist/ como site, gera preview social (/og/*, meta tags), atalhos (/i/<code>),
  proxy de /api/contact (esconde a chave de proxy do navegador), cabeçalhos de segurança.
  Publicado com `npm run deploy` (wrangler); gerado a cada build por scripts/build-site.cjs.
```

## Se você precisa mudar X, mexa em Y

| Você quer mudar... | Mexa em... |
| --- | --- |
| Layout, formulários, estrutura da página | `dist/index.html`, `dist/style.css` |
| Mapa, catálogo, edição de anúncio | `dist/app.js`, `dist/js/map/*`, `dist/js/terrenos/*` |
| Login, sessão, conta | `dist/auth.js`, `dist/js/account/*` |
| Busca por cidade/CEP/endereço | `dist/location.js`, `dist/location-ui.js`, `dist/js/search/*` |
| Consultas/gravações no Supabase (favoritos, filtros, comparação etc.) | `dist/data.js`, `dist/js/repository/marketplace.js` |
| CAPTCHA (Turnstile/hCaptcha) | `dist/captcha.js` + `dist/config.js` (chave pública) |
| Vídeo do YouTube no anúncio | `dist/js/video.js` |
| Nome, versão, domínio, tagline da marca | `dist/brand.js` (fonte única — front-end e Worker leem daqui) |
| Cobrança, planos, boost | `dist/js/account/billing.js` + `supabase/functions/terra-billing*` |
| Exclusão de conta, verificação adicional | `supabase/functions/terra-operations` |
| Preview social, links curtos, cabeçalhos HTTP, proxy de contato | `server/site-worker.mjs` |
| Página "Como Publicar" (guia com screenshots) | `dist/como-publicar/index.html`, `dist/guia.css`, imagens em `dist/guia/` — nova pasta soma-se à lista servida por `server/site-worker.mjs` (`/como-publicar`) e ao `sitemap.xml` |
| Esquema do banco, RLS, funções SQL | `supabase/migrations/*.sql` (nova migração, nunca editar uma aplicada) |
| Raio-X (altitude, referências geográficas) | `supabase/functions/terra-rayx`, `dist/js/analysis/rayx.js` |
| Empacotar e publicar | `scripts/build-site.cjs` (build), `npm run deploy` (build + `wrangler deploy`) |

## O que testar depois de mexer

- `npm test` — 137+ testes unitários (`tests/*.test.cjs`), cobrem front-end e o Worker.
- `tests/verify-*.sql` — roteiros transacionais (com `ROLLBACK`) para validar mudanças de banco contra o projeto real sem persistir dados de teste.
- Depois de mudar `server/site-worker.mjs`: `node scripts/build-site.cjs && npx wrangler dev` e conferir no navegador (console sem erros de CSP, mapa carrega, fotos carregam, login funciona).
