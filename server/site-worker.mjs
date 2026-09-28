// HTTP metadata is decided from an anonymous public-status read, never a viewer JWT.
import '../dist/brand.js';
const APP_BRAND=globalThis.APP_BRAND;
export const ORIGIN=APP_BRAND.origin;
const PROJECT='https://pkofzhlcbqupanzydyyf.supabase.co',KEY='sb_publishable_r7y-sZnL-6Bkp_FzCJORLw__adpfc_f';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const title=APP_BRAND.title,description=APP_BRAND.description;
// Link previews (WhatsApp, social networks) describe the listing itself when the URL points to one.
const thousands=n=>String(Math.round(Number(n))).replace(/\B(?=(\d{3})+(?!\d))/g,'.');
const BUILT=['casa','sobrado','apartamento','cobertura','sala_comercial','galpao'];
export function listingPreview(row){
 if(!row?.title)return null;
 const d=row.details||{},built=BUILT.includes(row.category)&&Number(d.built_area_m2)>0,area=Number(row.area_m2);
 const size=built?thousands(d.built_area_m2)+' m²':area>=10000?(area/10000).toFixed(2).replace('.',',')+' ha':area>0?thousands(area)+' m²':'';
 const place=[row.neighborhood,[row.city,row.state].filter(Boolean).join(' - ')].filter(Boolean).join(', ');
 const summary=[row.price_brl!=null?'R$ '+thousands(row.price_brl):'',size,Number(d.bedrooms)>0?d.bedrooms+(Number(d.bedrooms)===1?' quarto':' quartos'):'',place].filter(Boolean).join(' · ');
 const photo=Array.isArray(row.terra_listing_photos)&&row.terra_listing_photos.length>0;
 return {title:row.title,description:summary,image:photo?`${ORIGIN}/og/listing/${row.id}.jpg?r=${row.revision||1}`:null};
}
export function metadata(url,indexable=true,listing=null){
 if(!indexable)return '<meta name="robots" content="noindex,nofollow,noarchive">';
 const t=listing?escape(listing.title):title,d=listing?escape(listing.description):description,image=escape(listing?.image||`${ORIGIN}/og.png?v=${APP_BRAND.version}`);
 return `<link rel="canonical" href="${escape(url)}"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:image" content="${image}"><meta property="og:type" content="${listing?'article':'website'}"><meta property="og:site_name" content="${escape(APP_BRAND.name)}"><meta property="og:locale" content="pt_BR"><meta property="og:url" content="${escape(url)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${image}"><meta name="robots" content="index,follow">`;
}
// Same policy for every response: HTML is the only place CSP/frame-ancestors truly
// matter, but assets cost nothing extra carrying them, and HSTS must be on every
// response for browsers to pin it. Origins here mirror what dist/*.js actually calls
// (Leaflet/Esri tiles, Supabase, Photon, ViaCEP, Turnstile, YouTube) — keep this in
// sync with dist/config.js and dist/captcha.js when a provider changes (e.g. enabling
// hcaptcha needs https://js.hcaptcha.com and https://*.hcaptcha.com added below).
const SECURITY_HEADERS={
 'Strict-Transport-Security':'max-age=31536000; includeSubDomains; preload',
 'X-Frame-Options':'DENY',
 'Referrer-Policy':'strict-origin-when-cross-origin',
 'Permissions-Policy':'geolocation=(), camera=(), microphone=(), payment=()',
 'Content-Security-Policy':[
  "default-src 'self'",
  "script-src 'self' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tile.openstreetmap.org https://server.arcgisonline.com https://services.arcgisonline.com https://pkofzhlcbqupanzydyyf.supabase.co https://i.ytimg.com",
  "font-src 'self'",
  "connect-src 'self' https://pkofzhlcbqupanzydyyf.supabase.co https://photon.komoot.io https://viacep.com.br https://challenges.cloudflare.com",
  "frame-src https://challenges.cloudflare.com https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests'
 ].join('; ')
};
export function createWorker(assets,version){
 const decoded=new Map();
 const bytes=key=>{if(!decoded.has(key))decoded.set(key,Uint8Array.from(atob(assets[key].data),c=>c.charCodeAt(0)));return decoded.get(key);};
 return {async fetch(request,env={}){
  const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')||'/';
  const reply=(body,status=200,type='text/html; charset=utf-8',extra={})=>new Response(request.method==='HEAD'?null:body,{status,headers:{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store',...SECURITY_HEADERS,...extra}});
  if(path==='/api/contact'){
   if(request.method!=='POST')return reply('Use POST.',405,'text/plain');
   if(request.headers.get('Origin')!==url.origin)return reply(JSON.stringify({error:'Origem não autorizada.'}),403,'application/json');
   const ip=request.headers.get('CF-Connecting-IP');
   if(!env.TERRA_CONTACT_PROXY_KEY||!request.cf||!ip)return reply(JSON.stringify({error:'Contato temporariamente indisponível.'}),503,'application/json');
   try{
    const reader=request.body?.getReader();if(!reader)throw Error();let raw='',size=0;const decoder=new TextDecoder();while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>4096){await reader.cancel();throw Error();}raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();const b=JSON.parse(raw);
    const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.TERRA_CONTACT_PROXY_KEY+':'+new Date().toISOString().slice(0,10)+':'+ip));
    const ipHash=Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');
    const response=await fetch(PROJECT+'/functions/v1/terra-contact',{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json','x-terra-proxy':env.TERRA_CONTACT_PROXY_KEY,...(request.headers.get('authorization')?{Authorization:request.headers.get('authorization')}:{})},body:JSON.stringify({session:b.session,listing:b.listing,owner:b.owner,token:b.token,ip:ipHash,origin:url.origin}),signal:AbortSignal.timeout(20000)});
    return reply(await response.text(),response.status,'application/json');
   }catch(_){return reply(JSON.stringify({error:'Não foi possível abrir o contato agora.'}),503,'application/json');}
  }
  if(!['GET','HEAD'].includes(request.method))return reply('Method not allowed',405,'text/plain');
  if(APP_BRAND.redirectLegacy&&ORIGIN===APP_BRAND.targetOrigin&&url.origin===APP_BRAND.legacyOrigin&&!url.searchParams.has('code')&&!url.searchParams.has('recovery'))return new Response(null,{status:308,headers:{Location:ORIGIN+url.pathname+url.search,'Cache-Control':'public, max-age=300','Strict-Transport-Security':SECURITY_HEADERS['Strict-Transport-Security']}});
  const short=path.match(/^\/i\/([2-9a-hjkmnp-z]{6})$/);
  if(short){
   try{const q=new URL(PROJECT+'/rest/v1/terra_listings');q.searchParams.set('short_code','eq.'+short[1]);q.searchParams.set('status','in.(published,reserved,sold)');q.searchParams.set('select','id');
    const r=await fetch(q,{headers:{apikey:KEY},signal:AbortSignal.timeout(5000)});const rows=r.ok?await r.json():[];
    if(UUID.test(rows?.[0]?.id||''))return new Response(null,{status:302,headers:{Location:ORIGIN+'/?terreno='+rows[0].id,'Cache-Control':'public, max-age=300','Strict-Transport-Security':SECURITY_HEADERS['Strict-Transport-Security']}});
   }catch(_){}
   return new Response(null,{status:302,headers:{Location:ORIGIN+'/','Cache-Control':'no-store','Strict-Transport-Security':SECURITY_HEADERS['Strict-Transport-Security']}});
  }
  const cover=path.match(/^\/og\/listing\/([0-9a-f-]{36})\.jpg$/i);
  if(cover&&UUID.test(cover[1])){
   // The photo bucket is private: sign the cover with the anonymous key (Storage policy only allows public listings).
   try{const q=new URL(PROJECT+'/rest/v1/terra_listing_photos');q.searchParams.set('listing_id','eq.'+cover[1]);q.searchParams.set('select','storage_path');q.searchParams.set('order','sort_order.asc');q.searchParams.set('limit','1');
    const rows=await(await fetch(q,{headers:{apikey:KEY},signal:AbortSignal.timeout(5000)})).json();const stored=rows?.[0]?.storage_path;if(!stored)throw Error();
    const signed=await fetch(PROJECT+'/storage/v1/object/sign/terra-listing-photos/'+stored,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify({expiresIn:120}),signal:AbortSignal.timeout(5000)}).then(r=>r.ok?r.json():null);
    if(!signed?.signedURL)throw Error();
    const image=await fetch(PROJECT+'/storage/v1'+signed.signedURL,{signal:AbortSignal.timeout(10000)});if(!image.ok)throw Error();
    return new Response(request.method==='HEAD'?null:image.body,{status:200,headers:{'Content-Type':image.headers.get('Content-Type')||'image/jpeg','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff','Strict-Transport-Security':SECURITY_HEADERS['Strict-Transport-Security']}});
   }catch(_){return new Response(null,{status:302,headers:{Location:ORIGIN+'/og.png?v='+APP_BRAND.version,'Cache-Control':'public, max-age=300','Strict-Transport-Security':SECURITY_HEADERS['Strict-Transport-Security']}});}
  }
  if(path==='/version.json')return reply(JSON.stringify(version),200,'application/json');
  if(path==='/robots.txt')return reply(`User-agent: *\nAllow: /\nDisallow: /*?recovery=\nDisallow: /*?code=\nDisallow: /*?checkout=\nDisallow: /*?boost=\nSitemap: ${ORIGIN}/sitemap.xml\n`,200,'text/plain');
  if(path==='/sitemap.xml')return reply('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['/','/privacidade','/termos','/profissionais'].map(p=>`<url><loc>${ORIGIN}${p}</loc></url>`).join('')+'</urlset>',200,'application/xml');
  let asset=path==='/'?'/index.html':path;
  if(['/privacidade','/termos','/profissionais'].includes(path))asset=path+'/index.html';
  if(!assets[asset])return reply('Página não encontrada.',404,'text/plain',{'X-Robots-Tag':'noindex'});
  if(!asset.endsWith('.html'))return reply(bytes(asset),200,assets[asset].type,{'Cache-Control':version.assetVersion&&url.searchParams.get('v')===version.assetVersion?'public, max-age=31536000, immutable':'public, max-age=0, must-revalidate'});
  let listing=null,indexable=true,canonical=ORIGIN+(path==='/index.html'?'/':path);
  if(url.search){indexable=false;const id=url.searchParams.get('terreno');
   if((path==='/'||path==='/index.html')&&UUID.test(id||'')&&[...url.searchParams.keys()].every(k=>k==='terreno')){
    try{const q=new URL(PROJECT+'/rest/v1/terra_listings');q.searchParams.set('id','eq.'+id);q.searchParams.set('status','in.(published,reserved,sold)');q.searchParams.set('select','id,title,price_brl,area_m2,city,state,neighborhood,category,details,revision,terra_listing_photos(storage_path)');
     const r=await fetch(q,{headers:{apikey:KEY},signal:AbortSignal.timeout(5000)});const rows=r.ok?await r.json():[];indexable=Array.isArray(rows)&&rows.length===1&&rows[0].id===id;
     if(indexable){canonical=ORIGIN+'/?terreno='+id;listing=listingPreview(rows[0]);}
    }catch(_){indexable=false;}
   }
  }
  let html=new TextDecoder().decode(bytes(asset)).replace('<!-- TERRA_METADATA -->',metadata(canonical,indexable,listing));
  if(listing)html=html.replace(/<title>[^<]*<\/title>/,'<title>'+escape(listing.title)+' — '+escape(APP_BRAND.name)+'</title>');
  return reply(html,200,'text/html; charset=utf-8',indexable&&!url.search?{'Cache-Control':'public, max-age=0, must-revalidate'}:{'Cache-Control':'no-store',...(!indexable?{'X-Robots-Tag':'noindex, nofollow, noarchive'}:{})});
 }};
}
