# Auditoria Lighthouse pendente

Este ambiente oferece navegador controlado por uma API sem Lighthouse/CDP livre. Não foi possível produzir relatórios Lighthouse antes/depois. Não há pontuações estimadas. O build baseline é o commit `c2896616611ad99bdc11fbbd01f00e7bf83d090b` (1.2.0); a versão candidata é 1.3.0.

## Como executar

1. Publique cada build em staging, com o mesmo conjunto de anúncios e configurações. Não reverta a produção para medir.
2. Em Chrome, abra DevTools → Lighthouse. Use Navigation, selecione Performance, Accessibility, Best Practices e SEO; execute Mobile e depois Desktop, sem extensões e sem sessão autenticada.
3. Faça três execuções por combinação versão/dispositivo. Exporte os relatórios JSON e HTML. Registre a mediana, versão do Chrome/Lighthouse, URL, data e condições da execução.
4. Compare Performance (mobile ≥85; desktop ≥90), Accessibility/Best Practices/SEO (≥95), LCP (<2,5s) e CLS (<0,1). Teste catálogo e `/profissionais`; fotos e mapa externo variam com rede/cache.
5. INP (<200ms) exige interações e medição específica/telemetria de campo. Não preencha INP com TBT ou com estimativa derivada do tamanho do JavaScript. Verifique também teclado virtual e dispositivos reais.

## Baseline mensurável aqui

`baseline-assets.json` e `current-assets.json` contêm bytes de JavaScript e compressão gzip local. Não representam transferência real de uma visita, pontuação Lighthouse, LCP, CLS ou INP. O segundo arquivo é atualizado por `npm run build`.

O build mantém JavaScript clássico, sem framework, com bundles `core`, `account`, `editor`, `admin`, `feedback`, `operations`, `geometry` e `photos`. Não foi adicionada dependência de empacotador: concatenação ordenada preserva os vínculos globais existentes. Supabase e Leaflet permanecem separados e já distribuídos minificados.

## Auditoria de consultas

- Catálogo: uma RPC de busca por página e uma assinatura de URLs em lote (`hydratePhotos` / `createSignedUrls`). Nenhuma busca de perfil ou estatística por card.
- Favoritos: uma leitura por conta, mantida em `Set`; renderização consulta esse conjunto localmente.
- Dashboard: uma RPC agregada para métricas e top 5, sem RPC por anúncio.
- Detalhe: perfil, semelhantes e métricas do proprietário são carregados apenas ao abrir o anúncio.
- Hover: modifica estilos das camadas/cards envolvidos; não chama `render` ou `loadListings`. Coberto por testes de interação do catálogo.
- Removida a varredura de todos os corações a cada criação de card; estado inicial agora é aplicado somente ao botão do card.

A revisão acima é de código e testes. Não foi capturado HAR completo neste ambiente.
