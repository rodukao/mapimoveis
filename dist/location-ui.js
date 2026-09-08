function clearLocation(reload = true) {
  searchLocation = null;
  window.TerraFilters?.clearSpatial();
  if (searchMarker) { searchMarker.remove(); searchMarker = null; }
  $('catalog-location').hidden = true;
  $('location-query').value = '';
  $('location-panel').hidden = true;
  locationSearchSequence++;
  if (reload && !drawing) loadListings();
}
$('clear-location').onclick = () => clearLocation();
$('sort-order').onchange = () => loadListings();
$('close-location-results').onclick = () => { $('location-panel').hidden = true; $('location-query').focus(); };
$('location-query').addEventListener('keydown', event => { if (event.key === 'Escape') { $('location-panel').hidden = true; event.stopPropagation(); } });
function chooseLocation(place) {
  $('location-panel').hidden = true;
  $('location-query').value = place.postalCode ? place.postalCode + ' · ' + place.label : place.label;
  const b = place.bounds;
  moveMapProgrammatically('fitBounds',[[b.south,b.west],[b.north,b.east]], {padding:[25,25],maxZoom:place.cityLevel ? 13 : 17});
  if (searchMarker) searchMarker.remove();
  const label = document.createElement('span'); label.textContent = place.label;
  searchMarker = L.circleMarker([place.lat,place.lng],{radius:8,color:'#245da0',fillColor:'#fff',fillOpacity:1,weight:3}).addTo(map).bindTooltip(label);
  if (drawing) {
    if (!editRevision && !points.length) {
      if (place.city) $('city').value = place.city;
      if (place.state) $('state').value = place.state;
      $('neighborhood').value = place.neighborhood || '';
    }
    toast(place.cityFallback ? 'CEP localizado apenas pela cidade. Ajuste o mapa até o terreno.' : points.length ? 'Mapa posicionado. O desenho foi mantido.' : 'Confira a posição e marque os limites do terreno.');
  } else {
    TerraFilters.setLocation(place);
    searchLocation = place;
    $('catalog-location-label').textContent = place.cityLevel ? 'Cidade: ' + place.city + (place.state ? ', ' + place.state : '') : 'Área próxima: ' + place.label;
    $('catalog-location').hidden = true;
    loadListings();
    if (place.cityFallback) toast('Não encontramos a rua no mapa. Mostrando os terrenos da cidade do CEP.');
  }
}
$('location-form').onsubmit = async event => {
  event.preventDefault();
  if ($('location-submit').disabled || saving) return;
  const sequence = ++locationSearchSequence;
  $('location-submit').disabled = true; $('location-submit').textContent = 'Buscando…';
  $('location-panel').hidden = false; $('location-results').replaceChildren(); $('location-message').textContent = 'Buscando localização…';
  try {
    const places = await window.TerraLocation.search($('location-query').value);
    if (sequence !== locationSearchSequence) return;
    $('location-message').textContent = places.length ? 'Escolha a localização:' : 'Nenhuma localização encontrada. Tente informar rua, cidade e estado.';
    places.forEach(place => {
      const button = document.createElement('button'), title = document.createElement('strong'), hint = document.createElement('span');
      button.type = 'button'; title.textContent = place.label;
      hint.textContent = place.cityFallback ? 'CEP encontrado · posição aproximada da cidade' : place.cityLevel ? 'Cidade' : 'Endereço ou local · posição aproximada';
      button.append(title,hint); button.onclick = () => chooseLocation(place); $('location-results').append(button);
    });
  } catch (error) {
    if (sequence !== locationSearchSequence) return;
    $('location-message').textContent = ['TypeError','TimeoutError','AbortError'].includes(error.name) ? 'Não foi possível consultar a localização. Confira a conexão e tente novamente.' : error.message;
  } finally { $('location-submit').disabled = false; $('location-submit').textContent = 'Buscar'; }
};
