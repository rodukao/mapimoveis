window.TerraAccount = (() => {
  const {el,dialog,error,busy,field,options}=TerraUI,api=TerraMarketData;
  const tabs={overview:'Visão geral',listings:'Meus anúncios',favorites:'Favoritos',searches:'Buscas salvas',alerts:'Alertas',profile:'Perfil'};
  const accountLinks=el('div',{class:'account-links'});
  for(const [key,label] of Object.entries(tabs))accountLinks.append(el('button',{class:'full',onclick:()=>{$('auth-dialog').close();open(key);}},label));
  $('account-listings').replaceWith(accountLinks);
  let badgeBusy=false, activePanel=null, panelOwner=null;
  async function updateBadge(){
    const alertButton=activePanel?.querySelector('[data-tab="alerts"]');
    if(!alertButton||!currentSession||badgeBusy)return;badgeBusy=true;
    const owner=currentSession.user.id;
    try{const count=await api.unreadCount();if(currentSession?.user.id===owner)alertButton.textContent=count?'Alertas ('+count+')':'Alertas';}
    catch(_){alertButton.textContent='Alertas';}finally{badgeBusy=false;}
  }
  document.addEventListener('terra:session',()=>{if(activePanel&&panelOwner!==currentSession?.user.id)activePanel.close();updateBadge();});
  setInterval(()=>{if(!document.hidden)updateBadge();},60000);
  async function open(initial='overview'){
    if(!TerraMarketplace.requireLogin())return;
    const panel=dialog('Minha conta',{wide:true}),nav=el('nav',{class:'account-tabs','aria-label':'Seções da conta'}),body=el('div',{class:'account-body'});
    panel.node.classList.add('account-panel');
    const menu=el('div',{class:'account-menu'},nav),utilities=el('div',{class:'account-utilities'});
    panel.content.append(el('div',{class:'account-layout'},menu,body));
    activePanel=panel.node;panelOwner=currentSession.user.id;panel.node.addEventListener('close',()=>{if(activePanel===panel.node)activePanel=null;},{once:true});
    let sequence=0,selected=null;
    const sections=new Map();
    panel.invalidate=(...keys)=>keys.forEach(key=>sections.delete(key));
    async function show(key){
      panel.node.dataset.mobileSection=key==='favorites'?'favorites':'account';
      if(selected===key)return;
      selected=key;
      const current=++sequence;nav.querySelectorAll('[data-tab]').forEach(button=>button.setAttribute('aria-current',String(button.dataset.tab===key)));
      const cached=sections.get(key);
      if(cached?.node){body.replaceChildren(cached.node);body.scrollTop=0;return;}
      body.replaceChildren(TerraUI.skeleton());
      if(!cached){
        const target=el('section');
        const entry={promise:null,node:null};
        entry.promise=({overview:overview,listings:ownListings,favorites:favoriteListings,searches:savedSearches,alerts:notifications,profile:profileForm})[key](target,panel).then(()=>{entry.node=target;return target;});
        sections.set(key,entry);
      }
      try{const target=await sections.get(key).promise;if(current===sequence&&panel.node.open){body.replaceChildren(target);body.scrollTop=0;}}catch(exception){sections.delete(key);if(current===sequence){selected=null;body.replaceChildren();error(body,exception);}}

    }
    for(const [key,label] of Object.entries(tabs))nav.append(el('button',{'data-tab':key,onclick:()=>show(key)},label));
    nav.append(utilities);
    utilities.append(el('button',{onclick:()=>TerraLazy.load('feedback').then(()=>TerraFeedback.open()).catch(e=>error(body,e))},'Enviar feedback'),el('button',{class:'account-signout',onclick:event=>busy(event.currentTarget,()=>$('signout').onclick(),body)},'Sair'));
    TerraRepository.db().rpc('terra_is_admin').then(({data})=>{if(data&&panel.node.open)utilities.append(el('button',{onclick:()=>TerraLazy.load('feedback').then(()=>TerraFeedback.admin()).catch(e=>error(body,e))},'Feedback do piloto'),el('button',{onclick:()=>TerraLazy.load('admin').then(()=>TerraAdmin.open()).catch(e=>error(body,e))},'Moderação'));});
    updateBadge();
    await show(initial);
  }
  async function overview(target,panel){
    const data=await api.dashboard();target.append(el('h3',{},'Visão geral'),el('p',{class:'small'},'Interesse nos últimos 30 dias. Anúncios ativos: situação atual, incluindo reservados.'));
    const grid=el('div',{class:'dashboard-metrics'});for(const [key,label] of [['active','Anúncios ativos'],['views','Visualizações'],['favorites','Favoritos'],['contacts','Contatos iniciados']])grid.append(el('div',{},el('strong',{},num(Number(data[key]))),el('span',{},label)));target.append(grid,el('p',{class:'small'},'Contatos são cliques liberados para o WhatsApp, não conversas confirmadas. Favoritos: salvos no período e ainda mantidos.'),el('h3',{},'Anúncios com maior interesse'));
    if(!data.top.length)target.append(el('p',{},'Ainda não há interações no período.'));
    for(const row of data.top){const button=el('button',{class:'mini-card',onclick:()=>{panel.node.close();TerraMarketplace.openById(row.id);}},el('strong',{},row.title||'Anúncio sem título'),el('span',{},`${row.contacts} contatos · ${row.favorites} favoritos · ${row.views} visualizações`));target.append(button);}
  }
  async function ownListings(target,panel){
    let offset=0,sequence=0,timer;const query=el('input',{type:'search',placeholder:'Buscar anúncio…','aria-label':'Buscar anúncio',maxLength:100}),filter=el('select',{'aria-label':'Filtrar situação'},options({'':'Todos',published:'Ativos',reserved:'Reservados',sold:'Vendidos',paused:'Pausados',draft:'Rascunhos'})),list=el('div'),more=el('button',{class:'full'},'Carregar mais anúncios');target.append(el('div',{class:'management-filters'},query,filter),list,more);
    async function load(reset=false){const run=++sequence;if(reset)offset=0;const startOffset=offset,result=await api.ownListings(query.value.trim(),filter.value,startOffset);if(run!==sequence)return;const plots=result.rows.map(fromRow);if(reset)list.replaceChildren();offset=startOffset+plots.length;
      for(const plot of plots){const item=el('article',{class:'account-item'},TerraMarketplace.miniCard(plot,()=>{panel.node.close();TerraMarketplace.openById(plot.id);}),el('p',{class:'status-label'},TerraMarketplace.statuses[plot.status])),actions=el('div',{class:'row-actions'});
        actions.append(el('button',{onclick:()=>{panel.node.close();start(plot);if(plot.points.length)moveMapProgrammatically('fitBounds',plot.points,{padding:[25,25],maxZoom:18});}},'Editar'),el('button',{onclick:()=>TerraMarketplace.share(plot)},'Compartilhar'));
        for(const [status,label] of [['reserved','Reservar'],['paused','Pausar'],['sold','Marcar vendido'],['published','Publicar']]){if(status===plot.status)continue;const button=el('button',{},label);button.onclick=()=>busy(button,async()=>{const changed=await api.status(plot,status);plot.revision=changed.revision;plot.status=changed.status;panel.invalidate('overview');await load(true);await loadListings();toast('Situação atualizada.');},item);actions.append(button);}item.append(actions);list.append(item);
      }
      if(!offset)list.append(el('p',{class:'empty-message'},'Nenhum anúncio encontrado com esses filtros.'));more.hidden=offset>=result.total;
    }
    const refresh=()=>load(true).catch(e=>error(list,e));query.oninput=()=>{sequence++;clearTimeout(timer);timer=setTimeout(refresh,350);};filter.onchange=()=>{sequence++;clearTimeout(timer);refresh();};panel.node.addEventListener('close',()=>{clearTimeout(timer);sequence++;},{once:true});more.onclick=()=>busy(more,()=>load(false),target);await load(true);
  }
  async function favoriteListings(target,panel){
    const saved=await api.favorites();let offset=0;const more=el('button',{class:'full'},'Carregar mais favoritos');
    async function load(){
      const slice=saved.slice(offset,offset+50);offset+=slice.length;const rows=await api.byIds(slice.map(f=>f.listing_id)),byId=new Map(rows.map(row=>[row.id,row]));
      for(const favorite of slice){
        const row=byId.get(favorite.listing_id),item=el('article',{class:'account-item'}),remove=el('button',{},'Remover dos favoritos');
        item.append(row?TerraMarketplace.miniCard(fromRow(row),()=>{panel.node.close();TerraMarketplace.openById(row.id);}):el('p',{},'Este terreno não está mais disponível.'),remove);
        remove.onclick=()=>busy(remove,async()=>{await api.favorite(favorite.listing_id,false);panel.invalidate('overview');item.remove();await TerraMarketplace.refreshFavorites();},item);target.insertBefore(item,more.parentElement?more:null);
      }more.hidden=offset>=saved.length;
    }
    if(!saved.length)target.append(el('p',{},'Você ainda não salvou terrenos. Toque no coração de um anúncio para favoritar.'));
    await load();more.onclick=()=>busy(more,load,target);target.append(more);
  }
  async function savedSearches(target,panel){
    const rows=await api.savedSearches();
    if(!rows.length)target.append(el('p',{},'Você ainda não tem buscas salvas.'));
    for(const row of rows){
      const name=el('input',{value:row.name,maxLength:100,'aria-label':'Nome da busca'}),alerts=el('input',{type:'checkbox',checked:row.alerts_enabled}),item=el('article',{class:'account-item'},name,field(`Receber alertas no ${APP_BRAND.name}`,alerts));
      const rename=el('button',{},'Salvar alterações'),remove=el('button',{class:'danger'},'Excluir busca');
      rename.onclick=()=>busy(rename,async()=>{if(!name.value.trim())throw new Error('Dê um nome para a busca.');await api.editSearch(row.id,{name:name.value.trim(),alerts_enabled:alerts.checked});toast('Busca atualizada.');},item);
      remove.onclick=()=>busy(remove,async()=>{await api.deleteSearch(row.id);item.remove();updateBadge();},item);
      item.append(el('div',{class:'row-actions'},el('button',{class:'primary',onclick:()=>{panel.node.close();TerraFilters.applySaved(row.filters,row.sort_order);}},'Abrir busca'),rename,remove));target.append(item);
    }
  }
  async function notifications(target,panel){
    let offset=0;const more=el('button',{class:'full'},'Carregar mais alertas');
    async function load(){
      const rows=await api.notifications(offset);offset+=rows.length;
      for(const row of rows){const button=el('button',{class:'notification'+(row.is_read?'':' unread')},el('strong',{},'Novo terreno para '+(row.terra_saved_searches?.name || 'sua busca')),el('small',{},new Date(row.created_at).toLocaleString('pt-BR')));button.onclick=()=>busy(button,async()=>{await api.readNotification(row.id);panel.node.close();updateBadge();TerraMarketplace.openById(row.listing_id);},target);target.insertBefore(button,more.parentElement?more:null);}
      if(!offset)target.append(el('p',{},'Nenhum alerta por enquanto. Ative alertas em uma busca salva para acompanhar novos anúncios.'));more.hidden=rows.length<50;
    }
    await load();more.onclick=()=>busy(more,load,target);target.append(more);
  }
  async function profileForm(target){
    const profile=await api.profile(),form=el('form'),name=el('input',{required:true,maxLength:100,value:profile.display_name,autocomplete:'name'}),city=el('input',{maxLength:100,value:profile.city}),type=el('select',{},options(TerraMarketplace.types,profile.account_type)),phone=el('input',{type:'tel',inputMode:'tel',maxLength:20,value:profile.contact.phone,placeholder:'32 99999-9999',autocomplete:'tel'}),enabled=el('input',{type:'checkbox',checked:profile.contact.enabled}),photo=el('input',{type:'file',accept:'image/jpeg,image/png,image/webp'}),submit=el('button',{type:'submit',class:'primary'},'Salvar perfil');
    const description=el('textarea',{maxLength:2000,value:profile.description||'',rows:4}),state=el('input',{maxLength:2,value:profile.state||'',placeholder:'MG'}),creci=el('input',{maxLength:40,value:profile.creci||'',placeholder:'12345-J'}),website=el('input',{type:'url',maxLength:500,value:profile.website||'',placeholder:'https://...'}),instagram=el('input',{maxLength:31,value:profile.instagram||'',placeholder:'@imobiliaria'});
    const nameField=field('Nome público',name),photoField=field('Foto pública do perfil (até 5 MB)',photo);
    const labels=()=>{nameField.firstChild.textContent=type.value==='imobiliaria'?'Nome da imobiliária':'Nome público';photoField.firstChild.textContent=type.value==='imobiliaria'?'Logo da imobiliária (até 5 MB)':'Foto pública do perfil (até 5 MB)';};type.onchange=labels;labels();
    if(profile.avatar_path)form.append(el('img',{class:'profile-avatar',src:api.avatar(profile.avatar_path),alt:'Sua foto pública'}));
    form.append(nameField,field('Cidade',city),field('UF',state),field('Tipo de conta — informação declarada',type),photoField,field('Descrição pública',description),field('CRECI declarado',creci),el('p',{class:'small'},'Informação fornecida pelo anunciante. O preenchimento não cria selo de verificação.'),field('Site (HTTPS)',website),field('Instagram (usuário)',instagram),field('WhatsApp com DDD',phone),field('Disponibilizar WhatsApp nos meus anúncios ativos',enabled),el('p',{class:'small'},'O WhatsApp é a única forma de contato com anunciantes no TerraMapa. Cadastre e habilite seu número antes de publicar. Ele não aparece no perfil público e só é liberado quando alguém escolhe entrar em contato.'),el('p',{class:'small'},profile.phone_verified?'Telefone verificado.':'Não exibimos selo de telefone verificado sem validação.'),submit);
    form.onsubmit=event=>{event.preventDefault();busy(submit,async()=>{await api.saveProfile({display_name:name.value,city:city.value,account_type:type.value,state:state.value,description:description.value,creci:creci.value,website:website.value,instagram:instagram.value,phone:phone.value,enabled:enabled.checked},photo.files[0]);toast('Perfil salvo.');photo.value='';},form);};target.append(form,el('hr'),el('h3',{},'Exclusão de conta'),el('p',{},'Você pode excluir sua conta e os dados associados. Confira os efeitos antes de confirmar.'),el('button',{type:'button',class:'danger full',onclick:()=>TerraOperations.deleteAccount()},'Excluir minha conta'));
  }
  return {open,updateBadge};
})();
