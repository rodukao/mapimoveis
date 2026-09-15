// HTTP metadata is decided from an anonymous public-status read, never a viewer JWT.
export const ORIGIN='https://terramapa.danielleczfranco.chatgpt.site';
const PROJECT='https://pkofzhlcbqupanzydyyf.supabase.co',KEY='sb_publishable_r7y-sZnL-6Bkp_FzCJORLw__adpfc_f';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title='Terra — seu próximo terreno está no mapa',description='Explore terrenos no mapa, compare preços e encontre seu próximo terreno.';
export function metadata(url,indexable=true){
 if(!indexable)return '<meta name="robots" content="noindex,nofollow,noarchive">';
 return `<link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="${ORIGIN}/og.png"><meta property="og:type" content="website"><meta property="og:url" content="${escape(url)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${ORIGIN}/og.png"><meta name="robots" content="index,follow">`;
}
export function createWorker(assets,version){
 const decoded=new Map();
 const bytes=key=>{if(!decoded.has(key))decoded.set(key,Uint8Array.from(atob(assets[key].data),c=>c.charCodeAt(0)));return decoded.get(key);};
 return {async fetch(request){
  const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/';
  const reply=(body,status=200,type='text/html; charset=utf-8',extra={})=>new Response(request.method==='HEAD'?null:body,{status,headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store',...extra}});
  if(!['GET','HEAD'].includes(request.method))return reply('Method not allowed',405,'text/plain');
  if(path==='/version.json')return reply(JSON.stringify(version),200,'application/json');
  if(path==='/robots.txt')return reply(`User-agent: *\nAllow: /\nDisallow: /*?recovery=\nDisallow: /*?code=\nSitemap: ${ORIGIN}/sitemap.xml\n`,200,'text/plain');
  if(path==='/sitemap.xml')return reply('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/','/privacidade','/termos'].map(p=>`<url><loc>${ORIGIN}${p}</loc></url>`).join('')+'</urlset>',200,'application/xml');
  let asset=path==='/'?'/index.html':path;
  if(['/privacidade','/termos'].includes(path))asset=path+'/index.html';
  if(!assets[asset])return reply('Página não encontrada.',404,'text/plain',{'X-Robots-Tag':'noindex'});
  if(!asset.endsWith('.html'))return reply(bytes(asset),200,assets[asset].type,{'Cache-Control':url.searchParams.get('v')===version.version?'public, max-age=31536000, immutable':'public, max-age=3600'});
  let indexable=true,canonical=ORIGIN+(path==='/index.html'?'/':path);
  if(url.search){indexable=false;const id=url.searchParams.get('terreno');
   if((path==='/'||path==='/index.html')&&UUID.test(id||'')&&[...url.searchParams.keys()].every(k=>k==='terreno')){
    try{const q=new URL(PROJECT+'/rest/v1/terra_listings');q.searchParams.set('id','eq.'+id);q.searchParams.set('status','in.(published,reserved,sold)');q.searchParams.set('select','id');
     const r=await fetch(q,{headers:{apikey:KEY},signal:AbortSignal.timeout(5000)});const rows=r.ok?await r.json():[];indexable=Array.isArray(rows)&&rows.length===1&&rows[0].id===id;
     if(indexable)canonical=ORIGIN+'/?terreno='+id;
    }catch(_){indexable=false;}
   }
  }
  const html=new TextDecoder().decode(bytes(asset)).replace('<!-- TERRA_METADATA -->',metadata(canonical,indexable));
  return reply(html,200,'text/html; charset=utf-8',indexable?{}:{'X-Robots-Tag':'noindex, nofollow, noarchive'});
 }};
}
