/* Resolve trusted brand tokens in local previews; production HTML is resolved at build time. */
(()=>{
 const replace=value=>value.replace(/\{\{brand\.(\w+)\}\}/g,(_,key)=>key==='upperName'?APP_BRAND.name.toUpperCase():APP_BRAND[key]??'');
 const walker=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);let node;
 while((node=walker.nextNode()))if(!['SCRIPT','STYLE'].includes(node.parentElement?.tagName)&&node.nodeValue.includes('{{brand.'))node.nodeValue=replace(node.nodeValue);
 for(const element of document.querySelectorAll('*'))for(const attr of [...element.attributes])if(attr.value.includes('{{brand.'))element.setAttribute(attr.name,replace(attr.value));
})();
