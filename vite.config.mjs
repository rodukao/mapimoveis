import {defineConfig,loadEnv} from 'vite';
import fs from 'node:fs';

// Development/QA only. Production continues to serve the authored dist files.
export default defineConfig(({mode})=>{
  const env={...loadEnv(mode,process.cwd(),'E2E_'),...process.env};
  return {
    root:'dist',
    server:{host:'0.0.0.0',allowedHosts:['terminal.local']},
    plugins:[{
      name:'terra-qa',
      configureServer(server){server.middlewares.use((req,res,next)=>{
        const url=new URL(req.url,'http://localhost');
        if(['/profissionais','/privacidade','/termos'].includes(url.pathname)){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(new URL('./dist'+url.pathname+'/index.html',import.meta.url)));return;}
        if(url.pathname==='/__qa__/feedback'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(new URL('./tests/fixtures/pilot-feedback.html',import.meta.url)));return;}
        if(url.pathname==='/__qa__/production'){
          const workerPath=new URL('./dist/server/index.js',import.meta.url);
          if(!fs.existsSync(workerPath)){res.statusCode=503;res.end('Execute npm run build antes do QA.');return;}
          import('data:text/javascript;base64,'+fs.readFileSync(workerPath).toString('base64')).then(async({default:worker})=>{const response=await worker.fetch(new Request('https://qa.invalid/'));res.setHeader('Content-Type','text/html; charset=utf-8');res.end((await response.text()).replace('<head>','<head><base href="/">'));}).catch(()=>{res.statusCode=500;res.end('Falha no build de QA.');});return;
        }
        if(url.pathname==='/__qa__/viewport'){
          const sizes={'360x800':[360,800],'390x844':[390,844],'412x915':[412,915],'844x390':[844,390],'1366x768':[1366,768],'1920x1080':[1920,1080]};
          const size=sizes[url.searchParams.get('size')]||sizes['360x800'];
          const src=url.searchParams.get('view')==='feedback'?'/__qa__/feedback':url.searchParams.get('view')==='professionals'?'/profissionais':'/__qa__/production';
          res.setHeader('Content-Type','text/html; charset=utf-8');
          res.end(`<!doctype html><html lang="pt-BR"><title>TerraMapa — QA de viewport</title><body style="margin:0;background:#ddd"><iframe title="TerraMapa ${size.join('×')}" src="${src}" width="${size[0]}" height="${size[1]}" style="display:block;border:0"></iframe></body></html>`);return;
        }
        if(url.pathname==='/config.js'&&env.E2E_SUPABASE_URL){
          if(!env.E2E_SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')){
            res.statusCode=500;res.end('throw new Error("Configure a chave publicável do staging.");');return;
          }
          const config={supabaseUrl:env.E2E_SUPABASE_URL,supabasePublishableKey:env.E2E_SUPABASE_PUBLISHABLE_KEY,geocoding:{photonUrl:'https://photon.komoot.io/api/'},captcha:{enabled:true,provider:'turnstile',siteKey:env.E2E_TURNSTILE_SITE_KEY||''}};
          res.setHeader('Content-Type','text/javascript');res.end('window.TERRA_CONFIG='+JSON.stringify(config)+';');return;
        }
        next();
      });}
    }]
  };
});
