/* Listing page extras for people who arrive through a shared link and may never see the
   catalogue behind the modal: key facts, the drawn location on satellite imagery,
   directions, and an invitation to advertise. */
(() => {
  const {el}=TerraUI;
  let miniMap=null;
  const plural=(n,one,many)=>n+' '+(Number(n)===1?one:many);
  const ICONS={
    area:'<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
    house:'<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-6h4v6"/>',
    ruler:'<path d="M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2"/>',
    bed:'<path d="M3 19v-9M21 19v-5a3 3 0 0 0-3-3h-7v5M3 16h18"/><circle cx="7" cy="12" r="2"/>',
    bath:'<path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM6 12V6a2 2 0 0 1 3.5-1.3M8 19l-1 2M16 19l1 2"/>',
    car:'<path d="M5 17H3v-4l2-5h14l2 5v4h-2M9 17h6M3 13h18"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>'
  };
  const areaText=a=>a>=10000?(a/10000).toLocaleString('pt-BR',{maximumFractionDigits:2})+' ha':num(a)+' m²';
  // Key numbers in one row under the price: label on top, icon + value below.
  function stats(plot){
    const d=plot.details||{},kind=TerraFilters.kindOf(plot.category),built=TerraFilters.builtArea(plot),out=[];
    if(built)out.push(['house',num(built.area)+' m²','',built.label==='m² privativos'?'Área privativa':'Área construída']);
    out.push(['area',areaText(plot.area),'',{apartment:'Área do prédio',office:'Área do prédio'}[kind]||(built?'Área do terreno':'Área no mapa')]);
    if(d.frontage)out.push(['ruler',num(d.frontage)+' m','','Frente']);
    if(d.bedrooms)out.push(['bed',String(d.bedrooms),d.suites?'('+plural(d.suites,'suíte','suítes')+')':'',Number(d.bedrooms)===1?'Quarto':'Quartos']);
    else if(d.suites)out.push(['bed',String(d.suites),'',Number(d.suites)===1?'Suíte':'Suítes']);
    if(d.bathrooms)out.push(['bath',String(d.bathrooms),'',Number(d.bathrooms)===1?'Banheiro':'Banheiros']);
    if(d.parking_spaces)out.push(['car',String(d.parking_spaces),'',Number(d.parking_spaces)===1?'Vaga':'Vagas']);
    return out.map(([icon,value,note,label])=>{
      const item=document.createElement('li'),line=el('span',{class:'stat-value'});
      line.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[icon]}</svg>`;
      line.append(value,note?el('small',{},' '+note):'');
      item.append(el('span',{class:'stat-label'},label),line);
      return item;
    });
  }
  // Only what the numbers row above doesn't already say.
  function chips(plot){
    const d=plot.details||{},items=[];
    if(d.floor!==undefined)items.push(Number(d.floor)===0?'Térreo':d.floor+'º andar');
    if(d.ceiling_height_m)items.push('Pé-direito de '+Number(d.ceiling_height_m).toLocaleString('pt-BR')+' m');
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
    $('detail-area').hidden=true;
    $('detail-unit').after(el('ul',{id:'detail-stats',class:'detail-stats'},facts));
    if(labels.length)$('detail-stats').after(el('ul',{id:'detail-highlights',class:'detail-highlights'},labels));
    $('detail-map').hidden=true;
    if(plot.points?.length>=3){const {section,mapNode,approximate}=location(plot);$('detail-aside').prepend(section);showMap(mapNode,plot,approximate);}
    if(currentSession?.user.id!==plot.owner_id){const info=document.querySelector('.detail-info'),footer=$('contact-footer');footer?footer.before(invitation()):info.append(invitation());}
  });
  $('listing-detail').addEventListener('close',()=>{miniMap?.remove();miniMap=null;});
})();
