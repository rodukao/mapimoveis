// Only the website Worker can supply the trusted visitor identity.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const origins=(Deno.env.get('TERRA_ALLOWED_ORIGINS')||'https://terramapa.danielleczfranco.chatgpt.site').split(',').map(s=>s.trim());
const key=(name,old)=>{const v=Deno.env.get(name);return (v?JSON.parse(v).default:null)||Deno.env.get(old);};
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
Deno.serve(async req=>{
 const reply=(status,data)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 if(req.method!=='POST')return reply(405,{error:'Use POST.'});
 try{
  const proxy=req.headers.get('x-terra-proxy')||'';if(!/^[0-9a-f]{64}$/.test(proxy))return reply(403,{error:'Acesso não autorizado.'});
  const project=Deno.env.get('SUPABASE_URL'),secret=key('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
  const headers={apikey:secret,'Content-Type':'application/json',...(secret?.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{})};
  const rpc=async(name,args)=>{const r=await fetch(project+'/rest/v1/rpc/'+name,{method:'POST',headers,body:JSON.stringify(args),signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Não foi possível disponibilizar este contato.');return r.json();};
  if(!await rpc('terra_contact_proxy_valid',{p_hash:await hash(proxy)}))return reply(403,{error:'Acesso não autorizado.'});
  const raw=await req.text();if(raw.length>5000)return reply(413,{error:'Requisição muito grande.'});const b=JSON.parse(raw);
  if(!UUID.test(b.session||'')||!(/^[0-9a-f]{64}$/.test(b.ip||''))||!origins.includes(b.origin)||(!UUID.test(b.listing||'')&&!UUID.test(b.owner||'')))return reply(400,{error:'Contato inválido.'});
  // Reserve request budget before verification or contact lookup. Denials are committed.
  const gate=await rpc('terra_contact_gate',{p_ip:b.ip,p_session:b.session,p_verified:false});
  if(gate.error==='RATE_LIMIT')return reply(429,{error:'Muitas tentativas. Tente novamente mais tarde.',retry_after:gate.retry_after});
  if(gate.error==='CAPTCHA_REQUIRED'){
   if(!b.token)return reply(403,{error:'CAPTCHA_REQUIRED'});
   const turnstile=Deno.env.get('TURNSTILE_SECRET_KEY');if(!turnstile)return reply(503,{error:'Verificação adicional temporariamente indisponível. Tente novamente mais tarde.'});
   if(typeof b.token!=='string'||b.token.length>2048)return reply(400,{error:'Verificação inválida.'});
   const r=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:new URLSearchParams({secret:turnstile,response:b.token}),signal:AbortSignal.timeout(10000)}),v=await r.json();
   if(!v.success||v.action!=='terra_contact'||v.hostname!==new URL(b.origin).hostname)return reply(403,{error:'Verificação inválida ou expirada.'});
  }
  // Optional account attribution comes from Auth, never from a body user ID.
  let user=null;const bearer=req.headers.get('authorization');
  if(bearer?.startsWith('Bearer eyJ')){const r=await fetch(project+'/auth/v1/user',{headers:{apikey:key('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY'),Authorization:bearer},signal:AbortSignal.timeout(10000)});if(r.ok){const u=await r.json();if(UUID.test(u.id||''))user=u.id;}}
  const result=await rpc('terra_contact_deliver',{p_listing:b.listing||null,p_owner:b.owner||null,p_session:b.session,p_user:user});
  if(!/^55\d{10,11}$/.test(result.phone||''))return reply(404,{error:'WhatsApp indisponível.'});
  return reply(200,{url:'https://wa.me/'+result.phone,listing_id:result.listing_id});
 }catch(_){return reply(503,{error:'Não foi possível abrir o contato agora. Tente novamente.'});}
});
