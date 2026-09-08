# Terra

Site de anúncios de terrenos com mapa, cadastro de contas, desenho dos limites, cálculo de área no PostGIS, fotos no Supabase Storage, galeria e visualização ampliada.

Site atual: https://terramapa.danielleczfranco.chatgpt.site

## Código e execução local

Este repositório contém o código-fonte editável. A pasta `dist` contém HTML, CSS e JavaScript escritos diretamente; não há compilação de framework.

```sh
python3 -m http.server 8000 --directory dist
```

Abra http://localhost:8000. Para autenticação local, inclua esse endereço nos redirects do Supabase e autorize localhost no Turnstile de desenvolvimento. Use um projeto de teste para testar alterações no banco.

- `dist/index.html`: estrutura e formulários.
- `dist/style.css`: estilos e responsividade.
- `dist/app.js`: mapa, catálogo e edição.
- `dist/auth.js`, `dist/detail.js` e `dist/location-ui.js`: conta, galeria e busca de localização.
- `dist/data.js`: acesso ao Supabase, regras de consulta e login social.
- `dist/captcha.js`: integração com Turnstile.
- `dist/config.js`: URL e chave PUBLICÁVEL do Supabase, sitekey pública do CAPTCHA.
- `supabase/migrations/`: histórico inicial do banco.
- `docs/photo-upload-fix.sql`: correções posteriores já aplicadas ao projeto atual.
- `tests/data.test.cjs`: testes do adaptador de dados, executáveis com `node --test tests/*.test.cjs`.
- `.openai/hosting.json`: identidade do site na hospedagem Sites. Preserve para atualizar este site; não reutilize sua identidade para criar outro.

As chaves presentes em config.js são públicas por definição. Nunca coloque senha do banco, service_role, secret key, segredo OAuth ou token GitHub no front-end. A autorização é aplicada pelo banco com RLS, não pelo botão de edição.

## Comportamento do catálogo

Todos os visitantes, incluindo os autenticados, podem ver anúncios publicados. “Meus terrenos” é um filtro acionado explicitamente que também mostra rascunhos e anúncios pausados da própria conta. Somente o proprietário pode editar e excluir. Salvar um anúncio não ativa o filtro da conta automaticamente. Entrar e “Explorar” retornam ao catálogo geral.

## Login social

Consulte `docs/LOGIN_SOCIAL.md`. A integração está implementada para Google, Microsoft, GitHub, Apple e Facebook. Só aparecem botões dos provedores habilitados no Supabase. Atualmente todos estão desativados; entrar com e-mail e senha continua disponível. Não são solicitadas senhas dos provedores pelo site.

## Banco atual e nova instalação

No projeto atual, as migrações e as correções de fotos já foram aplicadas: NÃO execute os arquivos SQL novamente apenas para atualizar a interface. Não é necessário recriar o Storage.

Em um projeto novo, revise e aplique nesta ordem: `202609060001_terra_accounts_listings.sql`, `202609060003_terra_listing_photos_cast_text.sql` e `docs/photo-upload-fix.sql`. O arquivo 002 é histórico e foi substituído pelo 003. A sequência de instalação nova não foi executada em um projeto vazio nesta entrega. Configure Auth, URL do site, redirecionamentos e CAPTCHA separadamente, conforme os guias. Copie somente dados que você decidir migrar.

## Hospedagem e GitHub

O repositório principal é https://github.com/rodukao/mapimoveis. A pasta `dist` é a aplicação publicada. Mudanças são verificadas e sincronizadas com `main` antes da publicação. Para outra hospedagem estática, publique `dist` e atualize URLs autorizadas no Supabase e Turnstile.

## Limites de produção e validação

25 testes do adaptador e busca e verificações de sintaxe/referências passaram. Foi verificado com o papel authenticated que anúncios publicados de outro proprietário são visíveis e que sua atualização é bloqueada. Não houve teste de login social real, pois faltam as credenciais dos provedores, nem teste visual no navegador nesta entrega.

O SMTP próprio ainda precisa ser configurado. Consulte os apontamentos de segurança já registrados em `docs/photo-upload-verification.md` antes do lançamento comercial. A interface usa URLs de fotos assinadas com duração de uma hora. O acesso é autorizado pelo Storage conforme a situação e propriedade do anúncio. O bucket de fotos dos terrenos está privado desde a publicação da versão 12; apenas fotos de anúncios públicos ou do próprio proprietário recebem uma URL assinada.

O mapa de ruas usa OpenStreetMap sem chave de API; respeita atribuição e cache do navegador. O serviço comunitário não oferece garantia de disponibilidade ou uso ilimitado: https://operations.osmfoundation.org/policies/tiles/

## Busca e ordenação

Busque por cidade, endereço ou CEP no topo e selecione uma localização. Cidades filtram o catálogo pelo nome do município e UF cadastrados. Endereços e CEPs filtram pelos centros dos terrenos em uma janela aproximada de 3 × 3 km ao redor do local encontrado. CEP sem rua mapeada pode retornar a cidade, com aviso explícito. Os resultados não representam limites de lotes: o anunciante deve conferir o ponto e desenhar o terreno.

Durante o cadastro, a busca move o mapa sem apagar vértices; cidade, UF e bairro são preenchidos somente para um cadastro novo que ainda não tenha desenho. A ordenação por preço, área e data é feita pelo Supabase antes da paginação.

O módulo `dist/location.js` consulta ViaCEP para CEP e Photon para posições. São requisições disparadas pelo botão Buscar, com cache em memória, intervalo entre consultas e timeout; não há autocomplete nem coleta em lote. O endereço do Photon pode ser alterado em `dist/config.js`. O servidor público do Photon permite uso moderado, sem SLA e com possibilidade de limitação; para crescimento comercial, planeje uma instância própria ou provedor contratado.

Fontes: https://github.com/komoot/photon e https://viacep.com.br/

A consulta real de Juiz de Fora retornou o município e seus limites. Os testes automatizados cobrem validação de CEP, normalização, cache, filtros e ordenação. Não houve teste visual no navegador nesta atualização.
