# Terra — conexão com Supabase

Estado em 06/09/2026: chave pública configurada e validada por HTTP. A API Auth respondeu 200; a API de terra_listings respondeu PGRST205 porque a nova tabela ainda não estava no cache (resolvido após aplicar o SQL). O plugin está conectado, mas não expõe operações administrativas nesta sessão. Nenhuma alteração remota de banco ou Auth foi realizada pelo assistente. A demonstração publicada permanece na versão anterior.

## O que falta informar

Projeto confirmado: mapimóveis (`pkofzhlcbqupanzydyyf`). URL e chave pública fornecidas e configuradas. O usuário informou que os dados existentes são testes e autorizou sua substituição se necessária. Nenhum dado foi apagado. A primeira tentativa manual de SQL foi interrompida porque o PostGIS está em outro schema; usar a versão corrigida do script e verificar o resultado.

Com as operações do plugin disponíveis, consultar o projeto, seus schemas, extensões, políticas e configurações antes de aplicar qualquer SQL. Não solicitar senha da conta, senha do PostgreSQL, secret key, service_role ou token pessoal pelo chat.

Caso a conexão não permita obter os dados públicos, eles estão em Connect ou Settings → API Keys:

- Project URL: `https://<referencia>.supabase.co`.
- Publishable key: `sb_publishable_...`.

Esses são os únicos valores usados em `dist/config.js`. O arquivo recusa secret keys e chaves legadas. Uma chave pública identifica o aplicativo; a sessão Supabase Auth identifica a pessoa, e as permissões são impostas no PostgreSQL.

## Banco de dados

Arquivo: `supabase/migrations/202609060001_terra_accounts_listings.sql`.

Aplicar como migração em um projeto de desenvolvimento, após inspecionar a estrutura real. Também pode ser executado uma única vez no SQL Editor. É uma transação: conflitos em objetos existentes interrompem a execução em vez de substituí-los.

- `terra_profiles`: nome privado ligado a `auth.users`; sem senhas e sem cópia do e-mail.
- `terra_listings`: proprietário, título, descrição, cidade, UF, bairro, categoria, preço, situação, polígono, área e perímetro.
- Situações: rascunho, publicado e pausado. Rascunhos e pausados só podem ser lidos pelo proprietário; publicados podem ser lidos pelo catálogo.
- Cada usuário só pode criar, editar ou excluir os próprios terrenos. O proprietário é definido no banco e não pode ser transferido pelo navegador.
- PostGIS valida o polígono e calcula área geodésica, perímetro e posição. Valores derivados e datas não podem ser enviados como alterações pelo usuário.
- Edições usam revisão para detectar alterações concorrentes; novas inserções reutilizam o mesmo identificador em uma tentativa repetida.
- O script detecta o schema real do PostGIS em `pg_extension` e usa identificadores qualificados. Não move nem recria uma instalação existente. Se ainda não houver PostGIS, instala em `extensions`.
- A criação de perfis inclui um trigger em `auth.users` e perfis mínimos para contas existentes. Testar a criação de conta após instalar o trigger, pois um erro nele pode impedir novos cadastros.

Não aplicar automaticamente esta migração a um projeto antigo sem revisar conflitos e políticas. Os nomes `terra_*` evitam substituir tabelas como `profiles`, `properties` ou `terrenos`.

## Supabase Auth

Configuração consultada: login por e-mail habilitado, cadastro habilitado, contas anônimas desabilitadas e confirmação de e-mail desativada (`mailer_autoconfirm=true`). O formulário reconhece tanto cadastro imediato com sessão quanto cadastro que exige confirmação. Para os testes privados, o projeto atual permite cadastro imediato sem SMTP. Antes do lançamento público, configurar SMTP e habilitar confirmação de e-mail. Usar comprimento mínimo de senha de 12 caracteres para corresponder ao formulário e manter cadastros anônimos desabilitados.

Em Authentication → URL Configuration:

| Campo | Valor para a versão de teste atual |
| --- | --- |
| Site URL | `https://terramapa.danielleczfranco.chatgpt.site/` |
| Redirect URL: confirmação | `https://terramapa.danielleczfranco.chatgpt.site/` |
| Redirect URL: recuperação | `https://terramapa.danielleczfranco.chatgpt.site/?recovery=1` |

Revisar os templates de e-mail para preservar o redirecionamento configurado (`ConfirmationURL` no template padrão). Não liberar curingas amplos para a origem de produção. O SDK valida o token de recuperação; o parâmetro de URL sozinho não libera troca de senha.

O endereço atual tem acesso privado do Sites. Um login Supabase não remove essa restrição. Para receber visitantes reais, será necessário definir a hospedagem/domínio público e atualizar a lista de redirecionamentos quando o lançamento for solicitado.

## E-mails

Para cadastro e recuperação com usuários externos, configurar SMTP próprio no Supabase. Os campos do provedor são host, porta, usuário, senha, nome e e-mail do remetente. Preencher credenciais do SMTP diretamente no painel; não enviar senhas pelo chat.

O serviço padrão do Supabase é restrito a testes e a endereços autorizados da equipe. Não tratar um cadastro isolado que funcionou como prova de que o envio para o público está pronto.

## Validação antes de ativar

Já verificado localmente: sintaxe JavaScript, referências do HTML e nove testes do adaptador sobre descarte de campos forjados, filtros de proprietário/publicação, revisão concorrente, preços inválidos, chaves inadequadas e repetição de inserção. Esses testes usam um cliente simulado: não provam a execução das políticas RLS.

Ainda necessário no projeto conectado:

1. Aplicar a migração e verificar tabelas, índices, grants e RLS.
2. Criar duas contas de teste e confirmar o e-mail; testar login, logout e recuperação.
3. Na conta A, salvar rascunho e publicado. Confirmar persistência após recarregar.
4. Sem login, ver somente publicados. Pela conta B, tentar ler rascunhos de A e alterar/excluir os terrenos de A, inclusive diretamente pela API. Todas essas ações devem ser negadas ou não retornar registros.
5. Tentar forjar proprietário, área e datas; enviar polígono cruzado, pontos fora da faixa, área nula e excesso de vértices. O banco deve recusar.
6. Editar o mesmo terreno em duas sessões; a revisão antiga não pode sobrescrever a nova.
7. Conferir polígono e área geodésica com coordenadas conhecidas e testar os controles de desenho/cadastro no celular.
8. Somente então ativar a integração na versão hospedada.

## Itens para o lançamento profissional

Não confundir o cadastro funcional com o aplicativo inteiro pronto para produção. Antes de abrir ao público: separar desenvolvimento e produção, configurar SMTP e proteção contra abuso/CAPTCHA, definir política de privacidade e exclusão de conta, estabelecer backup/recuperação e acompanhamento de erros, e contratar/configurar um provedor de mapas adequado ao uso comercial e volume esperado. Contato público do anunciante, moderação e busca geográfica em grande volume ainda precisam ter escopo definido.

## Fotos dos anúncios

A implementação usa a migração `supabase/migrations/202609060002_terra_listing_photos.sql`.

- `terra_listing_photos` guarda somente metadados e o caminho do arquivo; os bytes ficam no bucket público `terra-listing-photos`.
- O caminho é particionado por usuário e anúncio (`usuario/anuncio/arquivo.webp`).
- Visitantes podem visualizar fotos de anúncios publicados; somente o proprietário autenticado pode enviar ou remover arquivos.
- O frontend aceita até 12 imagens JPG, PNG ou WebP, com limite de 10 MB por arquivo.

Execute a migração no SQL Editor depois da primeira migração. Em seguida, teste criar, editar e excluir fotos com a conta proprietária e abrir um anúncio publicado em uma janela anônima.

## Referências oficiais

- [Chaves públicas e secretas](https://supabase.com/docs/guides/getting-started/api-keys)
- [Autenticação por senha](https://supabase.com/docs/guides/auth/passwords)
- [Redirecionamentos](https://supabase.com/docs/guides/auth/redirect-urls)
- [SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostGIS](https://supabase.com/docs/guides/database/extensions/postgis)

## Verificação após instalação das tabelas

A API do catálogo respondeu 200 e os perfis recusaram acesso anônimo com 42501, conforme esperado. A tentativa de criar a primeira conta técnica retornou `captcha_failed`: o projeto exige um token CAPTCHA. Nenhuma conta de teste ou terreno foi criado. Os testes com dois usuários ainda não foram executados.

O frontend foi preparado para hCaptcha ou Cloudflare Turnstile, enviando `captchaToken` no login, cadastro e recuperação. Falta informar o provedor já configurado no Supabase e sua **Site Key pública** em `dist/config.js`. Não trocar nem solicitar a secret key do servidor. No painel do provedor, autorizar o hostname `terramapa.danielleczfranco.chatgpt.site`. Manter o CAPTCHA ativo.

Referências: https://supabase.com/docs/guides/auth/auth-captcha e https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/ .
