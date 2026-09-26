// Creates Stripe Checkout/Billing Portal sessions. The Stripe secret key never leaves
// this Edge runtime — the browser only ever receives a redirect URL.
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedOrigins=(Deno.env.get('TERRA_ALLOWED_ORIGINS')||'https://terramapa.danielleczfranco.chatgpt.site').split(',').map(x=>x.trim());
const headers={'Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
function key(jsonName,legacy){const value=Deno.env.get(jsonName);return (value?JSON.parse(value).default:null)||Deno.env.get(legacy);}
async function request(url,options={}){return fetch(url,{...options,signal:AbortSignal.timeout(15000)});}
function form(fields){const params=new URLSearchParams();const add=(key,value)=>{if(value===undefined||value===null)return;if(typeof value==='object')for(const [k,v] of Object.entries(value))add(key+'['+k+']',v);else params.append(key,String(value));};for(const [k,v] of Object.entries(fields))add(k,v);return params;}
Deno.serve(async req=>{
 const origin=req.headers.get('origin'),cors={...headers,...(origin&&allowedOrigins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})};
 const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:cors});
 if(origin&&!allowedOrigins.includes(origin))return reply(403,{error:'Origem não autorizada.'});
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply(405,{error:'Use POST.'});
 try{
  const project=Deno.env.get('SUPABASE_URL'),pub=key('SUPABASE_PUBLISHABLE_KEYS','SUPABASE_ANON_KEY'),secret=key('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
  const stripeKey=Deno.env.get('STRIPE_SECRET_KEY');
  const prices={plus:Deno.env.get('STRIPE_PRICE_PLUS'),pro:Deno.env.get('STRIPE_PRICE_PRO')};
  const boostPrice=Deno.env.get('STRIPE_PRICE_BOOST');
  if(!project||!pub||!secret||!stripeKey)return reply(503,{error:'Cobrança temporariamente indisponível.'});
  const bearer=req.headers.get('authorization')||'';if(!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(bearer))return reply(401,{error:'Entre novamente na sua conta.'});
  const checked=await request(project+'/auth/v1/user',{headers:{apikey:pub,Authorization:bearer}});if(!checked.ok)return reply(401,{error:'Entre novamente na sua conta.'});
  const user=await checked.json();if(!UUID.test(user.id||''))return reply(401,{error:'Sessão inválida.'});
  const body=await req.json().catch(()=>({}));
  const adminHeaders={apikey:secret,'Content-Type':'application/json',...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{})};
  const rpc=async(name,args)=>{const r=await request(project+'/rest/v1/rpc/'+name,{method:'POST',headers:adminHeaders,body:JSON.stringify(args)});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.message||'Não foi possível concluir a operação.');}return r.status===204?null:r.json();};
  const stripeHeaders={Authorization:'Basic '+btoa(stripeKey+':'),'Content-Type':'application/x-www-form-urlencoded'};
  const stripe=async(path,fields)=>{const r=await request('https://api.stripe.com/v1/'+path,{method:'POST',headers:stripeHeaders,body:form(fields)});const data=await r.json();if(!r.ok)throw new Error(data.error?.message||'Não foi possível falar com o provedor de pagamento.');return data;};
  const origin2=(origin&&allowedOrigins.includes(origin))?origin:allowedOrigins[0];

  if(body.operation==='checkout_subscription'){
   if(!['plus','pro'].includes(body.plan)||!prices[body.plan])return reply(400,{error:'Plano inválido.'});
   const session=await stripe('checkout/sessions',{
    mode:'subscription',
    line_items:{'0':{price:prices[body.plan],quantity:1}},
    customer_email:user.email,
    client_reference_id:user.id,
    metadata:{supabase_user_id:user.id,plan:body.plan},
    subscription_data:{metadata:{supabase_user_id:user.id,plan:body.plan}},
    success_url:origin2+'/?checkout=success',
    cancel_url:origin2+'/?checkout=cancel'
   });
   return reply(200,{url:session.url});
  }

  if(body.operation==='checkout_boost'){
   if(!UUID.test(body.listingId||''))return reply(400,{error:'Anúncio inválido.'});
   if(!boostPrice)return reply(503,{error:'Impulsionamento temporariamente indisponível.'});
   const listingRes=await request(project+'/rest/v1/terra_listings?id=eq.'+body.listingId+'&select=id,owner_id,status',{headers:adminHeaders});
   const rows=await listingRes.json();const listing=rows[0];
   if(!listing||listing.owner_id!==user.id||!['published','reserved','paused'].includes(listing.status))return reply(403,{error:'Este anúncio não pode ser impulsionado agora.'});
   const session=await stripe('checkout/sessions',{
    mode:'payment',
    line_items:{'0':{price:boostPrice,quantity:1}},
    client_reference_id:user.id,
    metadata:{kind:'boost',supabase_user_id:user.id,listing_id:body.listingId},
    success_url:origin2+'/?boost=success',
    cancel_url:origin2+'/?boost=cancel'
   });
   return reply(200,{url:session.url});
  }

  if(body.operation==='billing_portal'){
   const customer=await rpc('terra_billing_customer',{p_user:user.id});
   if(!customer)return reply(404,{error:'Você ainda não tem uma assinatura ativa.'});
   const session=await stripe('billing_portal/sessions',{customer,return_url:origin2+'/?checkout=portal_return'});
   return reply(200,{url:session.url});
  }

  return reply(400,{error:'Operação inválida.'});
 }catch(error){return reply(400,{error:error instanceof Error?error.message:'Não foi possível concluir.'});}
});
