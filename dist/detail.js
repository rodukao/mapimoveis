let detailMedia = [], detailPhotoIndex = 0, detailPlot = null;
function stopDetailVideo() {
  $('detail-video').replaceChildren(); $('lightbox-video').replaceChildren();
}
function closeDetail() {
  stopDetailVideo();
  if ($('photo-lightbox').open) $('photo-lightbox').close();
  if ($('listing-detail').open) $('listing-detail').close();
}
function showDetail(plot) {
  if (!plot || drawing) return closeDetail();
  stopDetailVideo();
  if ($('photo-lightbox').open) $('photo-lightbox').close();
  detailPlot = plot;
  $('detail-title').textContent = plot.title || 'Rascunho sem título';
  $('detail-category').textContent = plot.tag;
  $('detail-address').textContent = plot.address;
  $('detail-price').textContent = money(plot.price);
  const displayArea=Number(plot.details?.built_area_m2)||plot.area;
  $('detail-area').textContent = num(displayArea) + (plot.details?.built_area_m2?' m² construídos/privativos (declarados)':' m² de área no mapa');
  $('detail-unit').textContent = plot.price == null ? 'Preço pendente' : unitMoney(plot.price / displayArea) + ' / m²';
  $('detail-description').textContent = plot.description || 'O anunciante ainda não incluiu uma descrição.';
  $('owner-actions').hidden = !currentSession || currentSession.user.id !== plot.owner_id;
  const facts = [['Área estimada no mapa', num(plot.area) + ' m²']];
  if (Number.isFinite(Number(plot.perimeter_m))) facts.push(['Perímetro', num(Number(plot.perimeter_m)) + ' m']);
  if (plot.status) facts.push(['Situação', {draft:'Rascunho',published:'Ativo',reserved:'Reservado',sold:'Vendido',paused:'Pausado'}[plot.status] || plot.status]);
  if (Number.isFinite(plot.lat) && Number.isFinite(plot.lng)) facts.push(['Coordenadas', plot.lat.toFixed(6) + ', ' + plot.lng.toFixed(6)]);
  for (const [key, label] of [['created_at','Cadastrado em'],['updated_at','Atualizado em']]) {
    if (plot[key] && Number.isFinite(Date.parse(plot[key]))) facts.push([label,new Date(plot[key]).toLocaleDateString('pt-BR')]);
  }
  $('detail-facts').replaceChildren();
  for (const [label,value] of facts) {
    const item = document.createElement('div'), term = document.createElement('dt'), definition = document.createElement('dd');
    term.textContent = label; definition.textContent = value; item.append(term,definition); $('detail-facts').append(item);
  }
  detailMedia = (plot.photos || []).map(photo => ({type:'photo',photo}));
  const videoId = TerraVideo.fromDetails(plot.details);
  if (videoId) detailMedia.push({type:'video',id:videoId});
  detailPhotoIndex = 0;
  $('detail-gallery').hidden = !detailMedia.length;
  $('no-photos').hidden = Boolean(detailMedia.length);
  $('photo-thumbnails').replaceChildren();
  detailMedia.forEach((item,index) => {
    const button = document.createElement('button');
    button.type = 'button';
    if (item.type === 'video') {
      button.className = 'video-thumbnail'; button.setAttribute('aria-label','Ver vídeo do imóvel');
      const icon = document.createElement('span'), label = document.createElement('span');
      icon.textContent = '▶'; icon.setAttribute('aria-hidden','true'); label.textContent = 'Vídeo'; button.append(icon,label);
    } else {
      const img = document.createElement('img'); button.setAttribute('aria-label', 'Ver foto ' + (index + 1));
      TerraPhotos.bind(img,item.photo); img.alt = ''; img.loading = 'lazy'; button.append(img);
    }
    button.onclick = () => displayPhoto(index); $('photo-thumbnails').append(button);
  });
  if (detailMedia.length) displayPhoto(0);
  if (!$('listing-detail').open) $('listing-detail').showModal();
  $('listing-detail').scrollTop = 0;
  document.dispatchEvent(new CustomEvent('terra:detail',{detail:plot}));
}
function resetPhotoZoom() {
  $('lightbox-viewport').classList.remove('zoomed');
  $('lightbox-viewport').scrollTo(0,0);
  $('photo-zoom').textContent = 'Ampliar 2×';
  $('photo-zoom').setAttribute('aria-pressed','false');
}
function displayPhoto(index) {
  if (!detailMedia.length) return;
  stopDetailVideo();
  detailPhotoIndex = (index + detailMedia.length) % detailMedia.length;
  const item = detailMedia[detailPhotoIndex], video = item.type === 'video';
  const caption = `${video ? 'Vídeo' : 'Foto'} · ${detailPhotoIndex + 1} de ${detailMedia.length}`;
  $('expand-photo').hidden = video; $('detail-video').hidden = !video;
  $('lightbox-photo').hidden = video; $('lightbox-video').hidden = !video;
  $('photo-zoom').hidden = video; $('video-fallback').hidden = !video;
  $('detail-video').parentElement.classList.toggle('is-video',video);
  $('gallery-hint').textContent = video ? 'YouTube' : 'Deslize para ver mais';
  $('photo-error').hidden = true; $('lightbox-error').hidden = true;
  if (video) {
    // Cancel pending photo-error callbacks when their image is no longer selected.
    for (const id of ['detail-photo','lightbox-photo']) { $(id)._terraPhoto = null; $(id).onerror = null; }
    const container = $($('photo-lightbox').open ? 'lightbox-video' : 'detail-video');
    container.append(TerraVideo.player(item.id,detailPlot.title));
    $('video-youtube-link').href = TerraVideo.watchUrl(item.id);
  } else {
    for (const id of ['detail-photo','lightbox-photo']) {
      TerraPhotos.bind($(id),item.photo,()=>{$(id==='detail-photo'?'photo-error':'lightbox-error').hidden=false;});
      $(id).alt = item.photo.alt_text || `${detailPlot.title} — ${caption}`;
    }
  }
  $('photo-counter').textContent = caption; $('lightbox-counter').textContent = caption;
  for (const id of ['photo-prev','photo-next','lightbox-prev','lightbox-next']) $(id).hidden = detailMedia.length < 2;
  [...$('photo-thumbnails').children].forEach((button,i) => button.setAttribute('aria-current',String(i === detailPhotoIndex)));
  resetPhotoZoom();
}
$('close-detail').onclick = closeDetail;
$('detail-map').onclick = closeDetail;
$('close-lightbox').onclick = () => $('photo-lightbox').close();
$('expand-photo').onclick = () => { if (detailMedia.length) { resetPhotoZoom(); $('photo-lightbox').showModal(); displayPhoto(detailPhotoIndex); } };
$('listing-detail').addEventListener('close', () => { if (!$('listing-detail').open) stopDetailVideo(); });
$('photo-lightbox').addEventListener('close', () => {
  stopDetailVideo();
  if ($('listing-detail').open && detailMedia.length) displayPhoto(detailPhotoIndex);
});
$('photo-zoom').onclick = () => {
  const zoomed = $('lightbox-viewport').classList.toggle('zoomed');
  $('photo-zoom').setAttribute('aria-pressed',String(zoomed));
  $('photo-zoom').textContent = zoomed ? 'Ajustar à tela' : 'Ampliar 2×';
};

for (const id of ['photo-prev','lightbox-prev']) $(id).onclick = () => displayPhoto(detailPhotoIndex - 1);
for (const id of ['photo-next','lightbox-next']) $(id).onclick = () => displayPhoto(detailPhotoIndex + 1);
for (const id of ['listing-detail','photo-lightbox']) {
  $(id).addEventListener('keydown', event => {
    if (event.target.closest('input,textarea,select')) return;
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
