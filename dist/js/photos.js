/* Decode pixels and re-encode: original EXIF/GPS never travels with the upload. */
window.TerraPhotos=(()=>{
 const prepared=new WeakSet(),flights=new Map();
 async function optimize(file,{maxSide=2048}={}){
  if(prepared.has(file))return file;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Use fotos JPG, PNG ou WebP.');
  if(file.size>30*1024*1024)throw new Error('A foto original deve ter até 30 MB.');
  let source,url;
  try{
   if(typeof createImageBitmap==='function')source=await createImageBitmap(file,{imageOrientation:'from-image'});
   else {url=URL.createObjectURL(file);source=new Image();source.src=url;await source.decode();}
   const w=source.width||source.naturalWidth,h=source.height||source.naturalHeight;
   if(!w||!h||w*h>100000000)throw new Error('A resolução desta foto é grande demais. Exporte uma versão menor.');
   const ratio=Math.min(1,maxSide/Math.max(w,h)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(w*ratio));canvas.height=Math.max(1,Math.round(h*ratio));
   const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Não foi possível preparar a foto neste navegador.');
   ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(source,0,0,canvas.width,canvas.height);
   const encode=q=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('Não foi possível comprimir a foto.')),'image/jpeg',q));
   let blob=await encode(.84);if(blob.size>2*1024*1024)blob=await encode(.72);
   if(blob.size>5*1024*1024)throw new Error('A foto ainda está muito grande. Escolha uma versão menor.');
   const result=new File([blob],file.name.replace(/\.[^.]+$/,'')+'.jpg',{type:'image/jpeg',lastModified:Date.now()});prepared.add(result);return result;
  }catch(e){throw new Error(e.message||'Não foi possível preparar a foto. Escolha outro arquivo.');}
  finally{source?.close?.();if(url)URL.revokeObjectURL(url);}
 }
 async function renew(photo){
  const path=photo.storage_path;if(!path)throw new Error('Foto indisponível.');
  if(!flights.has(path))flights.set(path,(async()=>{const r=await TerraRepository.db().storage.from('terra-listing-photos').createSignedUrls([path],3600);const item=TerraRepository.unwrap(r)?.[0];if(item?.error||!item?.signedUrl)throw new Error('Foto indisponível.');return item.signedUrl;})().finally(()=>flights.delete(path)));
  photo.url=await flights.get(path);return photo.url;
 }
 function bind(img,photo,onFailure=()=>{}){
  const ticket={};img._terraPhoto=ticket;let retried=false;
  img.onerror=async()=>{if(img._terraPhoto!==ticket)return;if(retried){img.onerror=null;img.alt='Não foi possível carregar esta foto.';onFailure();return;}retried=true;try{const url=await renew(photo);if(img._terraPhoto===ticket)img.src=url;}catch(_){if(img._terraPhoto===ticket){img.onerror=null;img.alt='Não foi possível carregar esta foto.';onFailure();}}};
  if(photo.url)img.src=photo.url;else img.onerror();
 }
 return {optimize,bind,renew};
})();
