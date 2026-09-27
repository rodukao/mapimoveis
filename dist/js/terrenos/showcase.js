/* Listing page extras for people who arrive through a shared link and may never see the
   catalogue behind the modal: key facts, the drawn location on satellite imagery,
   directions, and an invitation to advertise. */
(() => {
  const {el}=TerraUI;
  let miniMap=null;
  const plural=(n,one,many)=>n+' '+(Number(n)===1?one:many);
  function highlights(plot){
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
    return items;
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
        el('button',{type:'button',onclick:()=>$('detail-map').click()},'Ver com outros imóveis no mapa')));
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
    for(const id of ['detail-highlights','detail-location','seller-invite'])$(id)?.remove();
    const facts=highlights(plot);
    if(facts.length)$('detail-unit').after(el('ul',{id:'detail-highlights',class:'detail-highlights'},facts.map(text=>el('li',{},text))));
    $('detail-map').hidden=true;
    if(plot.points?.length>=3){const {section,mapNode,approximate}=location(plot);$('detail-description').previousElementSibling.before(section);showMap(mapNode,plot,approximate);}
    if(currentSession?.user.id!==plot.owner_id){const info=document.querySelector('.detail-info'),footer=$('contact-footer');footer?footer.before(invitation()):info.append(invitation());}
  });
  $('listing-detail').addEventListener('close',()=>{miniMap?.remove();miniMap=null;});
})();
