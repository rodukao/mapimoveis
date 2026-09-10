# Terra

Site de anúncios de terrenos com mapa, cadastro de contas, desenho dos limites, cálculo de área no PostGIS, fotos no Supabase Storage, galeria e visualização ampliada.

Site atual: https://terramapa.danielleczfranco.chatgpt.site

Esta versão inclui favoritos, painel da conta, filtros avançados, comparação e ferramentas geográficas. As migrações foram autorizadas, aplicadas e verificadas no projeto existente. Consulte [o estado da entrega e as pendências](docs/ROADMAP_STATUS.md).

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
- `dist/js/repository/marketplace.js`: consultas e gravações das novas funcionalidades.
- `dist/js/terrenos`, `dist/js/account`, `dist/js/search`, `dist/js/map` e `dist/js/analysis`: anúncios, painel da conta, filtros, perímetros e Raio-X.
- `dist/js/ui/dialogs.js` e `dist/marketplace.css`: componentes compartilhados e estilos do marketplace.
- `dist/config.js`: URL e chave PUBLICÁVEL do Supabase, sitekey pública do CAPTCHA.
- `supabase/migrations/`: esquema inicial e migrações registradas no projeto atual.
- `docs/photo-upload-fix.sql`: correções posteriores já aplicadas ao projeto atual.
- `docs/DATABASE.md`: permissões e migrações aplicadas, incluindo a configuração do Raio-X.
- `supabase/functions/terra-rayx/index.ts`: análise geográfica implantada, restrita a anúncios públicos.
- `tests/`: 64 testes, executáveis com `node --test tests/*.test.cjs`.
- `.openai/hosting.json`: identidade do site na hospedagem Sites. Preserve para atualizar este site; não reutilize sua identidade para criar outro.

As chaves presentes em config.js são públicas por definição. Nunca coloque senha do banco, service_role, secret key, segredo OAuth ou token GitHub no front-end. A autorização é aplicada pelo banco com RLS, não pelo botão de edição.

## Comportamento do catálogo

Todos os visitantes, incluindo os autenticados, podem ver anúncios ativos e reservados. Vendidos continuam acessíveis pelo link individual, fora da busca padrão. “Meus terrenos” é um filtro acionado explicitamente que também mostra rascunhos e anúncios pausados da própria conta. Somente o proprietário pode editar e excluir. Salvar um anúncio não ativa o filtro da conta automaticamente. Entrar e “Explorar” retornam ao catálogo geral.

## Login social

Consulte `docs/LOGIN_SOCIAL.md`. A integração está implementada para Google, Microsoft, GitHub, Apple e Facebook. Só aparecem botões dos provedores habilitados no Supabase. Atualmente todos estão desativados; entrar com e-mail e senha continua disponível. Não são solicitadas senhas dos provedores pelo site.

## Banco atual e nova instalação

No projeto atual, as migrações e as correções de fotos já foram aplicadas: NÃO execute os arquivos SQL novamente apenas para atualizar a interface. Não é necessário recriar o Storage.

Em um projeto novo, revise e aplique nesta ordem: `202609060001_terra_accounts_listings.sql`, `202609060003_terra_listing_photos_cast_text.sql` e `docs/photo-upload-fix.sql`. O arquivo 002 é histórico e foi substituído pelo 003. A sequência de instalação nova não foi executada em um projeto vazio nesta entrega. Configure Auth, URL do site, redirecionamentos e CAPTCHA separadamente, conforme os guias. Copie somente dados que você decidir migrar.

Essa sequência histórica exige revisão das referências ao schema PostGIS e das migrações posteriores de Storage; não representa um instalador completo validado. As migrações adicionais com versões alocadas pelo Supabase já estão aplicadas ao projeto atual e não devem ser repetidas.

## Hospedagem e GitHub

O repositório principal é https://github.com/rodukao/mapimoveis. A pasta `dist` é a aplicação publicada. Mudanças são verificadas e sincronizadas com `main` antes da publicação. Para outra hospedagem estática, publique `dist` e atualize URLs autorizadas no Supabase e Turnstile.

## Limites de produção e validação

Na entrega anterior, 54 testes automatizados e verificações de sintaxe/referências passaram. O roteiro transacional `tests/verify-marketplace.sql` passou com duas contas temporárias no banco atual, sem persistir os registros de teste. A API real foi verificada para catálogo, ordenação, interseção de perímetros, perfil público, assinatura das fotos e Raio-X. Não houve teste de login social real, pois faltam as credenciais dos provedores, nem teste visual naquela entrega. A cobertura visual do pacote 4 está descrita abaixo.

O SMTP próprio ainda precisa ser configurado. Consulte os apontamentos de segurança registrados em `docs/ROADMAP_STATUS.md` antes do lançamento comercial. A interface usa URLs de fotos assinadas com duração de uma hora. O acesso é autorizado pelo Storage conforme a situação e propriedade do anúncio. O bucket de fotos dos terrenos está privado desde a publicação da versão 12; apenas fotos de anúncios públicos ou do próprio proprietário recebem uma URL assinada.

O mapa de ruas usa OpenStreetMap sem chave de API; respeita atribuição e cache do navegador. O serviço comunitário não oferece garantia de disponibilidade ou uso ilimitado: https://operations.osmfoundation.org/policies/tiles/

## Busca e ordenação

Busque por cidade, endereço ou CEP no topo e selecione uma localização. Cidades filtram o catálogo pelo nome do município e UF cadastrados. Endereços e CEPs filtram os terrenos cujo perímetro intersecta uma janela aproximada de 3 × 3 km ao redor do local encontrado. CEP sem rua mapeada pode retornar a cidade, com aviso explícito. Os resultados não representam limites de lotes: o anunciante deve conferir o ponto e desenhar o terreno.

A seleção de área utiliza interseção do perímetro com a região no PostGIS. Ao terminar de mover ou ampliar o mapa, a busca atualiza após 400 ms; filtros de preço, tamanho, cidade e demais atributos são preservados. Movimentos feitos pela aplicação não disparam novas buscas. Áreas de interesse desenhadas ou salvas têm prioridade sobre a janela do mapa. As buscas podem ter filtros avançados e alertas internos para novos anúncios correspondentes.

Durante o cadastro, a busca move o mapa sem apagar vértices; cidade, UF e bairro são preenchidos somente para um cadastro novo que ainda não tenha desenho. A ordenação por preço, área e data é feita pelo Supabase antes da paginação.

O módulo `dist/location.js` consulta ViaCEP para CEP e Photon para posições. São requisições disparadas pelo botão Buscar, com cache em memória, intervalo entre consultas e timeout; não há autocomplete nem coleta em lote. O endereço do Photon pode ser alterado em `dist/config.js`. O servidor público do Photon permite uso moderado, sem SLA e com possibilidade de limitação; para crescimento comercial, planeje uma instância própria ou provedor contratado.

Fontes: https://github.com/komoot/photon e https://viacep.com.br/

A consulta real de Juiz de Fora retornou o município e seus limites. Os testes automatizados cobrem validação de CEP, normalização, cache, filtros e ordenação. Essa etapa antecedeu a conferência visual do pacote 4.

## Pacote 3 — mapa, filtros e cadastro

Cards e polígonos compartilham seleção e destaque. Passar o mouse ou focar um card pelo teclado destaca o polígono existente; clicar abre os detalhes. Polígonos usam laranja com estados normal, foco e seleção. A busca automática mantém os resultados durante carregamento ou falha e descarta respostas atrasadas.

Preço, área (m²/ha), tipo, filtros avançados e buscas salvas utilizam o mesmo estado. Filtros ativos podem ser removidos separadamente ou por “Limpar tudo”. A área de interesse está no canto superior direito do mapa; enquanto ativa, a navegação não substitui seu polígono de busca.

O cadastro usa um formulário único, com instruções específicas para desenho, coordenadas e importação. Aceita todas as 27 UFs, sem município/UF fixos no formulário. Informações disponíveis no resultado de localização preenchem um novo cadastro; confira-as antes de salvar. Rascunhos podem deixar título, preço, cidade e UF pendentes, mas precisam de um perímetro válido. Para ativar o anúncio, os quatro campos devem estar completos.

Tipo de anunciante é informação declarada. Os indicadores independentes de e-mail, telefone, identidade e registro profissional só podem ser atualizados por processos autorizados no servidor. Novos indicadores começam como falsos; este pacote prepara os campos e a exibição, sem implementar serviços de verificação.

Testes: `node --test tests/*.test.cjs`; roteiros transacionais `tests/verify-marketplace.sql` e `tests/verify-package3.sql`. Os testes do mapa e dos formulários usam objetos simulados de DOM/Leaflet; não substituem a conferência visual em navegador e celular reais.


## Pacote 4 — QA em navegador

Foram adicionados Playwright, cenários de visitante e cenários autenticados protegidos para staging. A matriz contém desktop Chromium, 360×800, 390×844, 412×915, paisagem 844×390 e WebKit 390×844. A coleta lista 132 combinações; não significa que foram executadas. Cenários destrutivos e importações de arquivos rodam somente no projeto desktop; conta e coordenadas também têm projetos responsivos.

A inspeção manual em Chrome real usou a prévia local com catálogo público e, para telas pequenas, iframes nas dimensões indicadas. Isso verifica layout CSS, mas não emula teclado do sistema, notch, toque ou Safari. Foram corrigidos UUID indisponível em HTTP local, controles Leaflet sobre a lista mobile e sobreposição do zoom com ações do mapa em paisagem.

55 testes JavaScript passaram. A execução completa do runner E2E e os fluxos autenticados permanecem pendentes. Não foram criados anúncios, denúncias ou contatos de QA em produção. Veja [como executar e concluir a validação](docs/QA.md).

## Pacote 5 — operação, moderação e privacidade

Painel de denúncias protegido por tabela administrativa privada, histórico de ações, pausa administrativa, limites por conta e desafio adicional para uso intenso. A liberação de WhatsApp agora exige login; a navegação do catálogo continua pública. Exclusão de conta exige confirmação forte e é executada no servidor, removendo fotos antes do Auth. Privacidade e termos têm páginas próprias e permanecem em revisão jurídica.

64 testes JavaScript e três roteiros SQL passaram. Configurar o administrador, o segredo adicional do Turnstile, SMTP e Google conforme [o guia operacional](docs/OPERATIONS.md). Os testes reais de e-mail, Google e exclusão integral em staging ainda estão pendentes. O procedimento de retenção foi implementado, mas seu agendamento depende da aprovação dos prazos.
