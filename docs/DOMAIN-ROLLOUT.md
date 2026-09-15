# Domínio próprio — implantação posterior

Estado em 15/09/2026: nenhum domínio personalizado vinculado ao Sites. O endereço atual segue ativo. Não foram alteradas configurações externas de Auth, OAuth ou Turnstile.

## Preparação entregue

`dist/brand.js` centraliza `origin`, `targetOrigin`, `legacyOrigin` e `redirectLegacy`. Worker, canonical, Open Graph, sitemap e compartilhamento usam a origem ativa. Manifest utiliza caminhos relativos e preserva sua identidade. Recuperação, confirmação e OAuth retornam à origem onde o usuário iniciou a ação.

## Ordem da ativação

1. Registrar/controlar terramapa.com.br. Vincular ao Site existente e aplicar exatamente os registros DNS devolvidos pelo provedor; não inventar IP ou CNAME. Aguardar domínio e certificado ativos.
2. No Supabase Auth → URL Configuration, adicionar `https://terramapa.com.br/` e `https://terramapa.com.br/?recovery=1` aos redirects autorizados. Preservar as URLs do endereço antigo. Trocar Site URL para a nova origem somente quando ela estiver acessível.
3. No Turnstile, acrescentar terramapa.com.br à lista de hostnames e manter o hostname antigo. No Google Cloud, revisar o domínio autorizado/tela de consentimento e as origens necessárias; o callback OAuth continua sendo o callback do projeto Supabase, não a página inicial do site. Não ativar um provedor incompleto.
4. Revisar CORS/hostnames nas funções Supabase e publicar essa mudança antes de enviar visitantes ao domínio novo. Manter o endereço antigo permitido durante a transição.
5. Testar no novo endereço: catálogo, login, Google, confirmação, recuperação, upload, contato e links individuais. Sessões locais não são transferidas automaticamente entre origens.
6. Alterar `APP_BRAND.origin` para `APP_BRAND.targetOrigin` e publicar. Canonical/OG/sitemap e novos compartilhamentos passam a apontar para o domínio validado; o endereço antigo deixa de concorrer como URL canônica.
7. Após validar, habilitar `redirectLegacy:true` e publicar. O Worker responde 308 somente para o hostname antigo conhecido, preservando caminho e query. Links de retorno de Auth com `code` ou `recovery` permanecem atendidos no endereço antigo e continuam noindex. Não remover os redirects antigos enquanto existirem e-mails de recuperação/convites em circulação.

A etapa de DNS precisa de acesso ao registrador. A configuração de Google/Turnstile precisa de acesso às respectivas contas. Não há necessidade de enviar senhas no chat.
