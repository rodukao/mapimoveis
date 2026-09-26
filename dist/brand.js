/* Public product identity. Keep the active origin until DNS, TLS and Auth redirects are ready. */
(()=>{
 const name='Terra à Vista Imóveis',tagline='Seu próximo imóvel, à vista.';
 globalThis.APP_BRAND=Object.freeze({
  name,slug:'terramapa',domain:'terramapa.com.br',targetOrigin:'https://terramapa.com.br',
  origin:'https://terramapa.danielleczfranco.chatgpt.site',
  legacyOrigin:'https://terramapa.danielleczfranco.chatgpt.site',redirectLegacy:false,
  shortTagline:'imóveis à vista',
  tagline,title:name+' — imóveis à vista',
  description:tagline+' Explore limites, fotos e informações de imóveis em um só lugar.',
  version:'1.6.1',themeColor:'#164018'
 });
})();
