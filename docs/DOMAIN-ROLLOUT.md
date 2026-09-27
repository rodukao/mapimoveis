# Domínio próprio — implantação posterior

Estado em 27/09/2026: domínio `terraavistaimoveis.com.br` ativo no Worker Cloudflare `terramapa` e definido como origem canônica (`APP_BRAND.origin`). `redirectLegacy:true`: o endereço `terramapa.rodukao.workers.dev` responde 308 para o domínio novo, exceto retornos de Auth com `code`/`recovery`. Passos 1–7 abaixo concluídos; falta o passo 8 (caixa de contato). A cópia antiga em `terramapa.danielleczfranco.chatgpt.site` não é servida por este Worker e deve ser desativada na hospedagem de origem.

## Preparação entregue

`dist/brand.js` centraliza `origin`, `targetOrigin`, `legacyOrigin` e `redirectLegacy`. Worker, canonical, Open Graph, sitemap e links de compartilhamento usam `origin`. `legacyOrigin` é o endereço workers.dev, servido pelo mesmo Worker, para permitir o redirecionamento 308 após a troca. Recuperação, confirmação e OAuth retornam à origem onde o usuário iniciou a ação.

## Ordem da ativação

1. Registrar `terraavistaimoveis.com.br` (registro.br). Adicionar o domínio à conta Cloudflare (trocar os nameservers no registro.br para os indicados pela Cloudflare) e, em Workers & Pages → `terramapa` → Settings → Domains & Routes, adicionar o Custom Domain. Aguardar domínio e certificado ativos.
2. No Supabase Auth → URL Configuration, adicionar `https://terraavistaimoveis.com.br/` e `https://terraavistaimoveis.com.br/?recovery=1` aos redirects autorizados. Preservar as URLs do workers.dev. Trocar Site URL para a nova origem somente quando ela estiver acessível.
3. No Turnstile, acrescentar `terraavistaimoveis.com.br` à lista de hostnames e manter o workers.dev. No Google Cloud (se o login Google estiver ativo), revisar domínio autorizado e tela de consentimento; o callback OAuth continua sendo o do projeto Supabase.
4. Nas funções Supabase, acrescentar a nova origem ao segredo `TERRA_ALLOWED_ORIGINS` (lista separada por vírgula), mantendo o workers.dev durante a transição.
5. Testar no novo endereço: catálogo, cadastro, confirmação por e-mail, recuperação de senha, upload, contato por WhatsApp e links individuais. Sessões não são transferidas entre origens.
6. Alterar `APP_BRAND.origin` para `APP_BRAND.targetOrigin` e publicar (`npm run deploy`). Canonical/OG/sitemap e novos compartilhamentos passam a apontar para o domínio novo.
7. Após validar, habilitar `redirectLegacy:true` e publicar. O Worker responde 308 do workers.dev para o domínio novo, preservando caminho e query. Links de retorno de Auth com `code` ou `recovery` continuam atendidos no workers.dev. Não remover os redirects antigos do Supabase enquanto houver e-mails de recuperação em circulação.
8. Criar a caixa `contato@terraavistaimoveis.com.br` (o painel de planos usa `contato@` + `APP_BRAND.domain`), por exemplo com Cloudflare Email Routing encaminhando para o seu e-mail.

A etapa de DNS precisa de acesso ao registrador. A configuração de Supabase/Google/Turnstile precisa de acesso às respectivas contas. Não há necessidade de enviar senhas no chat.
