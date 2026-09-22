## Busca lateral e cabeçalho simplificado — 1.5.7 (21/09/2026)

Removidos atalhos de explorar e alertas do cabeçalho do catálogo. Alertas e contagem de não lidos ficam no modal da conta; consultas de contagem só acontecem com esse painel aberto. Desktop: o formulário único de busca permanece no topo fixo da coluna esquerda e o botão Filtros fica logo abaixo do título “Encontre seu imóvel. Entenda a localização”. Mobile: o mesmo formulário e o botão de filtros permanecem acima do mapa, acessíveis antes de abrir a lista. Mudança de viewport reposiciona os elementos sem duplicar listeners/formulários.

99 testes aprovados, build e diff verificados. Navegador real: desktop 1366×768 com mapa iniciando em y=72 e altura de 696 px; alinhamento e busca lateral inspecionados. Mobile 390×844 com busca visível e toolbar fora da coluna recolhida. Sem mudanças no banco. Commit publicado em /version.json.

---

## Busca, alinhamento e seleção — 1.5.6 (21/09/2026)

Desktop com campo de localização e botão de lupa; Filtros à direita alinhado ao CTA do header. Modal existente reúne os filtros e agora oferece Limpar filtros. Controles rápidos mobile preservados. Margens da lista, cards, ordenação, chips e estado vazio padronizadas; botões secundários em 14 px.

Clique na área vazia do mapa e Escape removem seleção, hover persistente e destaque de preço/card sem reconstruir catálogo. Clique no polígono não propaga ao mapa. Escape nos detalhes fecha e limpa; outros modais e edição preservam seus comandos.

99 testes JavaScript aprovados, incluindo retirada de seleção sem recriação das camadas. Build e diff verificados. Navegador real: desktop 1366×768, filtro de preço até resultado vazio, limpeza, botão secundário confirmado em 14 px; seleção de imóvel e Escape (zero cards/preços selecionados), nova seleção e clique fora do polígono (zero selecionados). Mobile 390×844: barra de busca, filtros rápidos e lista inspecionados. Sem mudanças de banco/permissões. Commit publicado em /version.json; pendências externas anteriores mantidas.

---

## Conta estável e navegação mobile explícita — 1.5.4 (21/09/2026)

Desktop: janela com altura fixa adaptada à viewport, menu lateral estável e rolagem independente do conteúdo. Seções carregadas uma vez por abertura; conteúdo e formulário preservados na troca, com reutilização de consultas em andamento. Alterações em favoritos/situação invalidam o resumo. Nova abertura consulta novamente. Encerramento/troca de sessão fecha o painel. Sair reaproveita diretamente o handler de logout existente, com destaque vermelho suave, sem abrir a janela de autenticação.

Mobile: Conta e Favoritos ocupam 100% da largura/altura, com espaço reservado à navegação inferior. Seis seções sempre visíveis em duas linhas, sem menu escondido. Conteúdo com rolagem interna e margem de segurança.

98 testes existentes aprovados; build e git diff --check aprovados. Navegador real em fixture isolada: desktop 1366×768 manteve 1100×704 ao alternar Visão geral/Favoritos; contador de consultas ao resumo permaneceu em 1 ao retornar. Saída simulada confirmou chamada direta e fechamento. Mobile: 360×800, 390×844 e 412×915 com largura/altura integrais e sem overflow horizontal; Favoritos também 360×800. Não foi encerrada sessão real no Supabase nesta rodada; serviço e handler existentes não foram alterados. Sem migration. Commit publicado em /version.json; pendências externas anteriores preservadas.

---

## Favoritos, favicon e navegação da conta — 1.5.3 (21/09/2026)

Coração SVG compartilhado entre menu, cards e detalhes, com rótulos acessíveis e estado salvo preenchido. Favicon SVG/PNG transparente, com URL versionada para renovar o cache. Conta com menu lateral no desktop e seletor expansível em duas colunas no mobile; seção atual indicada, espaçamento interno ampliado e sem rolagem horizontal das abas. Observador do menu inferior considera somente dialogs, preservando a navegação ao expandir o seletor.

Validação: 98 testes JavaScript aprovados, build e git diff --check aprovados. Navegador real com fixture isolada usando o módulo real da conta em 1366×768 e 360×800: abertura, expansão do menu e seleção de Favoritos; painel mobile sem overflow horizontal (329/329 px). Dados da fixture são simulados; não foi efetuado login real. Catálogo real em 360×800: ícones da lista e menu inspecionados visualmente. PNG confirmado com alpha transparente. Fixture somente no servidor de desenvolvimento, fora do artefato publicado. Banco e permissões inalterados. Commit publicado disponível em /version.json. Domínio próprio e espelho GitHub continuam com as pendências anteriores.

---

## Navegação persistente — 1.5.2 (21/09/2026)

Anunciar usa ícone de 24 px como os demais e fundo verde suave. Menu inferior compartilhado pelo catálogo, detalhes, galeria, filtros e painéis, inclusive a camada modal ativa; também disponível em /profissionais, /privacidade e /termos. Links das páginas informativas abrem diretamente a aba correspondente. Conta/favoritos indicam a aba ativa. Espaço reservado abaixo de conteúdo e acima do WhatsApp fixo. Saída da edição exige confirmação de descarte; operações de salvamento/autenticação em andamento são preservadas. Fechamento do login reaproveita a limpeza existente de senha e CAPTCHA.

98 testes JavaScript aprovados. Navegador real: 360×800 com filtros → Lista → anúncio → Mapa, menu clicável dentro das janelas, barra entre y=734 e 800 e WhatsApp acima dela; 390×844 em /profissionais, menu visível e link Lista abrindo diretamente a lista do catálogo. Sem mudanças no banco ou nas permissões. Não foi efetuado login real nesta rodada. Versão e commit publicado disponíveis em /version.json.

---

## Imóveis, contato e identidade — 1.5.1 (20/09/2026)

- Símbolo fornecido pelo usuário convertido em SVG e aplicado à marca, favicon, PWA e preview social. Assinatura: “Seu próximo imóvel, visto no mapa.”
- Hover/foco no card destaca o preço correspondente em âmbar, com borda branca e prioridade visual, sem recarregar catálogo.
- Tipos novos: casa, apartamento, cobertura, sobrado, sala comercial e galpão. Cadastro e filtros de quartos, banheiros, vagas e área construída/privativa. Dados persistem no JSON `details`, com validação numérica no banco. Anúncios existentes mantidos, sem reclassificação inferida pelo título.
- Área construída/privativa declarada é separada da área geodésica no mapa. O cadastro continua usando polígono de referência do lote/empreendimento; não infere metragem interna de apartamentos. Ordenação e filtro de área no mapa estão explicitamente rotulados; área construída tem filtro próprio.
- Publicação e reativação exigem WhatsApp habilitado. Formulário permite cadastrar o número e continuar, ou fechar e salvar rascunho. Proteção aplicada no banco também; telefone continua fora do perfil e das consultas públicas. Anúncios já públicos não foram despublicados.
- Menu mobile: Mapa, Lista, Anunciar, Favoritos, Conta. Anunciar central em verde. Favoritos mantém exigência de conta.

### Validação

98 testes JavaScript aprovados, build e `git diff --check` aprovados. `tests/verify-property-types.sql` passou no Supabase com rollback integral: tipos/atributos, filtros reais, publicação sem contato, reativação com contato desabilitado, privacidade do telefone, isolamento de edição/exclusão e anúncios privados. `tests/verify-professional.sql` passou após adequar fixture à precondição de contato.

Navegador real: 360×800, 390×844, 412×915 e desktop 1366×768. Barra com cinco opções e CTA dentro da tela; lista ocupa área de mapa e retorna pelo botão; ausência de overflow horizontal nas larguras 390 e 412; busca Apartamento + 2 quartos retornou corretamente vazia (nenhum registro atual com esse tipo); hover no primeiro card destacou o preço R$ 1.300.000. Última revisão confirmou ícone central branco e lista em 360×800 entre y=168 e y=734. Casos E2E atualizados; suíte autenticada de navegador não executada nesta rodada. Fluxo completo de cadastro de WhatsApp no navegador autenticado permanece para staging.

Migration: `20260920230841_property_types_and_contact.sql`, aplicada via Supabase. Sem alteração de grants/RLS de anúncios existentes e sem exposição de telefones. Security/Performance Advisors executados; sem novos avisos atribuídos a esta alteração. Permanecem os avisos anteriores de PostGIS em public, spatial_ref_sys sem RLS, st_estimatedextent SECURITY DEFINER, proteção contra senhas vazadas desabilitada, tabelas internas fechadas por intenção e 9 índices ainda sem uso. Referências: [RLS](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public), [PostGIS no schema público](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [funções públicas](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [índices](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

Domínio atual preservado; terramapa.com.br continua pendente de configuração externa. Commit exato do artefato em `/version.json`. Código persistido no repositório de origem do Site; sincronização do espelho GitHub permanece pendente das versões anteriores. Lighthouse não reexecutado; demais pendências comerciais anteriores permanecem.

---

## Acabamento de navegação — 1.4.2

Barra mobile inferior com Mapa, Lista, Anunciar e Conta, área segura reservada e preservação do editor ao navegar. Retirada ferramenta de desenho de área de interesse; busca por área visível mantida e filtros antigos preservados. Filtros mais compactos. Página para profissionais redesenhada com identidade existente, apresentação e etapas de uso, sem CTA de piloto. Prévia do cursor desativada a partir de três vértices; etiquetas de comprimento deslocadas acima dos pontos de inserção.

94 testes JavaScript aprovados. Navegador real em 360×800: barra inferior entre y=734 e 800; mapa e lista terminam em y=734, sem sobreposição nem rolagem horizontal. Alternância Lista → Mapa conferida. Página profissional inspecionada visualmente no desktop. Casos E2E existentes atualizados para navegação e títulos novos; não executados nesta rodada. Banco e autenticação inalterados.

---

## Ajustes de mapa e edição — 1.4.1

Satélite por padrão, com camada Esri World Boundaries and Places abaixo dos polígonos; nomes disponíveis dependem da cobertura e do zoom. Removidos o subtítulo ao lado da marca e o botão Salvar busca da barra principal. Lista mobile ocupa toda a área do mapa, com retorno fixo e CTA maior. Vértices arrastáveis, inserção ordenada pelos pontos intermediários e fechamento explícito pelo primeiro vértice ou botão; o fechamento interrompe a prévia e a medição do próximo ponto. Edição de registros e perímetros importados começa com polígono fechado.

93 testes JavaScript passaram, incluindo quatro cenários novos de fechamento, inserção, arraste e validação. Build de produção aprovado. Esta rodada não incluiu teste autenticado em navegador nem alteração de banco. Camada de referência consultada em https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer . Código publicado identificável em `/version.json`.

---

## Atualização visual — 17/09/2026, 1.4.0

Logo SVG completo, símbolo isolado e versão branca; favicon, PWA e OG atualizados. Inter na interface e Plus Jakarta Sans 700 nos títulos, fontes locais com licenças OFL. Ver `docs/BRAND_IDENTITY.md`. 89 testes JavaScript passaram. Inspeção em navegador no catálogo em 360×800, 390×844, 412×915 e 1366×768: sem overflow horizontal, fontes carregadas e CTA do cabeçalho dentro da tela. Sem alteração de domínio, banco ou permissões. Pendências comerciais e de Lighthouse do relatório abaixo permanecem. O commit publicado está em `/version.json`.

---

# TerraMapa — status do pré-piloto comercial

Data: 16/09/2026. Versão: **1.3.0**.

Commit de implementação no repositório de origem do Site: `6338a333ba8f9a62d00641353826135134db86de`. Este relatório é um commit documental posterior. O SHA exato do artefato publicado é gerado automaticamente em `/version.json`; não é substituído por um hash abreviado ou inventado.

## Entrega e domínio

- Endereço preservado: https://terramapa.danielleczfranco.chatgpt.site.
- Domínio pretendido: `terramapa.com.br`, preparado na configuração central, ainda não ativado como origem canônica.
- Canonical/OG/sitemap continuam apontando para o endereço que funciona. Não ativar redirecionamento antes de validar DNS, TLS, Supabase Auth, OAuth, Turnstile e origens permitidas. Ver `DOMAIN-ROLLOUT.md`.
- Publicação desta versão usa o fluxo habitual do Site; `/version.json` permite conferir a versão efetivamente no ar.

## Marca e visual

Preservados do pacote anterior: TerraMapa, assinatura “Terrenos de verdade, vistos no mapa.”, verde institucional, polígonos âmbar, logo/ícones/manifest/OG, header compacto, cards com foto e favoritos, detalhes e WhatsApp fixo no mobile. Não houve renomeação de tabelas `terra_*`.

Nesta etapa:

- `/profissionais` refinada com “Seus terrenos. Agora no mapa.”, quatro benefícios e CTA para o cadastro do piloto.
- Skeletons no catálogo, conta, perfil e abertura por URL; mensagem vazia útil com limpar filtros/ampliar área.
- Transições de 150 ms e respeito a `prefers-reduced-motion`.
- Correção do texto de versão no preview e do estado inicial do último coração no catálogo.
- Foco preservado em terrenos. Sem Score, CRM, pagamentos, planos, chat, equipes ou IA de descrição.

## Feedback e administração

- Minha Conta → **Enviar feedback**: nota 1–5, categoria, mensagem, página sem query/hash.
- As 12 perguntas do piloto estão disponíveis como tema opcional; a pergunta escolhida acompanha a resposta na mensagem. Roteiro em `PILOT_INTERVIEW.md`.
- RLS: usuário insere e consulta seu feedback; só administrador classifica ou altera status. Status: `new`, `reviewed`, `planned`, `done`.
- Limite de 10 envios por conta em 24 horas, validado no banco sob trava transacional.
- Minha Conta → **Feedback do piloto**: filtros de status/categoria, paginação e classificação. Alterações registradas no histórico administrativo existente.
- Autorização por tabela privada `private_terra.admins` e sessão válida, nunca `user_metadata`.
- Formulários fecham quando a conta muda. Feedback é removido por cascata quando a conta é excluída; retenção de histórico segue a operação existente. Privacidade atualizada.
- **Há zero administradores cadastrados**, confirmado em 16/09. O responsável precisa indicar a conta a autorizar; não se promove automaticamente um usuário. Até isso ocorrer, os botões administrativos permanecem ocultos.

## Migration

Aplicada no Supabase: `terramapa_pilot_feedback`.

Arquivo: `supabase/migrations/20260915225640_terramapa_pilot_feedback.sql`.

Cria `terra_pilot_feedback`, constraints, índices de proprietário/status/categoria, policies e trigger de limite/histórico. Não altera anúncios, buckets ou PostGIS.

## Performance

| Medida reproduzível | Antes 1.2.0 | Depois 1.3.0 |
| --- | ---: | ---: |
| Arquivos JS iniciais | 26 | 4 |
| Bytes JS sem compressão | 496.615 | 463.239 |
| Bytes JS em gzip local | 149.444 | 129.724 |

Redução de aproximadamente **13,2% no gzip** inicial. Não é medição de tempo de carregamento nem de tráfego real.

- Build simples sem novo framework/dependência: bundles clássicos preservam o escopo global da aplicação.
- `core` inicial; `account`, `admin`, `feedback`, `operations`, `editor`, `geometry` e processamento de fotos sob demanda.
- KML/KMZ e coordenadas carregam ao abrir o editor; a geometria também pode carregar quando necessária à área de interesse.
- Cards iniciais não usam lazy; os demais recebem `loading="lazy"` e `decoding="async"`. Otimização de upload e renovação de URL uma vez preservadas.
- Assets com a versão atual: `public, max-age=31536000, immutable`; HTML público sem parâmetros revalida; rotas parametrizadas e `version.json` usam `no-store`.
- Fotos assinadas em lote, favoritos locais em Set, dashboard em uma RPC agregada. Sem consultas por card no catálogo. Removida varredura de todos os corações a cada card.
- Hover continua alterando apenas os elementos envolvidos; busca por movimento manual com debounce preservada.

### Lighthouse antes/depois

| Ambiente | Performance | Accessibility | Best Practices | SEO | LCP | CLS | INP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Antes mobile | Não medido | Não medido | Não medido | Não medido | Não medido | Não medido | Não medido |
| Antes desktop | Não medido | Não medido | Não medido | Não medido | Não medido | Não medido | Não medido |
| Depois mobile | Não medido | Não medido | Não medido | Não medido | Não medido | Não medido | Não medido |
| Depois desktop | Não medido | Não medido | Não medido | Não medido | Não medido | Não medido | Não medido |

A API de navegador deste ambiente não oferece Lighthouse nem controle CDP livre. Não executamos outro navegador para contornar essa restrição. Metas de performance e Core Web Vitals **não estão certificadas**. INP não deve ser preenchido com TBT. Procedimento de medição em `performance/LIGHTHOUSE.md`; baseline por arquivo preservado antes da mudança. HAR completo não capturado; auditoria de N+1 feita no código e testes.

## Testes executados

- **89 testes JavaScript aprovados**, zero falhas. Incluem carga sob demanda, retentativa de módulo, dependência do editor, parsing do build, cache, RLS no adaptador, importações, fotos, contatos, SEO, filtros e hover.
- `tests/verify-pilot-feedback.sql`: aprovado no banco real em transação revertida. Nota inválida, status forjado, caminho com parâmetros, leitura cruzada, `user_metadata` forjado, limite de envio, transições administrativas e histórico.
- `tests/verify-professional.sql`: regressão aprovada em transação revertida. Contato protegido, deduplicação, limites, isolamento das métricas e perfil.
- Security Advisor e Performance Advisor executados após migration.
- Build de produção e `git diff --check`: aprovados.
- Playwright: **168 casos descobertos** por `test:e2e:list`. Isso não significa 168 casos executados. Ajustados helpers para a nova conta, endpoint de contato e resoluções desktop; adicionada suíte de feedback/profissionais.

### Navegador real — escopo efetivamente conferido

Preview local supervisionado com o core compilado, em frames de tamanho fixo (não emulação de aparelho físico):

| Tamanho | Resultado observado |
| --- | --- |
| 360×800 | Catálogo sem overflow horizontal; lista abre; anúncio, galeria e lightbox funcionam; CTA WhatsApp em x=16, y=734, 328×54, dentro da tela. |
| 390×844 | Sem overflow horizontal; header e filtros avançados abrem corretamente. |
| 412×915 | Sem overflow horizontal; controles cabem; desenho de área abre; geometria carregada sob demanda. |
| 1366×768 | Header 72 px, lista 420 px, mapa 946 px; sem overflow horizontal. |
| 1920×1080 | Header 72 px, lista 420 px, mapa 1500 px; sem overflow horizontal. |

Feedback em fixture isolada de 360×800: nota/categoria/mensagem, envio simulado e alteração para planejado funcionaram, sem overflow no formulário. Essa fixture não escreve no Supabase e não comprova login administrativo real; RLS foi verificada separadamente por SQL.

Página profissional em 360×800: quatro benefícios, marca resolvida e CTA dentro da tela. Corrigido roteamento do servidor de QA, que inicialmente caía no catálogo para `/profissionais`; Worker de produção tem rota explícita.

Não executados neste ciclo: suite E2E completa A/B em staging, login/OAuth/SMTP reais, teclado virtual, safe area física, Safari real, compra/registro de domínio, envio de mensagem no WhatsApp. Não houve envio de mensagem nem exclusão de anúncio real.

## Catálogo para demo

7 anúncios públicos auditados; todos têm preço, cidade/UF, polígono válido e registros de fotos. A curadoria ainda não está pronta: vários títulos representam casas, cobertura ou instituições; há descrições/bairros ausentes. Relatório individual em `PILOT_CATALOG_AUDIT.md`.

Não confirmamos “Real” ou “Teste” só pelo título. Nenhum anúncio foi excluído ou alterado. Selecionar 6–15 terrenos reais autorizados e completar fotos, título, descrição, bairro e anunciante antes de apresentar a imobiliárias.

## Warnings restantes

Avisos anteriores preservados, sem correções destrutivas fora deste escopo:

- `spatial_ref_sys` sem RLS: [orientação do advisor](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public).
- PostGIS no schema public: [orientação](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public). Não foi removido nem movido.
- Três assinaturas de `st_estimatedextent` executáveis como SECURITY DEFINER por anon/authenticated: [orientação](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).
- Proteção contra senhas vazadas desativada: [orientação](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- 17 avisos informativos de RLS sem policies em tabelas deliberadamente fechadas. Não abrimos tabelas de eventos/leads/views.
- Performance Advisor: 9 índices ainda não usados, inclusive índice novo de feedback. Mantidos porque a base é pequena; [orientação](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Pendências e decisões para o piloto

1. Indicar qual conta deve receber acesso administrativo.
2. Confirmar a configuração de `TURNSTILE_SECRET_KEY` nas Edge Functions. A última verificação anterior a este pacote indicou ausência; CAPTCHA de Auth e segredo do endpoint são configurações diferentes. Não desativar a proteção.
3. Ativar/validar domínio, URLs de retorno, Google OAuth e e-mails transacionais.
4. Completar Lighthouse antes/depois em staging e QA autenticado com duas contas reais de teste; validar celulares físicos.
5. Fazer curadoria e confirmar autorização dos anúncios. Não fabricar catálogo.
6. Revisar juridicamente Termos/Privacidade e canal do responsável; ativar agenda das rotinas de retenção/órfãos conforme documentação operacional.

**Resultado:** funcionalidades deste pacote implementadas e verificadas no escopo descrito. O aceite comercial completo permanece condicionado a essas pendências; não declaramos prontidão integral para produção comercial.
