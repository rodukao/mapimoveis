/* Classic scripts preserve the existing application's shared lexical scope. */
window.TerraLazy=(()=>{
 const sources={account:['js/account/panel.js'],admin:['js/account/admin.js'],feedback:['js/account/feedback.js'],operations:['js/account/operations.js'],billing:['js/account/billing.js'],photos:['js/photo-processing.js'],geometry:['js/map/geometry.js'],editor:['js/map/editor.js']};
 const flights=new Map();
 function load(name){if(flights.has(name))return flights.get(name);if(!sources[name])return Promise.reject(Error('Recurso indisponível.'));const files=window.TERRA_BUNDLES?.[name]||sources[name];const task=(async()=>{if(name==='editor')await load('geometry');for(const file of files)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/'+file+'?v='+(window.TERRA_ASSET_VERSION||APP_BRAND.version);script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('Não foi possível carregar este recurso. Tente novamente.'));};document.head.append(script);});})();flights.set(name,task);task.catch(()=>flights.delete(name));return task;}
 return {load};
})();
window.TerraAccount={open:async(...args)=>{try{await TerraLazy.load('account');return TerraAccount.open(...args);}catch(e){toast(e.message);}}};
window.TerraOperations=Object.fromEntries(['withChallenge','invoke','deleteAccount','contact'].map(name=>[name,async(...args)=>{await TerraLazy.load('operations');return TerraOperations[name](...args);} ]));
