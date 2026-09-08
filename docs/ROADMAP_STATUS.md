# Terra — próxima versão

Estado em 8 de setembro de 2026. Este documento descreve a branch `roadmap-marketplace`, ainda não publicada. O site público permanece na versão 12.

## O que está no ar

- [Site público](https://terramapa.danielleczfranco.chatgpt.site), acessível sem login no ChatGPT.
- Contas com e-mail/senha e CAPTCHA; anúncios com desenho, área calculada no PostGIS, até 12 fotos, galeria e ampliação.
- Busca por cidade, endereço e CEP; ordenação por preço, área e data.
- Catálogo público igual para visitantes e usuários autenticados; edição restrita ao proprietário.
- Etapa 0: dados demonstrativos e salvamento em memória removidos, módulos de conta/detalhe/localização separados e GitHub principal consolidado com Terra.
- Fotos dos terrenos em bucket privado desde a versão 12, com URLs assinadas por uma hora e leitura autorizada por RLS.

Publicação verificada: versão 12, fonte Sites `3b38125d3fc5d1be0d689d5dd225daf1a527ecc4`. As mudanças posteriores de documentação no GitHub não alteram o site.

## Entrega preparada para revisão

| Etapa | Código nesta branch | Ativação pendente |
| --- | --- | --- |
| 1 — Marketplace | URL individual `?terreno=ID`, favoritos, compartilhamento, WhatsApp com registro do contato, visualizações deduplicadas, situação do anúncio, denúncias e perfil público do anunciante | Proposta SQL 01; verificação com contas distintas |
| 2 — Busca e conta | Filtros por preço, área em m²/ha, tipo, contexto urbano/rural, topografia, infraestrutura e documentação; buscas salvas; alertas dentro do site; similares; comparação de 2 a 4 terrenos; painel da conta | Propostas SQL 01 e 02; verificação dos alertas e paginação no banco |
| 3 — Mapa e cadastro | Busca pela área visível ou por polígono de interesse; entrada de coordenadas; importação GeoJSON/KML/KMZ; distâncias entre vértices; campos urbanos e rurais | SQL 02 para pesquisa espacial; testes em navegador dos desenhos e arquivos |
| 4 — Raio-X | Função com leitura autorizada por RLS, cache por revisão do anúncio, referência central da cidade e amostras de altitude reais; campos indisponíveis são identificados | Publicar e testar `terra-rayx`; configurar uma fonte própria/contratada de vias e serviços próximos |

**TerraScore e inteligência de preço regional não foram implementados.** O projeto tem apenas três anúncios públicos de teste; não há volume representativo para produzir comparações de mercado confiáveis. Preço por m² exibido é a divisão do preço anunciado pela área calculada.

Esta branch exige as novas tabelas, colunas e funções. Publicar somente seu `dist` sobre o banco atual interromperia a consulta do catálogo. Não houve publicação parcial dessa versão.

## Decisões de produto e privacidade propostas

| Situação | Catálogo e busca padrão | Link individual e fotos | Edição |
| --- | --- | --- | --- |
| Rascunho | Apenas em Meus terrenos | Apenas proprietário | Proprietário |
| Ativo | Público | Público | Proprietário |
| Reservado | Público, identificado como reservado | Público | Proprietário |
| Vendido | Fora da busca padrão | Público, identificado como vendido | Proprietário |
| Pausado | Apenas em Meus terrenos | Apenas proprietário | Proprietário |

- O perfil público inclui nome, foto, cidade, tipo de anunciante e quantidade de anúncios ativos. A foto de perfil usa um novo bucket público separado das fotos dos terrenos.
- O número de WhatsApp fica em tabela privada. Só é fornecido pelo fluxo de contato quando o anunciante habilita essa opção. Não há verificação automática do telefone; o usuário não pode marcar o próprio número como verificado.
- Favoritos, buscas e notificações pertencem à conta que os criou. A edição dos anúncios continua limitada ao proprietário, com controle de revisão para detectar alterações concorrentes.
- O anunciante recebe contagens agregadas de visualizações, favoritos e contatos. Identificadores brutos de visitantes não são disponibilizados pela API pública.
- Denúncias ficam pendentes para revisão administrativa no Supabase. A interface não remove automaticamente um anúncio denunciado.
- Os alertas desta entrega aparecem na conta, sem envio de e-mail. Eles são gerados para novos anúncios compatíveis ou anúncios reativados; não notificam novamente a cada edição.

## Validação realizada

Em 8 de setembro de 2026, `node --test tests/*.test.cjs` passou em **40 testes**, sem falhas. A sintaxe de 20 módulos foi verificada; os 22 scripts/estilos referenciados existem e os 120 IDs do HTML são únicos.

Cobertura: autorização e revisão enviadas pelo cliente, autenticação/CAPTCHA, ordem de upload e sincronização de fotos, CEP/localização/cache, parâmetros de busca/paginação, perfis e falhas parciais, perímetros válidos e inválidos, KML/KMZ comprimido e limites de tamanho, autorização antes do cache do Raio-X e ausência de dados externos.

Os testes de integração usam respostas controladas. Os testes KML adaptam o parser XML no ambiente Node; não comprovam o comportamento dos navegadores. Os testes antigos de catálogo exercitam `TerraData.list`; o novo adaptador é coberto por `marketplace.test.cjs`, mas a execução real da RPC ainda depende das migrações.

**Ainda não executados:** as propostas SQL, o roteiro transacional `docs/proposed/verify-marketplace.sql`, o fluxo completo com duas contas na nova versão, a função no Supabase e a validação visual/funcional em desktop e mobile. O ambiente Sites desta sessão não oferece preview de navegador compatível com este projeto estático. A adaptação mobile está no código, sem validação visual nesta entrega.

## Bloqueio de ativação

A revisão automática de aprovação recusou a migração ampla de produção por reunir mudanças de situações, RLS, Storage, perfis, favoritos, denúncias, métricas, contatos e funções com privilégios elevados.

Depois de uma consulta de precondições, uma proposta restrita às situações e suas leituras públicas também foi recusada: faltava autorização explícita para disponibilizar anúncios reservados e vendidos e suas fotos ao público. A consulta encontrou três anúncios publicados, nenhum valor incompatível com a nova restrição, políticas de propriedade preservadas e bucket de fotos privado. Nenhuma das duas migrações recusadas foi aplicada.

As propostas estão em `docs/proposed`, separadas do histórico de migrações aplicadas. A próxima ação depende da aprovação específica do proprietário para o escopo e as permissões descritos aqui. Não se deve contornar o bloqueio executando o mesmo SQL por outro canal.

## Sequência após aprovação

1. Validar as propostas em um projeto de teste com o esquema atual, incluindo `verify-marketplace.sql`, sem apagar os anúncios existentes. Não há projeto de teste nem nova branch de banco provisionados nesta entrega.
2. Registrar as migrações com versões alocadas pelo Supabase, aplicar por etapas e conferir as políticas e permissões após cada etapa. Preservar PostGIS em `public` no projeto atual.
3. Publicar a função `terra-rayx`, configurar seus provedores e testar acessos anônimo, proprietário e outra conta.
4. Conferir em navegador: login/logout, CRUD e fotos, favoritos, links, WhatsApp, filtros e ordenação, alertas, comparação, importações e desenhos. No mobile, verificar teclado, rolagem, arraste da lista, lightbox e botão de contato.
5. Incorporar a proposta no GitHub e publicar a versão completa. Confirmar os mesmos fluxos no site público.

Para recuperação, a versão 12 permanece disponível. As novas tabelas e colunas são aditivas, porém a visibilidade de reservados/vendidos e perfis é uma mudança de permissão: deve ser revisada separadamente de um retorno do front-end. Não apagar dados nem tentar desfazer migrações de forma destrutiva.

## Dependências para lançamento comercial

- SMTP próprio e credenciais dos provedores de login social ainda não foram fornecidos; o código mantém os botões sociais condicionados aos provedores habilitados. Consulte `LOGIN_SOCIAL.md`.
- Photon e Open Topo Data públicos atendem uso moderado e não têm SLA para esta aplicação. Cache e limite de concorrência da função são por instância; não substituem quotas globais e controle de abuso no crescimento do serviço.
- A consulta de serviços próximos exige `OVERPASS_URL` de uma instância operada para o projeto ou de um provedor contratado. Sem essa configuração, a interface informa que a fonte não está ativa.
- Altitudes SRTM de resolução aproximada de 90 m e variações entre amostras não equivalem a levantamento topográfico. Distâncias são aproximadas e em linha reta. Documentação e infraestrutura são declarações do anunciante.
- O gerador de notificações é transacional e percorre buscas com alerta habilitado, com limite de 50 buscas por conta. Antes de grande volume, medir o custo de publicação e migrar esse processamento para uma fila.
- Métricas por sessão reduzem duplicidades, mas não equivalem a visitantes únicos nem a contatos verificados. Política de retenção dos eventos e proteção adicional contra abuso permanecem decisões de operação antes da abertura comercial.

Fontes dos serviços: [Photon](https://github.com/komoot/photon), [ViaCEP](https://viacep.com.br/), [Open Topo Data](https://www.opentopodata.org/), [SRTM](https://www.opentopodata.org/datasets/srtm/), [OpenStreetMap](https://www.openstreetmap.org/copyright).
