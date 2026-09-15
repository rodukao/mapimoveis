/* Public product identity. Keep the active origin until DNS, TLS and Auth redirects are ready. */
(()=>{
 const name='TerraMapa',tagline='Terrenos de verdade, vistos no mapa.';
 globalThis.APP_BRAND=Object.freeze({
  name,slug:'terramapa',domain:'terramapa.com.br',targetOrigin:'https://terramapa.com.br',
  origin:'https://terramapa.danielleczfranco.chatgpt.site',
  legacyOrigin:'https://terramapa.danielleczfranco.chatgpt.site',redirectLegacy:false,
  shortTagline:'terrenos no mapa',
  tagline,title:name+' — terrenos no mapa',
  description:tagline+' Explore limites, fotos e informações de terrenos em um só lugar.',
  version:'1.1.2',themeColor:'#145A46'
 });
})();
