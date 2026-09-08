const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function library(){const ctx={setTimeout,clearTimeout};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/js/map/catalog.js','utf8'),ctx);return ctx.TerraCatalogMap;}
function fakeMap(){
 const handlers={};let west=-44;const map={on(name,fn){(handlers[name]??=[]).push(fn);return map;},emit(name){for(const fn of handlers[name]||[])fn();},getBounds:()=>({getWest:()=>west,getEast:()=>west+1,getSouth:()=>-22,getNorth:()=>-21}),getZoom:()=>14,stop(){},setView(){return map;},fitBounds(b,options){map.lastOptions=options;map.emit('movestart');map.emit('moveend');return map;},invalidateSize(){map.emit('moveend');},pan(){west+=.01;map.emit('movestart');map.emit('moveend');},getContainer:()=>({style:{}})};return map;
}
function scheduled(search=async()=>true){const jobs=new Map();let id=0,calls=0,invalidations=0,blocked=false;const map=fakeMap();const controller=library().viewport(map,{blocked:()=>blocked,invalidate:()=>invalidations++,search:async b=>{calls++;return search(b);},schedule:fn=>{jobs.set(++id,fn);return id;},unschedule:id=>jobs.delete(id)});return {map,controller,jobs,block:value=>blocked=value,get calls(){return calls;},get invalidations(){return invalidations;},flush:async()=>{for(const [id,fn]of [...jobs]){jobs.delete(id);await fn();}}};}
test('manual movement debounces, deduplicates rounded bounds, and programmatic moves do not search',async()=>{
 const s=scheduled();s.map.pan();s.map.pan();s.map.pan();assert.equal(s.jobs.size,1);assert.equal(s.calls,0);await s.flush();assert.equal(s.calls,1);
 s.map.emit('movestart');s.map.emit('moveend');await s.flush();assert.equal(s.calls,1);
 s.controller.move('fitBounds',[],{maxZoom:17});await s.flush();assert.equal(s.calls,1);assert.equal(s.map.lastOptions.animate,false);
 s.map.pan();await s.flush();assert.equal(s.calls,2);
});
test('drawing and active interest polygons suspend viewport search; next manual move resumes it',async()=>{
 const s=scheduled();s.map.pan();s.controller.cancel();s.block(true);await s.flush();s.map.pan();await s.flush();assert.equal(s.calls,0);
 s.block(false);s.map.pan();await s.flush();assert.equal(s.calls,1);
});
test('a failed viewport query is retryable at the same bounds',async()=>{
 let ok=false;const s=scheduled(async()=>ok);s.map.pan();await s.flush();ok=true;s.map.emit('movestart');s.map.emit('moveend');await s.flush();assert.equal(s.calls,2);
});
test('filters and programmatic navigation cancel a pending manual debounce',async()=>{
 const s=scheduled();s.map.pan();s.controller.cancel();await s.flush();assert.equal(s.calls,0);
 s.map.pan();s.controller.move('fitBounds',[]);await s.flush();assert.equal(s.calls,0);
});
test('hover and focus share existing layers, restore selection, and only explicit selection scrolls',()=>{
 const c=library().interactions();let style,scroll=0,front=0;const layer={setStyle:s=>style=s,bringToFront:()=>front++},card={classList:{toggle(){}},querySelector:()=>({setAttribute(){},removeAttribute(){}}),getBoundingClientRect:()=>({top:600,bottom:700}),closest:()=>({getBoundingClientRect:()=>({top:0,bottom:500})}),scrollIntoView:options=>{assert.equal(options.block,'nearest');scroll++;}};
 c.register('one',layer,card);assert.equal(style.weight,3);c.highlightListing('one','card');assert.equal(style.weight,5);assert.equal(scroll,0);
 c.highlightListing('one','focus');c.unhighlightListing('one','card');assert.equal(style.weight,5);c.unhighlightListing('one','focus');assert.equal(style.weight,3);
 c.selectListing('one',true);assert.equal(scroll,1);assert.equal(style.weight,6);c.highlightListing('one');c.unhighlightListing('one');assert.equal(style.weight,6);assert.equal(c.layers.get('one'),layer);assert.equal(c.layers.size,1);assert.ok(front>0);
 c.selectListing('other');assert.equal(style.weight,3);
});

// Small DOM/Leaflet doubles execute the actual catalog loader. They verify request
// ordering and retained data, not browser rendering or real tile availability.
function application(){
 const nodes=new Map();function node(){return {hidden:false,disabled:false,value:'',textContent:'',style:{},dataset:{},classList:{toggle(){},add(){},remove(){}},replaceChildren(){},append(){},addEventListener(){},setAttribute(){},removeAttribute(){},querySelector(){return node();}};}
 const $=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};const map=fakeMap();let polygons=0;
 const layer=()=>({on(){return this;},addTo(){return this;},remove(){},setStyle(){},bringToFront(){},getElement:node});
 const L={map:()=>map,control:{zoom:layer,scale:layer},tileLayer:layer,polygon(){polygons++;return layer();},marker:layer,divIcon:x=>x};
 const requests=[],events=[];const ctx={console,setTimeout,clearTimeout,structuredClone,crypto:require('node:crypto').webcrypto,CustomEvent:class{constructor(type){this.type=type;}},L,document:{getElementById:$,createElement:node,addEventListener(){},dispatchEvent:event=>events.push(event.type),body:node()},TerraData:{explain:e=>e.message},TerraFilters:{categories:{},get:()=>({city:'Curitiba',maxPrice:200000})},TerraMarketData:{search:(...args)=>new Promise((resolve,reject)=>requests.push({args,resolve,reject}))},closeDetail(){},matchMedia:()=>({matches:true})};ctx.window=ctx;vm.createContext(ctx);for(const file of ['dist/js/map/catalog.js','dist/app.js'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx);
 const row=id=>({id,owner_id:'a',title:id,price_brl:100,area_m2:100,latitude:-21,longitude:-43,city:'Curitiba',state:'PR',category:'residencial',status:'published',boundary_geojson:{type:'Polygon',coordinates:[[[-43,-21],[-42.99,-21],[-42.99,-20.99],[-43,-21]]]}});
 return {ctx,requests,$,row,eval:code=>vm.runInContext(code,ctx),get polygons(){return polygons;}};
}
test('pending refresh and failure retain existing cards and polygons, preserve filters, and show area error',async()=>{
 const a=application();const first=a.eval('loadListings()');a.requests[0].resolve({rows:[a.row('old')],total:1});await first;
 const count=a.polygons,refresh=a.eval('loadListings(false,true)');assert.equal(a.eval('plots[0].id'),'old');assert.equal(a.polygons,count);assert.equal(a.requests[1].args[0].city,'Curitiba');assert.equal(a.requests[1].args[0].maxPrice,200000);
 a.requests[1].reject(new Error('offline'));assert.equal(await refresh,false);assert.equal(a.eval('plots[0].id'),'old');assert.equal(a.polygons,count);assert.match(a.$('catalog-update').textContent,/Não foi possível atualizar os terrenos desta área/);
});
test('late responses cannot overwrite newer results, including during the next manual debounce',async()=>{
 const a=application(),old=a.eval('loadListings(false,true)'),fresh=a.eval('loadListings(false,true)');a.requests[1].resolve({rows:[a.row('fresh')],total:1});await fresh;a.requests[0].resolve({rows:[a.row('old')],total:1});assert.equal(await old,false);assert.equal(a.eval('plots[0].id'),'fresh');
 const pending=a.eval('loadListings(false,true)');a.eval('viewportSearch.cancel()');a.requests[2].resolve({rows:[a.row('late')],total:1});assert.equal(await pending,false);assert.equal(a.eval('plots[0].id'),'fresh');
});
