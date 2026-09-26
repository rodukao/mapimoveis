# Terra à Vista Imóveis — identidade 2.0

Rebrand de TerraMapa para Terra à Vista Imóveis (logo fornecida pelo usuário em 25/09/2026). Símbolo: telhado/parcela superior laranja e duas parcelas inferiores verde-escuro, separadas por limites em negativo — mesma lógica de território em partes do símbolo anterior, recor­tada da arte enviada e convertida em caminhos SVG. Verde institucional #164018, laranja #D9751E, vermelho de apoio #BF300F (usado no "IMÓVEIS" do lockup e como estado ativo/selecionado da UI). Assinatura: "Seu próximo imóvel, à vista." O cabeçalho exibe apenas a marca, sem subtítulo.

## Arquivos

- `dist/logo.svg`: símbolo + wordmark "TERRAÀVISTA! IMÓVEIS", extraído da arte vetorial original enviada pelo usuário (viewBox recortado no bbox real do conteúdo); independente de fontes instaladas.
- `dist/brand/symbol.svg`: símbolo isolado.
- `dist/brand/logo-reversed.svg`: versão com o verde e o wordmark trocados por branco, mantendo laranja e vermelho, para fundo verde-escuro ou escuro.
- `dist/favicon.svg`: símbolo isolado para tamanhos pequenos.
- PNGs de 64, 180, 192 e 512 px derivados do SVG; PWA e Apple.
- `dist/brand/social.svg` e `dist/og.png`: aplicação institucional para compartilhamento (1200×630).

Preservar proporção e cores do símbolo. Não comprimir horizontalmente nem adicionar sombra ao símbolo. Usar símbolo isolado quando o nome não puder ser lido confortavelmente. O SVG completo é apropriado para materiais comerciais.

Pendência de infraestrutura (fora do escopo desta troca visual): `dist/brand.js` mantém `slug`, `domain`, `origin` e `legacyOrigin` apontando para `terramapa.*` até uma decisão sobre migrar o domínio/nome técnico para refletir "Terra à Vista" — mudar isso envolve DNS, TLS e os redirects de Auth no Supabase.

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
