const zlib=require('node:zlib');
function zip(text,{method=8,declaredSize,corrupt=false}={}){
 const input=Buffer.from(text),name=Buffer.from('doc.kml'),packed=method===8?zlib.deflateRawSync(input):input;
 let crc=-1;for(const b of input){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}crc=(crc^-1)>>>0;
 const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50);local.writeUInt16LE(method,8);local.writeUInt32LE(crc,14);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(input.length,22);local.writeUInt16LE(name.length,26);
 const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50);central.writeUInt16LE(method,10);central.writeUInt32LE(corrupt?0:crc,16);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(declaredSize??input.length,24);central.writeUInt16LE(name.length,28);
 const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(central.length+name.length,12);end.writeUInt32LE(local.length+name.length+packed.length,16);
 const data=Buffer.concat([local,name,packed,central,name,end]);return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
}

module.exports={zip};
