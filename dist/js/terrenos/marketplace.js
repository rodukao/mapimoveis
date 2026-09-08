window.TerraMarketplace = (() => {
  const {el,dialog,error,busy,field,options} = TerraUI, api = TerraMarketData;
  const statuses = {draft:'Rascunho',published:'Ativo',reserved:'Reservado',sold:'Vendido',paused:'Pausado'};
  const types = {particular:'Particular',corretor:'Corretor',imobiliaria:'Imobiliária',loteadora:'Loteadora'};
  let favorites = new Set(), favoriteAccount = null, favoriteSequence = 0, routeSequence = 0;
  const favoriteBusy = new Set(), compared = new Map();
  let detailOutline = null, sessionId;
  try { sessionId = sessionStorage.getItem('terra-visit-session'); if (!/^[0-9a-f-]{36}$/.test(sessionId || '')) { sessionId=crypto.randomUUID(); sessionStorage.setItem('terra-visit-session',sessionId); } }
  catch (_) { sessionId = crypto.randomUUID(); }
  const track = (name,listing) => api.event(name,listing,sessionId).catch(() => { /* Analytics cannot replace or block catalog data. Contact uses the strict recorder below. */ });
  function link(id) { const url=new URL(location.pathname,location.origin);url.searchParams.set('terreno',id);return url.href; }
  function requireLogin(message = 'Entre na sua conta para continuar.') {
    if (currentSession) return true;
    toast(message); openAuth('login'); return false;
  }
  function syncHearts() {
    document.querySelectorAll('[data-favorite]').forEach(button => {
      const active=favorites.has(button.dataset.favorite);
      button.textContent=active?'♥ Salvo':'♡ Favoritar';button.setAttribute('aria-pressed',String(active));button.disabled=favoriteBusy.has(button.dataset.favorite);
    });
  }
  async function refreshFavorites() {
    const sequence=++favoriteSequence, owner=currentSession?.user.id;
    favorites=new Set();favoriteAccount=owner;syncHearts();
    if (!owner) return;
    try { const rows=await api.favorites();if(sequence!==favoriteSequence || currentSession?.user.id!==owner)return;favorites=new Set(rows.map(row=>row.listing_id));syncHearts(); }
    catch (exception) { if(sequence===favoriteSequence)toast('Não foi possível carregar seus favoritos. Tente novamente pela sua conta.'); }
  }
  async function toggleFavorite(id) {
    if (!requireLogin('Entre na sua conta para salvar terrenos.') || favoriteBusy.has(id)) return;
    favoriteBusy.add(id);syncHearts();
    const account=currentSession.user.id, active=!favorites.has(id);
    try {
      await api.favorite(id,active);
      if (currentSession?.user.id!==account) return;
      if(active){favorites.add(id);track('favorite_terreno',id);}else favorites.delete(id);
    } catch (exception) {
      if(exception.code==='23505') { favorites.add(id); }
      else toast(DATA.explain(exception));
    } finally {favoriteBusy.delete(id);syncHearts();}
  }
  function favoriteButton(plot) {const button=el('button',{type:'button','data-favorite':plot.id,'aria-pressed':'false',onclick:()=>toggleFavorite(plot.id)},'♡ Favoritar');return button;}
  const compareBar=el('div',{id:'compare-bar',hidden:true},el('button',{id:'open-comparison',class:'primary',onclick:()=>comparison()},'Comparar'),el('button',{'aria-label':'Limpar comparação',onclick:()=>{compared.clear();syncCompare();}},'×'));
  document.body.append(compareBar);
  function syncCompare() {
    compareBar.hidden=!compared.size;
    $('open-comparison').textContent=`Comparar ${compared.size} terreno${compared.size===1?'':'s'}`;
    $('open-comparison').disabled=compared.size<2;
    document.querySelectorAll('[data-compare]').forEach(input=>input.checked=compared.has(input.dataset.compare));
  }
  function decorateCard(card,plot) {
    const actions=card.querySelector('.card-actions');if(!actions)return;
    const checkbox=el('input',{type:'checkbox','data-compare':plot.id,checked:compared.has(plot.id)});
    checkbox.onchange=()=>{if(checkbox.checked){if(compared.size>=4){checkbox.checked=false;return toast('Compare até 4 terrenos por vez.');}compared.set(plot.id,plot);}else compared.delete(plot.id);syncCompare();};
    actions.append(favoriteButton(plot),field('Comparar',checkbox));syncHearts();
    if(plot.status==='reserved'||plot.status==='sold')card.querySelector('.tag').textContent+=' · '+statuses[plot.status];
  }
  function openPlot(plot) {
    routeSequence++;
    if(drawing)return toast('Conclua ou cancele a edição antes de abrir outro terreno.');
    showDetail(plot);
    selected=plots.findIndex(item=>item.id===plot.id);render();
    if(detailOutline)detailOutline.remove();
    detailOutline=L.polygon(plot.points,{color:'#186244',weight:3,fillOpacity:.2}).addTo(map);
    map.fitBounds(plot.points,{padding:[30,30],maxZoom:18});
    document.body.classList.remove('show-list');
  }
  async function openById(id) {
    const sequence=++routeSequence,account=currentSession?.user.id;
    try {
      const row=await api.get(id);if(sequence!==routeSequence||account!==currentSession?.user.id)return;
      if(!row){const panel=dialog('Terreno indisponível');panel.content.append(el('p',{},'Este terreno não está mais disponível.'));return;}
      openPlot(fromRow(row));
    }catch(exception){toast(DATA.explain(exception));}
  }
  window.addEventListener('popstate',()=>{const id=new URL(location.href).searchParams.get('terreno');if(id)openById(id);else {routeSequence++;closeDetail();}});
  document.addEventListener('terra:ready',()=>{const id=new URL(location.href).searchParams.get('terreno');if(id)openById(id);});
  document.addEventListener('terra:session',()=>{if(favoriteAccount!==currentSession?.user.id)refreshFavorites();});
  for(const name of ['terra:catalog','terra:editstart'])document.addEventListener(name,()=>{routeSequence++;detailOutline?.remove();detailOutline=null;});
  $('listing-detail').addEventListener('close',()=>{
    const url=new URL(location.href);url.searchParams.delete('terreno');history.replaceState(null,'',url);
    document.title='Terra — seu próximo terreno está no mapa';
  });
  async function share(plot) {
    const url=link(plot.id), text=`${plot.title} — ${num(plot.area)} m² — ${money(plot.price)}. Veja no Terra:`;
    if(navigator.share){try{await navigator.share({title:plot.title,text,url});track('share_terreno',plot.id);return;}catch(exception){if(exception.name==='AbortError')return;}}
    const panel=dialog('Compartilhar terreno');
    const copy=el('button',{class:'full'},'Copiar link');
    copy.onclick=()=>busy(copy,async()=>{if(navigator.clipboard){await navigator.clipboard.writeText(url);toast('Link copiado!');track('share_terreno',plot.id);}else{const input=el('input',{value:url,readOnly:true,'aria-label':'Link do terreno'});panel.content.append(input);input.select();}},panel.content);
    const whatsapp=el('a',{class:'action-link',href:'https://wa.me/?text='+encodeURIComponent(text+' '+url),target:'_blank',rel:'noopener',onclick:()=>track('share_terreno',plot.id)},'Compartilhar no WhatsApp');
    panel.content.append(el('p',{},plot.title),copy,whatsapp);
  }
  async function contact(plot,button) {
    if(button.disabled)return;
    const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
    button.disabled=true;const label=button.textContent;button.textContent='Abrindo contato…';
    try {
      const result=await api.event('whatsapp_click',plot.id,sessionId);
      if(!/^55\d{10,11}$/.test(result.phone || ''))throw new Error('WhatsApp indisponível.');
      const url='https://wa.me/'+result.phone+'?text='+encodeURIComponent(`Olá! Vi seu anúncio “${plot.title}” no Terra e gostaria de mais informações.\n${link(plot.id)}`);
      if(tab)tab.location.href=url;else window.location.assign(url);
    }catch(exception){tab?.close();toast(DATA.explain(exception));}
    finally{button.disabled=false;button.textContent=label;}
  }
  function report(plot) {
    if(!requireLogin('Entre na sua conta para denunciar um anúncio.'))return;
    const panel=dialog('Denunciar anúncio'),reason=el('select',{required:true},options({false_information:'Informação falsa',nonexistent:'Terreno inexistente',wrong_location:'Localização incorreta',scam:'Possível golpe',inappropriate:'Conteúdo impróprio',sold:'Já foi vendido',other:'Outro'}));
    const description=el('textarea',{maxLength:2000,rows:4}),submit=el('button',{type:'submit',class:'primary full'},'Enviar denúncia');
    const form=el('form',{},field('Qual o problema?',reason),field('Descreva o problema (opcional)',description),submit);
    form.onsubmit=event=>{event.preventDefault();busy(submit,async()=>{try{await api.report(plot.id,reason.value,description.value);}catch(exception){if(exception.code==='23505')throw new Error('Você já registrou uma denúncia com este motivo.');throw exception;}panel.node.close();toast('Obrigado. Sua denúncia foi registrada.');},panel.content);};
    panel.content.append(form);
  }
  function profileCard(profile,onclick) {
    const card=el('button',{class:'advertiser-card',onclick});
    if(profile.avatar_path)card.append(el('img',{src:api.avatar(profile.avatar_path),alt:'',class:'avatar'}));
    card.append(el('span',{},el('strong',{},profile.display_name || 'Anunciante Terra'),el('small',{},types[profile.account_type] || 'Anunciante'),el('small',{},`${profile.active_count} anúncio(s) ativo(s) · desde ${new Date(profile.created_at).getFullYear()}`)));
    if(profile.phone_verified)card.append(el('span',{class:'verified'},'✓ Telefone verificado'));
    return card;
  }
  async function publicProfile(ownerId) {
    const panel=dialog('Perfil do anunciante'),loading=el('p',{},'Carregando perfil…');panel.content.append(loading);
    try{
      const [profile,rows]=await Promise.all([api.advertiser(ownerId),api.advertiserListings(ownerId)]);loading.remove();
      if(!profile)throw new Error('Este perfil não está disponível.');
      panel.content.append(profileCard(profile,()=>{}),el('p',{},profile.city || ''),el('h3',{},'Anúncios ativos'));
      const listing=el('div',{class:'mini-list'});panel.content.append(listing);
      const append=rows=>rows.forEach(row=>listing.append(miniCard(fromRow(row),()=>{panel.node.close();openById(row.id);})));append(rows);
      let offset=rows.length;
      if(rows.length===50){const more=el('button',{},'Carregar mais');more.onclick=()=>busy(more,async()=>{const next=await api.advertiserListings(ownerId,offset);offset+=next.length;append(next);more.hidden=next.length<50;},panel.content);panel.content.append(more);}
    }catch(exception){loading.remove();error(panel.content,exception);}
  }
  function miniCard(plot,onclick) {
    const button=el('button',{class:'mini-card',onclick});
    if(plot.photos?.[0]?.url)button.append(el('img',{src:plot.photos[0].url,alt:'',loading:'lazy'}));
    button.append(el('strong',{},plot.title),el('span',{},money(plot.price)+' · '+num(plot.area)+' m²'),el('small',{},plot.address));return button;
  }
  document.addEventListener('terra:detail',async event=>{
    const plot=event.detail, url=new URL(location.href);url.searchParams.set('terreno',plot.id);
    if(url.href!==location.href)history.pushState(null,'',url);
    document.title=plot.title+' — Terra';track('view_terreno',plot.id);
    $('market-detail')?.remove();$('contact-footer')?.remove();
    const section=el('section',{id:'market-detail'}),actions=el('div',{class:'detail-quick-actions'},favoriteButton(plot),el('button',{onclick:()=>share(plot)},'Compartilhar'),el('button',{onclick:()=>report(plot)},'Denunciar'));
    section.append(actions);document.querySelector('.detail-info').append(section);syncHearts();
    if(currentSession?.user.id===plot.owner_id){
      const statusSelect=el('select',{},options(statuses,plot.status)),button=el('button',{},'Atualizar situação');
      button.onclick=()=>busy(button,async()=>{
        await api.status(plot,statusSelect.value);
        await loadListings();
        const row=await api.get(plot.id);
        if(!row)throw new Error('Situação salva. O anúncio não está disponível nesta sessão.');
        openPlot(fromRow(row));toast('Situação atualizada.');
      },section);
      section.append(field('Situação do anúncio',statusSelect),button);
      api.stats([plot.id]).then(stats=>{if(section.isConnected){const s=stats[plot.id];if(s)section.append(el('p',{class:'owner-metrics'},`${s.views} visualizações · ${s.favorites} favoritos · ${s.leads} contatos recebidos`));}}).catch(exception=>error(section,exception));
    }
    const advertiser=el('div',{class:'advertiser-section'},el('p',{},'Carregando anunciante…'));section.append(advertiser);
    try{
      const profile=await api.advertiser(plot.owner_id);if(!section.isConnected)return;advertiser.replaceChildren();
      if(profile){advertiser.append(el('h3',{},'Anunciante'),profileCard(profile,()=>publicProfile(plot.owner_id)));
        const footer=el('div',{id:'contact-footer'});
        if(profile.has_whatsapp && ['published','reserved'].includes(plot.status)){
          const button=el('button',{class:'primary full'},'Falar no WhatsApp');button.onclick=()=>contact(plot,button);footer.append(button);
        }else footer.append(el('p',{},plot.status==='sold'?'Este terreno foi vendido.':'O anunciante ainda não disponibilizou contato por WhatsApp.'));
        $('listing-detail').append(footer);
      }
    }catch(exception){advertiser.replaceChildren();error(advertiser,exception);}
    const similar=el('section',{},el('h3',{},'Terrenos semelhantes'),el('p',{},'Buscando alternativas…'));section.append(similar);
    try{const rows=await api.similar(plot);if(!similar.isConnected)return;similar.lastChild.remove();if(!rows.length)similar.append(el('p',{},'Ainda não há anúncios semelhantes disponíveis.'));else rows.forEach(row=>similar.append(miniCard(fromRow(row),()=>openById(row.id))));}catch(exception){similar.lastChild?.remove();error(similar,exception);}
    window.TerraRayX?.attach(plot,section);
  });
  async function comparison() {
    if(compared.size<2)return;
    const panel=dialog('Comparar terrenos',{wide:true}),loading=el('p',{},'Carregando anúncios atualizados…');panel.content.append(loading);
    try{
      const rows=await api.byIds([...compared.keys()]);const list=rows.map(fromRow);loading.remove();
      if(list.length<2)throw new Error('Alguns anúncios não estão mais disponíveis. Selecione pelo menos dois terrenos.');
      track('compare_terreno');
      const facts=[['Preço',p=>money(p.price)],['Área',p=>num(p.area)+' m²'],['Preço / m²',p=>unitMoney(p.price/p.area)],['Tipo',p=>p.tag],['Topografia',p=>p.topography || 'Não informada'],['Cidade',p=>p.city+', '+p.state],['Bairro',p=>p.neighborhood || 'Não informado'],['Infraestrutura',p=>TerraFilters.describe(p.infrastructure)],['Documentação declarada',p=>TerraFilters.describe(p.documents)],['Distâncias',p=>TerraRayX.summary(p.id,p.revision)]];
      const table=el('table',{class:'compare-table'},el('thead',{},el('tr',{},el('th',{scope:'col'},'Característica'),list.map(p=>el('th',{scope:'col'},el('button',{onclick:()=>{panel.node.close();openById(p.id);}},p.title))))),el('tbody',{},facts.map(([label,get])=>el('tr',{},el('th',{scope:'row'},label),list.map(p=>el('td',{},get(p)))))));
      const mapContainer=el('div',{class:'compare-map'});panel.content.append(el('div',{class:'table-scroll',tabIndex:0,'aria-label':'Comparação; role para os lados'},table),el('p',{class:'small'},'Infraestrutura e documentação são informações declaradas pelo anunciante.'),mapContainer);
      const comparisonMap=L.map(mapContainer,{scrollWheelZoom:false});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap',maxZoom:19}).addTo(comparisonMap);
      list.forEach((p,i)=>L.polygon(p.points,{color:['#156448','#346bb2','#a96721','#994f83'][i]}).addTo(comparisonMap).bindTooltip(el('span',{},p.title)));
      comparisonMap.fitBounds(list.flatMap(p=>p.points),{padding:[20,20],maxZoom:17});panel.node.addEventListener('close',()=>comparisonMap.remove(),{once:true});
    }catch(exception){loading.remove();error(panel.content,exception);}
  }
  return {statuses,types,link,track,requireLogin,decorateCard,openPlot,openById,share,miniCard,refreshFavorites,profileCard,publicProfile};
})();
