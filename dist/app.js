const $ = id => document.getElementById(id);
const money = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = n => Math.round(n).toLocaleString('pt-BR');
const demoPlots = [
  { title: 'Seu lugar em São Pedro', address: 'São Pedro · Juiz de Fora, MG', price: 285000, area: 450, tag: 'Residencial', lat: -21.773, lng: -43.392 },
  { title: 'Espaço para viver com calma', address: 'Bosque do Imperador · Juiz de Fora, MG', price: 420000, area: 1200, tag: 'Condomínio', lat: -21.789, lng: -43.402 },
  { title: 'Um novo começo em Borboleta', address: 'Borboleta · Juiz de Fora, MG', price: 175000, area: 360, tag: 'Residencial', lat: -21.759, lng: -43.389 },
  { title: 'Mais verde, mais possibilidades', address: 'Nova Califórnia · Juiz de Fora, MG', price: 350000, area: 2000, tag: 'Chácara', lat: -21.794, lng: -43.417 },
  { title: 'Pronto para seus planos', address: 'Marilândia · Juiz de Fora, MG', price: 230000, area: 510, tag: 'Residencial', lat: -21.804, lng: -43.377 }
];
const DATA = window.TerraData;
const plots = DATA.configured ? [] : demoPlots;
let searchLocation = null, searchMarker = null, locationSearchSequence = 0;
let currentSession = null, mine = false, loading = false, loadFailed = false, totalListings = 0, loadSequence = 0;
let editId = null, editRevision = null, saving = false, selected = 0, drawing = false, points = [];
let drawn = null, ghost = null, markers = [], plotLayers = [], vertices = [], currentArea = 0;
let retainedPhotos = [], selectedPhotoFiles = [], photosChanged = false, previewUrls = [];

const map = L.map('map', { zoomControl: false, doubleClickZoom: false }).setView([-21.782, -43.392], 14);
L.control.zoom({ position: 'topright' }).addTo(map);
L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>', maxNativeZoom: 19, maxZoom: 20 }).addTo(map);
const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri', maxZoom: 19 });
let mapErrors = 0;
[street, satellite].forEach(layerItem => {
  layerItem.on('tileerror', () => { if (++mapErrors > 6) $('map-error').hidden = false; });
  layerItem.on('tileload', () => { $('map-error').hidden = true; mapErrors = 0; });
});

function layer(sat) {
  (sat ? street : satellite).remove();
  (sat ? satellite : street).addTo(map);
  $('street').classList.toggle('active', !sat);
  $('satellite').classList.toggle('active', sat);
}
$('street').onclick = () => layer(false);
$('satellite').onclick = () => layer(true);

function bounds(plot) {
  if (plot.points) return plot.points;
  const d = Math.sqrt(plot.area) / 111320;
  return [[plot.lat - d / 2, plot.lng - d / 2 / Math.cos(plot.lat * Math.PI / 180)], [plot.lat - d / 2, plot.lng + d / 2 / Math.cos(plot.lat * Math.PI / 180)], [plot.lat + d / 2, plot.lng + d / 2 / Math.cos(plot.lat * Math.PI / 180)], [plot.lat + d / 2, plot.lng - d / 2 / Math.cos(plot.lat * Math.PI / 180)]];
}

function visible(plot) {
  return (!$('price').value || +$('price').value === 0 || plot.price <= +$('price').value) && plot.area >= +$('area').value;
}

function render() {
  markers.forEach(marker => marker.remove());
  plotLayers.forEach(plotLayer => plotLayer.remove());
  markers = [];
  plotLayers = [];
  $('cards').replaceChildren();
  let count = 0;
  plots.forEach((plot, index) => {
    if (!visible(plot)) return;
    count++;
    const card = document.createElement('button');
    card.className = 'card' + (selected === index ? ' selected' : '');
    card.innerHTML = '<div class="card-media" hidden><img alt=""></div><div class="card-top"><span class="tag"></span><span class="arrow">↗</span></div><h2></h2><div class="address"></div><div class="card-bottom"><div><div class="amount"></div><div class="sqm"></div></div><div class="plot-area"><strong></strong><br><small>área do terreno</small></div></div>';
    const firstPhoto = plot.photos?.[0];
    if (firstPhoto?.url) {
      const media = card.querySelector('.card-media');
      media.hidden = false;
      media.querySelector('img').src = firstPhoto.url;
      media.querySelector('img').alt = `Foto de ${plot.title}`;
    }
    card.querySelector('.tag').textContent = plot.tag + (mine ? ' · ' + ({ draft: 'Rascunho', published: 'Publicado', paused: 'Pausado' }[plot.status] || '') : '');
    card.querySelector('h2').textContent = plot.title;
    card.querySelector('.address').textContent = plot.address;
    card.querySelector('.amount').textContent = money(plot.price);
    card.querySelector('.sqm').textContent = money(plot.price / plot.area) + ' / m²';
    card.querySelector('.plot-area strong').textContent = num(plot.area) + ' m²';
    card.onclick = () => select(index);
    $('cards').append(card);
    if (!drawing) {
      const polygon = L.polygon(bounds(plot), { color: index === selected ? '#186244' : '#408666', weight: 2, fillOpacity: .25 }).addTo(map).on('click', () => select(index));
      plotLayers.push(polygon);
      const marker = L.marker([plot.lat, plot.lng], { icon: L.divIcon({ className: 'price-pin' + (index === selected ? ' chosen' : ''), html: money(plot.price), iconSize: null }), keyboard: true, title: plot.title + ' — ' + money(plot.price) }).addTo(map).on('click', () => select(index));
      markers.push(marker);
    }
  });
  $('count').textContent = loading ? 'Carregando terrenos…' : loadFailed ? 'Lista indisponível' : (DATA.configured ? totalListings : count) + ' terrenos encontrados';
  if (!count) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = loading ? 'Buscando terrenos…' : loadFailed ? 'Não foi possível carregar os terrenos. Tente novamente.' : mine ? 'Você ainda não tem terrenos com esses filtros.' : 'Nenhum terreno encontrado com esses filtros.';
    $('cards').append(empty);
  }
  $('more-listings').hidden = !DATA.configured || loading || plots.length >= totalListings;
  $('retry-listings').hidden = !loadFailed;
}

function select(index) {
  selected = index;
  render();
  showDetail(plots[index]);
  map.flyTo([plots[index].lat, plots[index].lng], 17, { duration: .7 });
  document.body.classList.remove('show-list');
  $('mobile-toggle').textContent = 'Ver lista de terrenos';
}

$('price').onchange = $('area').onchange = () => DATA.configured ? loadListings() : render();
$('reset').onclick = () => { clearLocation(false); $('sort-order').value = 'recent'; $('price').value = 0; $('area').value = 0; if (DATA.configured) loadListings(); else render(); map.setView([-21.782, -43.392], 14); };

function clearLocation(reload = true) {
  searchLocation = null;
  if (searchMarker) { searchMarker.remove(); searchMarker = null; }
  $('catalog-location').hidden = true;
  $('location-query').value = '';
  $('location-panel').hidden = true;
  locationSearchSequence++;
  if (reload && DATA.configured && !drawing) loadListings();
}
$('clear-location').onclick = () => clearLocation();
$('sort-order').onchange = () => DATA.configured ? loadListings() : render();
$('close-location-results').onclick = () => { $('location-panel').hidden = true; $('location-query').focus(); };
$('location-query').addEventListener('keydown', event => { if (event.key === 'Escape') { $('location-panel').hidden = true; event.stopPropagation(); } });
function chooseLocation(place) {
  $('location-panel').hidden = true;
  $('location-query').value = place.postalCode ? place.postalCode + ' · ' + place.label : place.label;
  const b = place.bounds;
  map.fitBounds([[b.south,b.west],[b.north,b.east]], {padding:[25,25],maxZoom:place.cityLevel ? 13 : 17});
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
    searchLocation = place;
    $('catalog-location-label').textContent = place.cityLevel ? 'Cidade: ' + place.city + (place.state ? ', ' + place.state : '') : 'Área próxima: ' + place.label;
    $('catalog-location').hidden = false;
    if (DATA.configured) loadListings(); else render();
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

function measure(ps) {
  if (ps.length < 3) return 0;
  const radius = 6378137;
  let sum = 0;
  for (let i = 0; i < ps.length; i++) {
    const a = ps[i], b = ps[(i + 1) % ps.length];
    sum += (b.lng - a.lng) * Math.PI / 180 * (2 + Math.sin(a.lat * Math.PI / 180) + Math.sin(b.lat * Math.PI / 180));
  }
  return Math.abs(sum * radius * radius / 2);
}

function updateDraw() {
  if (drawn) drawn.remove();
  vertices.forEach(vertex => vertex.remove());
  vertices = [];
  if (points.length) {
    drawn = (points.length >= 3 ? L.polygon(points, { color: '#156448', weight: 3, fillOpacity: .23 }) : L.polyline(points, { color: '#156448', weight: 3 })).addTo(map);
    points.forEach((point, index) => vertices.push(L.circleMarker(point, { radius: 6, color: '#156448', weight: 3, fillColor: '#fff', fillOpacity: 1 }).addTo(map).bindTooltip('Ponto ' + (index + 1))));
  }
  currentArea = measure(points);
  $('draw-area').innerHTML = num(currentArea) + ' <small>m²</small>';
  let perimeter = 0;
  points.forEach((point, index) => { if (index > 0) perimeter += map.distance(points[index - 1], point); });
  if (points.length >= 3) perimeter += map.distance(points.at(-1), points[0]);
  $('perimeter').textContent = 'Perímetro: ' + num(perimeter) + ' m';
  updateUnit();
  if (ghost) ghost.remove();
  $('distance').hidden = true;
}

function updateUnit() { $('unit').textContent = currentArea && +$('value').value ? money(+$('value').value / currentArea) : '—'; }
$('value').oninput = updateUnit;

function clearPhotoDraft() {
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
  retainedPhotos = [];
  selectedPhotoFiles = [];
  photosChanged = false;
  if ($('photos')) $('photos').value = '';
  if ($('photo-preview')) $('photo-preview').replaceChildren();
}

function photoTile(src, alt, onRemove) {
  const tile = document.createElement('div');
  tile.className = 'photo-tile';
  const image = document.createElement('img');
  image.src = src;
  image.alt = alt;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'photo-remove';
  remove.setAttribute('aria-label', 'Remover foto');
  remove.textContent = '×';
  remove.onclick = onRemove;
  tile.append(image, remove);
  return tile;
}

function renderPhotoPreview() {
  if (!$('photo-preview')) return;
  previewUrls.forEach(url => URL.revokeObjectURL(url));
  previewUrls = [];
  $('photo-preview').replaceChildren();
  retainedPhotos.forEach((photo, index) => {
    if (!photo.url) return;
    $('photo-preview').append(photoTile(photo.url, 'Foto já salva do terreno', () => { retainedPhotos.splice(index, 1); photosChanged = true; renderPhotoPreview(); }));
  });
  selectedPhotoFiles.forEach((file, index) => {
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    $('photo-preview').append(photoTile(url, `Nova foto selecionada: ${file.name}`, () => { selectedPhotoFiles.splice(index, 1); photosChanged = true; renderPhotoPreview(); }));
  });
}

function start(record = null) {
  if (DATA.configured && !currentSession) { pendingAnnounce = true; openAuth('login'); return; }
  if (drawing && !record) return;
  if (saving) return;
  editId = record?.id || crypto.randomUUID();
  editRevision = record?.revision || null;
  points = record?.points ? record.points.map(point => L.latLng(point[0], point[1])) : [];
  fillEditor(record);
  drawing = true;
  document.body.classList.remove('show-list');
  document.body.classList.add('editing');
  $('browse').hidden = true;
  $('editor').hidden = false;
  $('map-caption').textContent = 'Toque no mapa para adicionar os vértices';
  closeDetail();
  render();
  updateDraw();
  map.getContainer().style.cursor = 'crosshair';
  setTimeout(() => map.invalidateSize(), 50);
}

function stop() {
  if (saving) return;
  drawing = false;
  editId = null;
  editRevision = null;
  points = [];
  clearPhotoDraft();
  updateDraw();
  $('browse').hidden = false;
  $('editor').hidden = true;
  document.body.classList.remove('editing');
  $('map-caption').textContent = 'Seu próximo endereço começa aqui.';
  map.getContainer().style.cursor = '';
  setTimeout(() => map.invalidateSize(), 50);
  render();
}

$('announce').onclick = () => start();
$('cancel').onclick = stop;
$('explore').onclick = () => { if (saving) return; clearLocation(false); mine = false; stop(); if (DATA.configured) loadListings(); map.setView([-21.782, -43.392], 14); };
$('undo').onclick = () => { if (!saving) { points.pop(); updateDraw(); } };
$('clear').onclick = () => { if (!saving) { points = []; updateDraw(); } };
map.on('click', event => {
  if (!drawing || saving) return;
  if (points.length >= 200) return toast('Use no máximo 200 vértices.');
  if (points.length && map.distance(points.at(-1), event.latlng) < .2) return;
  points.push(event.latlng);
  updateDraw();
});
map.on('mousemove', event => {
  if (!drawing || !points.length) return;
  if (ghost) ghost.remove();
  ghost = L.polyline([points.at(-1), event.latlng], { color: '#156448', weight: 2, dashArray: '5 6', interactive: false }).addTo(map);
  $('distance').hidden = false;
  $('distance').textContent = num(map.distance(points.at(-1), event.latlng)) + ' m até o próximo ponto';
});

function crosses(ps) {
  const orient = (a, b, c) => (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    if (j === i + 1 || i === 0 && j === ps.length - 1) continue;
    const a = ps[i], b = ps[(i + 1) % ps.length], c = ps[j], d = ps[(j + 1) % ps.length];
    if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return true;
  }
  return false;
}

function toast(message) {
  $('toast').textContent = message;
  $('toast').style.display = 'block';
  setTimeout(() => $('toast').style.display = 'none', 5000);
}

if ($('photos')) $('photos').onchange = event => {
  const incoming = Array.from(event.target.files || []);
  const room = DATA.maxPhotos - retainedPhotos.length - selectedPhotoFiles.length;
  if (room <= 0) { toast(`Um anúncio pode ter no máximo ${DATA.maxPhotos} fotos.`); event.target.value = ''; return; }
  if (incoming.length > room) toast(`Você pode adicionar mais ${room} foto${room === 1 ? '' : 's'}.`);
  selectedPhotoFiles.push(...incoming.slice(0, room));
  photosChanged = true;
  event.target.value = '';
  renderPhotoPreview();
};

$('form').onsubmit = async event => {
  event.preventDefault();
  if (saving) return;
  if (points.length < 3 || currentArea < 1) return toast('Marque pelo menos 3 pontos para formar o terreno.');
  if (crosses(points)) return toast('Os limites se cruzam. Ajuste os pontos antes de continuar.');
  if (!$('title').value.trim()) return toast('Preencha o título do anúncio.');
  if (!DATA.configured) {
    const center = L.latLngBounds(points).getCenter();
    plots.unshift({ title: $('title').value.trim(), price: +$('value').value, area: currentArea, lat: center.lat, lng: center.lng, points: points.map(point => [point.lat, point.lng]), address: 'Localização marcada no mapa', tag: 'Seu anúncio · demonstração' });
    selected = 0;
    $('price').value = 0;
    $('area').value = 0;
    stop();
    $('form').reset();
    select(0);
    toast('Terreno adicionado à demonstração desta sessão.');
    return;
  }
  const ring = points.map(point => [point.lng, point.lat]);
  ring.push([...ring[0]]);
  const form = { title: $('title').value, description: $('description').value, city: $('city').value, state: $('state').value, neighborhood: $('neighborhood').value, category: $('category').value, price_brl: $('value').value, status: $('listing-status').value, boundary_geojson: { type: 'Polygon', coordinates: [ring] } };
  const filesToUpload = selectedPhotoFiles.slice();
  const keepPhotoIds = retainedPhotos.map(photo => photo.id);
  saving = true;
  $('listing-fields').disabled = true;
  $('save-listing').textContent = filesToUpload.length ? 'Salvando fotos…' : 'Salvando…';
  $('listing-error').hidden = true;
  $('cancel').disabled = true;
  $('undo').disabled = true;
  $('clear').disabled = true;
  try {
    await DATA.save(form, { id: editId, revision: editRevision, files: filesToUpload, keepPhotoIds, photosChanged });
    saving = false;
    stop();
    $('price').value = 0;
    $('area').value = 0;
    await loadListings();
    toast(form.status === 'published' ? 'Terreno salvo e disponível no catálogo.' : 'Terreno salvo. Você pode encontrá-lo em Meus terrenos.');
  } catch (error) {
    if (error.savedListing) {
      saving = false;
      stop();
        await loadListings();
      toast(error.message);
      return;
    }
    $('listing-error').textContent = DATA.explain(error);
    $('listing-error').hidden = false;
  } finally {
    saving = false;
    $('listing-fields').disabled = false;
    $('save-listing').textContent = 'Salvar terreno';
    $('cancel').disabled = false;
    $('undo').disabled = false;
    $('clear').disabled = false;
  }
};

$('mobile-toggle').onclick = () => { const open = document.body.classList.toggle('show-list'); $('mobile-toggle').textContent = open ? 'Voltar para o mapa' : 'Ver lista de terrenos'; };
render();

const categoryNames = { residencial: 'Residencial', condominio: 'Condomínio', chacara: 'Chácara', rural: 'Rural', comercial: 'Comercial' };
function fromRow(row) {
  const photos = (row.terra_listing_photos || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(photo => ({ ...photo, url: DATA.publicPhotoUrl(photo.storage_path) }));
  return { ...row, photos, price: Number(row.price_brl), area: Number(row.area_m2), lat: row.latitude, lng: row.longitude, points: row.boundary_geojson.coordinates[0].slice(0, -1).map(point => [point[1], point[0]]), address: [row.neighborhood, row.city + ', ' + row.state].filter(Boolean).join(' · '), tag: categoryNames[row.category] };
}

function fillEditor(plot) {
  $('form').reset();
  $('listing-error').hidden = true;
  retainedPhotos = (plot?.photos || []).map(photo => ({ ...photo }));
  selectedPhotoFiles = [];
  photosChanged = false;
  $('title').value = plot?.title || '';
  $('value').value = plot?.price || '';
  $('description').value = plot?.description || '';
  $('city').value = plot?.city || 'Juiz de Fora';
  $('state').value = plot?.state || 'MG';
  $('neighborhood').value = plot?.neighborhood || '';
  $('category').value = plot?.category || 'residencial';
  $('listing-status').value = plot?.status || 'draft';
  if (DATA.configured) $('save-listing').textContent = plot ? 'Salvar alterações' : 'Salvar terreno';
  renderPhotoPreview();
}

let detailPhotos = [], detailPhotoIndex = 0, detailPlot = null;
function closeDetail() {
  if ($('photo-lightbox').open) $('photo-lightbox').close();
  if ($('listing-detail').open) $('listing-detail').close();
}
function showDetail(plot) {
  if (!plot || drawing) return closeDetail();
  detailPlot = plot;
  $('detail-title').textContent = plot.title;
  $('detail-category').textContent = plot.tag;
  $('detail-address').textContent = plot.address;
  $('detail-price').textContent = money(plot.price);
  $('detail-unit').textContent = money(plot.price / plot.area) + ' / m²';
  $('detail-description').textContent = plot.description || 'O anunciante ainda não incluiu uma descrição.';
  $('owner-actions').hidden = !currentSession || currentSession.user.id !== plot.owner_id;
  const facts = [['Área estimada', num(plot.area) + ' m²']];
  if (Number.isFinite(Number(plot.perimeter_m))) facts.push(['Perímetro', num(Number(plot.perimeter_m)) + ' m']);
  if (plot.status) facts.push(['Situação', {draft:'Rascunho',published:'Publicado',paused:'Pausado'}[plot.status] || plot.status]);
  if (Number.isFinite(plot.lat) && Number.isFinite(plot.lng)) facts.push(['Coordenadas', plot.lat.toFixed(6) + ', ' + plot.lng.toFixed(6)]);
  for (const [key, label] of [['created_at','Cadastrado em'],['updated_at','Atualizado em']]) {
    if (plot[key] && Number.isFinite(Date.parse(plot[key]))) facts.push([label,new Date(plot[key]).toLocaleDateString('pt-BR')]);
  }
  $('detail-facts').replaceChildren();
  for (const [label,value] of facts) {
    const item = document.createElement('div'), term = document.createElement('dt'), definition = document.createElement('dd');
    term.textContent = label; definition.textContent = value; item.append(term,definition); $('detail-facts').append(item);
  }
  detailPhotos = (plot.photos || []).filter(photo => photo.url);
  detailPhotoIndex = 0;
  $('detail-gallery').hidden = !detailPhotos.length;
  $('no-photos').hidden = Boolean(detailPhotos.length);
  $('photo-thumbnails').replaceChildren();
  detailPhotos.forEach((photo,index) => {
    const button = document.createElement('button'), img = document.createElement('img');
    button.type = 'button'; button.setAttribute('aria-label', 'Ver foto ' + (index + 1));
    img.src = photo.url; img.alt = ''; img.loading = 'lazy'; button.append(img);
    button.onclick = () => displayPhoto(index); $('photo-thumbnails').append(button);
  });
  if (detailPhotos.length) displayPhoto(0);
  if (!$('listing-detail').open) $('listing-detail').showModal();
  $('listing-detail').scrollTop = 0;
}
function resetPhotoZoom() {
  $('lightbox-viewport').classList.remove('zoomed');
  $('lightbox-viewport').scrollTo(0,0);
  $('photo-zoom').textContent = 'Ampliar 2×';
  $('photo-zoom').setAttribute('aria-pressed','false');
}
function displayPhoto(index) {
  if (!detailPhotos.length) return;
  detailPhotoIndex = (index + detailPhotos.length) % detailPhotos.length;
  const photo = detailPhotos[detailPhotoIndex];
  const caption = `Foto ${detailPhotoIndex + 1} de ${detailPhotos.length}`;
  $('photo-error').hidden = true; $('lightbox-error').hidden = true;
  for (const id of ['detail-photo','lightbox-photo']) {
    $(id).src = photo.url;
    $(id).alt = photo.alt_text || `${detailPlot.title} — ${caption}`;
  }
  $('photo-counter').textContent = caption; $('lightbox-counter').textContent = caption;
  for (const id of ['photo-prev','photo-next','lightbox-prev','lightbox-next']) $(id).hidden = detailPhotos.length < 2;
  [...$('photo-thumbnails').children].forEach((button,i) => button.setAttribute('aria-current',String(i === detailPhotoIndex)));
  resetPhotoZoom();
}
$('close-detail').onclick = closeDetail;
$('detail-map').onclick = closeDetail;
$('close-lightbox').onclick = () => $('photo-lightbox').close();
$('expand-photo').onclick = () => { if (detailPhotos.length) { resetPhotoZoom(); $('photo-lightbox').showModal(); } };
$('photo-zoom').onclick = () => {
  const zoomed = $('lightbox-viewport').classList.toggle('zoomed');
  $('photo-zoom').setAttribute('aria-pressed',String(zoomed));
  $('photo-zoom').textContent = zoomed ? 'Ajustar à tela' : 'Ampliar 2×';
};
$('detail-photo').onerror = () => { $('photo-error').hidden = false; };
$('lightbox-photo').onerror = () => { $('lightbox-error').hidden = false; };
for (const id of ['photo-prev','lightbox-prev']) $(id).onclick = () => displayPhoto(detailPhotoIndex - 1);
for (const id of ['photo-next','lightbox-next']) $(id).onclick = () => displayPhoto(detailPhotoIndex + 1);
for (const id of ['listing-detail','photo-lightbox']) {
  $(id).addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault(); event.stopPropagation(); displayPhoto(detailPhotoIndex + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  $(id).addEventListener('click', event => {
    if (event.target !== $(id)) return;
    const rect = $(id).getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) $(id).close();
  });
}
for (const element of [$('expand-photo'),$('lightbox-viewport')]) {
  let start = null;
  element.addEventListener('touchstart', event => { start = event.touches.length === 1 ? {x:event.touches[0].clientX,y:event.touches[0].clientY} : null; },{passive:true});
  element.addEventListener('touchend', event => {
    if (!start || element.classList.contains('zoomed')) return;
    const dx = event.changedTouches[0].clientX-start.x, dy = event.changedTouches[0].clientY-start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)*1.5) displayPhoto(detailPhotoIndex + (dx < 0 ? 1 : -1));
    start = null;
  },{passive:true});
}

async function loadListings(append = false) {
  if (!DATA.configured) return;
  const sequence = ++loadSequence;
  loading = true;
  loadFailed = false;
  if (!append) { plots.splice(0); totalListings = 0; closeDetail(); }
  render();
  $('all-listings').classList.toggle('active', !mine);
  $('my-listings').classList.toggle('active', mine);
  $('list-meta').textContent = mine ? 'Seus anúncios' : 'Anúncios publicados';
  try {
    const result = await DATA.list({ mine, offset: append ? plots.length : 0, price: +$('price').value, area: +$('area').value, sort:$('sort-order').value, location:searchLocation });
    if (sequence !== loadSequence) return;
    plots.push(...result.rows.map(fromRow));
    totalListings = result.total ?? plots.length;
  } catch (error) {
    if (sequence !== loadSequence) return;
    loadFailed = true;
    toast(DATA.explain(error));
  } finally {
    if (sequence === loadSequence) { loading = false; render(); }
  }
}

$('all-listings').onclick = () => { if (!saving) { mine = false; stop(); loadListings(); } };
$('my-listings').onclick = () => { if (!saving) { mine = true; stop(); loadListings(); } };
$('more-listings').onclick = () => loadListings(true);
$('retry-listings').onclick = () => loadListings();
$('edit-listing').onclick = () => { const plot = plots[selected]; if (plot?.owner_id === currentSession?.user.id) { start(plot); map.fitBounds(plot.points, { padding: [35, 35], maxZoom: 19 }); } };
let deleteTarget = null;
$('delete-listing').onclick = () => { const plot = plots[selected]; if (plot?.owner_id !== currentSession?.user.id) return; deleteTarget = { id: plot.id, revision: plot.revision }; $('delete-error').hidden = true; $('delete-dialog').showModal(); };
$('cancel-delete').onclick = () => $('delete-dialog').close();
$('confirm-delete').onclick = async () => {
  if (!deleteTarget) return;
  $('confirm-delete').disabled = true;
  $('cancel-delete').disabled = true;
  try { await DATA.remove(deleteTarget.id, deleteTarget.revision); $('delete-dialog').close(); deleteTarget = null; await loadListings(); toast('Terreno excluído.'); }
  catch (error) { $('delete-error').textContent = DATA.explain(error); $('delete-error').hidden = false; }
  finally { $('confirm-delete').disabled = false; $('cancel-delete').disabled = false; }
};

let authMode = 'login', authBusy = false, pendingAnnounce = false, recoverySession = false;
let socialProviders = [];
const socialNames = {google:'Google',azure:'Microsoft',github:'GitHub',apple:'Apple',facebook:'Facebook'};
function setPasswordVisible(visible) {
  $('auth-password').type = visible ? 'text' : 'password';
  $('toggle-password').textContent = visible ? 'Ocultar' : 'Mostrar';
  $('toggle-password').setAttribute('aria-pressed',String(visible));
  $('toggle-password').setAttribute('aria-label',visible ? 'Ocultar senha' : 'Mostrar senha');
}
$('toggle-password').onclick = () => setPasswordVisible($('auth-password').type === 'password');
$('auth-dialog').addEventListener('close', () => { setPasswordVisible(false); $('auth-password').value = ''; });
function updateSocialButtons() {
  $('social-auth').hidden = !socialProviders.length || !['login','signup'].includes(authMode);
  $('social-buttons').replaceChildren();
  for (const provider of socialProviders) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'full social-button';
    button.textContent = 'Continuar com ' + socialNames[provider];
    button.disabled = authBusy;
    button.onclick = async () => {
      if (authBusy) return;
      authBusy = true; $('auth-fields').disabled = true;
      $('switch-auth').disabled = true; $('forgot-password').disabled = true;
      $('auth-message').hidden = true; updateSocialButtons();
      try { await DATA.loginWithProvider(provider); }
      catch (error) {
        $('auth-message').textContent = DATA.explain(error); $('auth-message').hidden = false;
        authBusy = false; $('auth-fields').disabled = false;
        $('switch-auth').disabled = false; $('forgot-password').disabled = false; updateSocialButtons();
      }
    };
    $('social-buttons').append(button);
  }
}
async function loadSocialProviders() {
  try { socialProviders = await DATA.availableProviders(); }
  catch (_) { socialProviders = []; }
  updateSocialButtons();
}
function authModeUI(mode) {
  authMode = mode;
  $('auth-message').hidden = true;
  $('auth-password').value = '';
  setPasswordVisible(false);
  updateSocialButtons();
  const signup = mode === 'signup', reset = mode === 'reset', change = mode === 'change';
  $('auth-heading').textContent = ({ login: 'Entre para anunciar', signup: 'Crie sua conta', reset: 'Recupere sua senha', change: 'Escolha uma nova senha' })[mode];
  $('name-label').hidden = !signup;
  $('auth-name').required = signup;
  $('email-label').hidden = change;
  $('auth-email').required = !change;
  $('password-label').hidden = reset;
  $('auth-password').required = !reset;
  $('auth-password').minLength = signup || change ? 12 : 1;
  $('auth-password').autocomplete = signup || change ? 'new-password' : 'current-password';
  $('password-hint').hidden = !(signup || change);
  $('auth-submit').textContent = ({ login: 'Entrar', signup: 'Criar conta', reset: 'Enviar link de recuperação', change: 'Salvar nova senha' })[mode];
  $('forgot-password').hidden = mode !== 'login';
  $('switch-auth').hidden = change;
  $('switch-auth').textContent = mode === 'login' ? 'Ainda não tem conta? Cadastre-se' : 'Já tem conta? Entrar';
  requestAnimationFrame(() => window.TerraCaptcha.show(mode));
}
function openAuth(mode = 'login') {
  if (authBusy) return;
  if (!DATA.configured) { toast('O cadastro está em preparação. A demonstração do mapa continua disponível.'); return; }
  $('signed-in').hidden = !currentSession || mode === 'change';
  $('auth-form').hidden = !!currentSession && mode !== 'change';
  authModeUI(mode);
  if (currentSession && mode !== 'change') { $('auth-heading').textContent = 'Sua conta'; $('account-email').textContent = currentSession.user.email || ''; }
  if (!$('auth-dialog').open) $('auth-dialog').showModal();
  if (!currentSession && ['login','signup'].includes(mode)) loadSocialProviders();
}
$('account').onclick = () => openAuth();
$('close-auth').onclick = () => { if (!authBusy) { $('auth-dialog').close(); window.TerraCaptcha.close(); pendingAnnounce = false; $('auth-password').value = ''; } };
$('auth-dialog').addEventListener('cancel', event => { if (authBusy) event.preventDefault(); else { window.TerraCaptcha.close(); pendingAnnounce = false; $('auth-password').value = ''; } });
$('switch-auth').onclick = () => authModeUI(authMode === 'login' ? 'signup' : 'login');
$('forgot-password').onclick = () => authModeUI('reset');
$('auth-form').onsubmit = async event => {
  event.preventDefault();
  if (authBusy) return;
  const mode = authMode, email = $('auth-email').value.trim(), password = $('auth-password').value, name = $('auth-name').value.trim();
  if (mode === 'signup' && !name) { $('auth-message').textContent = 'Informe seu nome.'; $('auth-message').hidden = false; return; }
  if (mode === 'change' && !recoverySession) { $('auth-message').textContent = 'Solicite um novo link de recuperação para alterar a senha.'; $('auth-message').hidden = false; return; }
  let captchaToken;
  try { captchaToken = window.TerraCaptcha.value(mode); }
  catch (error) { $('auth-message').textContent = error.message; $('auth-message').hidden = false; return; }
  authBusy = true;
  updateSocialButtons();
  $('auth-fields').disabled = true;
  $('auth-message').hidden = true;
  $('switch-auth').disabled = true;
  $('forgot-password').disabled = true;
  try {
    if (mode === 'login') { const result = await DATA.login(email, password, captchaToken); currentSession = result.session; mine = false; $('auth-dialog').close(); updateAccount(); if (pendingAnnounce) { pendingAnnounce = false; start(); } await loadListings(); }
    if (mode === 'signup') { const result = await DATA.signUp(name, email, password, captchaToken); $('auth-password').value = ''; if (result.session) { currentSession = result.session; mine = false; $('auth-dialog').close(); updateAccount(); if (pendingAnnounce) { pendingAnnounce = false; start(); } await loadListings(); toast('Conta criada. Você já pode cadastrar seu terreno.'); } else { $('auth-message').textContent = 'Confira seu e-mail para confirmar o cadastro. Se já tiver uma conta, você pode entrar ou recuperar sua senha.'; $('auth-message').hidden = false; } }
    if (mode === 'reset') { await DATA.reset(email, captchaToken); $('auth-message').textContent = 'Se houver uma conta para esse e-mail, você receberá um link de recuperação.'; $('auth-message').hidden = false; }
    if (mode === 'change') { await DATA.changePassword(password); recoverySession = false; history.replaceState(null, '', location.pathname); $('auth-dialog').close(); toast('Senha atualizada.'); }
  } catch (error) { $('auth-message').textContent = DATA.explain(error); $('auth-message').hidden = false; }
  finally { authBusy = false; updateSocialButtons(); if (mode !== 'change') window.TerraCaptcha.reset(); $('auth-fields').disabled = false; $('switch-auth').disabled = false; $('forgot-password').disabled = false; if (mode === 'login' || mode === 'change') $('auth-password').value = ''; }
};
$('signout').onclick = async () => { if (saving) return; $('signout').disabled = true; try { await DATA.logout(); currentSession = null; mine = false; stop(); $('auth-dialog').close(); updateAccount(); await loadListings(); toast('Você saiu da sua conta.'); } catch (error) { toast(DATA.explain(error)); } finally { $('signout').disabled = false; } };
$('account-listings').onclick = () => { if (saving) return; $('auth-dialog').close(); mine = true; stop(); loadListings(); if (matchMedia('(max-width:720px)').matches) { document.body.classList.add('show-list'); $('mobile-toggle').textContent = 'Voltar para o mapa'; } };
function updateAccount() { $('account').textContent = currentSession ? 'Minha conta' : 'Entrar'; $('listing-tabs').hidden = false; $('my-listings').hidden = !currentSession; }

async function initializeData() {
  if (!DATA.configured) return;
  $('demo-badge').hidden = true;
  $('persisted-fields').hidden = false;
  $('city').required = true;
  $('title').minLength = 3;
  $('save-listing').textContent = 'Salvar terreno';
  $('save-note').textContent = 'Rascunhos e anúncios pausados ficam visíveis somente para você.';
  const initialHash = new URLSearchParams(location.hash.slice(1));
  if (initialHash.has('error')) { toast('Este link não está mais disponível. Solicite um novo e-mail.'); history.replaceState(null, '', location.pathname); }
  try {
    DATA.subscribe((event, session) => {
      // Keep Supabase callbacks synchronous; perform SDK calls outside the auth lock.
      setTimeout(() => { const changed = currentSession?.user.id !== session?.user.id; currentSession = session; if (event === 'PASSWORD_RECOVERY') { recoverySession = true; openAuth('change'); } if (changed) mine = false; if (!session) { mine = false; if (drawing && !saving) stop(); } updateAccount(); if (changed) loadListings(); }, 0);
    });
    currentSession = await DATA.session();
    updateAccount();
    await loadListings();
  } catch (error) { toast(DATA.explain(error)); loadFailed = true; render(); }
}

$('state').replaceChildren(...'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ').map(state => new Option(state, state, state === 'MG', state === 'MG')));
initializeData();
