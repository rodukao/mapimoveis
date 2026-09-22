// Development-only fixture: actual gallery markup and behavior, no account or data writes.
const fs=require('node:fs'),path=require('node:path');
module.exports=()=>{
 const html=fs.readFileSync(path.join(__dirname,'../dist/index.html'),'utf8');
 const detail=html.match(/<dialog id="listing-detail"[\s\S]*?<\/dialog>/)[0];
 const lightbox=html.match(/<dialog id="photo-lightbox"[\s\S]*?<\/dialog>/)[0];
 const field=html.match(/<div class="video-field">[\s\S]*?<\/div>/)[0];
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><script src="/brand.js"></script><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/marketplace.css"><link rel="stylesheet" href="/typography.css"><style>body{padding:16px;overflow:auto}.fixture-actions{display:flex;gap:8px;flex-wrap:wrap}#fixture-editor{max-width:500px}</style></head><body>
 <p>Prévia isolada da galeria. Nenhum anúncio será alterado.</p>
 <div class="fixture-actions"><button id="mixed">Fotos e vídeo</button><button id="video-only">Somente vídeo</button><button id="empty">Sem mídia</button></div>
 <form id="fixture-editor">${field}<button type="submit">Testar link</button><button type="button" id="restore-video">Restaurar vídeo salvo</button><output id="fixture-result"></output></form>
 ${detail}${lightbox}<script>
 const $=id=>document.getElementById(id),drawing=false,currentSession=null,num=n=>String(n),money=n=>'R$ '+n,unitMoney=n=>'R$ '+n;
 const TerraPhotos={bind(img,p){img.src=p.url;img._terraPhoto={};}};
 </script><script src="/js/video.js"></script><script src="/detail.js"></script><script>
 const sample={id:'fixture',title:'Imóvel de demonstração',tag:'Terreno',address:'Juiz de Fora · MG',price:100000,area:500,description:'Galeria de teste',details:{youtube_video_id:'M7lc1UVf-VE'},photos:[{url:'/og.png',alt_text:'Imagem de demonstração'},{url:'/icon-512.png',alt_text:'Marca TerraMapa'}]};
 $('mixed').onclick=()=>showDetail(sample);$('video-only').onclick=()=>showDetail({...sample,photos:[]});$('empty').onclick=()=>showDetail({...sample,photos:[],details:{}});
 TerraVideo.bindEditor();$('restore-video').onclick=()=>TerraVideo.fillEditor(sample.details);
 $('fixture-editor').onsubmit=e=>{e.preventDefault();try{$('fixture-result').textContent=TerraVideo.editorId()||'Sem vídeo';}catch(err){$('fixture-result').textContent=err.message;}};
 </script></body></html>`;
};
