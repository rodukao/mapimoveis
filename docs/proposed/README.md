# Propostas de banco — não aplicadas

Estas propostas correspondem à branch `roadmap-marketplace`. Foram preparadas para revisão e **não fazem parte do histórico de migrações aplicadas**. Não devem ser executadas para contornar a rejeição da revisão automática de aprovação.

Leia primeiro [o estado da entrega](../ROADMAP_STATUS.md), que detalha as novas permissões, o bloqueio e a sequência de validação. O projeto atual mantém PostGIS no schema `public`; não mover a extensão.

| Arquivo | Objetos e comportamento |
| --- | --- |
| `01-marketplace.sql` | Novas situações e políticas públicas de anúncios/fotos; atributos públicos do perfil; bucket público de avatares; contatos privados; favoritos; denúncias; visualizações; contatos recebidos; eventos; RPCs com controles de acesso e agregação |
| `02-search-and-notifications.sql` | Atributos urbanos/rurais; pesquisa espacial com PostGIS e paginação/ordenação no servidor; buscas salvas; notificações privadas; gatilhos de validação e correspondência |
| `verify-marketplace.sql` | Roteiro transacional com duas contas temporárias, verificação de RLS, identidade, situação, favoritos, métricas e alertas; finaliza com `ROLLBACK`; preparado, ainda não executado |

Dependência: 01 → 02 → verificação. A aplicação nova depende de ambas as propostas. Os arquivos não são instaladores idempotentes e não têm datas de migração inventadas. Após aprovação e validação, registrar versões pelo serviço/CLI do Supabase antes de incorporá-los ao histórico.

## Limites de exposição

- `terra_contact_settings`, `terra_favorites`, `terra_saved_searches` e `terra_notifications`: acesso por proprietário autenticado; as notificações não aceitam inserção pelo cliente.
- `terra_reports`: criação e leitura pelo denunciante; revisão administrativa fora da API do anunciante.
- `terra_views`, `terra_leads`, `terra_events`: RLS habilitada, sem acesso direto dos papéis `anon`/`authenticated`. Registro e agregados passam por funções restritas.
- `terra_record_event`: permite ações anônimas previstas, confere a disponibilidade do anúncio, deriva proprietário/usuário do banco e aplica deduplicação/limite por sessão.
- `terra_listing_stats`: exige conta e devolve agregados apenas dos próprios anúncios.
- `terra_advertiser`: retorna somente campos públicos, e apenas do próprio perfil ou de quem tem anúncio público. O telefone não integra essa resposta.
- `terra_search_listings`: `SECURITY INVOKER`; a pesquisa respeita RLS. Reservados participam do catálogo padrão; vendidos continuam acessíveis pelo link, fora da busca padrão.
- As funções internas que precisam de `SECURITY DEFINER` usam `search_path` vazio, nomes qualificados, validação e permissões explícitas. Os gatilhos não ficam executáveis pelo cliente.

## Função de análise geográfica

O código está em `supabase/functions/terra-rayx/index.ts`, ainda não implantado. Usa `SUPABASE_URL` e `SUPABASE_ANON_KEY` fornecidos pelo ambiente de Edge Functions e reenvia o JWT do usuário à consulta do anúncio. Não usa `service_role`.

A configuração de implantação deve usar `verify_jwt=false` para aceitar visitantes com a chave publicável, que não é um JWT. Isso não remove a autorização: cada requisição consulta o anúncio com RLS **antes** de ler o cache. Validar obrigatoriamente anúncio privado, outra conta e logout antes da publicação.

Configurações opcionais no servidor: `PHOTON_URL`, `ELEVATION_URL` e `OVERPASS_URL`. A última não tem padrão comunitário e precisa de uma fonte própria/contratada; as duas primeiras possuem padrões públicos sem garantia de disponibilidade. Não inserir segredos ou URLs com credenciais no front-end.
