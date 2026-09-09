# Terra — QA do pacote 4

## Estado da entrega

- 55 testes JavaScript executados e aprovados, incluindo validação de importações e o fallback criptográfico de UUID.
- Playwright: 22 cenários em 6 projetos, total de 132 combinações coletadas. **O runner E2E ainda não foi executado.** Coleta e revisão de código não equivalem a aprovação dos cenários.
- Testes manuais em Chrome real na prévia local: catálogo público, mapa, lista, detalhes, URL individual recarregada, fotos, lightbox, favorito solicitando login, compartilhamento por link, filtros, comparação, cidade, CEP, busca automática, desenho de interesse, satélite e Raio-X.
- Em telas pequenas foram usados iframes com viewport CSS de 360×800, 390×844, 412×915 e 844×390. Isso não substitui teste em aparelho físico, Safari, teclado virtual ou safe areas reais.
- Sem staging ativo ou sessões das contas A/B nesta execução. Nenhum anúncio, denúncia ou contato sintético foi criado em produção. A navegação pública pode gerar os eventos normais de visualização do aplicativo.

## Executar localmente

Requer Node 22.12+ e Python disponível como `python` para o adaptador XML dos testes unitários.

```sh
npm ci
npm test
npx playwright install --with-deps chromium webkit
npm run test:e2e:list
npm run test:e2e -- tests/e2e/visitor.spec.cjs
```

Sem configuração adicional, o servidor de QA usa as credenciais **públicas** já existentes em `dist/config.js`. Os cenários de visitante consultam serviços reais; falhas de Photon, ViaCEP, tiles ou Raio-X devem ser investigadas, não ocultadas com retries ou posições inventadas. O teste de Raio-X aceita a mensagem explícita de indisponibilidade como tratamento de erro; ela não atesta disponibilidade dos provedores.

Os testes esperam pelo menos dois anúncios públicos e um anúncio com fotos no catálogo inicial. Use dados sintéticos no staging. Os relatórios ficam em `playwright-report/` e `test-results/`; são ignorados pelo Git. Traces estão desativados para evitar retenção de sessões/requisições autenticadas. Não publique sessões nem relatórios contendo dados privados.

## Preparar staging e contas A/B

1. Disponibilize um projeto Supabase separado, com schema, policies, buckets privados e Edge Functions equivalentes à versão atual. Não copie dados pessoais de produção. A preparação precisa conferir a instalação existente de PostGIS; não reaplique SQL histórico às cegas, não mova nem reinstale a extensão.
2. Configure no Auth as URLs locais/de staging permitidas. Use um widget Turnstile autorizado para esse domínio e a configuração correspondente no Supabase. Mantenha CAPTCHA habilitado. Para confirmar cadastro e recuperar senha, disponibilize e-mails de teste acessíveis e entrega de e-mail funcional.
3. Crie duas contas de teste distintas pelo formulário, confirme os e-mails e entre normalmente. Não utilize contas reais de clientes nem envie senhas/tokens pelo chat.
4. No staging, crie ao menos dois anúncios públicos com geometria válida e um com duas fotos. Para testar contato, a conta A deve disponibilizar um número de WhatsApp pertencente ao responsável pelo QA.
5. Crie localmente `.env.e2e` (ignorado pelo Git):

```dotenv
E2E_SUPABASE_URL=https://SEU-STAGING.supabase.co
E2E_SUPABASE_PUBLISHABLE_KEY=sb_publishable_SUBSTITUIR
E2E_TURNSTILE_SITE_KEY=SUBSTITUIR_PELA_CHAVE_PUBLICA
E2E_ALLOW_WRITES=staging
E2E_STATE_A=playwright/.auth/a.json
E2E_STATE_B=playwright/.auth/b.json
# Opcional: exige contato habilitado na conta A; não envia mensagem.
E2E_TEST_CONTACT=0
```

Não use `service_role`, senha do banco ou secret key no frontend. O Playwright carrega `.env.e2e` e passa a configuração ao servidor Vite de QA. Se iniciar `npm run dev` separadamente, copie somente as três variáveis públicas para `.env.local` ou exporte-as no terminal; reinicie o servidor depois de mudar o projeto. Confira visualmente que a página usa o staging antes de entrar.

Para obter as sessões, em um terminal local com a prévia de staging aberta, execute um comando por conta e faça o login manualmente na janela que abrir:

```sh
mkdir -p playwright/.auth
npx playwright codegen --save-storage=playwright/.auth/a.json http://127.0.0.1:4173
npx playwright codegen --save-storage=playwright/.auth/b.json http://127.0.0.1:4173
```

Feche a janela somente depois de concluir login e CAPTCHA. Esses arquivos equivalem a credenciais: mantenha-os apenas no computador de QA, fora do Git, e apague-os após o uso. Se a sessão expirar, capture uma nova.

```sh
npm run test:e2e
npm run test:e2e:report
```

`E2E_BASE_URL` é opcional para um frontend de staging já hospedado. Ele deve apontar para o mesmo Supabase declarado em `E2E_SUPABASE_URL`. Os cenários autenticados recusam o projeto de produção. Ausência de configuração/sessões aparece como **skipped**, nunca como aprovação.

O ciclo A/B cria um anúncio sintético, salva rascunho, publica com foto, tenta edição e exclusão pela conta B, favorita, denuncia, verifica alerta, edita perímetro e estados, exclui pela conta A e sai. A etapa de contato só é executada com `E2E_TEST_CONTACT=1`; bloqueia navegação para WhatsApp e verifica a resposta do registro de contato, sem envio de mensagem. O sucesso dessa resposta ainda não confirma recebimento de mensagem pelo anunciante.

A limpeza normal usa a interface do proprietário. Se uma asserção falhar, a limpeza alternativa limita-se ao ID sintético e à busca com nome único. Confira também objetos de Storage órfãos no staging após uma execução interrompida. Não execute a limpeza em produção.

## Matriz de cobertura ainda necessária

| Grupo | Automatização preparada | Validação complementar |
| --- | --- | --- |
| Visitante | Catálogo, detalhes/URL, mapa/lista, galeria/lightbox, favorito, filtros, cidade/CEP, viewport, interesse, comparação, semelhantes/Raio-X e compartilhamento | Executar runner; anúncios semelhantes com resultado não vazio; share sheet nativo |
| Conta A | Rascunho, publicação, edição, foto, polígono, busca/alerta no ciclo A/B, estados, exclusão, logout, Minha Conta | Cadastro, login, confirmação de e-mail e recuperação completa com CAPTCHA/e-mail reais |
| Conta B | Público visível, privado indisponível, PATCH/DELETE negados, favorito, denúncia; contato opcional | Executar no staging e conferir persistência dos eventos/contatos |
| Importação | GeoJSON/KML/KMZ válidos e inválidos, duplicatas, auto-interseção, coordenadas válidas/inválidas | Executar no navegador; importar arquivo de levantamento real autorizado |
| Mobile | Projetos 360×800, 390×844, 412×915, 844×390 e WebKit | Aparelhos físicos Android/iOS, toque e teclado virtual |

Nos aparelhos físicos, abrir o teclado em login/cadastro, perfil, busca e coordenadas; conferir scroll até os últimos campos e botões. Repetir com teclado aberto/fechado e em paisagem. Conferir notch e safe area inferior, arraste da lista, filtros, comparação, fotos/lightbox e botão WhatsApp. Registrar dimensão, navegador, sistema, resultado e screenshot da falha. Nenhum botão principal pode ficar cortado ou coberto.

## Correções verificadas na prévia

1. Fallback de `crypto.randomUUID` em origens locais HTTP, usando exclusivamente `crypto.getRandomValues` e preservando a implementação nativa.
2. Isolamento da camada do mapa para impedir controles Leaflet acima da lista mobile.
3. Margem menor do zoom em paisagem de baixa altura, separando-o das ações superiores.

Produção continua servindo `dist` estático. Vite, a rota de viewport e as configurações E2E são exclusivamente ferramentas de desenvolvimento. Não houve migração de banco neste pacote.
