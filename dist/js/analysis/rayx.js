window.TerraRayX = (() => {
  const {el,error,busy}=TerraUI,cache=new Map();
  const distance=n=>n>=1000?(n/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' km':Math.round(n)+' m';
  function summary(id,revision){const result=cache.get(id+':'+revision);return result?.distances?.length?result.distances.map(item=>item.label+': '+distance(item.meters)).join(' · '):'Ainda não consultadas';}
  function attach(plot,parent){
    const section=el('section',{class:'rayx'},el('h3',{},'Raio-X Terra'),el('p',{},'Consulte distâncias e altitude a partir das fontes geográficas disponíveis.')),content=el('div'),button=el('button',{},'Consultar dados geográficos');section.append(button,content);parent.append(section);
    function display(result){
      content.replaceChildren();
      if(result.distances?.length)content.append(el('dl',{class:'rayx-facts'},result.distances.map(item=>el('div',{},el('dt',{},item.label),el('dd',{},distance(item.meters))))));
      const elevation=result.elevation;
      if(elevation && Number.isFinite(elevation.min)&&Number.isFinite(elevation.max)){
        content.append(el('p',{},`Altitude amostrada: ${Math.round(elevation.min)}–${Math.round(elevation.max)} m · variação: ${Math.round(elevation.max-elevation.min)} m`));
        if(Number.isFinite(elevation.slopePercent))content.append(el('p',{},'Inclinação entre amostras: '+elevation.slopePercent.toLocaleString('pt-BR',{maximumFractionDigits:1})+'%.'));
        content.append(el('p',{class:'small'},`${elevation.samples} amostras em dados com resolução aproximada de 90 m. Terrenos pequenos podem não ter detalhe suficiente.`));
      }
      if(!result.distances?.length&&!elevation)content.append(el('p',{},'Não há dados geográficos disponíveis para este terreno no momento.'));
      for(const message of result.unavailable || [])content.append(el('p',{class:'small'},message));
      content.append(el('p',{class:'small'},'Distâncias em linha reta a partir do ponto de referência do terreno; não representam percurso de carro nem acesso legal. Altitude e inclinação são estimativas, sem substituir levantamento topográfico.'));
      const sources=el('p',{class:'small'},'Fontes: ');for(const source of result.sources || []){try{const url=new URL(source.url);if(url.protocol==='https:')sources.append(el('a',{href:url.href,target:'_blank',rel:'noopener'},source.name),' ');}catch(_){}}content.append(sources);
    }
    button.onclick=()=>busy(button,async()=>{const result=cache.get(plot.id+':'+plot.revision) || await TerraMarketData.rayx(plot.id);cache.set(plot.id+':'+plot.revision,result);if(cache.size>50)cache.delete(cache.keys().next().value);display(result);},section);
    if(cache.has(plot.id+':'+plot.revision))display(cache.get(plot.id+':'+plot.revision));
    // Price intelligence and scoring intentionally stay absent until enough real comparables exist.
  }
  return {attach,summary};
})();
