# TerraMapa — identidade 1.1.0

Assinatura: **Terrenos de verdade, vistos no mapa.**

`dist/brand.js` é a fonte de identidade, versão, domínio pretendido e origem ativa. O frontend usa `APP_BRAND`; o build resolve os marcadores de HTML/manifest e incorpora a mesma configuração no Worker. As imagens são ativos editoriais que precisam ser atualizados junto da marca.

A origem publicada continua `https://terramapa.danielleczfranco.chatgpt.site`. `https://terramapa.com.br` é o destino pretendido, sem afirmação de registro ou DNS configurado. Antes de trocar `origin`, configurar domínio e TLS no Sites, redirecionamentos do Supabase Auth, domínios permitidos do Turnstile e CORS das funções. Depois publicar e validar autenticação e links. Nunca apontar canonical para domínio ainda indisponível.

Banco `terra_*`, permissões, proprietários, arquivos e identificadores JavaScript internos foram preservados. Anúncios privados continuam sem preview e sem indexação. A página `/profissionais` apresenta somente recursos existentes.

E-mails: não foi possível inspecionar ou editar os templates atuais pelo conector disponível. Ao configurar SMTP, usar remetente TerraMapa; em Authentication → Email Templates, revisar nome e assuntos mantendo os links e variáveis de confirmação originais. SMTP, remetente verificado e revisão jurídica continuam pendentes; esta entrega não os configura.

Validação: 77 testes JavaScript aprovados, incluindo privacidade do preview e autenticação; build e respostas do Worker para início, Privacidade, Termos, Profissionais e manifest verificados sem marcadores pendentes. Não houve alteração de schema nem repetição dos testes SQL. Não foi realizado novo QA de navegador real nesta mudança de marca.
