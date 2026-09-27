# Dependências de navegador

- Leaflet 1.9.4: arquivos `dist/leaflet.js` e `dist/leaflet.css` da distribuição oficial, já presentes no layout inicial.
- Supabase JavaScript SDK 2.102.0: bundle UMD oficial em `dist/supabase.js`, obtido de `https://unpkg.com/@supabase/supabase-js@2.102.0/dist/umd/supabase.js`. Licença MIT. Usado para autenticação, renovação de sessão e API de dados; não há implementação própria de armazenamento de senha.
- qrcode-generator 2.0.4 (Kazuhiko Arase): cópia de `node_modules/qrcode-generator/dist/qrcode.js` em `dist/js/vendor/qrcode.js`. Licença MIT. Carregado sob demanda (grupo `qr`) só ao gerar a placa com QR Code.

O aplicativo não busca uma versão `latest` do SDK ao carregar no navegador. Antes do lançamento, revisar as atualizações e avisos de segurança das dependências.
