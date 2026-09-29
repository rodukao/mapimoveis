const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// DOM doubles test the actual form handlers without claiming visual browser QA.
function setup(){
 const ids=new Map();let lastPanel,loads=0,moves=0;
 function el(tag,attrs={},...children){const n={tag,value:'',children:[],hidden:false,...attrs,append(...items){this.children.push(...items.flat());},prepend(...items){this.children.unshift(...items);},get options(){return this.children;},replaceChildren(...items){this.children=[];this.append(...items);},closest(){return {after(){}};},after(){},setAttribute(k,v){this[k]=v;},classList:{toggle(name,on){n.activeClass=on?name:null;}},querySelector(selector){return walk(this).find(c=>c!==this&&typeof c==='object'&&c.class&&selector==='.'+c.class)||null;},querySelectorAll(selector){return walk(this).filter(n=>n.tag==='input'&&selector.includes('"'+n.name+'"')&&(!selector.includes(':checked')||n.checked));}};n.append(...children);if(tag==='select')n.value=n.children.find(c=>c.selected)?.value??n.children[0]?.value??'';if(n.id)ids.set(n.id,n);return n;}
 function walk(n){return [n,...(n.children||[]).flatMap(c=>typeof c==='object'?walk(c):[])];}
 const $=id=>{if(!ids.has(id))ids.set(id,el('div'));return ids.get(id);};
 const media={matches:true,addEventListener(){}},toolbar=el('div'),title=el('h1');
 const ctx={window:null,structuredClone,$,money:n=>'R$ '+n,num:n=>String(n),currentArea:0,drawing:false,searchLocation:null,searchMarker:null,mine:false,loadListings:()=>loads++,moveMapProgrammatically:()=>moves++,clearLocation:()=>ctx.TerraFilters.clearSpatial(),matchMedia:()=>media,document:{querySelector:selector=>selector==='.toolbar'?toolbar:title,addEventListener(){}},TerraUI:{el,field:(label,n)=>el('label',{},label,n),options:(values,value='')=>Object.entries(values).map(([key,label])=>({tag:'option',value:key,selected:key===value,children:[label]})),dialog:()=>lastPanel={node:{close(){}},content:el('div')},error:(form,e)=>{throw e;}}};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/js/map/catalog.js','utf8'),ctx);vm.runInContext(fs.readFileSync('dist/brand.js','utf8'),ctx);vm.runInContext(fs.readFileSync('dist/js/search/filters.js','utf8'),ctx);
 return {api:ctx.TerraFilters,$,walk,get panel(){return lastPanel;},get loads(){return loads;},get moves(){return moves;}};
}
test('saved searches, viewport and interest geometry share one filter object and keep attribute filters',()=>{
 const s=setup();s.api.applySaved({city:'Curitiba',state:'PR',minPrice:100000,maxArea:30000,topography:'plano',infrastructure:['agua']});
 const bounds={west:-50,east:-49,south:-26,north:-25};s.api.setViewport(bounds);let f=s.api.get();assert.equal(f.city,'Curitiba');assert.equal(f.minPrice,100000);assert.equal(f.topography,'plano');assert.equal(f.bounds.west,-50);
 f.city='Forged';assert.equal(s.api.get().city,'Curitiba');
 const polygon={type:'Polygon',coordinates:[]};s.api.setArea({polygon});s.api.setViewport(bounds);f=s.api.get();assert.equal(f.bounds,undefined);assert.equal(f.polygon.type,'Polygon');assert.equal(f.maxArea,30000);
 s.api.clearInterest();assert.equal(s.api.get().polygon,undefined);assert.equal(s.api.get().city,'Curitiba');s.api.setViewport(bounds);assert.equal(s.api.get().bounds.west,-50);
});
test('quick area converts m² to hectares and changes only the requested filter values',()=>{
 const s=setup();s.api.applySaved({city:'Curitiba',minArea:10000,maxArea:40000,minPrice:50000,category:'rural',topography:'plano',documents:['car']});
 s.$('quick-area').onclick();const form=s.panel.content.children[0],all=s.walk(form),unit=all.find(n=>n.tag==='select'),inputs=all.filter(n=>n.tag==='input');unit.value='10000';unit.onchange();assert.equal(Number(inputs[0].value),1);assert.equal(Number(inputs[1].value),4);
 inputs[0].value='2';inputs[1].value='3';form.onsubmit({preventDefault(){}});const f=s.api.get();assert.equal(f.minArea,20000);assert.equal(f.maxArea,30000);assert.equal(f.minPrice,50000);assert.equal(f.category,'rural');assert.equal(f.topography,'plano');assert.equal(f.documents[0],'car');assert.equal(f.city,'Curitiba');
});
test('removing a price chip preserves area and location; reset clears every filter',()=>{
 const s=setup();s.api.applySaved({city:'Curitiba',minArea:500,minPrice:10000,maxPrice:200000});const price=s.$('filter-chips').children.find(n=>n.children.some(c=>typeof c==='string'&&c.startsWith('Preço')));price.onclick();const f=s.api.get();assert.equal(f.minPrice,undefined);assert.equal(f.maxPrice,undefined);assert.equal(f.minArea,500);assert.equal(f.city,'Curitiba');s.api.reset();assert.equal(Object.keys(s.api.get()).length,0);
});

test('property editor preserves zero rooms and the declared area separately from map area',()=>{
 const s=setup();s.api.fillEditor({category:'apartamento',terrain_context:'urban',details:{bedrooms:2,bathrooms:1,parking_spaces:0,built_area_m2:72}});
 const d=s.api.editorValues().details;assert.equal(d.bedrooms,2);assert.equal(d.parking_spaces,0);assert.equal(d.built_area_m2,72);
 s.$('property-bedrooms').value='1.5';assert.throws(()=>s.api.editorValues(),/Quartos/);
 s.$('property-bedrooms').value='2';s.$('property-built_area_m2').value='-1';assert.throws(()=>s.api.editorValues(),/Área privativa/);
});
test('each property kind saves only its own attributes and built kinds need a declared area to publish',()=>{
 const s=setup();
 s.api.fillEditor({category:'apartamento',terrain_context:'urban',topography:'aclive',infrastructure:['agua'],features:['piscina','nascente'],details:{built_area_m2:80,floor:7,condo_fee_brl:650,frontage:12}});
 let v=s.api.editorValues();assert.equal(v.details.floor,7);assert.equal(v.details.condo_fee_brl,650);assert.equal(v.details.frontage,undefined);assert.equal(v.topography,'');assert.deepEqual([...v.infrastructure],[]);assert.deepEqual([...v.features],['piscina']);
 s.api.fillEditor({category:'residencial',terrain_context:'urban',features:['esquina','piscina'],details:{bedrooms:3,frontage:12}});
 v=s.api.editorValues();assert.equal(v.details.bedrooms,undefined);assert.equal(v.details.frontage,12);assert.deepEqual([...v.features],['esquina']);
 s.api.fillEditor({category:'casa',terrain_context:'urban',details:{bedrooms:3}});s.$('listing-status').value='published';
 assert.throws(()=>s.api.editorValues(),/área construída/);
 s.$('listing-status').value='draft';assert.equal(s.api.editorValues().details.bedrooms,3);
 assert.equal(s.api.builtArea({category:'casa',details:{built_area_m2:120}}).label,'m² construídos');
 assert.equal(s.api.builtArea({category:'lote',details:{built_area_m2:120}}),null);
});
test('new property filters survive viewport updates and can be removed independently',()=>{
 const s=setup();s.api.applySaved({category:'apartamento',minBedrooms:2,minBathrooms:2,minParking:1,minBuiltArea:60});s.api.setViewport({west:-44,east:-43,south:-22,north:-21});assert.equal(s.api.get().minBedrooms,2);
 const chip=s.$('filter-chips').children.find(n=>n.children.some(c=>typeof c==='string'&&c.startsWith('Quartos:')));chip.onclick();assert.equal(s.api.get().minBedrooms,undefined);assert.equal(s.api.get().minParking,1);assert.equal(s.api.get().category,'apartamento');
});

test('colored type filter narrows categories, clears incompatible category and survives other filters',()=>{
 const s=setup();s.api.applySaved({category:'casa',minPrice:50000,city:'Curitiba'});s.$('quick-type').onclick();
 const form=s.panel.content.children[0],all=s.walk(form),commercial=all.find(n=>n.name==='property-group'&&n.value==='commercial');
 commercial.onchange();form.onsubmit({preventDefault(){}});
 assert.equal(s.api.get().propertyGroup,'commercial');assert.equal(s.api.get().category,undefined);assert.equal(s.api.get().minPrice,50000);
 s.api.setViewport({west:-44,east:-43,south:-22,north:-21});assert.equal(s.api.get().propertyGroup,'commercial');
 s.$('quick-type').onclick();const next=s.panel.content.children[0];assert.equal(s.walk(next).find(n=>n.name==='property-group'&&n.value==='commercial').checked,true);
 s.walk(next).find(n=>n.name==='property-group'&&n.value==='').onchange();next.onsubmit({preventDefault(){}});assert.equal(s.api.get().propertyGroup,undefined);assert.equal(s.api.get().city,'Curitiba');
});
test('location precision defaults to exact and round-trips approximate listings',()=>{
 const s=setup();s.api.fillEditor({category:'casa',terrain_context:'urban',details:{built_area_m2:120}});
 assert.equal(s.api.editorValues().location_precision,'exact');
 s.api.fillEditor({category:'casa',terrain_context:'urban',location_precision:'approximate',details:{built_area_m2:120}});
 assert.equal(s.api.editorValues().location_precision,'approximate');
 s.api.fillEditor(null);assert.equal(s.api.editorValues().location_precision,'exact');
});
test('the filters button counts chosen filters, ignoring the automatic visible-map window',()=>{
 const s=setup(),button=s.$('advanced-filters');
 const badge=()=>s.walk(button).find(n=>n.class==='filter-count');
 s.api.reset();
 assert.equal(badge().hidden,true);assert.equal(button.activeClass,null);
 s.api.setViewport({north:1,south:0,east:1,west:0});
 assert.equal(badge().hidden,true);assert.equal(button.activeClass,null);
 s.api.setArea({minPrice:1000,maxPrice:5000,propertyGroup:'land'});
 assert.equal(badge().hidden,false);assert.equal(badge().textContent,2);assert.equal(button.activeClass,'has-filters');assert.equal(button['aria-label'],'Filtros, 2 ativos');
 s.api.reset();assert.equal(badge().hidden,true);assert.equal(button['aria-label'],'Filtros');
});
