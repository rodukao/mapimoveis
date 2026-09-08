const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup({row={id:'listing',revision:2},contactError=null}={}){
 const calls=[];const client={storage:{from:()=>({})},rpc:async(name,args)=>{calls.push(['rpc',name,args]);return {data:{rows:[],total:0}};},from(name){calls.push(['from',name]);const q={};for(const method of ['select','eq','in','order','limit','range','update','insert','delete','neq','gte','lte','ilike'])q[method]=(...args)=>{calls.push([method,name,...args]);return q;};q.maybeSingle=async()=>({data:row});q.then=fn=>Promise.resolve(name==='terra_contact_settings'&&contactError?{error:contactError}:{data:[{user_id:'user-a'}]}).then(fn);return q;}};
 const R={db:()=>client,user:async()=>({id:'user-a'}),unwrap:result=>{if(result.error)throw result.error;return result.data;},hydratePhotos:async rows=>rows,listFields:'id,photos'};
 const context={window:{TerraRepository:R},URL};vm.createContext(context);vm.runInContext(fs.readFileSync('dist/js/repository/marketplace.js','utf8'),context);return {api:context.window.TerraMarketData,calls};
}
test('marketplace empty results remain empty and filters and pagination reach one server query',async()=>{
 const s=setup(),filters={city:'Juiz de Fora',minArea:500,maxPrice:300000,polygon:{type:'Polygon',coordinates:[]}};const result=await s.api.search(filters,'area_desc',50,false);assert.equal(result.rows.length,0);assert.equal(result.total,0);const call=s.calls.find(c=>c[0]==='rpc');assert.equal(call[1],'terra_search_listings');assert.equal(call[2].p_offset,50);assert.equal(call[2].p_mine,false);assert.equal(call[2].p_filters,filters);
});
test('invalid deep links do not query the database',async()=>{const s=setup();for(const id of ['wrong','123','\" or true',''])assert.equal(await s.api.get(id),null);assert.equal(s.calls.length,0)});
test('a status change checks owner and revision and rejects unavailable records',async()=>{
 const s=setup({row:null});await assert.rejects(s.api.status({id:'listing',revision:7},'sold'),/outra sessão/);assert.ok(s.calls.some(c=>c[0]==='eq'&&c[2]==='owner_id'&&c[3]==='user-a'));assert.ok(s.calls.some(c=>c[0]==='eq'&&c[2]==='revision'&&c[3]===7));assert.equal(s.calls.find(c=>c[0]==='update')[2].status,'sold');await assert.rejects(s.api.status({id:'listing'},'unexpected'),/inválida/);
});
test('favorite and report inserts leave identity and timestamps to the database',async()=>{
 const s=setup();await s.api.favorite('listing',true);await s.api.report('listing','wrong_location','Descrição');for(const call of s.calls.filter(c=>c[0]==='insert')){assert.equal('user_id' in call[2],false);assert.equal('created_at' in call[2],false);assert.equal('status' in call[2],false);}
});
test('Brazilian WhatsApp normalizes DDD 55 without mistaking it for a country code',async()=>{
 const s=setup();await s.api.saveProfile({display_name:'Teste',city:'Santa Maria',account_type:'particular',phone:'55 99999-1234',enabled:true});const update=s.calls.find(c=>c[0]==='update'&&c[1]==='terra_contact_settings');assert.equal(update[2].phone,'5555999991234');
});
test('contact failure does not falsely claim that the entire profile was saved',async()=>{
 const s=setup({contactError:{code:'42501'}});await assert.rejects(s.api.saveProfile({display_name:'Teste',city:'JF',account_type:'particular',phone:'32 99999-1234',enabled:true}),/Perfil salvo, mas o WhatsApp não foi atualizado/);
});
