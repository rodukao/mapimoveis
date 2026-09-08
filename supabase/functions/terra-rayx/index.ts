// Only public listings may be sent to geographic providers. No service_role or user JWT.
// An anonymous RLS read and explicit public-status filter precede every cache read.
const cache=new Map(),inFlight=new Map();
const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,x-client-info,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
const response=(status,body)=>new Response(JSON.stringify(body),{status,headers});
const rad=x=>x*Math.PI/180;
function distance(a,b){const dlat=rad(a[0]-b[0]),dlng=rad(a[1]-b[1]);return 6371000*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dlat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dlng/2)**2)));}
async function readText(stream,max){const reader=stream.getReader(),decoder=new TextDecoder();let result='',size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();throw new Error('Resposta excedeu o limite.');}result+=decoder.decode(value,{stream:true});}return result+decoder.decode();}
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('Fonte indisponível.');return JSON.parse(await readText(r.body,2*1024*1024));}
function roadDistance(origin,geometry){
 const cos=Math.cos(rad(origin[0])),scale=111320,project=p=>[(p.lon-origin[1])*cos*scale,(p.lat-origin[0])*scale];let nearest=Infinity;
 for(let i=1;i<geometry.length;i++){const a=project(geometry[i-1]),b=project(geometry[i]),x=b[0]-a[0],y=b[1]-a[1],length=x*x+y*y,t=length?Math.max(0,Math.min(1,-(a[0]*x+a[1]*y)/length)):0;nearest=Math.min(nearest,Math.hypot(a[0]+t*x,a[1]+t*y));}
 return nearest;
}
async function analyze(plot){
 const origin=[plot.latitude,plot.longitude],result={distances:[],elevation:null,unavailable:[],sources:[]};
 const cityURL=new URL(Deno.env.get('PHOTON_URL') || 'https://photon.komoot.io/api/');cityURL.searchParams.set('q',plot.city+', '+plot.state+', Brasil');cityURL.searchParams.set('limit','5');cityURL.searchParams.set('lang','default');
 const vertices=plot.boundary_geojson.coordinates[0].slice(0,-1),step=Math.max(1,Math.ceil(vertices.length/8)),samples=vertices.filter((_,i)=>i%step===0).map(([lng,lat])=>[lat,lng]);samples.push(origin);
 const elevationURL=new URL(Deno.env.get('ELEVATION_URL') || 'https://api.opentopodata.org/v1/srtm90m');elevationURL.searchParams.set('locations',samples.map(p=>p.map(v=>v.toFixed(6)).join(',')).join('|'));
 const sources=await Promise.allSettled([json(cityURL),json(elevationURL)]);
 if(sources[0].status==='fulfilled'){
  const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const states={AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins'};
  const point=sources[0].value.features?.find(f=>f.properties?.countrycode==='BR'&&['city','town','village','municipality'].includes(f.properties?.osm_value)&&normalize(f.properties?.name)===normalize(plot.city)&&[normalize(states[plot.state]),normalize(plot.state)].includes(normalize(f.properties?.state)));
  if(point?.geometry?.coordinates){const c=point.geometry.coordinates,meters=distance(origin,[c[1],c[0]]);if(meters<200000){result.distances.push({label:'Referência central da cidade',meters});result.sources.push({name:'Photon / OpenStreetMap',url:'https://www.openstreetmap.org/copyright'});}}
 }
 if(!result.distances.length)result.unavailable.push('Referência central da cidade indisponível.');
 if(sources[1].status==='fulfilled'){
  const data=sources[1].value,values=data.results;
  if(data.status==='OK'&&Array.isArray(values)&&values.length===samples.length&&values.every(v=>Number.isFinite(v.elevation))){
   const heights=values.map(v=>v.elevation);let variation=0,length=0;
   // Sampling the perimeter is not a surface slope calculation. The UI labels it explicitly.
   for(let i=0;i<samples.length-2;i++){const d=distance(samples[i],samples[i+1]);if(d>=90){variation+=Math.abs(heights[i]-heights[i+1]);length+=d;}}
   result.elevation={min:Math.min(...heights),max:Math.max(...heights),slopePercent:length>0?variation/length*100:null,samples:heights.length};result.sources.push({name:'Open Topo Data / SRTM',url:'https://www.opentopodata.org/datasets/srtm/'});
  }
 }
 if(!result.elevation)result.unavailable.push('Dados de altitude indisponíveis.');
 // A public Overpass community instance must not become the backend of a commercial app.
 // Configure an instance operated for this project or a contracted compatible provider.
 const overpass=Deno.env.get('OVERPASS_URL');
 if(overpass){
  try{
   const url=new URL(overpass);if(url.protocol!=='https:')throw new Error('Use HTTPS.');
   const location=origin.map(n=>Number(n).toFixed(6)).join(',');
   const query=`[out:json][timeout:12][maxsize:16777216];(nwr(around:5000,${location})[amenity~"^(hospital|school)$"];nwr(around:5000,${location})[shop=supermarket];way(around:5000,${location})[highway~"^(motorway|trunk|primary)$"];way(around:300,${location})[highway];);out center geom 1000;`;
   const data=await json(url,{method:'POST',body:new URLSearchParams({data:query})});
   if(data.remark||!Array.isArray(data.elements)||data.elements.length>=1000)throw new Error('Resultado geográfico incompleto.');
   for(const [label,filter] of [['Hospital',e=>e.tags?.amenity==='hospital'],['Escola',e=>e.tags?.amenity==='school'],['Supermercado',e=>e.tags?.shop==='supermarket'],['Rodovia principal',e=>['motorway','trunk','primary'].includes(e.tags?.highway)],['Via mais próxima',e=>!!e.tags?.highway]]){
    let nearest=Infinity,roadType='';
    for(const element of data.elements.filter(filter)){
     const p=element.center||element,meters=element.geometry?.length>1?roadDistance(origin,element.geometry):Number.isFinite(p.lat)&&Number.isFinite(p.lon)?distance(origin,[p.lat,p.lon]):Infinity;
     if(meters<nearest){nearest=meters;roadType=element.tags?.surface || '';}
    }
    const radius=label==='Via mais próxima'?300:5000;
    if(Number.isFinite(nearest)&&nearest<=radius)result.distances.push({label,meters:nearest,...(label==='Via mais próxima'?{surface:roadType}:{})});else result.unavailable.push(label+': não encontrado na área consultada.');
   }
   result.sources.push({name:'OpenStreetMap',url:'https://www.openstreetmap.org/copyright'});
  }catch(_){result.unavailable.push('Serviços próximos e vias: fonte indisponível.');}
 }else result.unavailable.push('Serviços próximos e vias ainda sem fonte de dados ativa.');
 return result;
}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST')return response(405,{error:'Use POST.'});
 try{
  const text=await readText(req.body,512);if(text.length>200)return response(400,{error:'Requisição inválida.'});
  const {listingId}=JSON.parse(text);if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listingId || ''))return response(400,{error:'Terreno inválido.'});
  const project=Deno.env.get('SUPABASE_URL'),configuredKeys=Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  const publicKeys=configuredKeys?JSON.parse(configuredKeys):{},key=publicKeys.default || Object.values(publicKeys).find(value=>typeof value==='string'&&value.startsWith('sb_publishable_')) || Deno.env.get('SUPABASE_ANON_KEY');
  if(!project||!key)return response(503,{error:'Análise temporariamente indisponível.'});
  const query=new URL(project+'/rest/v1/terra_listings');query.searchParams.set('id','eq.'+listingId);query.searchParams.set('status','in.(published,reserved,sold)');query.searchParams.set('select','id,city,state,latitude,longitude,boundary_geojson,revision');
  const rows=await json(query,{headers:{apikey:key}});if(!Array.isArray(rows)||rows.length!==1)return response(404,{error:'A análise está disponível apenas para anúncios públicos.'});
  const plot=rows[0],cacheKey=plot.id+':'+plot.revision,cached=cache.get(cacheKey);
  if(cached&&cached.until>Date.now())return response(200,cached.data);
  if(inFlight.size>=3&&!inFlight.has(cacheKey))return response(429,{error:'Aguarde alguns segundos antes de consultar.'});
  if(!inFlight.has(cacheKey))inFlight.set(cacheKey,analyze(plot).finally(()=>inFlight.delete(cacheKey)));
  const data=await inFlight.get(cacheKey);cache.set(cacheKey,{until:Date.now()+6*3600000,data});if(cache.size>100)cache.delete(cache.keys().next().value);return response(200,data);
 }catch(_){return response(503,{error:'Não foi possível consultar os dados geográficos. Tente novamente.'});}
});
