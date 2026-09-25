// Called directly by Stripe, never by the browser — no CORS handling needed (Stripe
// never sends an Origin header). Trust comes from verifying Stripe-Signature, not from
// an allowlisted origin, matching terra-storage-cleanup's "external trusted system"
// shape rather than terra-operations'/terra-billing's browser-facing shape.
function key(jsonName,legacy){const value=Deno.env.get(jsonName);return (value?JSON.parse(value).default:null)||Deno.env.get(legacy);}
async function request(url,options={}){return fetch(url,{...options,signal:AbortSignal.timeout(15000)});}

// Hand-rolled HMAC-SHA256 verification instead of the Stripe SDK: this project has zero
// external dependencies in any Edge Function, and Stripe's webhook signature algorithm
// (HMAC-SHA256 over "{timestamp}.{rawBody}", hex-compared, 5-minute tolerance) is short,
// public and stable enough that a small audited implementation beats the sole exception
// to that rule.
async function verifyStripeSignature(rawBody,header,secret){
 const parts=Object.fromEntries((header||'').split(',').map(p=>p.split('=')));
 const timestamp=Number(parts.t);
 if(!timestamp||Math.abs(Date.now()/1000-timestamp)>300)throw new Error('Assinatura expirada.');
 const cryptoKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const mac=await crypto.subtle.sign('HMAC',cryptoKey,new TextEncoder().encode(parts.t+'.'+rawBody));
 const expected=Array.from(new Uint8Array(mac),b=>b.toString(16).padStart(2,'0')).join('');
 const given=parts.v1||'';
 if(expected.length!==given.length)throw new Error('Assinatura inválida.');
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^given.charCodeAt(i);
 if(diff!==0)throw new Error('Assinatura inválida.');
}

Deno.serve(async req=>{
 const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply(405,{error:'Use POST.'});
 const project=Deno.env.get('SUPABASE_URL'),secret=key('SUPABASE_SECRET_KEYS','SUPABASE_SERVICE_ROLE_KEY');
 const webhookSecret=Deno.env.get('STRIPE_WEBHOOK_SECRET');
 const pricePlus=Deno.env.get('STRIPE_PRICE_PLUS'),pricePro=Deno.env.get('STRIPE_PRICE_PRO');
 if(!project||!secret||!webhookSecret)return reply(503,{error:'Webhook temporariamente indisponível.'});
 const adminHeaders={apikey:secret,'Content-Type':'application/json',...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{})};
 const rpc=async(name,args)=>{const r=await request(project+'/rest/v1/rpc/'+name,{method:'POST',headers:adminHeaders,body:JSON.stringify(args)});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.message||'RPC failed');}return r.status===204?null:r.json();};
 try{
  const rawBody=await req.text();
  await verifyStripeSignature(rawBody,req.headers.get('stripe-signature'),webhookSecret);
  const event=JSON.parse(rawBody);
  if(typeof event.id!=='string')return reply(400,{error:'Evento inválido.'});
  const first=await rpc('terra_stripe_event_seen',{p_event_id:event.id});
  if(!first)return reply(200,{ok:true,duplicate:true});

  const obj=event.data?.object||{};
  if(event.type==='customer.subscription.created'||event.type==='customer.subscription.updated'){
   const userId=obj.metadata?.supabase_user_id;
   if(userId){
    const priceId=obj.items?.data?.[0]?.price?.id;
    const plan=priceId===pricePro?'pro':priceId===pricePlus?'plus':(obj.metadata?.plan||'plus');
    await rpc('terra_sync_subscription',{p_user:userId,p_customer:obj.customer||null,p_subscription:obj.id||null,p_plan:plan,p_status:obj.status||'active',p_period_end:obj.current_period_end?new Date(obj.current_period_end*1000).toISOString():null,p_cancel_at_period_end:!!obj.cancel_at_period_end});
   }
   return reply(200,{ok:true});
  }
  if(event.type==='customer.subscription.deleted'){
   const userId=obj.metadata?.supabase_user_id;
   if(userId)await rpc('terra_sync_subscription',{p_user:userId,p_customer:obj.customer||null,p_subscription:obj.id||null,p_plan:'basica',p_status:'canceled',p_period_end:obj.current_period_end?new Date(obj.current_period_end*1000).toISOString():null,p_cancel_at_period_end:false});
   return reply(200,{ok:true});
  }
  if(event.type==='checkout.session.completed'&&obj.mode==='payment'&&obj.metadata?.kind==='boost'){
   const {supabase_user_id,listing_id}=obj.metadata;
   if(supabase_user_id&&listing_id)await rpc('terra_apply_boost',{p_user:supabase_user_id,p_listing:listing_id,p_session:obj.id||null,p_payment_intent:obj.payment_intent||null,p_amount:(obj.amount_total||0)/100});
   return reply(200,{ok:true});
  }
  return reply(200,{ok:true,ignored:event.type});
 }catch(error){return reply(400,{error:error instanceof Error?error.message:'Assinatura inválida.'});}
});
