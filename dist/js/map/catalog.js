/* Shared map interaction state. Neither hover nor selection rebuilds a layer. */
(function(root) {
  const styles = {
    normal: {color:'#F59E0B',weight:3,opacity:1,fillOpacity:.14},
    hover: {color:'#EA580C',weight:5,opacity:1,fillOpacity:.24},
    selected: {color:'#C2410C',weight:6,opacity:1,fillOpacity:.28}
  };
  function interactions() {
    const layers=new Map(), cards=new Map(), markers=new Map(), hovered=new Map();
    let selectedId=null;
    function paint(id) {
      const active=id===selectedId, hover=Boolean(hovered.get(id)?.size), layer=layers.get(id);
      layer?.setStyle(styles[active?'selected':hover?'hover':'normal']);
      if(active||hover)layer?.bringToFront();
      cards.get(id)?.classList.toggle('selected',active);
      cards.get(id)?.classList.toggle('map-highlight',hover);
      const button=cards.get(id)?.querySelector('.card-open');
      if(active)button?.setAttribute('aria-current','true');else button?.removeAttribute('aria-current');
      markers.get(id)?.getElement()?.classList.toggle('chosen',active);
    }
    function highlightListing(id,source='map'){if(!hovered.has(id))hovered.set(id,new Set());hovered.get(id).add(source);paint(id);}
    function unhighlightListing(id,source='map'){hovered.get(id)?.delete(source);paint(id);}
    function selectListing(id,scroll=false){const previous=selectedId;selectedId=id;paint(previous);paint(id);
      const card=cards.get(id);if(scroll&&card){const box=card.getBoundingClientRect(),parent=card.closest('aside').getBoundingClientRect();if(box.top<parent.top||box.bottom>parent.bottom)card.scrollIntoView({block:'nearest',behavior:'instant'});}}
    function register(id,layer,card,marker){if(layer)layers.set(id,layer);if(card)cards.set(id,card);if(marker)markers.set(id,marker);paint(id);}
    function clear(){layers.clear();cards.clear();markers.clear();hovered.clear();}
    return {layers,register,clear,highlightListing,unhighlightListing,selectListing,styles,get selectedId(){return selectedId;}};
  }
  function viewport(map,{blocked,search,invalidate,delay=400,schedule=setTimeout,unschedule=clearTimeout}) {
    let depth=0,manual=false,timer=null,lastKey=null,generation=0,pending=0;
    function cancel(){unschedule(timer);timer=null;generation++;manual=false;pending=0;invalidate();}
    function begin(){if(depth||blocked())return;cancel();manual=true;}
    function bounds(){const b=map.getBounds();return {west:Math.max(-180,Math.min(180,b.getWest())),east:Math.max(-180,Math.min(180,b.getEast())),south:Math.max(-85,Math.min(85,b.getSouth())),north:Math.max(-85,Math.min(85,b.getNorth()))};}
    function end(){if(depth||!manual||blocked())return;manual=false;unschedule(timer);
      const region=bounds(),key=Object.values(region).map(n=>n.toFixed(5)).join(':')+':'+map.getZoom().toFixed(2),token=generation;
      if(key===lastKey)return;
      timer=schedule(async()=>{timer=null;if(token!==generation||blocked())return;pending=token+1;const ok=await search(region);if(pending===token+1)pending=0;if(ok&&token===generation)lastKey=key;},delay);
    }
    map.on('movestart',begin);map.on('moveend',end);
    // All application moves are synchronous (animate:false). There is no timeout
    // that could accidentally suppress the next real user gesture.
    function move(method,...args){depth++;try{if(manual||timer!==null||pending)invalidate();pending=0;map.stop();manual=false;unschedule(timer);timer=null;generation++;
      if(method==='invalidateSize')return map.invalidateSize({animate:false,pan:false});
      if(!['setView','fitBounds','panTo','setZoom'].includes(method))throw new Error('Unsupported programmatic map method');
      const optionIndex=method==='setView'?2:1;args[optionIndex]={...(args[optionIndex]||{}),animate:false};return map[method](...args);
    }finally{depth--;}}
    return {move,cancel,resetKey(){lastKey=null;},bounds};
  }
  root.TerraCatalogMap={interactions,viewport};
})(typeof window==='undefined'?globalThis:window);
