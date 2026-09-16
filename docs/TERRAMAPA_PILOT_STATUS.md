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
