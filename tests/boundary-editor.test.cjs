const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function editor(){
 const nodes=new Map(),markers=[],listeners={};
 function el(tag,attrs={},...children){return Object.assign({children,style:{},hidden:false,append(...c){this.children.push(...c)},before(){},querySelector(){return el('div')},replaceChildren(...c){this.children=c},addEventListener(){},remove(){}},attrs);}
 const $=id=>{if(!nodes.has(id))nodes.set(id,el('div'));return nodes.get(id)};
 const ctx={window:{},TerraUI:{el,field:()=>el('label'),error(){}},$: $,document:{querySelector:()=>el('div'),addEventListener:(n,fn)=>listeners[n]=fn},Option:function(t,v){return {text:t,value:v}},points:[{lat:-21,lng:-43},{lat:-21,lng:-42.99},{lat:-20.99,lng:-42.99}],vertices:[],drawing:true,boundaryClosed:false,vertexDragging:false,saving:false,editId:'a',currentArea:100,ghost:{remove(){ctx.ghostRemoved=true}},drawn:{setLatLngs(p){ctx.drawnPoints=p.slice()}},num:String,toast:m=>ctx.message=m,moveMapProgrammatically(){},map:{getContainer:()=>({style:{}}),distance:()=>100}};
 ctx.L={divIcon:x=>x,latLng:(lat,lng)=>({lat,lng}),tooltip:()=>({setLatLng(){return this},setContent(){return this},addTo(){return this},remove(){}}),marker:(p,options)=>{const m={options,handlers:{},point:Array.isArray(p)?{lat:p[0],lng:p[1]}:p,on(n,fn){this.handlers[n]=fn;return this},addTo(){markers.push(this);return this},getLatLng(){return this.point},remove(){}};return m}};
 ctx.updateDraw=()=>{ctx.updates=(ctx.updates||0)+1;ctx.vertices=[];ctx.window.TerraEditorTools.renderHandles();ctx.window.TerraEditorTools.drawUpdated(ctx.points);ctx.$('distance').hidden=true;if(ctx.ghost)ctx.ghost.remove()};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/js/map/geometry.js','utf8'),ctx);ctx.TerraGeometry=ctx.window.TerraGeometry;vm.runInContext(fs.readFileSync('dist/js/map/editor.js','utf8'),ctx);
 return {ctx,markers,$,el,get close(){return nodes.get('unused')},render(){markers.length=0;ctx.window.TerraEditorTools.renderHandles()}};
}
test('closing by first vertex keeps exactly three points and stops the pending segment',()=>{
 const e=editor();e.render();e.markers[0].handlers.click();assert.equal(e.ctx.boundaryClosed,true);assert.equal(e.ctx.points.length,3);assert.equal(e.ctx.ghostRemoved,true);assert.equal(e.$('distance').hidden,true);
});
test('midpoints insert in ring order, including the closing edge; dragging updates that vertex',()=>{
 const e=editor();e.ctx.boundaryClosed=true;e.render();assert.equal(e.markers.length,6);
 const middle=e.markers[5];middle.handlers.click();assert.equal(e.ctx.points.length,4);assert.ok(Math.abs(e.ctx.points[3].lat+20.995)<1e-10);assert.equal(e.ctx.boundaryClosed,true);
 e.render();const vertex=e.markers[2];vertex.handlers.dragstart();assert.equal(e.ctx.vertexDragging,true);vertex.point={lat:-21.001,lng:-42.991};vertex.handlers.drag();vertex.handlers.dragend();assert.equal(e.ctx.points[1].lat,-21.001);assert.equal(e.ctx.vertexDragging,false);assert.ok(e.ctx.updates>=2);
});
test('self intersecting boundaries remain open, and saving blocks midpoint insertion',()=>{
 const e=editor();e.ctx.points=[{lat:0,lng:0},{lat:1,lng:1},{lat:0,lng:1},{lat:1,lng:0}];e.render();e.markers[0].handlers.click();assert.equal(e.ctx.boundaryClosed,false);assert.match(e.ctx.message,/cruzam/);e.ctx.saving=true;e.markers[1].handlers.click();assert.equal(e.ctx.points.length,4);
});
