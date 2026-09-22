window.TerraEditorTools=(()=>{const {el,field,error}=TerraUI;let mode='map',coordinateDirty=false,segments=[];
  const method=el('select',{id:'boundary-method'},new Option('Desenhar no mapa','map'),new Option('Inserir coordenadas','coordinates'),new Option('Importar arquivo','import'));
  const rows=el('tbody'),coordinates=el('div',{id:'coordinate-editor',hidden:true},el('p',{class:'small'},'Latitude e longitude WGS84, em graus decimais. Ex.: −21.76245, −43.34891.'),el('div',{class:'coordinate-scroll'},el('table',{class:'coordinate-table'},el('thead',{},el('tr',{},['Vértice','Latitude','Longitude','Distância ao próximo',''].map(x=>el('th',{},x)))),rows)));
  const add=el('button',{type:'button'},'+ Adicionar vértice'),center=el('button',{type:'button'},'Centralizar desenho'),coordinateMessage=el('p',{class:'small',role:'status'});coordinates.append(add,center,coordinateMessage);
  center.onclick=()=>{if(points.length)moveMapProgrammatically('fitBounds',points,{padding:[30,30],maxZoom:18});else toast('Preencha as coordenadas para localizar o desenho.');};
  const file=el('input',{type:'file',accept:'.geojson,.json,.kml,.kmz'}),importMessage=el('p',{role:'status',class:'small'}),importer=el('div',{hidden:true},field('Arquivo do perímetro',file),el('p',{class:'small'},'GeoJSON, JSON, KML ou KMZ, até 5 MB. Um polígono sem buracos, com 3 a 200 vértices.'),importMessage);
  const container=el('div',{class:'boundary-tools'},field('Como deseja informar os limites?',method),coordinates,importer);$('editor').querySelector('.measure').before(container);
  function replacePoints(geometry){points=geometry.coordinates[0].slice(0,-1).map(([lng,lat])=>L.latLng(lat,lng));boundaryClosed=true;updateDraw();moveMapProgrammatically('fitBounds',points,{padding:[30,30],maxZoom:18});}
  function parseRows(){return [...rows.children].map(row=>{const inputs=row.querySelectorAll('input');if([...inputs].some(input=>input.value.trim()===''))throw new Error('Preencha latitude e longitude de todos os vértices.');const lat=Number(inputs[0].value.trim().replace(',','.')),lng=Number(inputs[1].value.trim().replace(',','.'));if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>85||Math.abs(lng)>180)throw new Error('Revise as coordenadas. Latitude: −85 a 85. Longitude: −180 a 180.');return [lng,lat];});}
  function refreshRows(){rows.replaceChildren();points.forEach(p=>addRow(p.lat,p.lng));if(!points.length)for(let i=0;i<3;i++)addRow();coordinateDirty=false;coordinateMessage.textContent='';updateDistances();}
  function updateDistances(){const items=[...rows.children];items.forEach((row,i)=>{row.firstChild.textContent=i+1;const cell=row.querySelector('.vertex-distance');cell.textContent='—';try{const vs=parseRows();if(vs.length>1){const p=vs[i],q=vs[(i+1)%vs.length];cell.textContent=num(map.distance([p[1],p[0]],[q[1],q[0]]))+' m';}}catch(_){}});}
  function coordinatesChanged(){if(saving)return;coordinateDirty=true;try{
    const vertices=parseRows();if(vertices.length<3){coordinateMessage.textContent='Adicione pelo menos 3 vértices.';return;}
    const geometry=TerraGeometry.polygon(vertices);points=geometry.coordinates[0].slice(0,-1).map(([lng,lat])=>L.latLng(lat,lng));boundaryClosed=true;updateDraw();coordinateMessage.textContent='Desenho atualizado. Confira a posição no mapa.';coordinateDirty=false;
  }catch(exception){coordinateMessage.textContent=exception.message+' O último desenho válido foi mantido.';}updateDistances();}
  function addRow(lat='',lng=''){const a=el('input',{type:'text',inputMode:'decimal',value:String(lat),'aria-label':'Latitude',maxLength:20}),b=el('input',{type:'text',inputMode:'decimal',value:String(lng),'aria-label':'Longitude',maxLength:20}),remove=el('button',{type:'button','aria-label':'Remover vértice'},'×'),row=el('tr',{},el('td',{},String(rows.children.length+1)),el('td',{},a),el('td',{},b),el('td',{class:'vertex-distance'},'—'),el('td',{},remove));a.oninput=b.oninput=coordinatesChanged;remove.onclick=()=>{if(!saving){row.remove();coordinatesChanged();}};rows.append(row);}
  add.onclick=()=>{if(saving)return;if(rows.children.length>=200)return toast('Use no máximo 200 vértices.');addRow();coordinateDirty=true;coordinateMessage.textContent='Preencha o novo vértice antes de salvar.';};
  method.onchange=()=>{if(saving){method.value=mode;return;}mode=method.value;$('boundary-instructions').textContent={map:'Marque os vértices. Arraste os pontos para ajustar e toque no + para inserir. Toque no primeiro ponto ou em Fechar polígono para concluir.',coordinates:'Informe latitude e longitude dos vértices em ordem.',import:'Importe um arquivo GeoJSON, KML ou KMZ contendo um único polígono.'}[mode];coordinates.hidden=mode!=='coordinates';importer.hidden=mode!=='import';if(mode==='coordinates')refreshRows();$('undo').disabled=$('clear').disabled=mode!=='map';updateDraw();};
  file.onchange=async()=>{if(saving||!file.files[0])return;const targetId=editId;file.disabled=true;method.disabled=true;importMessage.textContent='Lendo e validando o perímetro…';try{const geometry=await TerraGeometry.read(file.files[0]);if(!drawing||editId!==targetId)return;replacePoints(geometry);coordinateDirty=false;importMessage.textContent='Arquivo importado com sucesso. Área: '+num(currentArea)+' m². '+$('perimeter').textContent+'.';}catch(exception){importMessage.textContent=exception.message;}finally{file.value='';file.disabled=false;method.disabled=false;}};
  function validateEditor(){if(mode==='coordinates'){const geometry=TerraGeometry.polygon(parseRows());if(coordinateDirty)replacePoints(geometry);}if(file.disabled)throw new Error('Aguarde a conclusão da importação.');TerraGeometry.polygon(points.map(p=>[p.lng,p.lat]));}
  function drawUpdated(vertices){segments.forEach(layer=>layer.remove());segments=[];if(!drawing||vertices.length<2)return;vertices.forEach((p,i)=>{if(i===vertices.length-1&&vertices.length<3)return;const q=vertices[(i+1)%vertices.length];if(vertices.length<=30)segments.push(L.tooltip({permanent:true,direction:'top',offset:[0,-22],className:'segment-distance',interactive:false}).setLatLng([(p.lat+q.lat)/2,(p.lng+q.lng)/2]).setContent(num(map.distance(p,q))+' m').addTo(map));});}
  document.addEventListener('terra:editstart',()=>{mode='map';method.value=mode;$('boundary-instructions').textContent='Marque os vértices. Arraste os pontos para ajustar e toque no + para inserir. Toque no primeiro ponto ou em Fechar polígono para concluir.';coordinates.hidden=importer.hidden=true;coordinateDirty=false;importMessage.textContent='';$('undo').disabled=$('clear').disabled=false;});
  document.addEventListener('terra:editstop',()=>{drawUpdated([]);});

const closeBoundary=el('button',{id:'close-boundary',class:'primary',type:'button',hidden:true,onclick:finishBoundary},'Fechar polígono');
  document.querySelector('.map-wrap').append(closeBoundary);
  function finishBoundary(){
    if(saving||!drawing||mode!=='map'||points.length<3)return;
    try{TerraGeometry.polygon(points.map(p=>[p.lng,p.lat]));boundaryClosed=true;updateDraw();toast('Polígono fechado. Arraste os vértices ou toque no + para ajustar.');}catch(e){toast(e.message);}
  }
  function renderHandles(){
    if(!drawing||mode!=='map')return;
    points.forEach((point,index)=>{
      const marker=L.marker(point,{draggable:true,bubblingMouseEvents:false,autoPan:true,title:'Vértice '+(index+1)+(index===0&&!boundaryClosed?' — toque para fechar':''),icon:L.divIcon({className:'boundary-vertex',html:'<span>'+String(index+1)+'</span>',iconSize:[30,30],iconAnchor:[15,15]})}).addTo(map);
      marker.on('click',()=>{if(index===0&&!boundaryClosed)finishBoundary();});
      marker.on('dragstart',()=>{vertexDragging=true;if(ghost)ghost.remove();$('distance').hidden=true;});
      marker.on('drag',()=>{if(saving)return;points[index]=marker.getLatLng();if(drawn)drawn.setLatLngs(points);});
      marker.on('dragend',()=>{vertexDragging=false;updateDraw();});vertices.push(marker);
      if(index===points.length-1&&!boundaryClosed)return;
      const next=points[(index+1)%points.length];
      const midpoint=L.marker([(point.lat+next.lat)/2,(point.lng+next.lng)/2],{bubblingMouseEvents:false,title:'Adicionar vértice após '+(index+1),icon:L.divIcon({className:'boundary-midpoint',html:'<span>+</span>',iconSize:[28,28],iconAnchor:[14,14]})}).addTo(map);
      midpoint.on('click',()=>{if(saving)return;if(points.length>=200)return toast('Use no máximo 200 vértices.');points.splice(index+1,0,midpoint.getLatLng());updateDraw();});vertices.push(midpoint);
    });
  }
  return {validateEditor,renderHandles,drawUpdated(vertices){drawUpdated(vertices);closeBoundary.hidden=!drawing||mode!=='map'||boundaryClosed||vertices.length<3;map.getContainer().style.cursor=drawing&&mode==='map'&&!boundaryClosed?'crosshair':'';},canMapDraw:()=>mode==='map'};})();
