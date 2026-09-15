# Piloto profissional — TerraMapa 1.2.0

## Entregue

Contato sem conta por `/api/contact`, perfil público compartilhável `/?imobiliaria=UUID` com logo, descrição, cidade/UF, CRECI declarado, site, Instagram e lista/mapa paginados. O WhatsApp do perfil usa o mesmo fluxo protegido e atribui o lead ao anúncio ativo mais recente da imobiliária. Conta → Visão geral abre métricas dos últimos 30 dias, top 5 por contatos/favoritos/visualizações e gerenciamento com busca, filtros e ações rápidas.

CRECI é declaração, sem criação de selo. Favoritos, alertas e gerenciamento continuam autenticados. O telefone não integra HTML, perfil público nem consultas públicas de anúncios.

## Contato e limites

O Worker lê o IP fornecido pela Cloudflare, gera um hash com chave privada e rotação diária, e usa uma credencial dedicada para chamar `terra-contact`. A chave só existe no ambiente secreto do site; o banco guarda apenas seu hash. O corpo enviado pelo navegador não controla IP, usuário ou verificação de CAPTCHA. A Edge Function valida o proxy antes de consultar o banco. As funções de liberação de telefone são exclusivas de service_role; a chave de serviço permanece no Supabase.

Contadores atômicos por hora: desafio depois de 3 tentativas por sessão ou 5 por IP; bloqueio acima de 20 por sessão ou 60 por IP, mesmo com CAPTCHA. Limite global de proteção: 2.000 tentativas/hora. A troca do identificador de sessão não contorna a quota por IP. Contadores inativos por 48 horas são removidos na próxima chamada da rotina. Turnstile valida token, hostname e ação no servidor; se faltar segredo ou o provedor falhar, contatos que precisam de desafio permanecem bloqueados.

A liberação revalida anúncio publicado/reservado e contato habilitado. Cliques repetidos da mesma sessão/anúncio em 30 minutos geram um só lead. Um contato iniciado não prova envio de mensagem ou conversa. O WhatsApp não é aberto automaticamente fora do clique do visitante.

## Métricas

Ativos = publicados + reservados atualmente. Visualizações e contatos = registros dos últimos 30 dias. Favoritos = salvos nos últimos 30 dias e ainda mantidos. Dashboard resolve o proprietário pelo JWT e não aceita owner_id do navegador. Top 5 omite anúncios sem interações e não cria pontuações artificiais.

## Verificação

85 testes JavaScript aprovados, incluindo caminho anônimo, proxy forjado, origem estrangeira, IP forjado, CAPTCHA inválido e limite absoluto. `tests/verify-professional.sql` passou em transação revertida com usuários sintéticos: perfil público sem telefone, dono A versus B, isolamento das métricas, período de 30 dias, duplicação de lead, anúncio pausado, acesso direto proibido e tentativa de contornar quota trocando sessão. Dados de teste não persistidos. Build validado. Não houve QA novo em navegador real.

Security Advisor: permanecem avisos anteriores de PostGIS em public, spatial_ref_sys sem RLS, permissões de st_estimatedextent e proteção de senhas vazadas desativada. RLS sem policies nas tabelas privadas/internas é intencional, inclusive contadores e chave do proxy. Performance Advisor: oito índices ainda sem uso observado; não removidos.

## Operação

`TURNSTILE_SECRET_KEY` deve estar configurada nos Secrets das Edge Functions do Supabase. A chave pública já usada pelo frontend não substitui esse segredo. Preservar os hostnames de Turnstile e `TERRA_ALLOWED_ORIGINS` durante futura troca de domínio. A credencial `TERRA_CONTACT_PROXY_KEY` deve acompanhar restaurações do ambiente; não salvá-la em git ou no frontend.

Referências: [cabeçalhos de IP da Cloudflare](https://developers.cloudflare.com/fundamentals/reference/http-headers/) e [validação Turnstile no Supabase](https://supabase.com/docs/guides/functions/examples/cloudflare-turnstile).

Verificação da configuração real: o endpoint aceitou a credencial do proxy e exigiu desafio após a quota de teste. A tentativa com token de teste confirmou ausência de `TURNSTILE_SECRET_KEY`. Para concluir: Supabase → Edge Functions → Secrets → adicionar `TURNSTILE_SECRET_KEY` com a chave secreta do widget existente (obtida na Cloudflare → Turnstile). Nunca usar a site key pública nesse campo. Testes com token inválido não liberaram contato.
