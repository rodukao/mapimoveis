# Ativar login com Google e outras contas

A integração do site já consulta os provedores habilitados em `/auth/v1/settings`. Abra o formulário de login depois de habilitar um provedor: o respectivo botão aparecerá automaticamente. Não é necessário colocar client ID ou client secret no código do site.

## Google / Gmail

1. No Google Auth Platform, crie ou escolha um projeto:
   https://console.cloud.google.com/auth/overview
2. Configure a marca do app, o e-mail de suporte e o público. Para acesso por pessoas fora da sua organização, escolha público externo. Enquanto o app estiver em teste, inclua os e-mails autorizados como usuários de teste. Para acesso geral, publique a configuração de OAuth e conclua as verificações solicitadas pelo Google.
3. Permita apenas os escopos de identificação: openid, email e profile.
4. Crie um cliente OAuth do tipo **Aplicativo da Web**:
   https://console.cloud.google.com/auth/clients
5. Preencha a origem JavaScript autorizada:

   `https://terramapa.danielleczfranco.chatgpt.site`

6. Preencha o URI de redirecionamento autorizado (callback do SUPABASE):

   `https://pkofzhlcbqupanzydyyf.supabase.co/auth/v1/callback`

7. Copie o **Client ID** e o **Client Secret** diretamente para o provedor Google em Supabase → Authentication → Sign In / Providers e habilite-o:
   https://supabase.com/dashboard/project/pkofzhlcbqupanzydyyf/auth/providers?provider=Google

   Não envie o Client Secret no chat nem o salve no GitHub/front-end.

8. Em Supabase → Authentication → URL Configuration, confira:

   Site URL: `https://terramapa.danielleczfranco.chatgpt.site`

   Redirect URL autorizada: `https://terramapa.danielleczfranco.chatgpt.site/`

   https://supabase.com/dashboard/project/pkofzhlcbqupanzydyyf/auth/url-configuration

9. Abra “Entrar” no site e use “Continuar com Google”. Teste com uma conta autorizada; confirme o retorno ao site, a visualização do catálogo geral e a edição somente dos anúncios da própria conta.

A configuração no Google exige acesso ao seu Google Cloud. O conector atual não fornece esse acesso. Os passos acima precisam ser preenchidos na sua conta; a integração no código está preparada.

Referência oficial: https://supabase.com/docs/guides/auth/social-login/auth-google

## Outros provedores

O site também reconhece os provedores Microsoft (`azure`), GitHub, Apple e Facebook quando estiverem habilitados no Supabase. Cada serviço exige registrar seu próprio aplicativo e suas credenciais, usando o mesmo callback Supabase acima. O suporte no código não significa que as respectivas contas de desenvolvedor já foram configuradas.

Guias oficiais:
- Microsoft: https://supabase.com/docs/guides/auth/social-login/auth-azure
- GitHub: https://supabase.com/docs/guides/auth/social-login/auth-github
- Apple: https://supabase.com/docs/guides/auth/social-login/auth-apple
- Facebook: https://supabase.com/docs/guides/auth/social-login/auth-facebook

Se um login for cancelado ou falhar, entre novamente pelo botão Entrar ou use e-mail e senha. O login social usa o redirecionamento oficial do provedor; o site não coleta senhas de Google, Microsoft ou outros serviços.
