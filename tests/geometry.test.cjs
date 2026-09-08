const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),zlib=require('node:zlib'),{execFileSync}=require('node:child_process');
// XML fixture adapter uses an independent XML parser; browser-specific rendering is not asserted.
class XMLParser {
 parseFromString(text){
  const script="import sys,json,xml.etree.ElementTree as E\ndef tree(e): return {'name':e.tag.split('}')[-1], 'text':''.join(e.itertext()), 'children':[tree(x) for x in e]}\ntry: print(json.dumps(tree(E.fromstring(sys.stdin.read()))))\nexcept: print(json.dumps({'name':'parsererror','text':'invalid','children':[]}))";
  const value=JSON.parse(execFileSync('python',['-c',script],{input:text,encoding:'utf8'}));
  const convert=(x,document=false)=>{const descendants=(name,includeSelf=false)=>[...(includeSelf&&x.name===name?[convert(x)]:[]),...x.children.flatMap(c=>[...(c.name===name?[convert(c)]:[]),...convert(c).getElementsByTagNameNS('*',name)])];return {textContent:x.text,getElementsByTagNameNS:(ns,name)=>descendants(name,document),getElementsByTagName:name=>descendants(name,document)}};
  return convert(value,true);
 }
}
const ctx={window:{},DOMParser:XMLParser,Uint8Array,DataView,TextDecoder,Blob,DecompressionStream};vm.createContext(ctx);vm.runInContext(fs.readFileSync('dist/js/map/geometry.js','utf8'),ctx);const g=ctx.window.TerraGeometry;
const ring=[[-43.35,-21.76],[-43.349,-21.76],[-43.349,-21.759],[-43.35,-21.759],[-43.35,-21.76]];
const kml='<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>'+ring.map(p=>p.join(',')+',100').join(' ')+'</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>';
test('GeoJSON preserves longitude/latitude axis order and closes exactly one ring',()=>{
 const value=g.geojson({type:'Feature',geometry:{type:'Polygon',coordinates:[ring]}});assert.equal(JSON.stringify(value.coordinates),JSON.stringify([ring]));assert.ok(g.area(ring.slice(0,-1))>10000&&g.area(ring.slice(0,-1))<12000);
});
test('rejects crossings, duplicate vertices, holes, multiple polygons, bad coordinates and projected CRS',()=>{
 for(const points of [[[-43,-21],[-42.99,-20.99],[-43,-20.99],[-42.99,-21]],[[-43,-21],[-42.99,-21],[-43,-21],[-43,-20.99]],[[Infinity,-21],[-42,-21],[-42,-20]],[[350000,7500000],[350100,7500000],[350100,7500100]]])assert.throws(()=>g.polygon(points));
 assert.throws(()=>g.geojson({type:'Polygon',coordinates:[ring,ring]}),/buracos/);
 assert.throws(()=>g.geojson({type:'FeatureCollection',features:[1,2].map(()=>({type:'Feature',geometry:{type:'Polygon',coordinates:[ring]}}))}),/único/);
 assert.throws(()=>g.geojson({type:'Polygon',crs:{name:'EPSG:31983'},coordinates:[ring]}),/WGS84/);
 assert.throws(()=>g.geojson({type:'Polygon',coordinates:[[null,1,2,null]]}),/anel/);
});
test('vertex bounds prevent oversized imports and degenerate area',()=>{assert.throws(()=>g.polygon(Array.from({length:201},(_,i)=>[-43+Math.cos(i)*.01,-21+Math.sin(i)*.01])),/200/);assert.throws(()=>g.polygon([[0,0],[.000000001,0],[0,.000000001]]),/área/)});
test('KML reads namespaced polygons, ignores altitude and rejects holes or external declarations',()=>{
 assert.equal(JSON.stringify(g.kml(kml).coordinates),JSON.stringify([ring]));
 assert.throws(()=>g.kml('<!DOCTYPE kml>'+kml),/externas/);
 assert.throws(()=>g.kml(kml.replace('</Polygon>','<innerBoundaryIs/></Polygon>')),/buracos/);
 assert.throws(()=>g.kml(kml.replace('-43.35,-21.76,100','-43.35,,100')),/incompletas/);
});
function zip(text,{method=8,declaredSize,corrupt=false}={}){
 const input=Buffer.from(text),name=Buffer.from('doc.kml'),packed=method===8?zlib.deflateRawSync(input):input;
 let crc=-1;for(const b of input){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}crc=(crc^-1)>>>0;
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(method,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(input.length,22);local.writeUInt16LE(name.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(method,10);central.writeUInt32LE(corrupt?0:crc,16);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(declaredSize??input.length,24);central.writeUInt16LE(name.length,28);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+packed.length,16);
 const data=Buffer.concat([local,name,packed,central,name,end]);return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
}
test('KMZ reads stored and DEFLATE compressed perimeters with CRC verification',async()=>{for(const method of [0,8])assert.equal(JSON.stringify((await g.kmz(zip(kml,{method}))).coordinates),JSON.stringify([ring]));await assert.rejects(g.kmz(zip(kml,{corrupt:true})),/corrompido/)});
test('KMZ rejects zip bombs and malformed archives without returning partial geometry',async()=>{await assert.rejects(g.kmz(zip(kml,{declaredSize:10*1024*1024})),/5 MB/);await assert.rejects(g.kmz(new ArrayBuffer(8)),/ZIP/);await assert.rejects(g.kmz(zip(kml,{method:99})),/compressão/)});
