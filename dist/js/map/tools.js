window.TerraMapTools = (() => {
  const {el,field,error}=TerraUI;
  let interestActive=false,interestPoints=[],interestLayer=null;
  const interestButton=el('button',{'aria-label':'Desenhar área de interesse'},el('span',{class:'interest-desktop'},'✏ Desenhar área de interesse'),el('span',{class:'interest-mobile'},'✏ Área de interesse')),finish=el('button',{class:'primary',hidden:true},'Concluir área'),undo=el('button',{hidden:true},'Desfazer'),cancel=el('button',{hidden:true},'Cancelar'),save=el('button',{hidden:true,onclick:()=>TerraFilters.saveCurrent()},'Salvar esta área');
  const interestChip=el('button',{hidden:true,onclick:()=>TerraFilters.clearInterest(),'aria-label':'Remover área de interesse'},'Área de interesse ativa ×');
  const actions=el('div',{class:'map-search-actions'},interestButton,finish,undo,cancel,interestChip,save);document.querySelector('.map-wrap').append(actions);
  function displayInterest(geometry){if(interestLayer)interestLayer.remove();interestLayer=null;if(geometry)interestLayer=L.geoJSON(geometry,{style:{color:'#366aab',weight:3,dashArray:'7 5',fillOpacity:.07},interactive:false}).addTo(map);save.hidden=!geometry;interestChip.hidden=!geometry;}
  function drawInterest(){if(interestLayer)interestLayer.remove();interestLayer=interestPoints.length?(interestPoints.length>=3?L.polygon(interestPoints,{color:'#366aab',dashArray:'7 5',fillOpacity:.1,interactive:false}):L.polyline(interestPoints,{color:'#366aab',interactive:false})).addTo(map):null;finish.textContent='Concluir área ('+interestPoints.length+' pontos)';}
  function cancelInterest(){interestActive=false;actions.classList.remove('interest-drawing');interestPoints=[];finish.hidden=undo.hidden=cancel.hidden=true;interestButton.hidden=false;map.getContainer().style.cursor='';displayInterest(TerraFilters.get().polygon || null);}
  interestButton.onclick=()=>{if(drawing)return toast('Conclua a edição antes de desenhar uma área de busca.');viewportSearch.cancel();interestActive=true;actions.classList.add('interest-drawing');interestPoints=[];displayInterest(null);finish.hidden=undo.hidden=cancel.hidden=false;interestButton.hidden=save.hidden=true;map.getContainer().style.cursor='crosshair';toast('Toque nos limites da região desejada e depois em Concluir área.');};
  cancel.onclick=cancelInterest;undo.onclick=()=>{interestPoints.pop();drawInterest();};
  map.on('click',event=>{if(!interestActive||drawing)return;if(interestPoints.length>=200)return toast('Use no máximo 200 vértices.');interestPoints.push(event.latlng);drawInterest();});
  finish.onclick=async()=>{try{await TerraLazy.load('geometry');const geometry=TerraGeometry.polygon(interestPoints.map(p=>[p.lng,p.lat]));cancelInterest();TerraFilters.setArea({polygon:geometry},'Terrenos na área desenhada');displayInterest(geometry);}catch(exception){toast(exception.message);}};

  document.addEventListener('terra:editstart',()=>{cancelInterest();actions.hidden=true;});
  document.addEventListener('terra:editstop',()=>{actions.hidden=false;});
  // Draggable mobile list. The map remains visible above the sheet.
  const handle=el('button',{id:'mobile-sheet-handle','aria-label':'Arraste para ajustar a lista ou toque para recolher'},el('span',{class:'drag-pill'}),el('span',{},'Terrenos no mapa'));
  $('sidebar').prepend(handle);handle.onclick=()=>{document.body.classList.remove('show-list');$('sidebar').style.height='';$('mobile-toggle').textContent='Ver lista de terrenos';};
  let drag=null,moved=false;
  handle.onpointerdown=event=>{drag={y:event.clientY,height:$('sidebar').getBoundingClientRect().height};moved=false;handle.setPointerCapture(event.pointerId);};
  handle.onpointermove=event=>{if(!drag)return;const delta=drag.y-event.clientY;if(Math.abs(delta)>5)moved=true;const mainHeight=document.querySelector('main').clientHeight;$('sidebar').style.height=Math.max(mainHeight*.25,Math.min(mainHeight*.9,drag.height+delta))+'px';};
  handle.onpointerup=()=>{drag=null;};
  handle.addEventListener('click',event=>{if(moved){event.stopImmediatePropagation();event.preventDefault();moved=false;}},true);
  return {get interestActive(){return interestActive;},displayInterest,cancelInterest,validateEditor:()=>window.TerraEditorTools?.validateEditor(),drawUpdated:v=>window.TerraEditorTools?.drawUpdated(v),canMapDraw:()=>Boolean(window.TerraEditorTools?.canMapDraw())&&!interestActive};
})();
