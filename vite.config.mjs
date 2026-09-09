import {defineConfig,loadEnv} from 'vite';

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
        if(url.pathname==='/__qa__/viewport'){
          const sizes={'360x800':[360,800],'390x844':[390,844],'412x915':[412,915],'844x390':[844,390]};
          const size=sizes[url.searchParams.get('size')]||sizes['360x800'];
          res.setHeader('Content-Type','text/html; charset=utf-8');
          res.end(`<!doctype html><html lang="pt-BR"><title>Terra — QA de viewport</title><body style="margin:0;background:#ddd"><iframe title="Terra ${size.join('×')}" src="/" width="${size[0]}" height="${size[1]}" style="display:block;border:0"></iframe></body></html>`);return;
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
