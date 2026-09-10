window.TerraOperations=(()=>{
 const {el,dialog,field,busy,error}=TerraUI;
 async function invoke(body){const result=await TerraRepository.db().functions.invoke('terra-operations',{body});if(result.error){let message;try{message=(await result.error.context.json()).error;}catch(_){}throw new Error(message||'Não foi possível concluir a operação. Tente novamente.');}if(result.data?.error)throw new Error(result.data.error);return result.data;}
 async function challenge(action){
  const panel=dialog('Verificação de segurança'),container=el('div'),status=el('p',{role:'status'},'Carregando verificação…');panel.content.append(el('p',{},'Confirme a verificação para continuar. Ela ajuda a proteger anúncios e contatos contra abuso.'),container,status);
  let widget=null,settled=false;
  return new Promise((resolve,reject)=>{
   panel.node.addEventListener('close',()=>{if(widget!==null)window.turnstile?.remove(widget);if(!settled){settled=true;reject(new Error('Verificação cancelada.'));}},{once:true});
   (async()=>{try{
    await TerraCaptcha.load();if(!panel.node.open)return;
    widget=window.turnstile.render(container,{sitekey:TERRA_CONFIG.captcha.siteKey,action:'terra_'+action,theme:'light',size:innerWidth<400?'compact':'normal',callback:async token=>{try{status.textContent='Validando…';await invoke({operation:'challenge',action,token});settled=true;panel.node.close();resolve();}catch(e){status.textContent=e.message;window.turnstile.reset(widget);}},'error-callback':()=>{status.textContent='Não foi possível verificar. Feche e tente novamente.';return true;},'expired-callback':()=>{status.textContent='Verificação expirada. Tente novamente.';}});status.textContent='';
   }catch(e){status.textContent=e.message;}})();
  });
 }
 async function withChallenge(action,task){try{return await task();}catch(e){if(!String(e.message).includes('CAPTCHA_REQUIRED'))throw e;await challenge(action);return task();}}
 function deleteAccount(){
  const panel=dialog('Excluir minha conta'),phrase=el('input',{autocomplete:'off',maxLength:30}),ack=el('input',{type:'checkbox'}),remove=el('button',{class:'danger full',disabled:true},'Excluir definitivamente');
  panel.content.append(el('p',{},'Esta ação é irreversível. Serão excluídos sua conta, perfil, anúncios, fotos, favoritos, buscas e notificações. Seus anúncios deixam de aparecer quando a exclusão começa. Histórico de moderação pode permanecer pelo prazo informado na política.'),el('p',{},'Por segurança, saia e entre novamente antes de confirmar. O login precisa ter ocorrido nos últimos 10 minutos.'),field('Digite EXCLUIR MINHA CONTA',phrase),field('Entendo que meus dados e anúncios serão excluídos.',ack),remove);
  const check=()=>{remove.disabled=phrase.value!=='EXCLUIR MINHA CONTA'||!ack.checked;};phrase.oninput=ack.onchange=check;
  remove.onclick=()=>busy(remove,async()=>{panel.close.disabled=true;phrase.disabled=ack.disabled=true;const prevent=e=>e.preventDefault();panel.node.addEventListener('cancel',prevent);try{const result=await invoke({operation:'delete_account',confirmation:phrase.value});if(result.deleted){try{await TerraRepository.db().auth.signOut({scope:'local'});}catch(_){}location.replace('/');}}finally{panel.node.removeEventListener('cancel',prevent);panel.close.disabled=false;phrase.disabled=ack.disabled=false;}},panel.content);
 }
 return {withChallenge,invoke,deleteAccount};
})();
