window.TerraMapTools = (() => {
  const {el,field,error}=TerraUI;
  let interestLayer=null;
  // Preserve previously saved region filters without offering a second drawing tool.
  function displayInterest(geometry){if(interestLayer)interestLayer.remove();interestLayer=null;if(geometry)interestLayer=L.geoJSON(geometry,{style:{color:'#366aab',weight:3,dashArray:'7 5',fillOpacity:.07},interactive:false}).addTo(map);}
  function cancelInterest(){displayInterest(TerraFilters.get().polygon||null);}
  const handle=el('button',{id:'mobile-sheet-handle',type:'button','aria-label':'Voltar para o mapa'},'← Voltar para o mapa');
  $('sidebar').prepend(handle);handle.onclick=()=>{document.body.classList.remove('show-list');$('mobile-toggle').setAttribute('aria-expanded','false');$('mobile-toggle').focus();};
  return {get interestActive(){return false;},displayInterest,cancelInterest,validateEditor:()=>window.TerraEditorTools?.validateEditor(),drawUpdated:v=>window.TerraEditorTools?.drawUpdated(v),canMapDraw:()=>Boolean(window.TerraEditorTools?.canMapDraw())};
})();
