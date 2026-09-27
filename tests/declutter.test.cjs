const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
// DOM and Leaflet doubles: pins are 100×36 px boxes centred on their container point.
function load(){
 const ctx={document:{createElement:()=>({className:'',textContent:'',setAttribute(){}})}};ctx.window=ctx;
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/js/map/catalog.js','utf8'),ctx);return ctx.TerraCatalogMap;
}
function pin(id,x,y){
 const node={style:{},offsetWidth:100,offsetHeight:36,children:[],append(child){child.remove=()=>{node.children=node.children.filter(c=>c!==child);};node.children.push(child);},querySelector(){return node.children[0]||null;}};
 return {id,marker:{getElement:()=>node,getLatLng:()=>({x,y})},node};
}
const map={latLngToContainerPoint:point=>point};
test('overlapping price pins collapse into one pin with a +N badge',()=>{
 const api=load(),a=pin('a',0,0),b=pin('b',50,10),c=pin('c',300,0),d=pin('d',20,-15);
 api.declutter(map,[a,b,c,d]);
 assert.deepEqual(Array.from(a.group,e=>e.id),['b','d']);assert.equal(b.node.style.display,'none');assert.equal(d.node.style.display,'none');
 assert.equal(c.node.style.display,'');assert.equal(a.node.children[0].textContent,'+2');assert.equal(c.node.children.length,0);
});
test('the selected listing stays visible and regrouping clears previous badges',()=>{
 const api=load(),a=pin('a',0,0),b=pin('b',50,10);
 api.declutter(map,[a,b]);api.declutter(map,[a,b],'b');
 assert.equal(b.node.style.display,'');assert.equal(a.node.style.display,'none');assert.equal(a.node.children.length,0);assert.equal(b.node.children[0].textContent,'+1');
 a.marker.getLatLng=()=>({x:500,y:0});api.declutter(map,[a,b]);
 assert.equal(a.node.style.display,'');assert.equal(b.node.children.length,0);assert.equal(a.group.length,0);
});
