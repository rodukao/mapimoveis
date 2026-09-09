const {expect}=require('@playwright/test');
async function catalog(page){
  await page.goto('/');
  await expect(page.locator('#count')).toContainText('terrenos encontrados');
  await expect(page.locator('#catalog-update')).toBeHidden();
  await expect(page.locator('#cards .card').first()).toBeAttached();
}
async function showList(page){const toggle=page.locator('#mobile-toggle');if(await toggle.isVisible())await toggle.click();}
async function openFirst(page){await showList(page);const card=page.locator('#cards .card').first();const id=await card.getAttribute('data-listing-id');await card.locator('.card-open').click();await expect(page.locator('#listing-detail')).toBeVisible();await expect(page).toHaveURL(new RegExp('terreno='+id));return id;}
async function reachable(locator){
  await locator.scrollIntoViewIfNeeded();await expect(locator).toBeVisible();
  const box=await locator.boundingBox();expect(box).toBeTruthy();
  const viewport=await locator.evaluate(()=>({w:innerWidth,h:innerHeight}));
  expect(box.x).toBeGreaterThanOrEqual(-1);expect(box.x+box.width).toBeLessThanOrEqual(viewport.w+1);
  expect(box.y).toBeGreaterThanOrEqual(-1);expect(box.y+box.height).toBeLessThanOrEqual(viewport.h+1);
  await expect(locator).toBeEnabled();
  // Trial click also detects a fixed footer or overlay covering the control.
  await locator.click({trial:true});
}
function runtimeErrors(page){const errors=[];page.on('pageerror',e=>errors.push(e.message));return errors;}
async function account(page,section){await page.locator('#account').click();await page.locator('#auth-dialog .account-links').getByRole('button',{name:section,exact:true}).click();await expect(page.getByRole('dialog',{name:'Minha conta',exact:true})).toBeVisible();}
module.exports={catalog,showList,openFirst,reachable,runtimeErrors,account};
