const {defineConfig}=require('@playwright/test');
if(require('node:fs').existsSync('.env.e2e'))process.loadEnvFile('.env.e2e');
const baseURL=process.env.E2E_BASE_URL||'http://127.0.0.1:4173';
const remote=Boolean(process.env.E2E_BASE_URL);
module.exports=defineConfig({
  testDir:'tests/e2e',timeout:45000,expect:{timeout:12000},fullyParallel:false,workers:1,
  retries:0,forbidOnly:!!process.env.CI,
  reporter:[['list'],['html',{open:'never'}],['json',{outputFile:'test-results/results.json'}]],
  use:{baseURL,locale:'pt-BR',timezoneId:'America/Sao_Paulo',screenshot:'only-on-failure',trace:'off',actionTimeout:12000},
  webServer:remote?undefined:{command:'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',url:baseURL,reuseExistingServer:!process.env.CI},
  projects:[
    {name:'desktop-chromium',use:{browserName:'chromium',viewport:{width:1440,height:900}}},
    ...[[360,800],[390,844],[412,915],[844,390]].map(([width,height])=>({name:`mobile-${width}x${height}`,use:{browserName:'chromium',viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1}})),
    {name:'mobile-webkit-390x844',use:{browserName:'webkit',viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}}
  ]
});
