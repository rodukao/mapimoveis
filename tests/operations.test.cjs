const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const uid='11111111-1111-4111-8111-111111111111',sid='22222222-2222-4222-8222-222222222222';
const jwt='e30.'+Buffer.from(JSON.stringify({sub:uid,session_id:sid})).toString('base64url')+'.signature';
function setup({auth=true,secret=true,verdict=true,storageError=false,prepareError=false}={}){
 let handler,remaining=true;const calls=[];
 const env={SUPABASE_URL:'https://project.example.invalid',SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'sb_publishable_test'}),SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_server'}),TURNSTILE_SECRET_KEY:secret?'private-turnstile':undefined,TERRA_ALLOWED_ORIGINS:'https://terra.example.invalid'};
 const context={Request,Response,URL,URLSearchParams,TextDecoder,Uint8Array,AbortSignal,atob,fetch:async(url,options)=>{
  const path=new URL(url).pathname,body=typeof options.body==='string'?JSON.parse(options.body):null;calls.push({path,body,headers:options.headers,method:options.method});
  if(path==='/auth/v1/user')return Response.json(auth?{id:uid}:{error:'invalid'},{status:auth?200:401});
  if(path.endsWith('/siteverify'))return Response.json({success:verdict,hostname:'terra.example.invalid',action:'terra_contact'});
  if(path.endsWith('/terra_grant_challenge'))return new Response(null,{status:204});
  if(path.endsWith('/terra_prepare_deletion'))return prepareError?Response.json({message:'Entre novamente na conta.'},{status:400}):Response.json({pending:true});
  if(path.endsWith('/terra_deletion_objects'))return Response.json(remaining?[{bucket_id:'terra-listing-photos',name:uid+'/photo.png'}]:[]);
  if(path.startsWith('/storage/')){if(storageError)return Response.json({error:'failed'},{status:503});remaining=false;return Response.json([]);}
  if(path.endsWith('/terra_finish_deletion'))return new Response(null,{status:204});
  if(path==='/auth/v1/admin/users/'+uid)return Response.json({});
  throw new Error('Unexpected path '+path);
 },Deno:{env:{get:k=>env[k]},serve:f=>{handler=f;}}};vm.createContext(context);vm.runInContext(fs.readFileSync('supabase/functions/terra-operations/index.ts','utf8'),context);
 return {calls,call:(body,authorization='Bearer '+jwt,origin='https://terra.example.invalid')=>handler(new Request('https://project.example.invalid/functions/v1/terra-operations',{method:'POST',headers:{authorization,origin},body:JSON.stringify(body)}))};
}
test('operations reject unauthenticated requests before privileged calls',async()=>{const s=setup({auth:false});assert.equal((await s.call({operation:'delete_account'})).status,401);assert.equal(s.calls.length,1);});
test('operations reject unauthorized origins and publishable keys used as bearer tokens',async()=>{const s=setup();assert.equal((await s.call({},'Bearer '+jwt,'https://attacker.example.invalid')).status,403);assert.equal((await s.call({},'Bearer sb_publishable_fake')).status,401);assert.equal(s.calls.length,0);});
test('challenge fails closed when its server secret is missing',async()=>{const s=setup({secret:false});assert.equal((await s.call({operation:'challenge',action:'contact',token:'token'})).status,503);assert.equal(s.calls.some(c=>c.path.endsWith('terra_grant_challenge')),false);});
test('invalid challenge cannot issue a database pass',async()=>{const s=setup({verdict:false});assert.equal((await s.call({operation:'challenge',action:'contact',token:'token'})).status,403);assert.equal(s.calls.some(c=>c.path.endsWith('terra_grant_challenge')),false);});
test('challenge uses the verified user and session, ignoring supplied target IDs',async()=>{const s=setup(),r=await s.call({operation:'challenge',action:'contact',token:'token',userId:'attacker'});assert.equal(r.status,200);const call=s.calls.find(c=>c.path.endsWith('terra_grant_challenge'));assert.equal(call.body.p_user,uid);assert.equal(call.body.p_session,sid);assert.equal((await r.text()).includes('sb_secret'),false);});
test('account deletion requires exact confirmation and a recent server-validated session',async()=>{const s=setup();assert.equal((await s.call({operation:'delete_account',confirmation:'yes'})).status,400);assert.equal(s.calls.some(c=>c.path.includes('/admin/users/')),false);const old=setup({prepareError:true});assert.equal((await old.call({operation:'delete_account',confirmation:'EXCLUIR MINHA CONTA'})).status,400);assert.equal(old.calls.some(c=>c.path.startsWith('/storage/')),false);});
test('failed storage deletion never deletes the Auth user or reports success',async()=>{const s=setup({storageError:true}),r=await s.call({operation:'delete_account',confirmation:'EXCLUIR MINHA CONTA'});assert.equal(r.status,503);assert.equal((await r.json()).pending,true);assert.equal(s.calls.some(c=>c.path.includes('/admin/users/')),false);});
test('deletion removes storage before account and only targets the verified user',async()=>{const s=setup(),r=await s.call({operation:'delete_account',confirmation:'EXCLUIR MINHA CONTA',userId:'attacker'});assert.equal(r.status,200);assert.equal((await r.json()).deleted,true);const paths=s.calls.map(c=>c.path);assert.ok(paths.findIndex(p=>p.startsWith('/storage/'))<paths.findIndex(p=>p.includes('/admin/users/')));for(const c of s.calls.filter(c=>c.body?.p_user))assert.equal(c.body.p_user,uid);});
