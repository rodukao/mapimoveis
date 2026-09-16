window.TerraFeedback=(()=>{
 const {el,dialog,field,options,busy,error}=TerraUI;
 const categories={map:'Mapa',registration:'Cadastro',search:'Busca',leads:'Leads',dashboard:'Painel',performance:'Desempenho',other:'Outro'};
 const statuses={new:'Novo',reviewed:'Revisado',planned:'Planejado',done:'Concluído'};
 function protectSession(view){const owner=currentSession?.user.id;const changed=()=>{if(currentSession?.user.id!==owner)view.node.close();};document.addEventListener('terra:session',changed);view.node.addEventListener('close',()=>document.removeEventListener('terra:session',changed),{once:true});}
 const db=()=>TerraRepository.db().from('terra_pilot_feedback'),unwrap=TerraRepository.unwrap;
 function open(){
  if(!TerraMarketplace.requireLogin())return;
  const view=dialog('Enviar feedback'),form=el('form'),stars=el('fieldset',{class:'feedback-stars'}),areas=el('fieldset',{class:'feedback-categories'}),message=el('textarea',{required:true,minLength:10,maxLength:4000,rows:5}),submit=el('button',{type:'submit',class:'primary full'},'Enviar feedback');
  protectSession(view);
  stars.append(el('legend',{},'Como está sendo sua experiência?'));
  for(let n=1;n<=5;n++){const radio=el('input',{type:'radio',name:'rating',value:String(n),required:true,'aria-label':n+(n===1?' estrela':' estrelas')}),label=el('label',{},radio,el('span',{'aria-hidden':'true'},'★'),el('small',{},String(n)));radio.onchange=()=>stars.querySelectorAll('label').forEach((l,i)=>l.classList.toggle('rated',i<n));stars.append(label);}
  areas.append(el('legend',{},'Sobre qual área deseja falar?'));for(const [key,label] of Object.entries(categories))areas.append(el('label',{},el('input',{type:'radio',name:'category',value:key,required:true}),label));
  const questions=['A imobiliária usaria o TerraMapa só para terrenos?','Gostaria de publicar casas ou apartamentos também?','Como cadastra imóveis atualmente?','Precisaria importar anúncios de outro sistema?','Quantos terrenos mantém ativos?','Quem faria o cadastro?','O mapa ajuda na conversa com o cliente?','O polígono é um diferencial?','Visualizações, favoritos e leads são úteis?','Que informação está faltando?','Pagariam pela ferramenta?','Prefeririam mensalidade, pacote de anúncios ou plano gratuito com recursos premium?'];
  const question=el('select',{},options({'':'Quero enviar uma melhoria',...Object.fromEntries(questions.map((q,i)=>[String(i+1),q]))}));
  message.maxLength=3700;
  form.append(stars,areas,field('Tema da conversa do piloto (opcional)',question),field('O que poderíamos melhorar? Conte sua experiência ou responda ao tema escolhido.',message),el('p',{class:'small'},'Não inclua senhas, documentos ou dados de clientes. Seu feedback é visível para a administração.'),submit);view.content.append(form);
  form.onsubmit=e=>{e.preventDefault();busy(submit,async()=>{const data=new FormData(form);unwrap(await db().insert({rating:Number(data.get('rating')),category:data.get('category'),message:(question.value?'Pergunta do piloto: '+questions[Number(question.value)-1]+'\n\n':'')+message.value.trim(),page:location.pathname.match(/^\/[A-Za-z0-9/_-]*$/)?location.pathname.slice(0,200):'/'}));view.content.replaceChildren(el('h3',{},'Obrigado por participar do piloto.'),el('p',{},'Seu feedback foi enviado e vai ajudar a definir as próximas melhorias.'),el('button',{class:'primary full',onclick:()=>view.node.close()},'Concluir'));},form);};
 }
 async function admin(){
  if(!unwrap(await TerraRepository.db().rpc('terra_is_admin')))return toast('Acesso administrativo necessário.');
  const view=dialog('Feedback do piloto',{wide:true}),status=el('select',{'aria-label':'Filtrar status'},options({all:'Todos os status',...statuses},'new')),category=el('select',{'aria-label':'Filtrar área'},options({all:'Todas as áreas',...categories},'all')),list=el('div'),more=el('button',{class:'full'},'Carregar mais feedbacks');let offset=0,sequence=0;
  protectSession(view);
  view.content.append(el('div',{class:'management-filters'},field('Status',status),field('Área',category)),list,more);
  async function load(reset=false){const run=++sequence;if(reset){offset=0;list.replaceChildren(TerraUI.skeleton());}const from=offset;let query=db().select('id,user_id,rating,category,message,page,created_at,status').order('created_at',{ascending:false}).order('id',{ascending:false});if(status.value!=='all')query=query.eq('status',status.value);if(category.value!=='all')query=query.eq('category',category.value);const rows=unwrap(await query.range(from,from+49));if(run!==sequence||!view.node.open)return;if(reset)list.replaceChildren();offset=from+rows.length;
   for(const row of rows){const item=el('article',{class:'account-item'},el('strong',{},row.rating+'/5 · '+categories[row.category]),el('p',{class:'feedback-message'},row.message),el('small',{},new Date(row.created_at).toLocaleString('pt-BR')+' · '+row.page),el('p',{class:'small'},'Conta: '+row.user_id)),classification=el('select',{'aria-label':'Classificar área'},options(categories,row.category)),state=el('select',{'aria-label':'Situação do feedback'},options(statuses,row.status)),save=el('button',{},'Salvar classificação');save.onclick=()=>busy(save,async()=>{const changed=unwrap(await db().update({status:state.value,category:classification.value}).eq('id',row.id).eq('status',row.status).eq('category',row.category).select('id'));if(!changed.length)throw Error('O feedback mudou ou seu acesso expirou. Atualize a lista.');toast('Feedback atualizado.');await load(true);},item);item.append(el('div',{class:'row-actions'},field('Área',classification),field('Status',state),save));list.append(item);}
   if(!offset)list.append(el('p',{},'Nenhum feedback com esses filtros.'));more.hidden=rows.length<50;
  }
  const refresh=()=>load(true).catch(e=>error(list,e));status.onchange=category.onchange=refresh;more.onclick=()=>busy(more,()=>load(),list);view.node.addEventListener('close',()=>sequence++,{once:true});await refresh();
 }
 return {open,admin};
})();
