/* Printable "for sale" sign with a QR code that opens the listing (A4 portrait, 150 dpi). */
window.TerraPlaca=(()=>{
  const {el,dialog}=TerraUI;
  const W=1240,H=1754,GREEN='#164018',INK='#1f2a1f';
  function lines(ctx,text,maxWidth,maxLines){
    const words=String(text).split(/\s+/),out=[];let line='';
    for(const word of words){const next=line?line+' '+word:word;if(ctx.measureText(next).width<=maxWidth)line=next;else{if(line)out.push(line);line=word;}}
    if(line)out.push(line);
    if(out.length>maxLines){out.length=maxLines;out[maxLines-1]=out[maxLines-1].replace(/\s*\S*$/,'')+'…';}
    return out;
  }
  function summary(plot){
    const built=TerraFilters.builtArea(plot),d=plot.details||{};
    return [built?num(built.area)+' '+built.label:plot.area>=10000?(plot.area/10000).toLocaleString('pt-BR',{maximumFractionDigits:2})+' ha':num(plot.area)+' m²',d.bedrooms?d.bedrooms+(Number(d.bedrooms)===1?' quarto':' quartos'):'',[plot.neighborhood,plot.city].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  }
  async function draw(plot,url){
    await document.fonts?.ready;
    const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
    ctx.fillStyle=GREEN;ctx.fillRect(0,0,W,250);
    ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.font="700 150px 'Plus Jakarta Sans', Inter, sans-serif";ctx.fillText('VENDE-SE',W/2,135);
    let y=330;ctx.fillStyle=INK;ctx.font="700 62px 'Plus Jakarta Sans', Inter, sans-serif";
    for(const line of lines(ctx,plot.title,W-160,2)){ctx.fillText(line,W/2,y);y+=78;}
    ctx.fillStyle=GREEN;ctx.font="700 96px Inter, sans-serif";ctx.fillText(plot.price==null?'Consulte o valor':money(plot.price),W/2,y+40);y+=130;
    ctx.fillStyle='#4a5a4c';ctx.font='500 42px Inter, sans-serif';
    for(const line of lines(ctx,summary(plot),W-160,2)){ctx.fillText(line,W/2,y);y+=56;}
    const qr=qrcode(0,'M');qr.addData(url);qr.make();
    const count=qr.getModuleCount(),size=Math.min(760,H-(y+30)-340),cell=Math.floor(size/(count+8)),side=cell*(count+8),left=(W-side)/2,top=y+30;
    ctx.fillStyle='#fff';ctx.fillRect(left,top,side,side);ctx.strokeStyle='#d8e0d6';ctx.lineWidth=4;ctx.strokeRect(left,top,side,side);
    ctx.fillStyle='#000';for(let r=0;r<count;r++)for(let c=0;c<count;c++)if(qr.isDark(r,c))ctx.fillRect(left+(c+4)*cell,top+(r+4)*cell,cell,cell);
    y=top+side+70;ctx.fillStyle=INK;ctx.font='500 40px Inter, sans-serif';
    ctx.fillText('Aponte a câmera do celular e veja fotos,',W/2,y);ctx.fillText('preço e o mapa com os limites do imóvel',W/2,y+54);
    ctx.fillStyle=GREEN;ctx.font='700 48px Inter, sans-serif';ctx.fillText(url.replace(/^https?:\/\//,''),W/2,y+140);
    ctx.fillStyle=GREEN;ctx.fillRect(0,H-110,W,110);ctx.fillStyle='#fff';ctx.font="700 44px 'Plus Jakarta Sans', Inter, sans-serif";ctx.fillText(APP_BRAND.name.toUpperCase(),W/2,H-55);
    return canvas;
  }
  async function open(plot,url){
    const panel=dialog('QR Code para placa');
    const canvas=await draw(plot,url),image=el('img',{src:canvas.toDataURL('image/png'),alt:'Placa com QR Code do anúncio',class:'placa-preview'});
    const file='placa-'+(plot.short_code||plot.id)+'.png';
    const download=el('button',{class:'primary full',type:'button',onclick:()=>canvas.toBlob(blob=>{const a=el('a',{href:URL.createObjectURL(blob),download:file});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);},'image/png')},'Baixar imagem da placa');
    const print=el('button',{class:'full',type:'button',onclick:()=>{const w=window.open('','_blank');if(!w)return toast('Permita pop-ups para imprimir.');w.document.write(`<!doctype html><title>${file}</title><style>@page{size:A4;margin:0}body{margin:0}img{width:100%;display:block}</style><img src="${image.src}" onload="print()">`);w.document.close();}},'Imprimir');
    panel.content.append(el('p',{class:'small'},'Imprima e cole na placa do imóvel, ou mande para a gráfica. Quem apontar a câmera do celular abre o anúncio com fotos, preço e o mapa.'),image,download,print);
  }
  return {open,draw};
})();
