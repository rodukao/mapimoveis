window.TerraFilters = (() => {
  const {el,dialog,field,options,error,busy}=TerraUI;
  const categories={'':'Todos os tipos',casa:'Casa',apartamento:'Apartamento',cobertura:'Cobertura',sobrado:'Sobrado',sala_comercial:'Sala comercial',galpao:'Galpão',residencial:'Terreno urbano',lote:'Lote',condominio:'Lote em condomínio',chacara:'Chácara',sitio:'Sítio',fazenda:'Fazenda',rural:'Área rural',comercial:'Área comercial',industrial:'Área industrial'};
  const propertyGroups=TerraCatalogMap.propertyGroups;
  const topo={'':'Não informada',plano:'Plano',aclive:'Aclive',declive:'Declive',misto:'Misto'};
  const groups={infrastructure:{agua:'Água',energia:'Energia',esgoto:'Esgoto',asfalto:'Asfalto',internet:'Internet / fibra',calcada:'Calçada'},features:{esquina:'Esquina',murado:'Murado',cercado:'Cercado',nascente:'Nascente',vista:'Vista panorâmica',piscina:'Piscina',churrasqueira:'Churrasqueira',varanda:'Varanda',elevador:'Elevador',portaria:'Portaria 24h',area_lazer:'Área de lazer',mobiliado:'Mobiliado'},documents:{escritura:'Escritura',matricula:'Matrícula',iptu:'IPTU',car:'CAR',ccir:'CCIR',sigef:'SIGEF'}};
  const labels=Object.assign({},...Object.values(groups));
  let active={};
  const filterButton=el('button',{id:'advanced-filters',onclick:()=>openFilters()},el('span',{class:'filter-desktop-label'},'Filtros'),el('span',{class:'filter-mobile-label'},'Mais filtros'),el('span',{class:'filter-count',hidden:true}));
  const toolbar=document.querySelector('.toolbar'),desktop=matchMedia('(min-width:721px)'),catalogTitle=document.querySelector('#browse .list-heading h1');
  // Active-filter chips sit right under the filters button so they stay visible on desktop and, on mobile, in the map view.
  const chipHost=$('filter-chips');
  let activeCount=0;
  const placeFilterButton=()=>{if(desktop.matches){catalogTitle.after(filterButton);filterButton.after(chipHost);}else toolbar.append(filterButton,chipHost);};
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
    // The visible-map window is set by panning, not chosen by the user, so it stays out of the count.
    const count=host.children.length-(!active.polygon&&active.bounds?1:0),badge=filterButton.querySelector('.filter-count');
    activeCount=count;
    if(count)host.append(el('button',{type:'button',class:'chip-clear','aria-label':'Limpar todos os filtros',onclick:()=>$('reset').click()},'Limpar tudo'));
    badge.textContent=count;badge.hidden=!count;filterButton.classList.toggle('has-filters',count>0);
    filterButton.setAttribute('aria-label',count?'Filtros, '+count+(count===1?' ativo':' ativos'):'Filtros');
    $('catalog-location').hidden=true;
  }
  $('quick-price').onclick=()=>openFilters('price');
  $('quick-area').onclick=()=>openFilters('area');
  $('quick-type').onclick=()=>openFilters('type');
  function openFilters(scope) {
    const panel=dialog({price:'Filtrar por preço',area:'Filtrar por área',type:'Filtrar por tipo'}[scope] || 'Mais filtros'),f=get(),form=el('form');
    panel.node.classList?.add('filters-panel');
    if(activeCount)panel.node.querySelector?.('.panel-header')?.querySelector('button')?.before(el('button',{type:'button',class:'panel-clear',onclick:()=>{panel.node.close();$('reset').click();}},'Limpar tudo'));
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
    form.append(el('button',{class:'primary full',type:'submit'},'Aplicar filtros'));
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
  // Each property kind only shows the attributes that make sense for it.
  const accessLabels={'':'Não informado',asfalto:'Asfalto',terra:'Estrada de terra',cascalho:'Cascalho',trilha:'Trilha'};
  const kindOf=category=>({casa:'house',sobrado:'house',apartamento:'apartment',cobertura:'apartment',sala_comercial:'office',galpao:'warehouse'})[category]||'land';
  const builtKinds=['house','apartment','office','warehouse'];
  const detailFields={
    built_area_m2:{label:kind=>['apartment','office'].includes(kind)?'Área privativa (m²)':'Área construída (m²)',min:1,max:1000000,step:'any'},
    bedrooms:{label:'Quartos',min:0,max:100,step:1},
    suites:{label:'Suítes',min:0,max:100,step:1},
    bathrooms:{label:'Banheiros',min:0,max:100,step:1},
    parking_spaces:{label:'Vagas de garagem',min:0,max:100,step:1},
    floor:{label:'Andar',min:-5,max:300,step:1},
    ceiling_height_m:{label:'Pé-direito (m)',min:1,max:100,step:'any'},
    condo_fee_brl:{label:'Condomínio (R$/mês)',min:0,max:1000000,step:'any'},
    iptu_brl:{label:'IPTU (R$/ano)',min:0,max:100000000,step:'any'}
  };
  const kinds={
    land:{details:[],terrain:true,infrastructure:true,features:['esquina','murado','cercado','nascente','vista'],note:'No mapa, desenhe os limites do terreno. A área é calculada pelo desenho.'},
    house:{details:['built_area_m2','bedrooms','suites','bathrooms','parking_spaces','condo_fee_brl','iptu_brl'],infrastructure:true,features:['piscina','churrasqueira','varanda','area_lazer','mobiliado','vista','esquina','murado'],note:'No mapa, desenhe os limites do terreno da casa. Informe o condomínio apenas se a casa estiver em condomínio.'},
    apartment:{details:['built_area_m2','bedrooms','suites','bathrooms','parking_spaces','floor','condo_fee_brl','iptu_brl'],features:['piscina','churrasqueira','varanda','elevador','portaria','area_lazer','mobiliado','vista'],note:'No mapa, desenhe o contorno do prédio ou condomínio. A área da unidade é a área privativa informada acima.'},
    office:{details:['built_area_m2','bathrooms','parking_spaces','floor','condo_fee_brl','iptu_brl'],features:['elevador','portaria','mobiliado','vista'],note:'No mapa, desenhe o contorno do prédio. A área da sala é a área privativa informada acima.'},
    warehouse:{details:['built_area_m2','ceiling_height_m','bathrooms','parking_spaces','iptu_brl'],urban:true,infrastructure:true,features:['esquina','murado','cercado'],note:'No mapa, desenhe os limites do terreno do galpão. A área construída é informada acima.'}
  };
  const detailLabel=(key,kind)=>{const label=detailFields[key].label;return typeof label==='function'?label(kind):label;};
  const shortLabel=(key,kind)=>detailLabel(key,kind).replace(/ \((m²|m|R\$\/mês|R\$\/ano)\)$/,'');
  function detailText(key,value){
    const n=Number(value);
    if(key==='built_area_m2')return num(n)+' m²';
    if(key==='condo_fee_brl')return money(n)+'/mês';
    if(key==='iptu_brl')return money(n)+'/ano';
    if(key==='floor')return n===0?'Térreo':n<0?'Subsolo '+(-n):n+'º andar';
    if(key==='ceiling_height_m')return n.toLocaleString('pt-BR',{maximumFractionDigits:2})+' m';
    return String(n);
  }
  // Declared built/private area replaces the drawn area only for built property kinds.
  function builtArea(plot){const kind=kindOf(plot?.category),area=Number(plot?.details?.built_area_m2);return builtKinds.includes(kind)&&area>0?{area,label:['apartment','office'].includes(kind)?'m² privativos':'m² construídos'}:null;}

  const context=el('select',{id:'terrain-context'},options({urban:'🏙 Urbano',rural:'🌾 Rural'}));
  const contextField=field('Localização do imóvel',context);
  $('listing-fields').prepend(contextField);
  const extra=el('div',{id:'terrain-attributes'}),topography=el('select',{id:'terrain-topography'},options(topo));
  const topographyField=field('Topografia declarada',topography);
  const urban=el('div',{id:'urban-attributes'},field('Zoneamento (opcional)',el('input',{id:'zoning',maxLength:100})),field('Testada em metros (opcional)',el('input',{id:'frontage',type:'number',min:0,step:'any'})));
  const rural=el('div',{id:'rural-attributes',hidden:true},el('p',{id:'rural-area'}),field('Tipo de acesso',el('select',{id:'rural-access'},options(accessLabels))),field('Reserva legal (informação declarada)',el('input',{id:'legal-reserve',maxLength:200,placeholder:'Opcional'})));
  const propertyFields=el('div',{id:'property-rooms'}),detailInputs={};
  for(const [key,spec] of Object.entries(detailFields)){
    const input=el('input',{id:'property-'+key,type:'number',min:spec.min,max:spec.max,step:spec.step,inputMode:spec.step===1?'numeric':'decimal'}),caption=el('span',{});
    detailInputs[key]={input,caption,wrapper:el('label',{},caption,input)};propertyFields.append(detailInputs[key].wrapper);
  }
  const kindNote=el('p',{class:'small',id:'property-note'}),groupBlocks={},groupTitles={};
  // Exact drawing is the product's differentiator; approximate is offered but discouraged.
  const exactOption=el('input',{type:'radio',name:'location-precision',value:'exact',checked:true}),approximateOption=el('input',{type:'radio',name:'location-precision',value:'approximate'});
  const precisionTip=el('p',{class:'small precision-tip'},`Recomendamos a localização exata: o desenho no mapa é o diferencial do ${APP_BRAND.name} e passa mais confiança a quem vai comprar. Na aproximada, o público vê só um círculo de cerca de 350 m na região; o desenho exato continua visível apenas para você.`);
  const precisionField=el('fieldset',{class:'location-precision'},el('legend',{},'Localização no anúncio'),el('label',{class:'radio-option'},exactOption,el('span',{},el('strong',{},'Exata'),' — mostrar o desenho do imóvel (recomendado)')),el('label',{class:'radio-option'},approximateOption,el('span',{},el('strong',{},'Aproximada'),' — mostrar só a região')),precisionTip);
  const markPrecision=()=>precisionTip.classList?.toggle('warning',approximateOption.checked);
  exactOption.onchange=approximateOption.onchange=markPrecision;
  extra.append(precisionField,propertyFields,kindNote,topographyField,urban,rural);
  for(const [group,title] of [['infrastructure','Infraestrutura'],['features','Características'],['documents','Documentação declarada']])extra.append(groupBlocks[group]=el('details',{},groupTitles[group]=el('summary',{},title),checks(group,[],'editor')));
  extra.append(el('p',{class:'small'},`Informe apenas características que você conhece. A declaração não representa validação documental pelo ${APP_BRAND.name}.`));
  $('category').closest('label').after(extra);
  $('category').replaceChildren(...options(Object.fromEntries(Object.entries(categories).filter(([k])=>k))));
  function applyKind(){
    const kind=kindOf($('category').value),spec=kinds[kind];
    contextField.hidden=!spec.terrain;topographyField.hidden=!spec.terrain;
    if(!spec.terrain)context.value='urban';
    urban.hidden=!(spec.terrain?context.value==='urban':spec.urban);
    rural.hidden=!(spec.terrain&&context.value==='rural');
    for(const [key,{caption,wrapper}] of Object.entries(detailInputs)){
      wrapper.hidden=!spec.details.includes(key);
      caption.textContent=detailLabel(key,kind)+(key==='built_area_m2'?' — obrigatória para publicar':' (opcional)');
    }
    groupBlocks.infrastructure.hidden=!spec.infrastructure;
    groupTitles.features.textContent=builtKinds.includes(kind)?'Diferenciais':'Características';
    for(const input of groupBlocks.features.querySelectorAll('input[name="editor-features"]'))input.closest('label').hidden=!spec.features.includes(input.value);
    kindNote.textContent=spec.note;
  }
  context.onchange=()=>{if(context.value==='rural'&&!['rural','chacara','sitio','fazenda'].includes($('category').value))$('category').value='rural';if(context.value==='urban'&&['rural','chacara','sitio','fazenda'].includes($('category').value))$('category').value='residencial';applyKind();updateArea();if(drawing)updateDraw();};
  $('category').onchange=()=>{if(kinds[kindOf($('category').value)].terrain)context.value=['rural','chacara','sitio','fazenda'].includes($('category').value)?'rural':'urban';applyKind();updateArea();if(drawing)updateDraw();};
  function updateArea(){ $('rural-area').textContent='Área desenhada: '+(currentArea/10000).toLocaleString('pt-BR',{maximumFractionDigits:4})+' ha'; }
  function fillEditor(plot){
    if(plot?.category)$('category').value=plot.category;
    context.value=plot?.terrain_context || (['rural','chacara','sitio','fazenda'].includes(plot?.category)?'rural':'urban');topography.value=plot?.topography || '';
    const d=plot?.details || {};for(const key of Object.keys(detailFields))detailInputs[key].input.value=d[key]??'';$('zoning').value=d.zoning || '';$('frontage').value=d.frontage ?? '';$('rural-access').value=d.access || '';$('legal-reserve').value=d.legal_reserve || '';
    for(const group of Object.keys(groups))extra.querySelectorAll(`input[name="editor-${group}"]`).forEach(input=>input.checked=(plot?.[group] || []).includes(input.value));
    approximateOption.checked=plot?.location_precision==='approximate';exactOption.checked=!approximateOption.checked;markPrecision();applyKind();updateArea();
  }
  function editorValues(){
    const kind=kindOf($('category').value),spec=kinds[kind],terrainContext=spec.terrain?context.value:'urban',details={};
    if(spec.terrain?terrainContext==='urban':spec.urban){details.zoning=$('zoning').value.trim();if($('frontage').value!=='')details.frontage=Number($('frontage').value);}
    if(spec.terrain&&terrainContext==='rural'){details.access=$('rural-access').value;details.legal_reserve=$('legal-reserve').value.trim();}
    for(const key of spec.details){
      const input=detailInputs[key].input,range=detailFields[key];if(input.value==='')continue;const n=Number(input.value);
      if(!Number.isFinite(n)||n<range.min||n>range.max||(range.step===1&&!Number.isInteger(n)))throw Error('Revise o campo “'+shortLabel(key,kind)+'”.');
      details[key]=n;
    }
    if(builtKinds.includes(kind)&&details.built_area_m2===undefined&&['published','reserved'].includes($('listing-status').value))throw Error('Informe a '+shortLabel('built_area_m2',kind).toLowerCase()+' para publicar. Você pode salvar como rascunho.');
    return {location_precision:approximateOption.checked?'approximate':'exact',terrain_context:terrainContext,topography:spec.terrain?topography.value:'',details,infrastructure:spec.infrastructure?readChecks(extra,'infrastructure','editor'):[],features:readChecks(extra,'features','editor').filter(value=>spec.features.includes(value)),documents:readChecks(extra,'documents','editor')};
  }
  const describe=values=>(values || []).map(key=>labels[key] || key).join(', ') || 'Não informado';
  document.addEventListener('terra:detail',event=>{
    const p=event.detail,kind=kindOf(p.category),spec=kinds[kind],details=p.details||{},rows=[],list=$('detail-features');
    if(spec.terrain&&p.terrain_context==='rural')rows.push(['Área em hectares',(p.area/10000).toLocaleString('pt-BR',{maximumFractionDigits:4})+' ha']);
    // Rooms and parking are shown as icons at the top of the listing (showcase.js).
    for(const key of Object.keys(detailFields))if(!['bedrooms','suites','bathrooms','parking_spaces'].includes(key)&&details[key]!==undefined&&details[key]!=='')rows.push([shortLabel(key,kind)+(key==='built_area_m2'?' declarada':''),detailText(key,details[key])]);
    for(const [key,label] of [['zoning','Zoneamento declarado'],['frontage','Testada (m)'],['access','Acesso declarado'],['legal_reserve','Reserva legal declarada']])if(details[key]!==undefined&&details[key]!=='')rows.push([label,key==='access'?(accessLabels[details[key]]||String(details[key])):String(details[key])]);
    if(spec.terrain)rows.push(['Contexto',p.terrain_context==='rural'?'Rural':'Urbano'],['Topografia declarada',topo[p.topography] || 'Não informada']);
    if(spec.infrastructure)rows.push(['Infraestrutura',describe(p.infrastructure)]);
    rows.push([builtKinds.includes(kind)?'Diferenciais':'Características',describe(p.features)],['Documentação declarada',describe(p.documents)]);
    list.replaceChildren(...rows.map(([label,value])=>el('div',{},el('dt',{},label),el('dd',{},value))));
  });
  return {get,clearInterest,setViewport,setLocation,applySaved,setArea,clearSpatial,reset,saveCurrent,fillEditor,editorValues,updateArea,describe,categories,topo,kindOf,builtArea};
})();
