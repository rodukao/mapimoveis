/* Public product identity. Keep the active origin until DNS, TLS and Auth redirects are ready.
   Domain rollout: switch origin to targetOrigin, then set redirectLegacy:true (legacyOrigin is the
   workers.dev address served by this same Worker). See docs/DOMAIN-ROLLOUT.md. */
(()=>{
 const name='Terra à Vista',tagline='Seu próximo imóvel, à vista.';
 globalThis.APP_BRAND=Object.freeze({
  name,slug:'terramapa',domain:'terraavistaimoveis.com.br',targetOrigin:'https://terraavistaimoveis.com.br',
  origin:'https://terraavistaimoveis.com.br',
  legacyOrigin:'https://terramapa.rodukao.workers.dev',redirectLegacy:true,
  shortTagline:'imóveis à vista',
  tagline,title:name+' — imóveis à vista',
  description:tagline+' Explore limites, fotos e informações de imóveis em um só lugar.',
  version:'1.8.0',themeColor:'#164018'
 });
})();
