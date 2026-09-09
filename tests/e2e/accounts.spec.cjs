const {test,expect}=require('@playwright/test');
const {readiness,signedPage,drawImport,ownApi}=require('./staging.cjs');
const {account,reachable}=require('./helpers.cjs');

test('staging: ciclo A/B, rascunho, publicação, fotos, permissões e situações',async({browser,baseURL},info)=>{
  test.skip(info.project.name!=='desktop-chromium','O ciclo destrutivo roda uma vez; telas autenticadas têm suíte responsiva separada.');
  test.skip(Boolean(readiness()),readiness());test.setTimeout(240000);
  const a=await signedPage(browser,baseURL,'A'),b=await signedPage(browser,baseURL,'B');
  const title='QA E2E '+Date.now(),searchName=title+' alertas';let id;
  try{
    await a.page.locator('#announce').click();await drawImport(a.page);
    await a.page.locator('#title').fill(title);await a.page.locator('#save-listing').click();await expect(a.page.locator('#editor')).toBeHidden();
    await account(a.page,'Meus anúncios');let item=a.page.locator('.account-item').filter({hasText:title});await item.locator('.mini-card').click();
    id=new URL(a.page.url()).searchParams.get('terreno');expect(id).toMatch(/^[0-9a-f-]{36}$/);
    await b.page.goto('/?terreno='+id);await expect(b.page.getByRole('heading',{name:'Terreno indisponível'})).toBeVisible();
    await b.page.goto('/');await b.page.locator('#save-search').click();let save=b.page.getByRole('dialog',{name:'Salvar esta busca'});await save.getByLabel('Nome da busca').fill(searchName);await save.getByRole('button',{name:'Salvar busca',exact:true}).click();
    await a.page.locator('#edit-listing').click();await a.page.locator('#value').fill('123456');await a.page.locator('#city').fill('Juiz de Fora');await a.page.locator('#state').selectOption('MG');
    // Synthetic image only; no personal photos in test fixtures.
    await a.page.locator('#photos').setInputFiles({name:'qa.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGMUTfFgIAUwkaR6VMOohiGlAQCBiQDhxABa+QAAAABJRU5ErkJggg==','base64')});
    await a.page.locator('#listing-status').selectOption('published');await a.page.locator('#save-listing').click();await expect(a.page.locator('#editor')).toBeHidden();
    await b.page.goto('/?terreno='+id);await expect(b.page.locator('#detail-title')).toHaveText(title);await expect(b.page.locator('#owner-actions')).toBeHidden();await expect(b.page.locator('#detail-photo')).toBeVisible();await expect.poll(()=>b.page.locator('#detail-photo').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    const deniedEdit=await ownApi(b.context,b.config,'terra_listings?id=eq.'+id,'PATCH',{title:'FORGED QA'});expect([200,401,403]).toContain(deniedEdit.status());if(deniedEdit.ok())expect(await deniedEdit.json()).toEqual([]);
    const deniedDelete=await ownApi(b.context,b.config,'terra_listings?id=eq.'+id,'DELETE');expect([200,401,403]).toContain(deniedDelete.status());if(deniedDelete.ok())expect(await deniedDelete.json()).toEqual([]);
    await b.page.locator('#market-detail [data-favorite]').click();await expect(b.page.locator('#market-detail [data-favorite]')).toHaveAttribute('aria-pressed','true');
    if(process.env.E2E_TEST_CONTACT==='1'){
      // A must opt in to WhatsApp with a QA-owned number in staging.
      // Block external navigation: validate lead creation without sending messages.
      await b.context.route('https://wa.me/**',route=>route.abort('blockedbyclient'));
      const response=b.page.waitForResponse(r=>r.url().includes('/rpc/terra_record_event')&&r.request().postDataJSON()?.p_event==='whatsapp_click');
      const popup=b.page.waitForEvent('popup');await b.page.getByRole('button',{name:'Falar no WhatsApp',exact:true}).click();
      expect((await response).ok()).toBeTruthy();await (await popup).close();
    }
    await b.page.getByRole('button',{name:'Denunciar',exact:true}).click();const report=b.page.getByRole('dialog',{name:'Denunciar anúncio'});await report.getByLabel('Descreva o problema (opcional)').fill('Registro sintético do teste QA, remover com o anúncio.');await report.getByRole('button',{name:'Enviar denúncia'}).click();await expect(report).toBeHidden();
    await b.page.locator('#close-detail').click();await account(b.page,'Alertas');await expect(b.page.locator('.notification').filter({hasText:searchName})).toBeVisible();
    await a.page.goto('/?terreno='+id);await a.page.locator('#edit-listing').click();await a.page.locator('#boundary-method').selectOption('coordinates');const latitude=a.page.locator('#coordinate-editor input[aria-label=Latitude]').first();await latitude.fill('-21.8001');await a.page.locator('#title').fill(title+' editado');await a.page.locator('#save-listing').click();await expect(a.page.locator('#editor')).toBeHidden();
    for(const [status,label,publiclyVisible]of [['reserved','Reservado',true],['sold','Vendido',true],['paused','Pausado',false]]){
      await a.page.goto('/?terreno='+id);await a.page.getByLabel('Situação do anúncio').selectOption(status);await a.page.getByRole('button',{name:'Atualizar situação',exact:true}).click();await expect(a.page.locator('#detail-facts')).toContainText(label);
      await b.page.goto('/?terreno='+id);if(publiclyVisible)await expect(b.page.locator('#detail-facts')).toContainText(label);else await expect(b.page.getByRole('heading',{name:'Terreno indisponível'})).toBeVisible();
    }
    await a.page.locator('#delete-listing').click();await a.page.locator('#confirm-delete').click();await expect(a.page.locator('#delete-dialog')).toBeHidden();id=null;
    await a.page.locator('#account').click();await a.page.locator('#signout').click();await expect(a.page.locator('#account')).toHaveText('Entrar');
  }finally{
    // Cleanup after a failed assertion is limited to this test's synthetic ID.
    // A normal run deletes it through the owner UI before logging out.
    if(id){const cleanup=await ownApi(a.context,a.config,'terra_listings?id=eq.'+id,'DELETE');expect(cleanup.ok(),'Limpeza do anúncio sintético falhou; confira o staging').toBeTruthy();}
    const searches=await ownApi(b.context,b.config,'terra_saved_searches?name=eq.'+encodeURIComponent(searchName),'DELETE');expect(searches.ok()).toBeTruthy();
    await a.context.close();await b.context.close();
  }
});

test('staging: conta e cadastro acessíveis nos tamanhos mobile',async({page,browser,baseURL},info)=>{
  test.skip(Boolean(readiness()),readiness());
  const state=process.env.E2E_STATE_A;
  // Use the project viewport/touch settings, then import the genuine saved login.
  const context=await browser.newContext({viewport:info.project.use.viewport,isMobile:info.project.use.isMobile,hasTouch:info.project.use.hasTouch,deviceScaleFactor:1,baseURL,storageState:state});const target=await context.newPage();
  try{
    await target.goto('/');expect(await target.evaluate(()=>window.TERRA_CONFIG.supabaseUrl)).toBe(process.env.E2E_SUPABASE_URL);await expect(target.locator('#account')).toHaveText('Minha conta');
    await account(target,'Perfil');const profile=target.getByRole('dialog',{name:'Minha conta',exact:true});await reachable(profile.getByRole('button',{name:'Salvar perfil',exact:true}));await profile.getByRole('button',{name:'Fechar',exact:true}).click();
    await target.locator('#announce').click();await target.locator('#boundary-method').selectOption('coordinates');await expect(target.locator('#coordinate-editor')).toBeVisible();await reachable(target.locator('#save-listing'));await reachable(target.locator('#cancel'));await target.locator('#cancel').click();
  }finally{await context.close();}
});
