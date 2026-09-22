/* One navigation bar, including the active modal's accessible top layer. */
(()=>{
 const icons={favorites:'<use href="/icons.svg?v='+APP_BRAND.version+'#favorite"/>',map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16"/>',list:'<path d="M9 5h12M9 12h12M9 19h12M3 5h1M3 12h1M3 19h1"/>',announce:'<rect x="3" y="3" width="18" height="18" rx="6"/><path d="M12 7v10M7 12h10"/>',account:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>'};
 const app=Boolean(document.getElementById('map')),nav=document.createElement('nav'),buttons={};
 const routes={map:'mapa',list:'lista',announce:'anunciar',favorites:'favoritos',account:'conta'};
 nav.className='mobile-nav';nav.setAttribute('aria-label','Navegação principal');
 let active='',navigating=false;const stack=[];
 for(const [key,label] of [['map','Mapa'],['list','Lista'],['announce','Anunciar'],['favorites','Favoritos'],['account','Conta']]){
  const button=document.createElement(app?'button':'a');if(app)button.type='button';else button.href='/#'+routes[key];
  button.id='mobile-nav-'+key;button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[key]+'</svg><span>'+label+'</span>';
  if(app)button.onclick=()=>navigate(key);buttons[key]=button;nav.append(button);
 }
 document.body.append(nav);
 function mount(records=[]){
  for(const record of records)if(record.type==='attributes'&&record.attributeName==='open'&&record.target.tagName==='DIALOG'&&record.target.open){const i=stack.indexOf(record.target);if(i>=0)stack.splice(i,1);stack.push(record.target);}
  for(let i=stack.length-1;i>=0;i--)if(!stack[i].isConnected||!stack[i].open)stack.splice(i,1);
  for(const dialog of document.querySelectorAll('dialog[open]'))if(!stack.includes(dialog))stack.push(dialog);
  const host=stack.at(-1)||document.body;
  if(nav.parentElement!==host)host.append(nav);
  let selected=host.dataset.mobileSection||active;
  if(!stack.length)selected=app?(drawing?'announce':document.body.classList.contains('show-list')?'list':'map'):'';
  for(const [key,button] of Object.entries(buttons)){if(key===selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
 }
 async function navigate(key){
  if(navigating)return;
  if(saving||authBusy){toast('Aguarde a conclusão da operação.');return;}
  if(drawing&&key!=='announce'){
   if(!window.confirm('Sair da edição? As alterações ainda não salvas serão descartadas.'))return;
   stop();
  }
  navigating=true;active=key;
  try{
   document.body.append(nav);
   if($('auth-dialog').open)$('close-auth').click();
   for(const dialog of [...document.querySelectorAll('dialog[open]')].reverse())dialog.close();
   if(key==='map'||key==='list'){
    document.body.classList.toggle('show-list',key==='list');
    $('mobile-toggle').setAttribute('aria-expanded',String(key==='list'));moveMapProgrammatically('invalidateSize');
   }else if(key==='announce')await start();
   else if(key==='favorites')await TerraAccount.open('favorites');
   else if(currentSession)await TerraAccount.open();else openAuth();
  }finally{navigating=false;mount();}
 }
 if(app){
  new MutationObserver(mount).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['open','class','data-mobile-section']});
  document.addEventListener('close',()=>queueMicrotask(mount),true);
  $('mobile-sheet-handle').onclick=()=>{navigate('map');buttons.map.focus();};
  window.TerraMobileNav={openInitial:()=>{const key=Object.keys(routes).find(k=>'#'+routes[k]===location.hash);if(key){history.replaceState(null,'',location.pathname+location.search);return navigate(key);}}};
 }
 mount();
})();
