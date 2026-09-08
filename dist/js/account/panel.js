window.TerraAccount = (() => {
  const {el,dialog,error,busy,field,options}=TerraUI,api=TerraMarketData;
  const tabs={listings:'Meus anúncios',favorites:'Favoritos',searches:'Buscas salvas',alerts:'Alertas',profile:'Perfil'};
  const accountLinks=el('div',{class:'account-links'});
  for(const [key,label] of Object.entries(tabs))accountLinks.append(el('button',{class:'full',onclick:()=>{$('auth-dialog').close();open(key);}},label));
  $('account-listings').replaceWith(accountLinks);
  let badgeBusy=false, activePanel=null, panelOwner=null;
  const alertButton=el('button',{id:'alerts-button',hidden:true,onclick:()=>open('alerts')},'Alertas');
  $('account').before(alertButton);
  async function updateBadge(){
    alertButton.hidden=!currentSession;if(!currentSession||badgeBusy)return;badgeBusy=true;
    const owner=currentSession.user.id;
    try{const count=await api.unreadCount();if(currentSession?.user.id===owner)alertButton.textContent=count?'Alertas ('+count+')':'Alertas';}
    catch(_){alertButton.textContent='Alertas';}finally{badgeBusy=false;}
  }
  document.addEventListener('terra:session',()=>{if(activePanel&&panelOwner!==currentSession?.user.id)activePanel.close();updateBadge();});
  setInterval(()=>{if(!document.hidden)updateBadge();},60000);
  async function open(initial='listings'){
    if(!TerraMarketplace.requireLogin())return;
    const panel=dialog('Minha conta',{wide:true}),nav=el('nav',{class:'account-tabs'}),body=el('div');panel.content.append(nav,body);
    activePanel=panel.node;panelOwner=currentSession.user.id;panel.node.addEventListener('close',()=>{if(activePanel===panel.node)activePanel=null;},{once:true});
    let sequence=0;
    async function show(key){
      const current=++sequence;body.replaceChildren(el('p',{},'Carregando…'));nav.querySelectorAll('button').forEach(button=>button.setAttribute('aria-current',String(button.dataset.tab===key)));
      const target=el('section');
      try{await ({listings:ownListings,favorites:favoriteListings,searches:savedSearches,alerts:notifications,profile:profileForm})[key](target,panel);if(current===sequence&&panel.node.open)body.replaceChildren(target);}catch(exception){if(current===sequence){body.replaceChildren();error(body,exception);}}
    }
    for(const [key,label] of Object.entries(tabs))nav.append(el('button',{'data-tab':key,onclick:()=>show(key)},label));
    await show(initial);
  }
  async function ownListings(target,panel){
    let offset=0;const more=el('button',{class:'full'},'Carregar mais anúncios');
    async function load(){
      const result=await api.search({},'recent',offset,true),plots=result.rows.map(fromRow);offset+=plots.length;
      let stats={},statsFailed=false;try{stats=await api.stats(plots.map(p=>p.id));}catch(_){statsFailed=true;}
      for(const plot of plots){
        const stat=stats[plot.id],item=el('article',{class:'account-item'},TerraMarketplace.miniCard(plot,()=>{panel.node.close();TerraMarketplace.openById(plot.id);}),el('p',{class:'status-label'},TerraMarketplace.statuses[plot.status]),el('p',{class:'owner-metrics'},stat?`${stat.views} visualizações · ${stat.favorites} favoritos · ${stat.leads} contatos recebidos`:statsFailed?'Métricas indisponíveis. Tente novamente.':'Carregando métricas…'));
        const actions=el('div',{class:'row-actions'}),status=el('select',{'aria-label':'Situação de '+plot.title},options(TerraMarketplace.statuses,plot.status)),save=el('button',{},'Alterar situação');
        save.onclick=()=>busy(save,async()=>{const result=await api.status(plot,status.value);plot.revision=result.revision;plot.status=result.status;item.querySelector('.status-label').textContent=TerraMarketplace.statuses[result.status];await loadListings();toast('Situação atualizada.');},item);
        actions.append(el('button',{onclick:()=>{panel.node.close();start(plot);map.fitBounds(plot.points,{padding:[25,25],maxZoom:18});}},'Editar'),status,save);item.append(actions);target.insertBefore(item,more.parentElement?more:null);
      }
      if(!offset&&!target.querySelector('.empty-message'))target.append(el('p',{class:'empty-message'},'Você ainda não cadastrou terrenos.'));
      more.hidden=offset>=result.total;
    }
    await load();more.onclick=()=>busy(more,load,target);target.append(more);
  }
  async function favoriteListings(target,panel){
    const saved=await api.favorites();let offset=0;const more=el('button',{class:'full'},'Carregar mais favoritos');
    async function load(){
      const slice=saved.slice(offset,offset+50);offset+=slice.length;const rows=await api.byIds(slice.map(f=>f.listing_id)),byId=new Map(rows.map(row=>[row.id,row]));
      for(const favorite of slice){
        const row=byId.get(favorite.listing_id),item=el('article',{class:'account-item'}),remove=el('button',{},'Remover dos favoritos');
        item.append(row?TerraMarketplace.miniCard(fromRow(row),()=>{panel.node.close();TerraMarketplace.openById(row.id);}):el('p',{},'Este terreno não está mais disponível.'),remove);
        remove.onclick=()=>busy(remove,async()=>{await api.favorite(favorite.listing_id,false);item.remove();await TerraMarketplace.refreshFavorites();},item);target.insertBefore(item,more.parentElement?more:null);
      }more.hidden=offset>=saved.length;
    }
    if(!saved.length)target.append(el('p',{},'Você ainda não salvou terrenos. Toque no coração de um anúncio para favoritar.'));
    await load();more.onclick=()=>busy(more,load,target);target.append(more);
  }
  async function savedSearches(target,panel){
    const rows=await api.savedSearches();
    if(!rows.length)target.append(el('p',{},'Use “Salvar busca” depois de escolher a localização e os filtros.'));
    for(const row of rows){
      const name=el('input',{value:row.name,maxLength:100,'aria-label':'Nome da busca'}),alerts=el('input',{type:'checkbox',checked:row.alerts_enabled}),item=el('article',{class:'account-item'},name,field('Receber alertas no Terra',alerts));
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
    if(profile.avatar_path)form.append(el('img',{class:'profile-avatar',src:api.avatar(profile.avatar_path),alt:'Sua foto pública'}));
    form.append(field('Nome público',name),field('Cidade',city),field('Tipo de conta',type),field('Foto pública do perfil (até 5 MB)',photo),field('WhatsApp com DDD',phone),field('Disponibilizar WhatsApp nos meus anúncios ativos',enabled),el('p',{class:'small'},'Seu número será disponibilizado a quem escolher entrar em contato. Ele não aparece no perfil público.'),el('p',{class:'small'},profile.phone_verified?'Telefone verificado.':'Não exibimos selo de telefone verificado sem validação.'),submit);
    form.onsubmit=event=>{event.preventDefault();busy(submit,async()=>{await api.saveProfile({display_name:name.value,city:city.value,account_type:type.value,phone:phone.value,enabled:enabled.checked},photo.files[0]);toast('Perfil salvo.');photo.value='';},form);};target.append(form);
  }
  return {open,updateBadge};
})();
