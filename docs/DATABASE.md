# Banco e análise geográfica

As mudanças foram aplicadas ao projeto existente após autorização explícita de 8 de setembro de 2026. Não é necessário executar SQL no painel nem recriar buckets para usar esta atualização.

| Versão alocada pelo Supabase | Migração | Resultado |
| --- | --- | --- |
| 20260908111146 | terra_marketplace_accounts_and_activity | Situações e leituras públicas, perfis/avatares, contatos privados, favoritos, denúncias, eventos e agregados |
| 20260908111217 | terra_spatial_searches_and_notifications | Atributos urbanos/rurais, pesquisa PostGIS, ordenação, buscas salvas e alertas |
| 20260908111329 | terra_qualify_postgis_search_operator | Operador espacial qualificado mantendo search_path vazio |

Os arquivos ficam em `supabase/migrations`. PostGIS permanece em `public`; não mover a extensão. O roteiro `tests/verify-marketplace.sql` passou em transação e descartou os registros temporários. A instalação completa em projeto vazio não foi testada.

## Permissões

- Anúncios ativos, reservados e vendidos são públicos; a busca padrão só inclui ativos/reservados. Rascunhos e pausados ficam privados. Gravações exigem proprietário e revisão.
- Fotos dos terrenos seguem a situação/propriedade, em bucket privado e com URLs assinadas. Avatares ficam no bucket público `terra-profile-photos`, com gravação no diretório do proprietário.
- Contatos, favoritos, buscas e notificações são privados por conta; o cliente não cria notificações. Denúncias pertencem ao denunciante, com revisão administrativa.
- Eventos, visualizações e contatos recebidos não têm acesso direto pela API. `terra_record_event` valida situação, identidade e opção de WhatsApp e deduplica registros. `terra_listing_stats` retorna agregados apenas dos próprios anúncios.
- `terra_advertiser` retorna campos públicos do próprio perfil ou de quem tem anúncio público, sem telefone. O usuário não pode editar `phone_verified`.
- Funções internas privilegiadas usam o schema `private_terra`, nomes qualificados, search_path vazio e permissões restritas. Gatilhos não podem ser executados pelo cliente. A busca é SECURITY INVOKER e respeita RLS.

## Raio-X

`terra-rayx` está implantada. Usa `SUPABASE_URL` e prefere `SUPABASE_PUBLISHABLE_KEYS`, com compatibilidade para `SUPABASE_ANON_KEY`. Não usa service_role nem JWT do usuário: cada requisição lê o anúncio como anônimo, com filtro público, antes do cache. Um proprietário não pode enviar rascunhos ou pausados à análise externa.

`verify_jwt=false` permite visitantes com chave publicável, que não é JWT. A autorização ocorre na leitura com RLS e filtro de situação. Foram testados acesso público, IDs inválidos/inexistentes e, no teste automatizado, o bloqueio de registros privados mesmo com JWT do proprietário.

Configurações opcionais do servidor: `PHOTON_URL`, `ELEVATION_URL`, `OVERPASS_URL`. As duas primeiras têm padrões públicos; a última exige fonte própria/contratada e não está configurada. Ausências não são preenchidas com valores inventados. Cache de seis horas por anúncio/revisão, cem entradas e três consultas simultâneas por instância; isso não constitui limite global.

Referências: [autenticação de funções](https://supabase.com/docs/guides/functions/auth), [chaves publicáveis](https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys).
