const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
require('../dist/brand.js');
const brand=globalThis.APP_BRAND;
const version={name:brand.name,version:brand.version,commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()};
const assets={};const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){if(['server','client','assets','.openai','version.json'].includes(entry.name))continue;const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else{let data=fs.readFileSync(p);if(/\.(html|webmanifest)$/.test(entry.name)){data=Buffer.from(data.toString().replace(/\{\{brand\.(\w+)\}\}/g,(_,key)=>{const value=key==='upperName'?brand.name.toUpperCase():brand[key];if(value===undefined)throw Error('Unknown brand key '+key);return value;}));}assets['/'+path.relative(out,p).split(path.sep).join('/') ]={type:mime[path.extname(p)]||'application/octet-stream',data:data.toString('base64')};}}}
walk(out);
// A release label can be reused; an immutable asset URL must change with its content.
version.assetVersion=crypto.createHash('sha256').update(JSON.stringify(assets)).update(fs.readFileSync(__filename)).digest('hex').slice(0,16);
// Dependency-free classic-script bundles: preserve global lexical bindings, no framework migration.
const groups={account:['js/account/panel.js'],admin:['js/account/admin.js'],feedback:['js/account/feedback.js'],operations:['js/account/operations.js'],photos:['js/photo-processing.js'],geometry:['js/map/geometry.js'],editor:['js/map/editor.js']};
const bundles=Object.fromEntries(Object.keys(groups).map(key=>[key,['assets/'+key+'.js']]));
function bundle(name,files,prefix=''){const content=prefix+files.map(file=>';\n'+fs.readFileSync(path.join(out,file),'utf8')+'\n').join('');assets['/assets/'+name+'.js']={type:mime['.js'],data:Buffer.from(content).toString('base64')};fs.mkdirSync(path.join(out,'assets'),{recursive:true});fs.writeFileSync(path.join(out,'assets',name+'.js'),content);}
for(const [name,files] of Object.entries(groups))bundle(name,files);
let html=Buffer.from(assets['/index.html'].data,'base64').toString();
const files=[...html.matchAll(/<script src="([^"?]+)(?:\?[^"\s]*)?"><\/script>/g)].map(match=>match[1].replace(/^\//,''));
const core=files.filter(file=>!['brand.js','supabase.js','leaflet.js'].includes(file));
bundle('core',core,'window.TERRA_ASSET_VERSION='+JSON.stringify(version.assetVersion)+';\nwindow.TERRA_BUNDLES='+JSON.stringify(bundles)+';\n');
html=html.replace(/<script src="[^" ]+"><\/script>/g,'');
html=html.replace('</head>','<script src="/brand.js?v='+version.version+'"></script></head>');
html=html.replace('</body>',['supabase.js','leaflet.js','assets/core.js'].map(file=>'<script defer src="/'+file+'?v='+version.version+'"></script>').join('')+'</body>');
assets['/index.html'].data=Buffer.from(html).toString('base64');
for(const [name,asset] of Object.entries(assets))if(name.endsWith('.html')){
 const markup=Buffer.from(asset.data,'base64').toString().replace(/\b(src|href)="([^"]+)"/g,(tag,attribute,reference)=>{
  const url=new URL(reference,'https://assets.invalid'+name);
  if(url.origin!=='https://assets.invalid'||!assets[url.pathname]||url.pathname.endsWith('.html'))return tag;
  url.searchParams.set('v',version.assetVersion);
  return attribute+'="'+url.pathname+url.search+url.hash+'"';
 });
 asset.data=Buffer.from(markup).toString('base64');
}
const zlib=require('node:zlib');const initial=['brand.js','supabase.js','leaflet.js','assets/core.js'].map(file=>{const data=Buffer.from(assets['/'+file].data,'base64');return {file,bytes:data.length,gzip:zlib.gzipSync(data).length};});
fs.mkdirSync(path.join(root,'docs/performance'),{recursive:true});fs.writeFileSync(path.join(root,'docs/performance/current-assets.json'),JSON.stringify({version:version.version,scripts:initial,total_bytes:initial.reduce((sum,x)=>sum+x.bytes,0),total_gzip:initial.reduce((sum,x)=>sum+x.gzip,0)},null,2)+'\n');
const source=fs.readFileSync(path.join(root,'server/site-worker.mjs'),'utf8').replace("import '../dist/brand.js';",fs.readFileSync(path.join(out,'brand.js'),'utf8')).replaceAll('export ','');
fs.mkdirSync(path.join(out,'server'),{recursive:true});fs.writeFileSync(path.join(out,'server/index.js'),source+'\nexport default createWorker('+JSON.stringify(assets)+','+JSON.stringify(version)+');\n');
console.log('Built '+brand.name+' '+version.version+' from '+version.commit+' ('+Object.keys(assets).length+' assets).');
