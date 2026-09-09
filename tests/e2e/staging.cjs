const fs=require('node:fs');
const {expect}=require('@playwright/test');
const productionRef='pkofzhlcbqupanzydyyf';
function readiness(){
  const url=process.env.E2E_SUPABASE_URL;
  if(!url||url.includes(productionRef)||process.env.E2E_ALLOW_WRITES!=='staging')return 'Configure um Supabase de staging diferente da produção e E2E_ALLOW_WRITES=staging.';
  for(const who of ['A','B'])if(!process.env['E2E_STATE_'+who]||!fs.existsSync(process.env['E2E_STATE_'+who]))return 'Faltam sessões reais das contas de teste A/B, criadas manualmente no staging.';
  return '';
}
async function signedPage(browser,baseURL,who,use={}){
  const context=await browser.newContext({viewport:use.viewport,isMobile:use.isMobile,hasTouch:use.hasTouch,storageState:process.env['E2E_STATE_'+who],baseURL});
  await context.route('**://'+productionRef+'.supabase.co/**',route=>route.abort('blockedbyclient'));
  const page=await context.newPage();await page.goto('/');
  const config=await page.evaluate(()=>({url:window.TERRA_CONFIG.supabaseUrl,key:window.TERRA_CONFIG.supabasePublishableKey}));
  expect(config.url,'A página precisa apontar para o staging autorizado').toBe(process.env.E2E_SUPABASE_URL);
  expect(config.url).not.toContain(productionRef);await expect(page.locator('#account')).toHaveText('Minha conta');
  return {context,page,config};
}
const boundary={type:'Polygon',coordinates:[[[-43.5,-21.8],[-43.499,-21.8],[-43.499,-21.799],[-43.5,-21.8]]]};
const file={name:'qa-terreno.geojson',mimeType:'application/geo+json',buffer:Buffer.from(JSON.stringify(boundary))};
async function drawImport(page){await page.locator('#boundary-method').selectOption('import');await page.locator('.boundary-tools input[type=file]').setInputFiles(file);await expect(page.locator('.boundary-tools')).toContainText('Arquivo importado com sucesso');}
async function ownApi(context,config,path,method,data){
  const ref=new URL(config.url).hostname.split('.')[0],state=await context.storageState();
  const tokenItem=state.origins.flatMap(o=>o.localStorage).find(x=>x.name==='sb-'+ref+'-auth-token');
  if(!tokenItem)throw new Error('Sessão de staging ausente; entre novamente.');
  const token=JSON.parse(tokenItem.value).access_token;
  return context.request.fetch(config.url+'/rest/v1/'+path,{method,data,headers:{apikey:config.key,Authorization:'Bearer '+token,Prefer:'return=representation'}});
}
module.exports={readiness,signedPage,drawImport,ownApi,file,boundary};
