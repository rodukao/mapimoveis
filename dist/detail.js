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

