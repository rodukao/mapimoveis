/* User-submitted searches only; no autocomplete or bulk requests. */
(() => {
  'use strict';
  const config = window.TERRA_CONFIG?.geocoding || {};
  const endpoint = config.photonUrl || 'https://photon.komoot.io/api/';
  const cache = new Map();
  let lastRequest = 0;
  const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const stateNames = 'Acre|Alagoas|Amapá|Amazonas|Bahia|Ceará|Distrito Federal|Espírito Santo|Goiás|Maranhão|Mato Grosso|Mato Grosso do Sul|Minas Gerais|Pará|Paraíba|Paraná|Pernambuco|Piauí|Rio de Janeiro|Rio Grande do Norte|Rio Grande do Sul|Rondônia|Roraima|Santa Catarina|São Paulo|Sergipe|Tocantins'.split('|');
  const stateCodes = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');
  function stateCode(name) { const index = stateNames.findIndex(s => normalize(s) === normalize(name)); return index >= 0 ? stateCodes[index] : stateCodes.includes(name) ? name : ''; }
  async function json(url) {
    const response = await fetch(url,{signal:AbortSignal.timeout(12000)});
    if (response.status === 429) throw new Error('Muitas buscas em pouco tempo. Aguarde um momento e tente novamente.');
    if (!response.ok) throw new Error('A busca de localização está indisponível. Tente novamente.');
    return response.json();
  }
  async function photon(query) {
    const wait = 1200 - (Date.now() - lastRequest);
    if (wait > 0) await new Promise(resolve => setTimeout(resolve,wait));
    lastRequest = Date.now();
    const url = new URL(endpoint);
    url.search = new URLSearchParams({q:query,limit:'6',countrycode:'BR'}).toString();
    const result = await json(url);
    return (result.features || []).filter(f => String(f.properties?.countrycode || '').toUpperCase() === 'BR');
  }
  function resultFromFeature(feature, postal = null, cityFallback = false) {
    const p = feature.properties || {}, coordinates = feature.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) return null;
    const [lng,lat] = coordinates.map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180) return null;
    const cityLevel = cityFallback || ['city','town','village','municipality'].includes(p.osm_value) || p.type === 'city';
    const city = postal?.localidade || p.city || (cityLevel ? p.name : '') || '';
    const state = postal?.uf || stateCode(p.state);
    const neighborhood = cityFallback ? '' : postal?.bairro || p.district || p.locality || '';
    const name = cityFallback ? city : p.name || p.street || city;
    const label = [...new Set([name,p.housenumber,city,state || p.state].filter(Boolean))].join(', ');
    // Photon extents are [west,north,east,south]. Small places get a useful nearby area.
    let bounds = null;
    const extent = p.extent;
    if (cityLevel && extent?.length === 4 && extent.every(Number.isFinite)) bounds = {west:extent[0],north:extent[1],east:extent[2],south:extent[3]};
    if (!bounds) {
      const delta = (cityLevel ? 15000 : 1500)/111320, lonDelta = delta/Math.max(.1,Math.cos(lat*Math.PI/180));
      bounds = {south:lat-delta,north:lat+delta,west:lng-lonDelta,east:lng+lonDelta};
    }
    return {lat,lng,label,city,state,neighborhood,bounds,cityLevel,cityFallback,postalCode:postal?.cep || ''};
  }
  async function search(value) {
    const input = value.trim();
    if (input.length < 3) throw new Error('Digite uma cidade, endereço ou CEP com pelo menos 3 caracteres.');
    if (input.length > 180) throw new Error('Use até 180 caracteres na busca.');
    const key = normalize(input);
    if (cache.has(key)) return cache.get(key);
    let postal = null, query = input, cityFallback = false;
    if (/^[\d\s-]+$/.test(input)) {
      const cep = input.replace(/\D/g,'');
      if (cep.length !== 8) throw new Error('O CEP deve conter 8 dígitos.');
      postal = await json(`https://viacep.com.br/ws/${cep}/json/`);
      if (postal.erro || !postal.localidade) throw new Error('CEP não encontrado. Confira os números.');
      query = [postal.logradouro,postal.bairro,postal.localidade,postal.uf].filter(Boolean).join(', ');
    }
    let features = await photon(query);
    if (postal) features = features.filter(f => normalize(f.properties?.city || f.properties?.name) === normalize(postal.localidade));
    if (postal && !features.length) {
      cityFallback = true;
      features = (await photon(`${postal.localidade}, ${postal.uf}`)).filter(f => normalize(f.properties?.city || f.properties?.name) === normalize(postal.localidade));
    }
    const results = features.map(f => resultFromFeature(f,postal,cityFallback)).filter(Boolean);
    if (cache.size >= 30) cache.delete(cache.keys().next().value);
    cache.set(key,results);
    return results;
  }
  window.TerraLocation = {search,resultFromFeature};
})();
