/* Decode pixels and re-encode: original EXIF/GPS never travels with the upload. */
window.TerraPhotos=(()=>{
 const flights=new Map();
 async function optimize(...args){await TerraLazy.load('photos');return TerraPhotoProcessing.optimize(...args);}
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
