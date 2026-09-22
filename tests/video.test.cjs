const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const videoSource=fs.readFileSync('dist/js/video.js','utf8'),detailSource=fs.readFileSync('dist/detail.js','utf8');
const VIDEO='M7lc1UVf-VE';
function setup(){
 const nodes=new Map();
 function node(tag='div'){
  const attrs={},listeners={},classes=new Set();
  return {tag,attrs,children:[],value:'',hidden:false,open:false,textContent:'',parentElement:null,
   classList:{remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle(x,force){const yes=force??!classes.has(x);yes?classes.add(x):classes.delete(x);return yes;}},
   append(...items){this.children.push(...items);for(const x of items)if(typeof x==='object')x.parentElement=this;},replaceChildren(...items){this.children=[];this.append(...items);},
   setAttribute(k,v){attrs[k]=v;},removeAttribute(k){delete attrs[k];},setCustomValidity(s){this.validationMessage=s;},
   addEventListener(k,f){(listeners[k]??=[]).push(f);},dispatch(k){for(const f of listeners[k]||[])f({target:this});},
   showModal(){this.open=true;},close(){this.open=false;this.dispatch('close');},scrollTo(){},getBoundingClientRect(){return {left:0,right:300,top:0,bottom:200};}};
 }
 const $=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 $('detail-video').parentElement=node();
 const ctx={URL,$,drawing:false,currentSession:null,num:String,money:String,unitMoney:String,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},document:{createElement:node,getElementById:$,dispatchEvent(){}},TerraPhotos:{bind:(img,photo)=>{img.src=photo.url;img._terraPhoto={};}}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(videoSource,ctx);vm.runInContext(detailSource,ctx);
 return {ctx,$,api:ctx.TerraVideo,frames:()=>['detail-video','lightbox-video'].flatMap(id=>$(id).children)};
}
const plot={title:'Imóvel de teste',tag:'Terreno',address:'Juiz de Fora',price:100,area:200,description:'',details:{},photos:[{url:'/first.jpg'},{url:'/second.jpg'}]};
test('YouTube watch, share, Shorts, live and embed links normalize to the same video ID',()=>{
 const {api}=setup();
 for(const link of [`https://www.youtube.com/watch?v=${VIDEO}&t=40s`,`https://youtu.be/${VIDEO}?si=tracking`,`https://m.youtube.com/shorts/${VIDEO}`,`youtube.com/live/${VIDEO}`,`https://www.youtube-nocookie.com/embed/${VIDEO}`,` https://www.youtube.com/embed/${VIDEO} `])assert.equal(api.parse(link),VIDEO);
 assert.equal(api.watchUrl(VIDEO),'https://www.youtube.com/watch?v='+VIDEO);
});
test('untrusted hosts, credentials, markup, playlists and malformed IDs cannot become embeds',()=>{
 const {api}=setup();
 for(const link of [null,{},'',VIDEO,'javascript:alert(1)',`https://youtube.com.evil.invalid/watch?v=${VIDEO}`,`https://youtube.com@evil.invalid/watch?v=${VIDEO}`,`https://user:pass@youtube.com/watch?v=${VIDEO}`,`https://youtube.com:444/watch?v=${VIDEO}`,'<iframe src="https://youtube.com"></iframe>','https://youtube.com/playlist?list=abc',`https://youtube.com/watch?v=${VIDEO}&v=abcdefghijk`,`https://youtu.be/${VIDEO}/extra`,'https://youtu.be/short'])assert.equal(api.parse(link),null);
 assert.equal(api.fromDetails({youtube_video_id:'<script>'}),null);assert.throws(()=>api.player('bad','Unsafe'));
});
test('editor restores a saved video, replaces it, removes it, and rejects invalid input',()=>{
 const {api,$}=setup();api.fillEditor({youtube_video_id:VIDEO});assert.equal(api.editorId(),VIDEO);
 $('youtube-url').value='https://youtu.be/abcdefghijk';assert.equal(api.editorId(),'abcdefghijk');
 $('youtube-url').value='';assert.equal(api.editorId(),null);
 $('youtube-url').value='https://example.invalid/video';assert.throws(()=>api.editorId(),/YouTube/);assert.equal($('youtube-error').hidden,false);
 api.fillEditor({});assert.equal($('youtube-url').value,'');assert.equal($('youtube-error').hidden,true);
});
test('mixed gallery loads one video on selection and stops it on navigation and close',()=>{
 const s=setup();s.ctx.showDetail({...plot,details:{youtube_video_id:VIDEO}});
 assert.equal(s.frames().length,0);assert.equal(s.$('photo-thumbnails').children.length,3);
 s.$('photo-thumbnails').children[2].onclick();assert.equal(s.frames().length,1);
 const frame=s.frames()[0];assert.equal(frame.src,'https://www.youtube-nocookie.com/embed/'+VIDEO+'?playsinline=1&rel=0');assert.doesNotMatch(frame.src,/autoplay=1/);assert.equal(frame.referrerPolicy,'strict-origin-when-cross-origin');assert.equal(frame.allowFullscreen,true);
 assert.equal(s.$('expand-photo').hidden,true);assert.equal(s.$('photo-counter').textContent,'Vídeo · 3 de 3');
 s.$('photo-next').onclick();assert.equal(s.frames().length,0);assert.equal(s.$('expand-photo').hidden,false);
 s.$('photo-prev').onclick();assert.equal(s.frames().length,1);s.$('listing-detail').close();assert.equal(s.frames().length,0);
});
test('video-only, photo-only and empty legacy listings all keep usable galleries',()=>{
 const s=setup();s.ctx.showDetail({...plot,photos:[],details:{youtube_video_id:VIDEO}});assert.equal(s.frames().length,1);assert.equal(s.$('no-photos').hidden,true);assert.equal(s.$('photo-next').hidden,true);
 s.ctx.showDetail(plot);assert.equal(s.frames().length,0);assert.equal(s.$('detail-photo').src,'/first.jpg');
 s.ctx.showDetail({...plot,photos:[],details:{youtube_video_id:'malicious'}});assert.equal(s.frames().length,0);assert.equal(s.$('detail-gallery').hidden,true);assert.equal(s.$('no-photos').hidden,false);
});
test('lightbox has only one active video and closing all detail views removes the iframe',()=>{
 const s=setup();s.ctx.showDetail({...plot,details:{youtube_video_id:VIDEO}});s.$('expand-photo').onclick();
 s.$('lightbox-prev').onclick();assert.equal(s.$('lightbox-video').children.length,1);assert.equal(s.$('detail-video').children.length,0);assert.equal(s.$('photo-zoom').hidden,true);
 s.$('close-lightbox').onclick();assert.equal(s.$('lightbox-video').children.length,0);assert.equal(s.$('detail-video').children.length,1);
 s.ctx.closeDetail();assert.equal(s.frames().length,0);
});
