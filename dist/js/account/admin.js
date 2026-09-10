window.TerraAdmin=(()=>{
 const {el,dialog,field,options,busy,error}=TerraUI;
 const rpc=async(name,args={})=>TerraRepository.unwrap(await TerraRepository.db().rpc(name,args));
 const labels={pending:'Pendentes',reviewing:'Em análise',resolved:'Revisadas',dismissed:'Arquivadas',all:'Todas'};
 const reasons={false_information:'Informação falsa',nonexistent:'Terreno inexistente',wrong_location:'Localização incorreta',scam:'Possível golpe',inappropriate:'Conteúdo impróprio',sold:'Já foi vendido',other:'Outro'};
 const actions={review:'Marcar revisada',archive:'Arquivar',pause:'Pausar anúncio',restore:'Restaurar anúncio'};
 const button=el('button',{class:'full',hidden:true,onclick:()=>{$('auth-dialog').close();open();}},'Moderação');document.querySelector('.account-links').append(button);
 let panel=null,sequence=0;
 async function access(){const seq=++sequence;button.hidden=true;if(panel)panel.close();if(!currentSession)return;try{const allowed=await rpc('terra_is_admin');if(seq===sequence)button.hidden=!allowed;}catch(_){} }
 document.addEventListener('terra:session',access);access();
 async function open(){
  if(!await rpc('terra_is_admin'))return toast('Acesso administrativo necessário.');
  const view=dialog('Moderação de denúncias',{wide:true});panel=view.node;view.node.addEventListener('close',()=>{if(panel===view.node)panel=null;},{once:true});
  const filter=el('select',{'aria-label':'Situação das denúncias'},options(labels,'pending')),list=el('div'),more=el('button',{class:'full'},'Carregar mais denúncias');let offset=0,loading=false;
  view.content.append(field('Mostrar',filter),list,more);
  async function history(id){const h=dialog('Histórico administrativo');try{const rows=await rpc('terra_admin_history',{p_listing:id});if(!rows.length)h.content.append(el('p',{},'Nenhuma ação registrada.'));for(const row of rows)h.content.append(el('article',{class:'account-item'},el('strong',{},actions[row.action]||row.action),el('p',{},row.note),el('small',{},new Date(row.created_at).toLocaleString('pt-BR')+' · Administrador: '+(row.actor_id||'conta excluída'))));}catch(e){error(h.content,e);}}
  async function act(row,action){const confirm=dialog(actions[action]),note=el('textarea',{rows:3,maxLength:1000,minLength:3,required:true}),submit=el('button',{class:action==='pause'?'danger':'primary'},'Confirmar ação');confirm.content.append(el('p',{},row.title||'Anúncio sem título'),field('Justificativa (obrigatória)',note),submit);submit.onclick=()=>busy(submit,async()=>{if(note.value.trim().length<3)throw new Error('Informe uma justificativa com pelo menos 3 caracteres.');await TerraOperations.withChallenge('sensitive',()=>rpc('terra_admin_action',{p_report:row.id,p_action:action,p_note:note.value.trim()}));confirm.node.close();offset=0;list.replaceChildren();await load();await loadListings();},confirm.content);}
  async function load(){if(loading)return;loading=true;filter.disabled=true;try{
   const rows=await TerraOperations.withChallenge('sensitive',()=>rpc('terra_admin_reports',{p_status:filter.value,p_offset:offset}));offset+=rows.length;
   if(!offset)list.append(el('p',{},'Nenhuma denúncia nesta situação.'));
   for(const row of rows){const item=el('article',{class:'account-item moderation-item'},el('h3',{},row.title||'Anúncio sem título'),el('p',{},'Anunciante: '+(row.advertiser||'Sem nome público')),el('small',{},'Terreno: '+row.listing_id+' · Conta: '+row.owner_id),el('p',{},(reasons[row.reason]||row.reason)+' · '+row.report_count+' denúncia(s) neste anúncio'),el('p',{},row.description||'Sem descrição adicional.'),el('small',{},new Date(row.created_at).toLocaleString('pt-BR')+' · '+labels[row.status]),el('p',{},row.held?'Pausado pela moderação.':'Situação do anúncio: '+(TerraMarketplace.statuses[row.listing_status]||row.listing_status)));
    const controls=el('div',{class:'row-actions'});for(const action of ['review','archive',row.held?'restore':'pause'])controls.append(el('button',{onclick:()=>act(row,action)},actions[action]));controls.append(el('button',{onclick:()=>history(row.listing_id)},'Ver histórico'));item.append(controls);list.append(item);
   }more.hidden=rows.length<50;
  }catch(e){error(list,e);}finally{loading=false;filter.disabled=false;}}
  filter.onchange=()=>{offset=0;list.replaceChildren();load();};more.onclick=()=>busy(more,load,list);await load();
 }
 return {open};
})();
