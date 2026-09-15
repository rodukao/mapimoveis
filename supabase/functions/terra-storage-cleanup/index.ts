// Scheduled server-to-server call. Never expose the service key in the browser.
Deno.serve(async request=>{
 const reply=(status,value)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 const keys=Deno.env.get('SUPABASE_SECRET_KEYS'),secret=(keys?JSON.parse(keys).default:null)||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const supplied=request.headers.get('apikey');
 if(!secret||!supplied||supplied!==secret)return reply(401,{error:'Unauthorized'});
 if(request.method!=='POST')return reply(405,{error:'Use POST'});
 const project=Deno.env.get('SUPABASE_URL'),headers={apikey:secret,'Content-Type':'application/json',...(secret.startsWith('eyJ')?{Authorization:'Bearer '+secret}:{})};
 try{
  const body=await request.text();if(body.length>100)return reply(400,{error:'Invalid request'});const dryRun=JSON.parse(body||'{}').dryRun!==false;
  const result=await fetch(project+'/rest/v1/rpc/terra_claim_orphan_objects',{method:'POST',headers,body:JSON.stringify({p_dry_run:dryRun}),signal:AbortSignal.timeout(15000)});if(!result.ok)throw new Error('Could not claim candidates');
  const objects=await result.json();let deleted=0;
  if(!dryRun)for(const object of objects){const response=await fetch(project+'/storage/v1/object/'+encodeURIComponent(object.bucket_id),{method:'DELETE',headers,body:JSON.stringify({prefixes:[object.name]}),signal:AbortSignal.timeout(15000)});if(!response.ok)return reply(503,{deleted,pending:true,error:'Storage cleanup interrupted; retry next run'});deleted++;}
  return reply(200,{dryRun,candidates:objects.length,deleted});
 }catch(_){return reply(503,{error:'Cleanup temporarily unavailable'});}
});
