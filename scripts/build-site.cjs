const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
const version={version:'1.0.6',commit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()};
const assets={};const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(['server','client','.openai','version.json'].includes(entry.name))continue;const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else{let data=fs.readFileSync(p);if(entry.name.endsWith('.html')){data=Buffer.from(data.toString().replace(/((?:src|href)="[^"?:]+\.(?:js|css))"/g,'$1?v='+version.version+'"'));}assets['/'+path.relative(out,p).split(path.sep).join('/') ]={type:mime[path.extname(p)]||'application/octet-stream',data:data.toString('base64')};}}}
walk(out);const source=fs.readFileSync(path.join(root,'server/site-worker.mjs'),'utf8').replaceAll('export ','');
fs.mkdirSync(path.join(out,'server'),{recursive:true});fs.writeFileSync(path.join(out,'server/index.js'),source+'\nexport default createWorker('+JSON.stringify(assets)+','+JSON.stringify(version)+');\n');
console.log('Built Terra '+version.version+' from '+version.commit+' ('+Object.keys(assets).length+' assets).');
