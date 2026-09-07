const $ = id => document.getElementById(id);
const money = n => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = n => Math.round(n).toLocaleString('pt-BR');
const DATA = window.TerraData;
const plots = [];
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

function bounds(plot) { return plot.points; }

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
  $('count').textContent = loading ? 'Carregando terrenos…' : loadFailed ? 'Lista indisponível' : totalListings + ' terrenos encontrados';
  if (!count) {
    const empty = document.createElement('p');
    empty.className = 'empty-message';
    empty.textContent = loading ? 'Buscando terrenos…' : loadFailed ? 'Não foi possível carregar os terrenos. Tente novamente.' : mine ? 'Você ainda não tem terrenos com esses filtros.' : 'Nenhum terreno encontrado com esses filtros.';
    $('cards').append(empty);
  }
  $('more-listings').hidden = loading || plots.length >= totalListings;
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

$('price').onchange = $('area').onchange = () => loadListings();
$('reset').onclick = () => { clearLocation(false); $('sort-order').value = 'recent'; $('price').value = 0; $('area').value = 0; loadListings(); map.setView([-21.782, -43.392], 14); };

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
  if (!currentSession) { pendingAnnounce = true; openAuth('login'); return; }
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
$('explore').onclick = () => { if (saving) return; clearLocation(false); mine = false; stop(); loadListings(); map.setView([-21.782, -43.392], 14); };
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

const categoryNames = { residencial: 'Residencial', condominio: 'Condomínio', chacara: 'Chácara', rural: 'Rural', comercial: 'Comercial' };
function fromRow(row) {
  const photos = (row.terra_listing_photos || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map(photo => ({ ...photo, url: photo.url || '' }));
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
  $('save-listing').textContent = plot ? 'Salvar alterações' : 'Salvar terreno';
  renderPhotoPreview();
}

async function loadListings(append = false) {
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

