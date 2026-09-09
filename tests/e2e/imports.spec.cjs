const {test,expect}=require('@playwright/test');
const {readiness,signedPage,boundary}=require('./staging.cjs');
const {zip}=require('./fixtures.cjs');
const kml='<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><Polygon><outerBoundaryIs><LinearRing><coordinates>'+boundary.coordinates[0].map(p=>p.join(',')).join(' ')+'</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></kml>';
const cases=[
  ['válido.geojson',JSON.stringify(boundary),/Arquivo importado com sucesso/],
  ['inválido.geojson','{broken',/JSON está malformado/],
  ['válido.kml',kml,/Arquivo importado com sucesso/],
  ['inválido.kml','<kml><Polygon>',/KML está malformado/],
  ['válido.kmz',Buffer.from(zip(kml)),/Arquivo importado com sucesso/],
  ['inválido.kmz',Buffer.from('not a zip'),/ZIP válido/],
  ['duplicado.geojson',JSON.stringify({type:'Polygon',coordinates:[[[-43,-21],[-42.99,-21],[-43,-21],[-43,-20.99],[-43,-21]]]}),/vértices repetidos/],
  ['cruzado.geojson',JSON.stringify({type:'Polygon',coordinates:[[[-43,-21],[-42.99,-20.99],[-43,-20.99],[-42.99,-21],[-43,-21]]]}),/limites se cruzam/]
];
for(const [name,contents,message]of cases){
  test('staging: importar '+name,async({browser,baseURL},info)=>{
    test.skip(info.project.name!=='desktop-chromium','Importações executadas uma vez; coordenadas também cobertas no mobile.');
    test.skip(Boolean(readiness()),readiness());const a=await signedPage(browser,baseURL,'A');
    try{
      await a.page.locator('#announce').click();await a.page.locator('#boundary-method').selectOption('import');
      await a.page.locator('.boundary-tools input[type=file]').setInputFiles({name,mimeType:'application/octet-stream',buffer:Buffer.from(contents)});
      await expect(a.page.locator('.boundary-tools')).toContainText(message);
      // Parsing remains local; cancel without creating a listing.
      await a.page.locator('#cancel').click();await expect(a.page.locator('#editor')).toBeHidden();
    }finally{await a.context.close();}
  });
}
test('staging: coordenadas válidas e inválidas preservam o último desenho',async({browser,baseURL},info)=>{
  test.skip(Boolean(readiness()),readiness());const a=await signedPage(browser,baseURL,'A',info.project.use);
  try{
    await a.page.locator('#announce').click();await a.page.locator('#boundary-method').selectOption('coordinates');
    const lat=a.page.getByRole('textbox',{name:'Latitude',exact:true}),lng=a.page.getByRole('textbox',{name:'Longitude',exact:true});
    for(let i=0;i<3;i++){await lat.nth(i).fill(String(boundary.coordinates[0][i][1]));await lng.nth(i).fill(String(boundary.coordinates[0][i][0]));}
    await expect(a.page.locator('#coordinate-editor')).toContainText('Desenho atualizado');
    const area=await a.page.locator('#draw-area').innerText();await lat.first().fill('95');
    await expect(a.page.locator('#coordinate-editor')).toContainText('último desenho válido foi mantido');await expect(a.page.locator('#draw-area')).toHaveText(area);
    await a.page.locator('#cancel').click();
  }finally{await a.context.close();}
});
