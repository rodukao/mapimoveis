# Terra à Vista — identidade 2.1

Rebrand de TerraMapa para Terra à Vista (logo fornecida pelo usuário em 25/09/2026, revisada em 26/09/2026 removendo a palavra "Imóveis" do lockup; contorno branco do símbolo removido em 28/09/2026). Wordmark "TERRAÀVISTA!" em verde institucional #164018, com um símbolo em formato de crachá/pin no lugar do acento do "À", em âmbar sólido #F59E0B, sem contorno. Assinatura: "Seu próximo imóvel, à vista." O cabeçalho exibe apenas a marca, sem subtítulo.

## Arquivos

- `dist/logo.svg`: wordmark "TERRAÀVISTA!" com o símbolo substituindo o acento do À, extraído da arte vetorial enviada pelo usuário (viewBox recortado no bbox real do conteúdo); independente de fontes instaladas.
- `dist/brand/symbol.svg` e `dist/favicon.svg`: símbolo isolado (o crachá/pin âmbar), para uso em tamanhos pequenos ou quando o nome não couber.
- `dist/brand/logo-reversed.svg`: versão com o wordmark trocado por branco, mantendo o âmbar do símbolo, para fundo verde-escuro ou escuro.
- PNGs de 64, 180, 192 e 512 px derivados do SVG; PWA e Apple.
- `dist/brand/social.svg` e `dist/og.png`: aplicação institucional para compartilhamento (1200×630).

Preservar proporção e cores do símbolo. Não comprimir horizontalmente nem adicionar sombra. O SVG completo é apropriado para materiais comerciais.

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
