const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('dist/data.js','utf8');
const valid={title:'Terreno de teste',description:'',city:'Juiz de Fora',state:'MG',neighborhood:'',category:'residencial',price_brl:'100000',status:'draft',boundary_geojson:{type:'Polygon',coordinates:[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}};
function setup({configured=true,key='sb_publishable_test',updateRow={id:'own'},insertError=null,providers={google:true},oauthError=null}={}){
 const calls=[],authCalls=[];let inserted,updated;
 const query={eq(...a){calls.push(['eq',...a]);return this},select(){return this},order(...a){calls.push(['order',...a]);return this},ilike(...a){calls.push(['ilike',...a]);return this},lte(...a){calls.push(['lte',...a]);return this},gte(...a){calls.push(['gte',...a]);return this},range(){return Promise.resolve({data:[],count:0,error:null})},single(){return Promise.resolve({data:{id:'own'},error:insertError})},maybeSingle(){return Promise.resolve({data:updateRow,error:null})},insert(data){inserted=data;return this},update(data){updated=data;return this}};
 const client={auth:{signInWithOAuth:async x=>{authCalls.push(x);return {data:{url:'https://example.supabase.co/auth/v1/authorize'},error:oauthError}},signUp:async x=>{authCalls.push(x);return {data:{},error:null}},signInWithPassword:async x=>{authCalls.push(x);return {data:{},error:null}},resetPasswordForEmail:async(email,options)=>{authCalls.push({email,options});return {data:{},error:null}},getUser:async()=>({data:{user:{id:'user-a'}},error:null})},from(name){calls.push(['from',name]);return query}};
 const ctx={URL,AbortSignal,fetch:async()=>({ok:true,json:async()=>({external:providers})}),window:{TERRA_CONFIG:configured?{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:key}:{},location:{href:'https://example.com/',assign:url=>authCalls.push({redirect:url})},supabase:{createClient(){return client}}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {api:ctx.window.TerraData,calls,authCalls,get inserted(){return inserted},get updated(){return updated}};
}
test('save sends only editable fields; forged owner, area, dates and revision are discarded',async()=>{
 const s=setup();await s.api.save({...valid,owner_id:'victim',area_m2:1,created_at:'2000-01-01',revision:99},{id:'new'});
 assert.equal(s.inserted.id,'new');for(const key of ['owner_id','area_m2','created_at','revision'])assert.equal(key in s.inserted,false);assert.equal(s.inserted.price_brl,100000);
});
test('updates require the signed-in owner and expected revision',async()=>{
 const s=setup();await s.api.save(valid,{id:'own',revision:3});assert.ok(s.calls.some(x=>x[0]==='eq'&&x[1]==='owner_id'&&x[2]==='user-a'));assert.ok(s.calls.some(x=>x[0]==='eq'&&x[1]==='revision'&&x[2]===3));
});
test('a stale or denied update never reports success',async()=>{const s=setup({updateRow:null});await assert.rejects(s.api.save(valid,{id:'own',revision:3}),/outra sessão/)});
test('invalid numeric prices are rejected before a write',async()=>{for(const price of ['NaN','Infinity',-1,0,1e20]){const s=setup();await assert.rejects(s.api.save({...valid,price_brl:price},{id:'new'}),/preço/);assert.equal(s.inserted,undefined)}});
test('private list is constrained to current owner',async()=>{const s=setup();await s.api.list({mine:true});assert.ok(s.calls.some(x=>x[1]==='owner_id'&&x[2]==='user-a'))});
test('public list is constrained to published listings',async()=>{const s=setup();await s.api.list();assert.ok(s.calls.some(x=>x[1]==='status'&&x[2]==='published'))});
test('a missing project does not silently save to browser memory',async()=>{const s=setup({configured:false});assert.equal(s.api.configured,false);await assert.rejects(s.api.save(valid,{id:'new'}),/preparação/)});
test('secret and legacy keys are rejected in the browser adapter',async()=>{for(const key of ['sb_secret_test','eyJlegacy']){const s=setup({key});await assert.rejects(s.api.save(valid,{id:'new'}),/revisada/);assert.equal(s.inserted,undefined)}});
test('ambiguous retry with same id reports existing record instead of creating another',async()=>{const s=setup({insertError:{code:'23505'}});await assert.rejects(s.api.save(valid,{id:'new'}),/já foi recebido/)});

test('CAPTCHA token is forwarded to signup, login and password reset',async()=>{
 const s=setup();await s.api.signUp('Tester','user@example.invalid','test-password','challenge-one');await s.api.login('user@example.invalid','test-password','challenge-two');await s.api.reset('user@example.invalid','challenge-three');
 assert.equal(s.authCalls[0].options.captchaToken,'challenge-one');assert.equal(s.authCalls[1].options.captchaToken,'challenge-two');assert.equal(s.authCalls[2].options.captchaToken,'challenge-three');
});

function photoSetup({failUpload=false,failCommit=false}={}) {
 const events=[];
 const existing=[{id:'old-photo',storage_path:'old.jpg',sort_order:11}];
 const storage={upload:async(path)=>{events.push(['upload',path]);return failUpload?{error:new Error('upload failed')}:{data:{path}}},remove:async(paths)=>{events.push(['remove',paths]);return {data:[]}}};
 const client={auth:{getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111'}}})},storage:{from:()=>storage},rpc:async(name,args)=>{events.push(['commit',args]);return failCommit?{error:{code:'42501'}}:{data:null}},from(name){
  const q={select(){return q},eq(){return q},insert(){return q},single:async()=>({data:{id:'22222222-2222-4222-8222-222222222222',revision:1}}),then(resolve){return Promise.resolve({data:existing}).then(resolve)}};return q;
 }};
 const ctx={URL,console,crypto:require('node:crypto').webcrypto,window:{TERRA_CONFIG:{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'sb_publishable_test'},supabase:{createClient:()=>client}}};
 vm.createContext(ctx);vm.runInContext(source,ctx);return {api:ctx.window.TerraData,events};
}
const photoFile={type:'image/jpeg',size:1024,name:'terreno.jpg'};
test('uploads before atomic metadata commit and removes old storage only after success',async()=>{
 const s=photoSetup();await s.api.syncPhotos('22222222-2222-4222-8222-222222222222',[photoFile],[]);
 assert.deepEqual(s.events.map(x=>x[0]),['upload','commit','remove']);
 assert.match(s.events[0][1],/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/);
 assert.equal(s.events[1][1].p_expected_ids[0],'old-photo');
});
test('failed uploads preserve the existing photo metadata and files',async()=>{
 const s=photoSetup({failUpload:true});await assert.rejects(s.api.syncPhotos('listing',[photoFile],[]),/upload failed/);
 assert.deepEqual(s.events.map(x=>x[0]),['upload']);
});
test('metadata rejection cleans only new uploads and reports the saved listing for recovery',async()=>{
 const s=photoSetup({failCommit:true});await assert.rejects(s.api.save(valid,{id:'new',files:[photoFile],photosChanged:true}),error=>Boolean(error.savedListing?.revision===1));
 assert.deepEqual(s.events.map(x=>x[0]),['upload','commit','remove']);
 assert.equal(s.events[2][1][0],s.events[0][1]);
});

test('authenticated public catalog never adds an owner filter',async()=>{
 const s=setup();await s.api.list();assert.ok(s.calls.some(x=>x[1]==='status'&&x[2]==='published'));assert.ok(!s.calls.some(x=>x[1]==='owner_id'));
});
test('social login buttons use only enabled supported providers',async()=>{
 const s=setup({providers:{google:true,azure:true,github:false,unknown:true}});assert.deepEqual(Array.from(await s.api.availableProviders()),['google','azure']);
});
test('Google OAuth redirects back to the site without asking for extra scopes',async()=>{
 const s=setup();await s.api.loginWithProvider('google');assert.equal(s.authCalls[0].provider,'google');assert.equal(s.authCalls[0].options.redirectTo,'https://example.com/');assert.equal(s.authCalls[0].options.scopes,undefined);assert.ok(s.authCalls[1].redirect);
});
test('OAuth errors do not redirect and unsupported providers are rejected',async()=>{
 const s=setup({oauthError:{message:'disabled'}});await assert.rejects(s.api.loginWithProvider('google'));assert.equal(s.authCalls.length,1);await assert.rejects(s.api.loginWithProvider('unknown'),/inválida/);
});

test('price and area ordering is applied on the server before paging with deterministic tie-break',async()=>{
 for(const [sort,column,ascending] of [['price_asc','price_brl',true],['price_desc','price_brl',false],['area_asc','area_m2',true],['area_desc','area_m2',false]]){
  const s=setup();await s.api.list({sort});const orders=s.calls.filter(x=>x[0]==='order');assert.equal(orders[0][1],column);assert.equal(orders[0][2].ascending,ascending);assert.equal(orders[1][1],'id');
 }
});
test('city search filters city/state without restricting the catalog to the logged-in owner',async()=>{
 const s=setup();await s.api.list({location:{cityLevel:true,city:'Juiz de Fora',state:'MG'}});assert.ok(s.calls.some(x=>x[0]==='ilike'&&x[1]==='city'&&x[2]==='Juiz de Fora'));assert.ok(s.calls.some(x=>x[1]==='state'&&x[2]==='MG'));assert.ok(!s.calls.some(x=>x[1]==='owner_id'));
});
test('address searches bound both latitude and longitude on the server',async()=>{
 const s=setup();await s.api.list({location:{bounds:{south:-22,north:-21,west:-44,east:-43}}});for(const [op,field,value] of [['gte','latitude',-22],['lte','latitude',-21],['gte','longitude',-44],['lte','longitude',-43]])assert.ok(s.calls.some(x=>x[0]===op&&x[1]===field&&x[2]===value));
});

test('incomplete drafts save without invented title, price, city or UF; publishing requires all four',async()=>{
 const draft={...valid,title:'',price_brl:'',city:'',state:''};const s=setup();await s.api.save(draft,{id:'new'});assert.equal(s.inserted.title,'');assert.equal(s.inserted.price_brl,null);assert.equal(s.inserted.city,'');assert.equal(s.inserted.state,'');
 for(const key of ['title','price_brl','city','state']){const x=setup();await assert.rejects(x.api.save({...valid,status:'published',[key]:''},{id:'new'}));assert.equal(x.inserted,undefined);}
});
test('all Brazilian UFs are accepted and unknown states are rejected',async()=>{
 for(const state of 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')){const s=setup();await s.api.save({...valid,state,status:'published'},{id:'new'});assert.equal(s.inserted.state,state);}
 const s=setup();await assert.rejects(s.api.save({...valid,state:'XX'},{id:'new'}),/UF/);
});
