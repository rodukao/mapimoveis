window.TerraFilters = (() => {
  const {el,dialog,field,options,error,busy}=TerraUI;
  const categories={'':'Todos os tipos',casa:'Casa',apartamento:'Apartamento',cobertura:'Cobertura',sobrado:'Sobrado',sala_comercial:'Sala comercial',galpao:'Galpão',residencial:'Terreno urbano',lote:'Lote',condominio:'Condomínio',chacara:'Chácara',sitio:'Sítio',fazenda:'Fazenda',rural:'Área rural',comercial:'Área comercial',industrial:'Área industrial'};
  const propertyGroups=TerraCatalogMap.propertyGroups;
  const topo={'':'Não informada',plano:'Plano',aclive:'Aclive',declive:'Declive',misto:'Misto'};
  const groups={infrastructure:{agua:'Água',energia:'Energia',esgoto:'Esgoto',asfalto:'Asfalto',internet:'Internet / fibra',calcada:'Calçada'},features:{esquina:'Esquina',murado:'Murado',cercado:'Cercado',nascente:'Nascente',vista:'Vista panorâmica'},documents:{escritura:'Escritura',matricula:'Matrícula',iptu:'IPTU',car:'CAR',ccir:'CCIR',sigef:'SIGEF'}};
  const labels=Object.assign({},...Object.values(groups));
  let active={};
  const filterButton=el('button',{id:'advanced-filters',onclick:()=>openFilters()},el('span',{class:'filter-desktop-label'},'Filtros'),el('span',{class:'filter-mobile-label'},'Mais filtros'));
  const toolbar=document.querySelector('.toolbar'),desktop=matchMedia('(min-width:721px)'),catalogTitle=document.querySelector('#browse .list-heading h1');
  const placeFilterButton=()=>desktop.matches?catalogTitle.after(filterButton):toolbar.append(filterButton);
  desktop.addEventListener('change',placeFilterButton);placeFilterButton();
  function checks(group, selected=[], prefix='filter') {
    return el('div',{class:'check-grid'},Object.entries(groups[group]).map(([value,label])=>field(label,el('input',{type:'checkbox',name:prefix+'-'+group,value,checked:selected.includes(value)}))));
  }
  function readChecks(form,group,prefix='filter'){return [...form.querySelectorAll(`input[name="${prefix}-${group}"]:checked`)].map(input=>input.value);}
  function get() { return structuredClone(active); }
  function chips() {
    const host=$('filter-chips');host.replaceChildren();
    const add=(label,keys)=>host.append(el('button',{type:'button','aria-label':'Remover filtro: '+label,onclick:()=>{
      for(const key of keys)delete active[key];
      if(keys.includes('city')){searchLocation=null;$('location-query').value='';searchMarker?.remove();searchMarker=null;}
      if(keys.includes('polygon'))window.TerraMapTools?.displayInterest(null);
      chips();loadListings();
    }},label+' ×'));
    if(active.city)add('Cidade: '+active.city+(active.state?', '+active.state:''),['city','state']);
    else if(active.state)add('UF: '+active.state,['state']);
    const range=(low,high,format)=>[low!==undefined?'de '+format(low):'',high!==undefined?'até '+format(high):''].filter(Boolean).join(' ');
    if(active.minPrice!==undefined||active.maxPrice!==undefined)add('Preço '+range(active.minPrice,active.maxPrice,money),['minPrice','maxPrice']);
    if(active.minArea!==undefined||active.maxArea!==undefined)add('Área '+range(active.minArea,active.maxArea,n=>num(n)+' m²'),['minArea','maxArea']);
    if(active.propertyGroup)add(propertyGroups[active.propertyGroup]?.label || active.propertyGroup,['propertyGroup']);
    for(const [key,names] of [['category',categories],['topography',topo],['context',{urban:'Urbano',rural:'Rural'}]])if(active[key])add(names[active[key]], [key]);
    for(const key of Object.keys(groups))if(active[key]?.length)add(describe(active[key]),[key]);
    for(const [key,label] of [['minBedrooms','Quartos'],['minBathrooms','Banheiros'],['minParking','Vagas']])if(active[key]!==undefined)add(label+': '+active[key]+' ou mais',[key]);
    if(active.minBuiltArea!==undefined)add('Área construída/privativa: a partir de '+num(active.minBuiltArea)+' m²',['minBuiltArea']);
    if(active.polygon)add('Área de interesse ativa',['polygon']);
    else if(active.bounds)add('Área visível do mapa',['bounds']);
    $('catalog-location').hidden=true;
  }
  $('quick-price').onclick=()=>openFilters('price');
  $('quick-area').onclick=()=>openFilters('area');
  $('quick-type').onclick=()=>openFilters('type');
  function openFilters(scope) {
    const panel=dialog({price:'Filtrar por preço',area:'Filtrar por área',type:'Filtrar por tipo'}[scope] || 'Mais filtros'),f=get(),form=el('form');
    const priceMin=el('input',{type:'number',min:0,step:'any',value:f.minPrice ?? ''}),priceMax=el('input',{type:'number',min:0,step:'any',value:f.maxPrice ?? ''});
    const areaMin=el('input',{type:'number',min:0,step:'any',value:f.minArea ?? ''}),areaMax=el('input',{type:'number',min:0,step:'any',value:f.maxArea ?? ''}),unit=el('select',{},options({'1':'m²','10000':'ha'}));
    let previousUnit=1;unit.onchange=()=>{for(const input of [areaMin,areaMax])if(input.value!=='')input.value=Number(input.value)*previousUnit/Number(unit.value);previousUnit=Number(unit.value);};
    const context=el('select',{},options({'':'Urbanos e rurais',urban:'Urbano',rural:'Rural'},f.context)),category=el('select',{},options(categories,f.category)),topography=el('select',{},options({...topo,'':'Qualquer topografia'},f.topography));
    const typeChoices=el('fieldset',{class:'property-type-choices'},el('legend',{},'Tipo de imóvel'));
    let selectedGroup=f.propertyGroup || '';
    const refreshCategories=()=>{const previous=category.value;category.replaceChildren(...options(Object.fromEntries(Object.entries(categories).filter(([key])=>!key||!selectedGroup||propertyGroups[selectedGroup]?.categories.includes(key))),previous));if(![...category.options].some(option=>option.value===previous))category.value='';};
    for(const [key,label] of [['','Todos os tipos'],...Object.entries(propertyGroups).map(([key,g])=>[key,g.label])]){
      const radio=el('input',{type:'radio',name:'property-group',value:key,checked:selectedGroup===key});
      radio.onchange=()=>{selectedGroup=key;refreshCategories();};
      typeChoices.append(el('label',{'data-property-group':key},radio,el('span',{class:'property-type-dot','aria-hidden':'true'}),label));
    }
    refreshCategories();
    if(!scope||scope==='price')form.append(el('div',{class:'two-fields'},field('Preço mínimo (R$)',priceMin),field('Preço máximo (R$)',priceMax)));
    if(!scope||scope==='area')form.append(field('Unidade de área',unit),el('div',{class:'two-fields'},field('Área no mapa mínima',areaMin),field('Área no mapa máxima',areaMax)));
    if(!scope||scope==='type')form.append(typeChoices,field('Contexto',context),field('Categoria específica',category));
    const counts=Object.fromEntries([['minBedrooms','Quartos'],['minBathrooms','Banheiros'],['minParking','Vagas']].map(([key,label])=>[key,el('select',{},options({'':'Qualquer quantidade','1':'1 ou mais','2':'2 ou mais','3':'3 ou mais','4':'4 ou mais','5':'5 ou mais'},f[key]===undefined?'':String(f[key])))]));
    const builtMin=el('input',{type:'number',min:1,max:1000000,step:'any',value:f.minBuiltArea??''});
    if(!scope){
      for(const [key,label] of [['minBedrooms','Quartos'],['minBathrooms','Banheiros'],['minParking','Vagas']])form.append(field(label,counts[key]));
      form.append(field('Área construída/privativa mínima (m²)',builtMin));
      form.append(field('Topografia',topography));
      for(const [group,title] of [['infrastructure','Infraestrutura'],['features','Características'],['documents','Documentação declarada']])form.append(el('h3',{},title),checks(group,f[group]));
      form.append(el('p',{class:'small'},'Infraestrutura e documentação são declaradas pelo anunciante.'));
    }
    form.append(el('button',{class:'primary full',type:'submit'},'Aplicar filtros'),el('button',{class:'full',type:'button',onclick:()=>{panel.node.close();$('reset').click();}},'Limpar filtros'));
    form.onsubmit=event=>{event.preventDefault();try{
      const next={...f};
      if(!scope||scope==='type'){if(selectedGroup)next.propertyGroup=selectedGroup;else delete next.propertyGroup;}
      for(const [key,input,multiplier] of [['minPrice',priceMin,1],['maxPrice',priceMax,1],['minArea',areaMin,+unit.value],['maxArea',areaMax,+unit.value]]){
        if(input.value===''){delete next[key];continue;}const value=Number(input.value)*multiplier;if(!Number.isFinite(value)||value<0||value>1e12)throw new Error('Informe valores numéricos válidos.');next[key]=value;
      }
      if(next.minPrice>next.maxPrice || next.minArea>next.maxArea)throw new Error('O mínimo deve ser menor ou igual ao máximo.');
      for(const [key,input] of [['context',context],['category',category],['topography',topography]]){if(input.value)next[key]=input.value;else delete next[key];}
      if(!scope){for(const [key,input] of [...Object.entries(counts),['minBuiltArea',builtMin]]){if(input.value==='')delete next[key];else next[key]=Number(input.value);}}
      if(!scope)for(const group of Object.keys(groups))next[group]=readChecks(form,group);
      active=next;chips();panel.node.close();loadListings();
    }catch(exception){error(form,exception);}};panel.content.append(form);
  }
  function applySaved(filters,sort='recent') {
    clearLocation(false);active=structuredClone(filters);chips();$('sort-order').value=sort;mine=false;
    const b=filters.bounds;
    if(b)moveMapProgrammatically('fitBounds',[[b.south,b.west],[b.north,b.east]],{maxZoom:17});
    if(filters.polygon){const layer=L.geoJSON(filters.polygon);moveMapProgrammatically('fitBounds',layer.getBounds(),{maxZoom:17});}
    window.TerraMapTools?.displayInterest(filters.polygon || null);
    loadListings();
  }
  function clearSpatial(){for(const key of ['city','state','bounds','polygon'])delete active[key];window.TerraMapTools?.displayInterest(null);chips();}
  function setLocation(place){clearSpatial();if(place.cityLevel){active.city=place.city;if(place.state)active.state=place.state;}else active.bounds=place.bounds;chips();}
  function setViewport(bounds){if(active.polygon)return;active.bounds=bounds;chips();}
  function setArea(region){delete active.bounds;delete active.polygon;Object.assign(active,region);chips();loadListings();}
  function clearInterest(){delete active.polygon;window.TerraMapTools?.displayInterest(null);chips();loadListings();}
  function reset(){active={};window.TerraMapTools?.displayInterest(null);chips();}
  function saveCurrent() {
    if(!TerraMarketplace.requireLogin('Entre na sua conta para salvar uma busca.'))return;
    const snapshot=get(),sort=$('sort-order').value,panel=dialog('Salvar esta busca');
    const name=el('input',{required:true,maxLength:100,value:(snapshot.city?'Terrenos em '+snapshot.city:snapshot.polygon?'Minha área de interesse':'Minha busca').slice(0,100)}),alerts=el('input',{type:'checkbox',checked:true}),submit=el('button',{class:'primary full',type:'submit'},'Salvar busca');
    const form=el('form',{},field('Nome da busca',name),field(`Receber alertas no ${APP_BRAND.name}`,alerts),el('p',{class:'small'},'Você verá os novos anúncios correspondentes em Minha conta → Alertas.'),submit);
    form.onsubmit=event=>{event.preventDefault();busy(submit,async()=>{try{await TerraMarketData.saveSearch(name.value.trim(),snapshot,sort,alerts.checked);}catch(exception){if(exception.code==='23505')throw new Error('Você já tem uma busca com esse nome. Escolha outro.');throw exception;}TerraMarketplace.track('save_search');panel.node.close();toast('Busca salva.');},form);};panel.content.append(form);
  }
  // Optional attributes are shared by editor, details, filters, and comparison.
  const context=el('select',{id:'terrain-context'},options({urban:'🏙 Urbano',rural:'🌾 Rural'}));
  $('listing-fields').prepend(field('Localização do imóvel',context));
  const extra=el('div',{id:'terrain-attributes'}),topography=el('select',{id:'terrain-topography'},options(topo));
  const urban=el('div',{id:'urban-attributes'},field('Zoneamento (opcional)',el('input',{id:'zoning',maxLength:100})),field('Testada em metros (opcional)',el('input',{id:'frontage',type:'number',min:0,step:'any'})));
  const rural=el('div',{id:'rural-attributes',hidden:true},el('p',{id:'rural-area'}),field('Tipo de acesso',el('select',{id:'rural-access'},options({'':'Não informado',asfalto:'Asfalto',terra:'Estrada de terra',cascalho:'Cascalho',trilha:'Trilha'}))),field('Reserva legal (informação declarada)',el('input',{id:'legal-reserve',maxLength:200,placeholder:'Opcional'})));
  const propertyFields=el('div',{id:'property-rooms'});
  for(const [key,label,max,step] of [['bedrooms','Quartos',100,1],['bathrooms','Banheiros',100,1],['parking_spaces','Vagas de garagem',100,1],['built_area_m2','Área construída/privativa (m²)',1000000,'any']])propertyFields.append(field(label+' (opcional)',el('input',{id:'property-'+key,type:'number',min:key==='built_area_m2'?1:0,max,step})));
  extra.append(propertyFields,el('p',{class:'small'},'No mapa, desenhe os limites de referência do lote ou empreendimento. Para casas e apartamentos, informe a área construída/privativa separadamente; o polígono não representa a área interna da unidade.'),field('Topografia declarada',topography),urban,rural);
  for(const [group,title] of [['infrastructure','Infraestrutura'],['features','Características'],['documents','Documentação declarada']])extra.append(el('details',{},el('summary',{},title),checks(group,[],'editor')));
  extra.append(el('p',{class:'small'},`Informe apenas características que você conhece. A declaração não representa validação documental pelo ${APP_BRAND.name}.`));
  $('category').closest('label').after(extra);
  $('category').replaceChildren(...options(Object.fromEntries(Object.entries(categories).filter(([k])=>k))));
  context.onchange=()=>{urban.hidden=context.value!=='urban';rural.hidden=context.value!=='rural';if(context.value==='rural'&&!['rural','chacara','sitio','fazenda'].includes($('category').value))$('category').value='rural';if(context.value==='urban'&&['rural','chacara','sitio','fazenda'].includes($('category').value))$('category').value='residencial';updateArea();if(drawing)updateDraw();};
  $('category').onchange=()=>{context.value=['rural','chacara','sitio','fazenda'].includes($('category').value)?'rural':'urban';urban.hidden=context.value!=='urban';rural.hidden=context.value!=='rural';updateArea();if(drawing)updateDraw();};
  function updateArea(){ $('rural-area').textContent='Área desenhada: '+(currentArea/10000).toLocaleString('pt-BR',{maximumFractionDigits:4})+' ha'; }
  function fillEditor(plot){
    context.value=plot?.terrain_context || (['rural','chacara','sitio','fazenda'].includes(plot?.category)?'rural':'urban');topography.value=plot?.topography || '';
    const d=plot?.details || {};for(const key of ['bedrooms','bathrooms','parking_spaces','built_area_m2'])$('property-'+key).value=d[key]??'';$('zoning').value=d.zoning || '';$('frontage').value=d.frontage ?? '';$('rural-access').value=d.access || '';$('legal-reserve').value=d.legal_reserve || '';
    for(const group of Object.keys(groups))extra.querySelectorAll(`input[name="editor-${group}"]`).forEach(input=>input.checked=(plot?.[group] || []).includes(input.value));context.onchange();
  }
  function editorValues(){
    const details=context.value==='urban'?{zoning:$('zoning').value.trim(),...($('frontage').value!==''?{frontage:Number($('frontage').value)}:{})}:{access:$('rural-access').value,legal_reserve:$('legal-reserve').value.trim()};
    for(const key of ['bedrooms','bathrooms','parking_spaces','built_area_m2']){const input=$('property-'+key);if(input.value!==''){const n=Number(input.value);if(!Number.isFinite(n)||n<(key==='built_area_m2'?1:0)||n>(key==='built_area_m2'?1000000:100)||(key!=='built_area_m2'&&!Number.isInteger(n)))throw Error('Revise as características do imóvel.');details[key]=n;}}
    return {terrain_context:context.value,topography:topography.value,details,...Object.fromEntries(Object.keys(groups).map(group=>[group,readChecks(extra,group,'editor')]))};
  }
  const describe=values=>(values || []).map(key=>labels[key] || key).join(', ') || 'Não informado';
  document.addEventListener('terra:detail',event=>{const p=event.detail;const list=$('detail-features');list.replaceChildren();
    const details=p.details||{};const extra=[];
    if(p.terrain_context==='rural')extra.push(['Área em hectares',(p.area/10000).toLocaleString('pt-BR',{maximumFractionDigits:4})+' ha']);
    for(const [key,label] of [['bedrooms','Quartos'],['bathrooms','Banheiros'],['parking_spaces','Vagas de garagem'],['built_area_m2','Área construída/privativa declarada (m²)'],['zoning','Zoneamento declarado'],['frontage','Testada (m)'],['access','Acesso declarado'],['legal_reserve','Reserva legal declarada']])if(details[key]!==undefined&&details[key]!=='')extra.push([label,String(details[key])]);
    for(const [label,value] of extra)list.append(el('div',{},el('dt',{},label),el('dd',{},value)));
    for(const [label,value] of [['Contexto',p.terrain_context==='rural'?'Rural':'Urbano'],['Topografia declarada',topo[p.topography] || 'Não informada'],['Infraestrutura',describe(p.infrastructure)],['Características',describe(p.features)],['Documentação declarada',describe(p.documents)]])list.append(el('div',{},el('dt',{},label),el('dd',{},value)));});
  return {get,clearInterest,setViewport,setLocation,applySaved,setArea,clearSpatial,reset,saveCurrent,fillEditor,editorValues,updateArea,describe,categories,topo};
})();
