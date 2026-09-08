/* Small, bounded geometry importer. No external parsing dependency or file upload. */
window.TerraGeometry = (() => {
  const MAX_BYTES=5*1024*1024;
  const fail=message=>{throw new Error(message);};
  const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a[0]===b[0]&&a[1]===b[1];
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  function onSegment(a,b,p){return Math.abs(cross(a,b,p))<1e-14&&p[0]>=Math.min(a[0],b[0])-1e-12&&p[0]<=Math.max(a[0],b[0])+1e-12&&p[1]>=Math.min(a[1],b[1])-1e-12&&p[1]<=Math.max(a[1],b[1])+1e-12;}
  function intersects(a,b,c,d){const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);return x*y<0&&z*w<0||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);}
  function area(points){let sum=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];sum+=(b[0]-a[0])*Math.PI/180*(2+Math.sin(a[1]*Math.PI/180)+Math.sin(b[1]*Math.PI/180));}return Math.abs(sum*6378137**2/2);}
  function polygon(vertices) {
    if(!Array.isArray(vertices))fail('As coordenadas do polígono são inválidas.');
    let points=vertices.map(point=>{if(!Array.isArray(point)||point.length<2||!point.slice(0,2).every(Number.isFinite))fail('Use longitude e latitude em graus decimais.');return point.slice(0,2);});
    if(points.length>1&&same(points[0],points.at(-1)))points=points.slice(0,-1);
    if(points.length<3||points.length>200)fail('Use de 3 a 200 vértices.');
    for(const point of points)if(Math.abs(point[0])>180||Math.abs(point[1])>85)fail('Coordenadas fora do intervalo. Use longitude/latitude WGS84, em graus decimais.');
    if(new Set(points.map(p=>p.join(','))).size!==points.length)fail('Há vértices repetidos. Remova os pontos duplicados.');
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];if(Math.abs(b[0]-a[0])>180)fail('Polígonos que cruzam a linha de mudança de data não são aceitos.');
      for(let j=i+1;j<points.length;j++){if(j===i+1||i===0&&j===points.length-1)continue;if(intersects(a,b,points[j],points[(j+1)%points.length]))fail('Os limites se cruzam ou se tocam. Revise os vértices.');}
    }
    const size=area(points);if(size<1||size>1e10)fail('A área precisa estar entre 1 m² e 1 milhão de hectares.');
    return {type:'Polygon',coordinates:[[...points,[...points[0]]]]};
  }
  function geojson(value) {
    if(value?.crs && !/4326|CRS84/i.test(JSON.stringify(value.crs)))fail('Converta o arquivo para WGS84 (EPSG:4326).');
    let geometries;
    if(value?.type==='FeatureCollection')geometries=value.features?.map(f=>f.geometry).filter(g=>g?.type==='Polygon'||g?.type==='MultiPolygon');
    else geometries=[value?.type==='Feature'?value.geometry:value];
    if(!geometries||geometries.length!==1||geometries[0]?.type!=='Polygon')fail('Importe um único polígono. Arquivos com múltiplas áreas não são aceitos.');
    const rings=geometries[0].coordinates;
    if(!Array.isArray(rings)||rings.length!==1)fail('Polígonos com buracos não são aceitos.');
    if(!Array.isArray(rings[0])||rings[0].length<4||!same(rings[0][0],rings[0].at(-1)))fail('O anel GeoJSON precisa terminar na mesma coordenada em que começou.');
    return polygon(rings[0]);
  }
  function kml(text) {
    if(/<!DOCTYPE|<!ENTITY/i.test(text))fail('KML com declarações externas não é aceito.');
    const xml=new DOMParser().parseFromString(text,'application/xml');
    if(xml.getElementsByTagName('parsererror').length)fail('O arquivo KML está malformado.');
    const polygons=xml.getElementsByTagNameNS('*','Polygon');
    if(polygons.length!==1)fail('O arquivo deve conter um único polígono.');
    const p=polygons[0];if(p.getElementsByTagNameNS('*','innerBoundaryIs').length)fail('Polígonos com buracos não são aceitos.');
    const textCoordinates=p.getElementsByTagNameNS('*','outerBoundaryIs')[0]?.getElementsByTagNameNS('*','coordinates')[0]?.textContent?.trim();
    if(!textCoordinates)fail('Não encontramos o perímetro no arquivo KML.');
    return polygon(textCoordinates.split(/\s+/).map(tuple=>{const parts=tuple.split(',').slice(0,2);if(parts.length<2||parts.some(x=>!x.trim()))fail('As coordenadas do KML estão incompletas.');return parts.map(Number);}));
  }
  function crc32(bytes){let crc=-1;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}return (crc^-1)>>>0;}
  async function kmz(buffer) {
    const bytes=new Uint8Array(buffer),view=new DataView(buffer);let end=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
    if(end<0)fail('O arquivo KMZ não contém um ZIP válido.');
    if(view.getUint16(end+4,true)||view.getUint16(end+6,true))fail('KMZ dividido em vários volumes não é aceito.');
    let offset=view.getUint32(end+16,true),count=view.getUint16(end+10,true);const files=[];
    if(count>1000)fail('O KMZ possui arquivos demais. Exporte apenas o perímetro.');
    for(let i=0;i<count;i++){
      if(offset+46>bytes.length||view.getUint32(offset,true)!==0x02014b50)fail('O índice do KMZ está corrompido.');
      const nameLength=view.getUint16(offset+28,true),extra=view.getUint16(offset+30,true),comment=view.getUint16(offset+32,true),name=new TextDecoder().decode(bytes.slice(offset+46,offset+46+nameLength));
      if(/\.kml$/i.test(name))files.push({flags:view.getUint16(offset+8,true),method:view.getUint16(offset+10,true),crc:view.getUint32(offset+16,true),compressed:view.getUint32(offset+20,true),size:view.getUint32(offset+24,true),offset:view.getUint32(offset+42,true)});
      offset+=46+nameLength+extra+comment;
    }
    if(files.length!==1)fail('Use um KMZ com um único arquivo KML.');
    const entry=files[0];if(entry.flags&1)fail('KMZ protegido por senha não é aceito.');
    if(entry.size>MAX_BYTES||entry.compressed>MAX_BYTES)fail('O conteúdo descompactado deve ter até 5 MB.');
    if(entry.offset+30>bytes.length||view.getUint32(entry.offset,true)!==0x04034b50)fail('O conteúdo do KMZ está corrompido.');
    const start=entry.offset+30+view.getUint16(entry.offset+26,true)+view.getUint16(entry.offset+28,true);
    if(start+entry.compressed>bytes.length)fail('O KMZ está incompleto.');
    const compressed=bytes.slice(start,start+entry.compressed);let output;
    if(entry.method===0)output=compressed;
    else if(entry.method===8){
      let decoder;try{decoder=new DecompressionStream('deflate-raw');}catch(_){fail('Este navegador não consegue abrir KMZ. Extraia o KML e importe-o.');}
      const reader=new Blob([compressed]).stream().pipeThrough(decoder).getReader(),chunks=[];let length=0;
      while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>MAX_BYTES){await reader.cancel();fail('O conteúdo descompactado excede 5 MB.');}chunks.push(value);}
      output=new Uint8Array(length);let at=0;for(const chunk of chunks){output.set(chunk,at);at+=chunk.length;}
    }else fail('A compressão deste KMZ não é suportada. Importe o KML extraído.');
    if(output.length!==entry.size||crc32(output)!==entry.crc)fail('O KMZ está corrompido. Exporte o arquivo novamente.');
    return kml(new TextDecoder().decode(output));
  }
  async function read(file) {
    if(!file||file.size>MAX_BYTES)fail('Use um arquivo de até 5 MB.');
    const ext=file.name.split('.').at(-1).toLowerCase();
    if(ext==='kmz')return kmz(await file.arrayBuffer());
    const text=await file.text();
    if(ext==='kml')return kml(text);
    if(ext==='json'||ext==='geojson'){let value;try{value=JSON.parse(text);}catch(_){fail('O arquivo JSON está malformado.');}return geojson(value);}
    fail('Use GeoJSON, JSON, KML ou KMZ.');
  }
  return {polygon,geojson,kml,kmz,read,area};
})();
