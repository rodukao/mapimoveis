const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),vm=require('node:vm');
async function worker(root){return (await import('data:text/javascript;base64,'+fs.readFileSync(path.join(root,'dist/server/index.js')).toString('base64'))).default;}
async function getVersion(w){return (await w.fetch(new Request('https://qa.invalid/version.json'))).json();}

test('every page and lazy module use the content version instead of the release label',async()=>{
 const w=await worker('.'),version=await getVersion(w);
 assert.match(version.assetVersion,/^[0-9a-f]{16}$/);assert.notEqual(version.assetVersion,version.version);
 for(const page of ['/','/profissionais','/privacidade','/termos']){
  const html=await (await w.fetch(new Request('https://qa.invalid'+page))).text();
  const urls=[...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css)\?[^" ]*)"/g)].map(m=>new URL(m[1],'https://qa.invalid'));
  assert.ok(urls.length>0);
  for(const url of urls)assert.equal(url.searchParams.get('v'),version.assetVersion);
 }
 const nodes=[],ctx={APP_BRAND:{version:version.version},TERRA_ASSET_VERSION:version.assetVersion,TERRA_BUNDLES:{account:['assets/account.js']},document:{createElement:()=>({}),head:{append:s=>{nodes.push(s);s.onload();}}},toast(){}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/js/lazy.js','utf8'),ctx);
 await ctx.TerraLazy.load('account');assert.equal(nodes[0].src,'/assets/account.js?v='+version.assetVersion);
 for(const suffix of ['', '?v='+version.version,'?v=old-build'])assert.match((await w.fetch(new Request('https://qa.invalid/assets/core.js'+suffix))).headers.get('cache-control'),/must-revalidate/);
});

test('changing filter code with the same release label changes the browser cache URL',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'terramapa-cache-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 for(const dir of ['dist','scripts','server'])fs.cpSync(dir,path.join(root,dir),{recursive:true,filter:source=>!/^dist\/(server|assets)(\/|$)/.test(source)});
 const run=(command,args)=>cp.execFileSync(command,args,{cwd:root,stdio:'pipe'});
 run('git',['init','--quiet']);run('git',['-c','user.name=Test','-c','user.email=test@example.invalid','commit','--quiet','--allow-empty','-m','Isolated cache regression fixture']);
 const build=()=>run(process.execPath,['scripts/build-site.cjs']);
 build();const first=await getVersion(await worker(root));
 build();assert.equal((await getVersion(await worker(root))).assetVersion,first.assetVersion);
 fs.appendFileSync(path.join(root,'dist/js/search/filters.js'),'\n// Changed filter layout, same release label.\n');
 build();const updated=await worker(root),second=await getVersion(updated);
 assert.equal(first.version,second.version);assert.notEqual(first.assetVersion,second.assetVersion);
 const html=await (await updated.fetch(new Request('https://qa.invalid/'))).text();
 assert.ok(html.includes('/assets/core.js?v='+second.assetVersion));assert.ok(!html.includes('/assets/core.js?v='+first.assetVersion));
 assert.match((await updated.fetch(new Request('https://qa.invalid/assets/core.js?v='+first.assetVersion))).headers.get('cache-control'),/must-revalidate/);
});
