# Terra — estado da entrega

Atualizado em 8 de setembro de 2026. As migrações foram aplicadas após autorização explícita do proprietário e o Raio-X está implantado. Este código está pronto para a sequência de publicação. Os limites de validação abaixo continuam válidos após publicar.

## Funcionalidades

| Etapa | Entrega | Validação |
| --- | --- | --- |
| 0 — Base | Terra consolidado no GitHub, sem dados demonstrativos nem salvamento em memória; módulos separados; fotos em bucket privado | Publicado anteriormente; assinatura de fotos reconferida na API |
| 1 — Marketplace | URL individual, favoritos, compartilhamento, WhatsApp com registro do contato, visualizações, situações, denúncias e perfil do anunciante | Migração aplicada; testes de isolamento, métricas, favoritos e visibilidade passaram |
| 2 — Busca e conta | Filtros avançados, m²/ha, buscas salvas, alertas internos, similares, comparação de 2 a 4 terrenos e painel da conta | Migração aplicada; geração de alertas e pesquisa real verificadas |
| 3 — Mapa e cadastro | Busca pela área visível ou polígono; coordenadas; GeoJSON/KML/KMZ; distâncias dos vértices; campos urbanos/rurais | Interseção PostGIS testada na API; importadores cobertos por testes automatizados |
| 4 — Raio-X | Referência central da cidade e amostras de altitude reais, com indicação de indisponibilidade | Função implantada e chamada pela API; limitada a anúncios públicos |

**TerraScore e inteligência de preço regional continuam fora da entrega.** Existem apenas três anúncios públicos de teste, sem volume representativo para comparar o mercado. Preço por m² é a divisão do preço anunciado pela área calculada.

## Privacidade

| Situação | Busca padrão | Link individual e fotos | Edição |
| --- | --- | --- | --- |
| Rascunho | Apenas Meus terrenos | Proprietário | Proprietário |
| Ativo | Público | Público | Proprietário |
| Reservado | Público, identificado | Público | Proprietário |
| Vendido | Fora da busca padrão | Público, identificado | Proprietário |
| Pausado | Apenas Meus terrenos | Proprietário | Proprietário |

O perfil público inclui nome, foto, cidade, tipo de anunciante e número de anúncios ativos. Avatares usam um bucket público separado. O WhatsApp fica em tabela privada e só é fornecido no fluxo de contato quando habilitado; não existe verificação automática do telefone. Favoritos, buscas e notificações pertencem à conta. O anunciante recebe métricas agregadas; identificadores brutos de visitantes não ficam disponíveis na API. Denúncias ficam pendentes de revisão administrativa.

O Raio-X lê o anúncio como visitante anônimo, com filtro público, **antes de qualquer cache ou consulta externa**. O JWT do proprietário não é encaminhado nem pode liberar rascunhos ou pausados. Essa restrição resolveu a rejeição automática da implementação inicial, que poderia encaminhar coordenadas privadas aos provedores.

## Verificação

- **42 testes automatizados**: autorização/revisão no cliente, autenticação/CAPTCHA, fotos, CEP/localização/cache, filtros/paginação, perfil, perímetros, KML/KMZ, autorização do Raio-X, chaves publicáveis e ausência de fontes.
- `tests/verify-marketplace.sql` passou no banco existente em transação com duas contas temporárias e `ROLLBACK`. Confere terreno alheio, rascunhos, telefone verificado, contatos privados, métricas, favoritos únicos, denúncias, alerta correspondente e situação vendido.
- Permaneceram **cinco perfis e três anúncios existentes**, sem usuários de teste persistidos e com RLS em todas as oito novas tabelas.
- A API real retornou os três anúncios de Juiz de Fora por preço crescente, encontrou um terreno pela interseção de seu polígono, expôs o perfil sem telefone e assinou as duas fotos do anúncio consultado.
- O Raio-X retornou altitude amostrada entre 810 e 813 m, distância de aproximadamente 6,29 km à referência central de Juiz de Fora e rejeitou IDs inválidos ou indisponíveis. A classificação `municipality` retornada pelo Photon para Juiz de Fora foi incorporada ao reconhecimento de cidades.

Os testes JavaScript usam respostas controladas; os testes KML adaptam o parser XML no Node. **Não houve teste visual/funcional em navegador desktop ou mobile**, nem login social real. O ambiente Sites desta sessão não oferece preview compatível com o projeto estático. A validação com duas contas ocorreu no SQL, não no formulário do site. Não descrever esses testes como cobertura completa de ponta a ponta.

As migrações em `supabase/migrations` usam versões retornadas pelo serviço do Supabase. O teste real identificou e corrigiu o operador PostGIS `&&`, agora qualificado como `operator(public.&&)` para manter `search_path` vazio. Não foi criada uma segunda base nem apagado o esquema existente. Detalhes em [DATABASE.md](DATABASE.md).

## Pendências para lançamento comercial

- Configurar SMTP próprio e credenciais sociais. Os botões sociais só aparecem para provedores habilitados; alertas de buscas são internos, sem e-mail.
- Testar em navegador login/logout, cadastro/edição/fotos, links, favoritos, compartilhamento, contato, filtros, alertas, comparação, importação e desenho. No mobile, conferir teclado, rolagem, lista arrastável, lightbox e botão inferior de contato.
- Configurar `OVERPASS_URL` de fonte própria/contratada para serviços próximos e vias. Sem isso, a interface informa a ausência da fonte.
- Photon e Open Topo Data públicos não oferecem SLA. Cache/limites são por instância. Medir demanda antes de escalar; notificações percorrem buscas com alerta, limitadas a 50 por conta.
- SRTM tem resolução aproximada de 90 m; variações amostradas não equivalem a levantamento topográfico. Distâncias são em linha reta; infraestrutura e documentação são declarações do anunciante.
- Definir retenção dos eventos e proteção adicional contra abuso antes de grande volume. Métricas por sessão não equivalem a visitantes ou contatos verificados.

## Apontamentos do Supabase

RLS sem políticas nas tabelas de eventos, contatos recebidos e visualizações é intencional: não há acesso direto de `anon`/`authenticated`; funções restritas registram e agregam esses dados.

Permanecem apontamentos anteriores: [spatial_ref_sys sem RLS](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public), [PostGIS em public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public), [st_estimatedextent acessível pela API](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable) e [proteção contra senhas vazadas desativada](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Não mover a extensão sem uma migração específica de compatibilidade. A execução pública de `rls_auto_enable` foi revogada nesta entrega.

A versão anterior do site permanece disponível para recuperação. Um retorno do front-end não desfaz a visibilidade autorizada de reservados/vendidos e perfis. Não apagar tabelas nem executar scripts históricos novamente como reversão.

Fontes: [Photon](https://github.com/komoot/photon), [ViaCEP](https://viacep.com.br/), [Open Topo Data / SRTM](https://www.opentopodata.org/datasets/srtm/), [OpenStreetMap](https://www.openstreetmap.org/copyright).
