const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),{webcrypto}=require('node:crypto');
const secret='whsec_test_secret';
function sign(payload,timestamp=Math.floor(Date.now()/1000)){
 const mac=crypto.createHmac('sha256',secret).update(timestamp+'.'+payload).digest('hex');
 return {header:`t=${timestamp},v1=${mac}`,timestamp};
}
function setup({webhookSecret=true,seen=false,prices=true}={}){
 let handler;const calls=[];
 const env={SUPABASE_URL:'https://project.example.invalid',SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_server'}),STRIPE_WEBHOOK_SECRET:webhookSecret?secret:undefined,STRIPE_PRICE_PLUS:prices?'price_plus':undefined,STRIPE_PRICE_PRO:prices?'price_pro':undefined};
 const context={Request,Response,URL,URLSearchParams,TextEncoder,Uint8Array,AbortSignal,crypto:webcrypto,
  fetch:async(url,options)=>{
   const u=new URL(url);const body=options?.body?JSON.parse(options.body):null;calls.push({path:u.pathname,body});
   if(u.pathname==='/rest/v1/rpc/terra_stripe_event_seen')return Response.json(!seen);
   if(u.pathname.startsWith('/rest/v1/rpc/terra_'))return new Response(null,{status:204});
   throw new Error('Unexpected path '+u.pathname);
  },
  Deno:{env:{get:k=>env[k]},serve:f=>{handler=f;}}
 };vm.createContext(context);vm.runInContext(fs.readFileSync('supabase/functions/terra-billing-webhook/index.ts','utf8'),context);
 return {calls,call:(payload,header)=>handler(new Request('https://project.example.invalid/functions/v1/terra-billing-webhook',{method:'POST',headers:{'stripe-signature':header},body:payload}))};
}
function event(type,object,id='evt_1'){return JSON.stringify({id,type,data:{object}});}

test('fails closed without a configured webhook secret, never attempts verification',async()=>{
 const s=setup({webhookSecret:false});const payload=event('customer.subscription.updated',{});
 const r=await s.call(payload,sign(payload).header);assert.equal(r.status,503);assert.equal(s.calls.length,0);
});
test('rejects a tampered payload (signature no longer matches)',async()=>{
 const s=setup();const payload=event('customer.subscription.updated',{});const {header}=sign(payload);
 const r=await s.call(payload+' ',header);assert.equal(r.status,400);assert.equal(s.calls.length,0);
});
test('rejects a stale timestamp outside the 5-minute tolerance',async()=>{
 const s=setup();const payload=event('customer.subscription.updated',{});const {header}=sign(payload,Math.floor(Date.now()/1000)-400);
 const r=await s.call(payload,header);assert.equal(r.status,400);assert.equal(s.calls.length,0);
});
test('duplicate event id is acknowledged but not reapplied',async()=>{
 const s=setup({seen:true});const payload=event('customer.subscription.updated',{metadata:{supabase_user_id:'u1'}});const {header}=sign(payload);
 const r=await s.call(payload,header);assert.equal(r.status,200);assert.equal((await r.json()).duplicate,true);
 assert.equal(s.calls.some(c=>c.path.endsWith('terra_sync_subscription')),false);
});
test('valid subscription update syncs plan from the price id and forwards status/period',async()=>{
 const s=setup();
 const payload=event('customer.subscription.updated',{id:'sub_1',customer:'cus_1',status:'active',current_period_end:1893456000,cancel_at_period_end:false,metadata:{supabase_user_id:'u1'},items:{data:[{price:{id:'price_pro'}}]}});
 const {header}=sign(payload);const r=await s.call(payload,header);assert.equal(r.status,200);
 const call=s.calls.find(c=>c.path.endsWith('terra_sync_subscription'));assert.ok(call);
 assert.equal(call.body.p_user,'u1');assert.equal(call.body.p_plan,'pro');assert.equal(call.body.p_status,'active');assert.equal(call.body.p_subscription,'sub_1');
});
test('subscription without a supabase_user_id metadata tag is acknowledged without syncing',async()=>{
 const s=setup();const payload=event('customer.subscription.updated',{id:'sub_2',items:{data:[{price:{id:'price_plus'}}]}});const {header}=sign(payload);
 const r=await s.call(payload,header);assert.equal(r.status,200);assert.equal(s.calls.some(c=>c.path.endsWith('terra_sync_subscription')),false);
});
test('subscription cancellation resets the plan to basica',async()=>{
 const s=setup();const payload=event('customer.subscription.deleted',{id:'sub_1',customer:'cus_1',metadata:{supabase_user_id:'u1'}});const {header}=sign(payload);
 await s.call(payload,header);const call=s.calls.find(c=>c.path.endsWith('terra_sync_subscription'));assert.equal(call.body.p_plan,'basica');assert.equal(call.body.p_status,'canceled');
});
test('boost checkout completion applies the boost with the paid amount',async()=>{
 const s=setup();
 const payload=event('checkout.session.completed',{id:'cs_1',mode:'payment',payment_intent:'pi_1',amount_total:1490,metadata:{kind:'boost',supabase_user_id:'u1',listing_id:'l1'}});
 const {header}=sign(payload);const r=await s.call(payload,header);assert.equal(r.status,200);
 const call=s.calls.find(c=>c.path.endsWith('terra_apply_boost'));assert.ok(call);
 assert.equal(call.body.p_user,'u1');assert.equal(call.body.p_listing,'l1');assert.equal(call.body.p_amount,14.9);
});
test('unhandled event types are acknowledged without calling any RPC',async()=>{
 const s=setup();const payload=event('payment_intent.created',{});const {header}=sign(payload);
 const r=await s.call(payload,header);assert.equal(r.status,200);assert.equal((await r.json()).ignored,'payment_intent.created');
 assert.equal(s.calls.length,1); // only the dedupe check
});
