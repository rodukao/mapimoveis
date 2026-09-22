# TerraMapa — identidade 1.5.1

Símbolo enviado pelo usuário: parcela superior âmbar e duas parcelas inferiores verdes, separadas por limites em negativo. Convertido em caminhos SVG. Sem casa ou pin genérico. Verde institucional #145A46, âmbar #F59E0B. Assinatura: “Seu próximo imóvel, visto no mapa.” O cabeçalho exibe apenas a marca, sem subtítulo.

## Arquivos

- `dist/logo.svg`: símbolo + TerraMapa, letras convertidas em caminhos, espaçamento ajustado; independente de fontes instaladas.
- `dist/brand/symbol.svg`: símbolo isolado.
- `dist/brand/logo-reversed.svg`: versão branca para fundo verde ou escuro.
- `dist/favicon.svg`: versão com fundo e margem para tamanhos pequenos.
- PNGs de 64, 180, 192 e 512 px derivados do SVG; PWA e Apple.
- `dist/brand/social.svg` e `dist/og.png`: aplicação institucional para compartilhamento (1200×630).

Preservar proporção, cores e uma margem livre mínima de 10% da largura do símbolo. Não comprimir horizontalmente nem adicionar sombra ao símbolo. Usar símbolo isolado quando o nome não puder ser lido confortavelmente. O SVG completo é apropriado para materiais comerciais.

## Tipografia

Interface: Inter, pesos 400 (texto), 500 (rótulos), 600 (ações), 700 (destaques). Títulos: Plus Jakarta Sans 700. Logo derivado de Plus Jakarta Sans com espaçamento próprio, convertido em caminhos. Nenhuma fonte proprietária foi incorporada.

Fontes WOFF2 servidas pelo próprio site, com `font-display: swap`, fallback de sistema e preload apenas de Inter. Dois arquivos somam aproximadamente 83 KB, com caracteres latinos, português e pontuação. Inter mantém variação de peso; Jakarta inclui somente o peso usado. Licenças OFL preservadas em `dist/fonts/`. Não há chamada ao Google Fonts na navegação. CSS central: `dist/typography.css`.

### Referências e decisões

- [Inter, fonte oficial](https://rsms.me/inter/): desenho para interface, altura de x e legibilidade; adotada para textos pequenos, filtros e números.
- [Plus Jakarta Sans, autores](https://github.com/tokotype/PlusJakartaSans): formas geométricas e espaços internos abertos; adotada para títulos e marca, sem multiplicar pesos.
- [Google Design: evolução tipográfica](https://design.google/library/google-sans-flex-font): distinguir necessidades de marca e leitura em tamanhos pequenos. Usamos o princípio, não os arquivos da fonte Google.
- [Linear: revisão da interface](https://linear.app/now/how-we-redesigned-the-linear-ui): hierarquia e redução de ruído visual como referência, sem reproduzir sua identidade.
- Apple, Airbnb, Instagram, Notion e Stripe são referências de direção fornecidas pelo briefing, não alegações de uso das mesmas fontes. As páginas consultadas de Apple não disponibilizaram texto legível; Airbnb e Instagram não puderam ser recuperadas. Não se inferiram licenças de fontes dessas marcas.

## Validação

89 testes JavaScript existentes aprovados. Build de produção e verificação de diferenças sem erro. Inspeção visual do SVG e preview social; conferência de carregamento das fontes e cabeçalho em navegador real. Esta alteração não modifica banco, autenticação, permissões, catálogo ou regras de contato.
