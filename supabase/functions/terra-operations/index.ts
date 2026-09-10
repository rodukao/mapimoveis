// Privileged credentials are read only from the Edge runtime, never returned.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedOrigins=(Deno.env.get('TERRA_ALLOWED_ORIGINS')||'https://terramapa.danielleczfranco.chatgpt.site').split(',').map(x=>x.trim());
const headers={'Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
function key(jsonName,legacy){const value=Deno.env.get(jsonName);return (value?JSON.parse(value).default:null)||Deno.env.get(legacy);}
async function payload(req,max=4096){if(!req.body)throw new Error('Requisição inválida.');const reader=req.body.getReader();let size=0;const chunks=[];while(true){const x=await reader.read();if(x.done)break;size+=x.value.length;if(size>max){await reader.cancel();throw new Error('Requisição muito grande.');}chunks.push(x.value);}const bytes=new Uint8Array(size);let i=0;for(const c of chunks){bytes.set(c,i);i+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));}
function sessionId(jwt){try{const part=jwt.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(atob(part.padEnd(Math.ceil(part.length/4)*4,'='))).session_id;}catch{return null;}}
async function request(url,options={}){return fetch(url,{...options,signal:AbortSignal.timeout(15000)});}
Deno.serve(async req=>{
 const origin=req.headers.get('origin'),cors={...headers,...(origin&&allowedOrigins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})};
 const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:cors});
 if(origin&&!allowedOrigins.includes(origin))return reply(403,{error:'Origem não autorizada.'});
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply(405,{error:'Use POST.'});
 try{
  const project=Deno.env.get('SUPABASE_URL'),pub=key('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY'),secret=key('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
  if(!project||!pub||!secret)return reply(503,{error:'Operação temporariamente indisponível.'});
  const bearer=req.headers.get('authorization')||'';if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer))return reply(401,{error:'Entre novamente na sua conta.'});
  const checked=await request(project+'/auth/v1/user',{headers:{apikey:pub,Authorization:bearer}});if(!checked.ok)return reply(401,{error:'Entre novamente na sua conta.'});
  const user=await checked.json(),sid=sessionId(bearer.slice(7));if(!UUID.test(user.id)||!UUID.test(sid||''))return reply(401,{error:'Sessão inválida.'});
  const body=await payload(req);
  // Service calls never forward a caller-selected user/owner ID.
  const adminHeaders={apikey:secret,'Content-Type':'application/json',...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{})};
  const rpc=async(name,args)=>{const r=await request(project+'/rest/v1/rpc/'+name,{method:'POST',headers:adminHeaders,body:JSON.stringify(args)});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.message||'Não foi possível concluir a operação.');}return r.status===204?null:r.json();};
  if(body.operation==='challenge'){
   if(!['contact','report','listing','sensitive'].includes(body.action))return reply(400,{error:'Operação inválida.'});
   const turnstile=Deno.env.get('TURNSTILE_SECRET_KEY');if(!turnstile)return reply(503,{error:'A verificação adicional está em configuração. Tente novamente mais tarde.'});
   if(typeof body.token!=='string'||!body.token||body.token.length>2048)return reply(400,{error:'Conclua a verificação de segurança.'});
   const validation=await request('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:turnstile,response:body.token})});
   const verdict=await validation.json();const hosts=allowedOrigins.map(value=>new URL(value).hostname);
   if(!verdict.success||verdict.action!=='terra_'+body.action||!hosts.includes(verdict.hostname))return reply(403,{error:'Verificação expirada ou inválida. Tente novamente.'});
   await rpc('terra_grant_challenge',{p_user:user.id,p_session:sid,p_action:body.action});return reply(200,{ok:true});
  }
  if(body.operation==='delete_account'){
   if(body.confirmation!=='EXCLUIR MINHA CONTA')return reply(400,{error:'Digite EXCLUIR MINHA CONTA para confirmar.'});
   await rpc('terra_prepare_deletion',{p_user:user.id,p_session:sid,p_confirmation:body.confirmation});
   // Resumable deletion: a retry lists remaining objects; metadata is never deleted directly.
   for(let batch=0;batch<10;batch++){
    const objects=await rpc('terra_deletion_objects',{p_user:user.id});if(!objects.length)break;
    const buckets=[...new Set(objects.map(o=>o.bucket_id))];
    for(const bucket of buckets){const prefixes=objects.filter(o=>o.bucket_id===bucket).map(o=>o.name);const r=await request(project+'/storage/v1/object/'+encodeURIComponent(bucket),{method:'DELETE',headers:adminHeaders,body:JSON.stringify({prefixes})});if(!r.ok)return reply(503,{pending:true,error:'A exclusão foi iniciada, mas ainda há fotos pendentes. Tente novamente para concluir.'});}
   }
   if((await rpc('terra_deletion_objects',{p_user:user.id})).length)return reply(202,{pending:true,error:'Ainda há fotos pendentes. Confirme novamente para continuar a exclusão.'});
   await rpc('terra_finish_deletion',{p_user:user.id});
   const removed=await request(project+'/auth/v1/admin/users/'+user.id,{method:'DELETE',headers:adminHeaders,body:JSON.stringify({should_soft_delete:false})});
   if(!removed.ok)return reply(503,{pending:true,error:'As fotos foram removidas, mas a exclusão da conta não terminou. Tente novamente ou procure o responsável pelo Terra.'});
   return reply(200,{deleted:true});
  }
  return reply(400,{error:'Operação inválida.'});
 }catch(error){return reply(400,{error:error instanceof Error?error.message:'Não foi possível concluir.'});}
});
