/* Public product identity. Keep the active origin until DNS, TLS and Auth redirects are ready. */
(()=>{
 const name='TerraMapa',tagline='Seu próximo imóvel, visto no mapa.';
 globalThis.APP_BRAND=Object.freeze({
  name,slug:'terramapa',domain:'terramapa.com.br',targetOrigin:'https://terramapa.com.br',
  origin:'https://terramapa.danielleczfranco.chatgpt.site',
  legacyOrigin:'https://terramapa.danielleczfranco.chatgpt.site',redirectLegacy:false,
  shortTagline:'imóveis no mapa',
  tagline,title:name+' — imóveis no mapa',
  description:tagline+' Explore limites, fotos e informações de imóveis em um só lugar.',
  version:'1.6.1',themeColor:'#145A46'
 });
})();
