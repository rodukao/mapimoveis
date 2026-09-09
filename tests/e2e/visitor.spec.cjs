const {test,expect}=require('@playwright/test');
const {catalog,showList,openFirst,reachable,runtimeErrors}=require('./helpers.cjs');
test.beforeEach(async({page})=>{await catalog(page);});

test('visitante: catálogo, mapa, lista e URL individual',async({page})=>{
  const errors=runtimeErrors(page);await expect(page.locator('#map .leaflet-tile-loaded').first()).toBeVisible();
  await expect(page.locator('#map .leaflet-overlay-pane path').first()).toBeAttached();
  const id=await openFirst(page);const title=await page.locator('#detail-title').innerText();await reachable(page.locator('#close-detail'));
  await page.goto('/?terreno='+id);await expect(page.locator('#detail-title')).toHaveText(title);await expect(page.locator('#listing-detail')).toBeVisible();
  await expect(page.locator('#owner-actions')).toBeHidden();expect(errors).toEqual([]);
});
test('visitante: galeria, miniaturas, lightbox e ampliação',async({page})=>{
  await showList(page);const card=page.locator('#cards .card').filter({has:page.locator('.card-media:not([hidden])')}).first();
  await expect(card).toBeAttached();await card.locator('.card-open').click();await expect(page.locator('#detail-photo')).toBeVisible();
  await expect.poll(()=>page.locator('#detail-photo').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
  if(await page.locator('#photo-next').isVisible()){const before=await page.locator('#photo-counter').innerText();await page.locator('#photo-next').click();await expect(page.locator('#photo-counter')).not.toHaveText(before);}
  await reachable(page.locator('#expand-photo'));await page.locator('#expand-photo').click();await expect(page.locator('#photo-lightbox')).toBeVisible();
  await reachable(page.locator('#photo-zoom'));await page.locator('#photo-zoom').click();await expect(page.locator('#photo-zoom')).toHaveAttribute('aria-pressed','true');
  await reachable(page.locator('#close-lightbox'));await page.locator('#close-lightbox').click();await expect(page.locator('#listing-detail')).toBeVisible();
});
test('visitante: favorito solicita autenticação',async({page})=>{
  await showList(page);await page.locator('#cards [data-favorite]').first().click();await expect(page.locator('#auth-dialog')).toBeVisible();await expect(page.locator('#auth-email')).toBeVisible();await reachable(page.locator('#close-auth'));
});
test('visitante: filtros compartilhados, hectares e chips removíveis',async({page})=>{
  await page.locator('#quick-area').click();const panel=page.getByRole('dialog',{name:'Filtrar por área',exact:true});
  await panel.getByLabel('Unidade de área').selectOption('10000');await panel.getByLabel('Área mínima',{exact:true}).fill('0.01');await reachable(panel.getByRole('button',{name:'Aplicar filtros'}));await panel.getByRole('button',{name:'Aplicar filtros'}).click();
  await showList(page);await expect(page.locator('#filter-chips')).toContainText('100 m²');await page.locator('#filter-chips button').filter({hasText:'Área'}).click();await expect(page.locator('#filter-chips')).not.toContainText('100 m²');
});
test('visitante: cidade e CEP real sem posição inventada',async({page})=>{
  await page.locator('#location-query').fill('Juiz de Fora, MG');await page.locator('#location-submit').click();await expect(page.locator('#location-results button').first()).toBeVisible();await page.locator('#location-results button').first().click();
  await showList(page);await expect(page.locator('#filter-chips')).toContainText('Juiz de Fora');
  await page.locator('#location-query').fill('36010-000');await page.locator('#location-submit').click();await expect(page.locator('#location-results button').first()).toBeVisible();
});
test('visitante: busca automática substitui o antigo botão de área',async({page})=>{
  await expect(page.getByRole('button',{name:'Buscar nesta área',exact:true})).toHaveCount(0);
  await reachable(page.locator('.leaflet-control-zoom-in'));
  const request=page.waitForRequest(r=>r.url().includes('/rpc/terra_search_listings')&&Boolean(r.postDataJSON()?.p_filters?.bounds));
  await page.locator('.leaflet-control-zoom-in').click();const r=await request;expect(r.postDataJSON().p_limit).toBe(50);await expect(page.locator('#catalog-update')).toBeHidden();
});
test('visitante: formulários de conta e recuperação, sem enviar credenciais',async({page})=>{
  await page.locator('#account').click();await expect(page.locator('#auth-heading')).toHaveText('Entre para anunciar');
  await page.getByRole('button',{name:'Mostrar senha',exact:true}).click();await expect(page.locator('#auth-password')).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Ocultar senha',exact:true}).click();await expect(page.locator('#auth-password')).toHaveAttribute('type','password');
  await page.locator('#switch-auth').click();await expect(page.locator('#auth-heading')).toHaveText('Crie sua conta');await expect(page.locator('#auth-name')).toBeVisible();
  // Submission depends on a real human CAPTCHA and confirmation email.
  await page.locator('#auth-submit').scrollIntoViewIfNeeded();await expect(page.locator('#auth-submit')).toBeInViewport({ratio:1});
  await page.locator('#switch-auth').click();await page.locator('#forgot-password').click();await expect(page.locator('#auth-heading')).toHaveText('Recupere sua senha');await expect(page.locator('#password-label')).toBeHidden();
  await page.locator('#auth-submit').scrollIntoViewIfNeeded();await expect(page.locator('#auth-submit')).toBeInViewport({ratio:1});await page.locator('#close-auth').click();
});
test('visitante: área desenhada permanece ativa ao navegar',async({page})=>{
  await page.getByRole('button',{name:'Desenhar área de interesse',exact:true}).click();
  const map=page.locator('#map'),box=await map.boundingBox();
  for(const [x,y]of [[.40,.40],[.70,.40],[.70,.64],[.40,.64]])await map.click({position:{x:box.width*x,y:box.height*y}});
  const request=page.waitForRequest(r=>r.url().includes('/rpc/terra_search_listings')&&Boolean(r.postDataJSON()?.p_filters?.polygon));
  await page.getByRole('button',{name:/Concluir área/}).click();await request;
  const chip=page.getByRole('button',{name:'Remover área de interesse',exact:true});await expect(chip).toBeVisible();await page.locator('.leaflet-control-zoom-in').click();await expect(chip).toBeVisible();await chip.click();await expect(chip).toBeHidden();
});
test('visitante: comparação de dois anúncios e controles sem cortes',async({page})=>{
  await showList(page);const checks=page.locator('#cards [data-compare]');await expect(checks.nth(1)).toBeAttached();await checks.nth(0).check();await checks.nth(1).check();await reachable(page.locator('#open-comparison'));await page.locator('#open-comparison').click();
  const panel=page.getByRole('dialog',{name:'Comparar terrenos',exact:true});await expect(panel.locator('.compare-table')).toBeVisible();await reachable(panel.getByRole('button',{name:'Fechar',exact:true}));await expect(panel.locator('.compare-map .leaflet-tile').first()).toBeAttached();
});
test('visitante: semelhantes, Raio-X e contato acessível sem enviar mensagem',async({page})=>{
  await openFirst(page);await expect(page.getByRole('heading',{name:'Terrenos semelhantes'})).toBeAttached();
  const ray=page.getByRole('button',{name:'Consultar dados geográficos'});await reachable(ray);await ray.click();
  await expect(page.locator('.rayx')).toContainText(/Fontes:|Não foi possível/);
  const whatsapp=page.getByRole('button',{name:'Falar no WhatsApp',exact:true});if(await whatsapp.count())await reachable(whatsapp);
});
test('visitante: compartilhamento oferece link do anúncio',async({page})=>{
  // Native share sheets are platform UI; exercise the supported link fallback.
  await page.addInitScript(()=>{Object.defineProperty(navigator,'share',{value:undefined,configurable:true});});
  await catalog(page);await openFirst(page);await page.getByRole('button',{name:'Compartilhar',exact:true}).click();const panel=page.getByRole('dialog',{name:'Compartilhar terreno',exact:true});await reachable(panel.getByRole('button',{name:'Copiar link'}));
  await expect(panel.getByRole('link',{name:'Compartilhar no WhatsApp'})).toHaveAttribute('href',/terreno%3D/);
});
