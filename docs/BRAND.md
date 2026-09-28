# Terra à Vista — identidade 2.1.0

Rebrand de TerraMapa para Terra à Vista em 25/09/2026, a partir de logo fornecida pelo usuário; revisado em 26/09/2026 para remover "Imóveis" do lockup e do nome (era "Terra à Vista Imóveis"). Assinatura: **Seu próximo imóvel, à vista.** Ver `docs/BRAND_IDENTITY.md` para símbolo, cores e inventário de arquivos.

`dist/brand.js` é a fonte de identidade, versão, domínio pretendido e origem ativa. O frontend usa `APP_BRAND`; o build resolve os marcadores de HTML/manifest e incorpora a mesma configuração no Worker. As imagens são ativos editoriais que precisam ser atualizados junto da marca.

A origem publicada é `https://terraavistaimoveis.com.br` (ver [DOMAIN-ROLLOUT.md](DOMAIN-ROLLOUT.md)); `https://terramapa.rodukao.workers.dev` continua no ar e redireciona 308 para ela. Ao trocar `origin` novamente no futuro, repetir a sequência: configurar domínio e TLS, redirecionamentos do Supabase Auth, domínios permitidos do Turnstile e CORS das funções, publicar e só então validar autenticação e links. Nunca apontar canonical para domínio ainda indisponível.

Banco `terra_*`, permissões, proprietários, arquivos e identificadores JavaScript internos foram preservados. Anúncios privados continuam sem preview e sem indexação. A página `/profissionais` apresenta somente recursos existentes.

E-mails: não foi possível inspecionar ou editar os templates atuais pelo conector disponível. Ao configurar SMTP, usar remetente Terra à Vista; em Authentication → Email Templates, revisar nome e assuntos mantendo os links e variáveis de confirmação originais. SMTP, remetente verificado e revisão jurídica continuam pendentes; esta entrega não os configura.

Validação: ver seção de testes deste rebrand. Não houve alteração de schema, autenticação, permissões ou regras de contato.
