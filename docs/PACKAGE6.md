# Pacote 6 — acabamento, imagens, SEO e Raio-X

## Fotos

O editor processa uma foto por vez antes de permitir salvar. Aceita originais JPEG, PNG e WebP de até 30 MB, limita o lado maior a 2048 px, reencoda em JPEG com qualidade 84% (72% se ultrapassar 2 MB) e rejeita saída acima de 5 MB. O canvas produz novos pixels sem transportar EXIF/GPS; mantém a orientação interpretada pelo navegador. Avatares usam até 640 px. Imagens existentes não foram reprocessadas ou substituídas.

Cada foto tem controles de mover para a esquerda/direita e “Definir como capa”. A ordem pode intercalar fotos novas e existentes. A primeira posição é a capa; toda a alteração é gravada atomicamente e a função existente continua disponível para clientes antigos.

Falhas no carregamento das fotos tentam renovar a URL assinada uma vez por imagem exibida. A segunda falha mostra indisponibilidade, sem loop. Pedidos simultâneos de renovação do mesmo objeto são agrupados. A falha do serviço de fotos não remove o anúncio do catálogo.

## Limpeza de órfãos

A função `terra-storage-cleanup` está implantada, mas **o agendamento ainda precisa ser configurado**. Abrange `terra-listing-photos` e `terra-profile-photos`; preserva o bucket legado arquivado. Seleciona no máximo 100 objetos por execução, sem registro de foto/avatar correspondente, cuja criação e última atualização são anteriores a 48 horas.

Antes de remover, marca os objetos em uma fila privada. Um objeto selecionado não pode receber novas referências ou ser sobrescrito durante a limpeza. Exclusões usam a API de Storage, nunca remoção direta de linhas do catálogo de objetos. Falhas podem ser retomadas na execução seguinte. O teste no banco encontrou **zero candidatos**; nenhum arquivo real foi excluído.

Para ativar: configure um agendador server-side de confiança para enviar um POST diário a `https://pkofzhlcbqupanzydyyf.supabase.co/functions/v1/terra-storage-cleanup`. Use header `apikey` com a chave secreta padrão do projeto usada pelo runtime da função; armazene-a no cofre do agendador. Não colocar essa chave no GitHub, frontend ou query string. O corpo inicial é `{"dryRun":true}`. Depois de conferir o resultado, use `{"dryRun":false}`. Acompanhe respostas não-200 e repita em caso de `pending`. Se houver mais de 100 candidatos, as próximas execuções processam o restante.

É possível usar Supabase Cron com Vault e pg_net seguindo a [documentação oficial](https://supabase.com/docs/guides/functions/schedule-functions). Não foi ativada uma extensão nem cadastrado um segredo de agendamento neste pacote. A fila privada e a rotina existem independentemente do agendador.

## SEO e compartilhamento

A hospedagem passa a responder por um Worker pequeno, preservando o frontend e a autenticação Supabase existentes. Isso é necessário para decidir os metadados antes de executar JavaScript.

Home e links de anúncios públicos recebem imagem institucional, canonical, Open Graph e Twitter Card. Antes de incluir um preview de anúncio, o servidor consulta apenas `id` usando chave publicável, RLS e filtro explícito `published/reserved/sold`. Não encaminha cookies ou tokens do visitante. Rascunhos, pausados, inexistentes, links de recuperação e falhas nessa consulta recebem `noindex` e nenhum metadado social. O aplicativo continua podendo abrir os anúncios privados para seus proprietários autenticados.

`robots.txt` e `sitemap.xml` são respostas do servidor. O sitemap inicial inclui home, privacidade e termos; não enumera anúncios nesta etapa. Não depende de uma lista de anúncios exportada que poderia ficar desatualizada. Previews por terreno e expansão do sitemap ficam para uma etapa futura. Plataformas de compartilhamento podem manter previews públicos antigos em cache depois de uma mudança de status; a resposta atual não consegue revogar cópias externas já armazenadas.

Favicon PNG, apple-touch-icon, ícones de 192/512 px e manifest estão incluídos. O manifest não adiciona cache offline de contas/anúncios.

## Versão e publicação

`/version.json` retorna versão `1.0.6` e o SHA completo do código utilizado no build. O Worker também serve JS e CSS com `?v=1.0.6` no HTML. HTML e metadados dinâmicos usam `no-store`; assets versionados usam cache longo. Em próximas alterações de assets, incrementar a versão em `scripts/build-site.cjs` e no identificador visível antes de publicar.

O código editável do frontend permanece em `dist/`. O código HTTP está em `server/site-worker.mjs`; `node scripts/build-site.cjs` produz `dist/server/index.js`, ignorado pelo Git. Construir a partir do commit definitivo antes de empacotar. Não publicar apenas a pasta `dist` como site estático: isso perderia a verificação de previews privados e a versão dinâmica.

## Raio-X

Preserva referência central da cidade, altitude e inclinação estimada. O cache no servidor e navegador usa `listing_id + revision`, com validade de seis horas para resultados completos e um minuto para resultados incompletos. O servidor revalida a visibilidade pública antes de servir seu cache. Uma revisão nova não reutiliza a análise anterior. Falhas exibem “Informação temporariamente indisponível” sem impedir a consulta do anúncio.

Hospitais, supermercados, escolas e vias estão implementados para uma API compatível com Overpass. Falta disponibilizar a instância própria ou contratada. Em Supabase → Edge Functions → Secrets, configurar `OVERPASS_URL` com endpoint HTTPS contratado. Se houver autenticação Bearer, configurar `OVERPASS_API_KEY`; a chave só é enviada ao provedor no servidor. Não usar uma instância comunitária gratuita como backend comercial sem permissão.

Consulta em raio de até 5 km para serviços e vias principais, e até 300 m para via próxima. São distâncias em linha reta, não trajetos. A ausência de um ponto nos dados não prova inexistência no local. Resultados excessivos/incompletos são tratados como indisponíveis. Nenhum Terra Score foi criado e preço anunciado não é chamado de valor de mercado.

## Validação

Testes JavaScript cobrem processamento por pixels com canvas simulado, renovação sem loop, previews privados e públicos, cache por revisão e limpeza autenticada. `tests/verify-package6.sql` comprova ordem/capa, rollback de ordem inválida, isolamento da limpeza e preservação de objetos recentes/referenciados com fixtures revertidas. Os testes não equivalem a conferir fotos reais em todos os navegadores ou previews efetivos em WhatsApp/Facebook. O provedor contratado e o agendador continuam pendentes de configuração externa.

Resultado desta entrega: 77 testes JavaScript passaram, assim como os quatro roteiros SQL (marketplace e pacotes 3, 5 e 6). As nove rotas principais e suas dependências versionadas responderam corretamente no Worker construído localmente. A função de limpeza implantada rejeitou uma chamada real com chave pública (401). A inspeção dos arquivos no banco não encontrou órfãos elegíveis.
