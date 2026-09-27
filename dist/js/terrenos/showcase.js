/* Listing page extras for people who arrive through a shared link and may never see the
   catalogue behind the modal: key facts, the drawn location on satellite imagery,
   directions, and an invitation to advertise. */
(() => {
  const {el}=TerraUI;
  let miniMap=null;
  const plural=(n,one,many)=>n+' '+(Number(n)===1?one:many);
  const ICONS={
    area:'<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    bed:'<path d="M3 19v-9M21 19v-5a3 3 0 0 0-3-3h-7v5M3 16h18"/><circle cx="7" cy="12" r="2"/>',
    bath:'<path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM6 12V6a2 2 0 0 1 3.5-1.3M8 19l-1 2M16 19l1 2"/>',
    car:'<path d="M5 17H3v-4l2-5h14l2 5v4h-2M9 17h6M3 13h18"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'
  };
  // Rooms and parking appear as icons side by side at the top of the characteristics list.
  function stats(plot){
    const d=plot.details||{},out=[];
    if(d.bedrooms)out.push(['bed',String(d.bedrooms),d.suites?'('+plural(d.suites,'suíte','suítes')+')':'',Number(d.bedrooms)===1?'quarto':'quartos']);
    else if(d.suites)out.push(['bed',String(d.suites),'',Number(d.suites)===1?'suíte':'suítes']);
    if(d.bathrooms)out.push(['bath',String(d.bathrooms),'',Number(d.bathrooms)===1?'banheiro':'banheiros']);
    if(d.parking_spaces)out.push(['car',String(d.parking_spaces),'',Number(d.parking_spaces)===1?'vaga':'vagas']);
    return out.map(([icon,value,note,label])=>{
      const item=document.createElement('li');item.title=[value,label,note].filter(Boolean).join(' ');
      item.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>`;
      item.append(el('span',{},value,note?el('small',{},' '+note):''),el('span',{class:'sr-only'},' '+label));
      return item;
    });
  }
  function chips(plot){
    const d=plot.details||{},kind=TerraFilters.kindOf(plot.category),items=[];
    if(kind==='house'||kind==='warehouse')items.push(plot.area>=10000?(plot.area/10000).toLocaleString('pt-BR',{maximumFractionDigits:2})+' ha de terreno':num(plot.area)+' m² de terreno');
    if(d.bedrooms)items.push(plural(d.bedrooms,'quarto','quartos'));
    if(d.suites)items.push(plural(d.suites,'suíte','suítes'));
    if(d.bathrooms)items.push(plural(d.bathrooms,'banheiro','banheiros'));
    if(d.parking_spaces)items.push(plural(d.parking_spaces,'vaga','vagas'));
    if(d.floor!==undefined)items.push(Number(d.floor)===0?'Térreo':d.floor+'º andar');
    if(d.ceiling_height_m)items.push('Pé-direito de '+Number(d.ceiling_height_m).toLocaleString('pt-BR')+' m');
    if(d.frontage)items.push('Frente de '+num(d.frontage)+' m');
    if(kind==='land'&&plot.topography)items.push('Terreno '+TerraFilters.topo[plot.topography].toLowerCase());
    return items.map(text=>el('li',{},text));
  }
  function showMap(node,plot,approximate){
    miniMap?.remove();
    miniMap=L.map(node,{scrollWheelZoom:false,dragging:!L.Browser.mobile,tap:false,zoomControl:true});
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{attribution:'Tiles &copy; Esri',maxZoom:19}).addTo(miniMap);
    L.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',{maxZoom:19}).addTo(miniMap);
    const shape=L.polygon(plot.points,{...TerraCatalogMap.styleFor(plot.category,'selected'),fillOpacity:approximate?.12:.2,...(approximate?{dashArray:'8 8',weight:3}:{})}).addTo(miniMap);
    const fit=()=>{miniMap?.invalidateSize();miniMap?.fitBounds(shape.getBounds(),{padding:[28,28],maxZoom:approximate?15:18});};
    fit();requestAnimationFrame(fit);
  }
  function location(plot){
    const approximate=plot.location_precision==='approximate';
    const mapNode=el('div',{class:'detail-mini-map',role:'img','aria-label':approximate?'Região aproximada do imóvel no mapa de satélite':'Limites do imóvel no mapa de satélite'});
    const destination=encodeURIComponent(plot.lat+','+plot.lng);
    const section=el('section',{id:'detail-location',class:'detail-location'},
      el('h3',{},'Localização'),mapNode,
      el('p',{class:'small'},approximate?'O anunciante optou por mostrar a localização aproximada: o imóvel fica dentro da área destacada.':'Limites desenhados pelo anunciante sobre a imagem de satélite. Medidas estimadas pelo desenho.'),
      el('div',{class:'detail-location-actions'},
        el('a',{class:'action-link',href:'https://www.google.com/maps/dir/?api=1&destination='+destination,target:'_blank',rel:'noopener'},approximate?'Como chegar à região':'Como chegar'),
        el('button',{type:'button',onclick:()=>$('detail-map').click()},'Ver no mapa')));
    return {section,mapNode,approximate};
  }
  function invitation(){
    return el('div',{id:'seller-invite',class:'seller-invite'},
      el('strong',{},'Tem um imóvel para vender?'),
      el('p',{},`Anuncie grátis no ${APP_BRAND.name}: desenhe os limites no mapa, envie as fotos e receba contatos direto no seu WhatsApp.`),
      el('button',{type:'button',class:'primary',onclick:()=>{$('listing-detail').close();$('announce').click();}},'Anunciar meu imóvel'));
  }
  document.addEventListener('terra:detail',event=>{
    const plot=event.detail;
    for(const id of ['detail-stats','detail-highlights','detail-location','seller-invite'])$(id)?.remove();
    const labels=chips(plot),facts=stats(plot);
    if(labels.length)$('detail-unit').after(el('ul',{id:'detail-highlights',class:'detail-highlights'},labels));
    if(facts.length)$('detail-features').before(el('ul',{id:'detail-stats',class:'detail-stats'},facts));
    $('detail-map').hidden=true;
    if(plot.points?.length>=3){const {section,mapNode,approximate}=location(plot);$('detail-description').previousElementSibling.before(section);showMap(mapNode,plot,approximate);}
    if(currentSession?.user.id!==plot.owner_id){const info=document.querySelector('.detail-info'),footer=$('contact-footer');footer?footer.before(invitation()):info.append(invitation());}
  });
  $('listing-detail').addEventListener('close',()=>{miniMap?.remove();miniMap=null;});
})();
