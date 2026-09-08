const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function setup({missingElevation=false}={}){
 const id='11111111-1111-4111-8111-111111111111';let handler,allowed=true,dbCalls=0,sourceCalls=0;
 const plot={id,city:'Juiz de Fora',state:'MG',latitude:-21.762,longitude:-43.348,revision:1,boundary_geojson:{type:'Polygon',coordinates:[[[-43.349,-21.762],[-43.348,-21.762],[-43.348,-21.761],[-43.349,-21.762]]]}};
 const env={SUPABASE_URL:'https://database.example.invalid',SUPABASE_ANON_KEY:'public-test'};
 const context={Request,Response,URL,URLSearchParams,AbortSignal,TextDecoder,fetch:async(url,options)=>{
  const u=new URL(url);if(u.hostname==='database.example.invalid'){dbCalls++;assert.equal(options.headers.apikey,'public-test');return Response.json(allowed?[plot]:[]);}sourceCalls++;
  if(u.hostname==='photon.komoot.io')return Response.json({features:[{properties:{name:'Juiz de Fora',state:'Minas Gerais',countrycode:'BR',osm_value:'city'},geometry:{coordinates:[-43.347,-21.761]}}]});
  if(u.hostname==='api.opentopodata.org')return Response.json({status:'OK',results:u.searchParams.get('locations').split('|').map((_,i)=>({elevation:missingElevation?null:700+i}))});
  throw new Error('Unexpected source');
 },Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn;}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('supabase/functions/terra-rayx/index.ts','utf8'),context);
 return {call:(value=id)=>handler(new Request('https://edge.example.invalid',{method:'POST',body:JSON.stringify({listingId:value})})),deny:()=>{allowed=false;},get dbCalls(){return dbCalls},get sourceCalls(){return sourceCalls}};
}
test('Raio-X validates the id before any database or external request',async()=>{const s=setup();assert.equal((await s.call('invalid')).status,400);assert.equal(s.dbCalls,0);assert.equal(s.sourceCalls,0)});
test('cached geographic data remains behind the caller RLS read, including after logout',async()=>{
 const s=setup();const first=await s.call();assert.equal(first.status,200);const result=await first.json();assert.ok(result.elevation);assert.equal(result.distances.length,1);assert.equal(s.sourceCalls,2);assert.equal((await s.call()).status,200);assert.equal(s.sourceCalls,2);s.deny();assert.equal((await s.call()).status,404);assert.equal(s.sourceCalls,2);assert.equal(s.dbCalls,3);
});
test('missing elevation and POI providers produce explicit unavailability, never zero placeholders',async()=>{
 const s=setup({missingElevation:true}),result=await (await s.call()).json();assert.equal(result.elevation,null);assert.ok(result.unavailable.some(x=>x.includes('altitude')));assert.ok(result.unavailable.some(x=>x.includes('fonte de dados ativa')));assert.equal('score' in result,false);
});
