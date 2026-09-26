const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const uid='11111111-1111-4111-8111-111111111111';
const jwt='e30.'+Buffer.from(JSON.stringify({sub:uid})).toString('base64url')+'.signature';
function setup({auth=true,stripeKey=true,prices=true,listingOwner=uid,listingStatus='published',customer='cus_123'}={}){
 let handler;const calls=[];
 const env={SUPABASE_URL:'https://project.example.invalid',SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'sb_publishable_test'}),SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_server'}),TERRA_ALLOWED_ORIGINS:'https://terra.example.invalid',STRIPE_SECRET_KEY:stripeKey?'sk_test_x':undefined,STRIPE_PRICE_PLUS:prices?'price_plus':undefined,STRIPE_PRICE_PRO:prices?'price_pro':undefined,STRIPE_PRICE_BOOST:prices?'price_boost':undefined};
 const context={Request,Response,URL,URLSearchParams,TextDecoder,Uint8Array,AbortSignal,btoa,
  fetch:async(url,options)=>{
   const u=new URL(url);calls.push({path:u.pathname,body:options?.body,method:options?.method});
   if(u.pathname==='/auth/v1/user')return Response.json(auth?{id:uid,email:'user@example.invalid'}:{error:'invalid'},{status:auth?200:401});
   if(u.pathname==='/rest/v1/terra_listings')return Response.json([{id:'listing-1',owner_id:listingOwner,status:listingStatus}]);
   if(u.pathname==='/rest/v1/rpc/terra_billing_customer')return Response.json(customer);
   if(u.pathname==='/v1/checkout/sessions')return Response.json({url:'https://checkout.stripe.com/session/abc'});
   if(u.pathname==='/v1/billing_portal/sessions')return Response.json({url:'https://billing.stripe.com/portal/abc'});
   throw new Error('Unexpected path '+u.pathname);
  },
  Deno:{env:{get:k=>env[k]},serve:f=>{handler=f;}}
 };vm.createContext(context);vm.runInContext(fs.readFileSync('supabase/functions/terra-billing/index.ts','utf8'),context);
 return {calls,call:(body,authorization='Bearer '+jwt,origin='https://terra.example.invalid')=>handler(new Request('https://project.example.invalid/functions/v1/terra-billing',{method:'POST',headers:{authorization,origin,'content-type':'application/json'},body:JSON.stringify(body)}))};
}
test('fails closed without Stripe secret configured',async()=>{const s=setup({stripeKey:false});assert.equal((await s.call({operation:'checkout_subscription',plan:'plus'})).status,503);assert.equal(s.calls.length,0);});
test('rejects unauthenticated requests before any privileged call',async()=>{const s=setup({auth:false});assert.equal((await s.call({operation:'checkout_subscription',plan:'plus'})).status,401);assert.equal(s.calls.length,1);});
test('rejects unauthorized origins',async()=>{const s=setup();assert.equal((await s.call({},'Bearer '+jwt,'https://attacker.example.invalid')).status,403);assert.equal(s.calls.length,0);});
test('unknown operation is rejected',async()=>{const s=setup();assert.equal((await s.call({operation:'delete_everything'})).status,400);});
test('checkout_subscription rejects an invalid plan',async()=>{const s=setup();assert.equal((await s.call({operation:'checkout_subscription',plan:'ultra'})).status,400);assert.equal(s.calls.some(c=>c.path==='/v1/checkout/sessions'),false);});
test('checkout_subscription creates a subscription-mode session with the right price and metadata',async()=>{
 const s=setup();const r=await s.call({operation:'checkout_subscription',plan:'pro'});assert.equal(r.status,200);
 assert.equal((await r.json()).url,'https://checkout.stripe.com/session/abc');
 const call=s.calls.find(c=>c.path==='/v1/checkout/sessions');const body=new URLSearchParams(call.body);
 assert.equal(body.get('mode'),'subscription');assert.equal(body.get('line_items[0][price]'),'price_pro');assert.equal(body.get('metadata[supabase_user_id]'),uid);
});
test('checkout_boost rejects a listing the caller does not own',async()=>{const s=setup({listingOwner:'someone-else'});const r=await s.call({operation:'checkout_boost',listingId:'11111111-1111-4111-8111-111111111112'});assert.equal(r.status,403);assert.equal(s.calls.some(c=>c.path==='/v1/checkout/sessions'),false);});
test('checkout_boost rejects a draft listing',async()=>{const s=setup({listingStatus:'draft'});const r=await s.call({operation:'checkout_boost',listingId:'11111111-1111-4111-8111-111111111112'});assert.equal(r.status,403);});
test('checkout_boost creates a payment-mode session for an eligible listing',async()=>{
 const s=setup();const r=await s.call({operation:'checkout_boost',listingId:'11111111-1111-4111-8111-111111111112'});assert.equal(r.status,200);
 const call=s.calls.find(c=>c.path==='/v1/checkout/sessions');const body=new URLSearchParams(call.body);
 assert.equal(body.get('mode'),'payment');assert.equal(body.get('line_items[0][price]'),'price_boost');assert.equal(body.get('metadata[kind]'),'boost');
});
test('billing_portal requires an existing Stripe customer',async()=>{const s=setup({customer:null});const r=await s.call({operation:'billing_portal'});assert.equal(r.status,404);assert.equal(s.calls.some(c=>c.path==='/v1/billing_portal/sessions'),false);});
test('billing_portal opens a session for the stored customer',async()=>{const s=setup();const r=await s.call({operation:'billing_portal'});assert.equal(r.status,200);const call=s.calls.find(c=>c.path==='/v1/billing_portal/sessions');assert.equal(new URLSearchParams(call.body).get('customer'),'cus_123');});
