const {test,expect}=require('@playwright/test');
const {reachable}=require('./helpers.cjs');
test('piloto: formulário e triagem em fixture isolada',async({page})=>{
 await page.goto('/__qa__/feedback');await page.getByRole('button',{name:'Enviar feedback',exact:true}).click();
 const form=page.getByRole('dialog',{name:'Enviar feedback',exact:true});await form.getByRole('radio',{name:'5 estrelas',exact:true}).check();await form.getByRole('radio',{name:'Mapa',exact:true}).check();await form.getByRole('textbox').fill('O mapa ajuda na primeira conversa. Feedback sintético.');
 await reachable(form.getByRole('button',{name:'Enviar feedback',exact:true}));await form.getByRole('button',{name:'Enviar feedback',exact:true}).click();await expect(form).toContainText('Obrigado por participar do piloto.');await form.getByRole('button',{name:'Concluir'}).click();
 await page.getByRole('button',{name:'Feedback do piloto',exact:true}).click();const panel=page.getByRole('dialog',{name:'Feedback do piloto',exact:true});await panel.getByLabel('Situação do feedback').selectOption('planned');await panel.getByRole('button',{name:'Salvar classificação'}).click();await expect(panel.getByLabel('Situação do feedback')).toHaveValue('planned');
});
test('profissionais: hero, quatro benefícios e CTA acessível',async({page})=>{
 await page.goto('/profissionais');await expect(page.getByRole('heading',{level:1})).toHaveText('Seu portfólio.Uma novaperspectiva.');await expect(page.locator('.professional-benefits article')).toHaveCount(4);await reachable(page.getByRole('link',{name:/Conhecer o mapa/}));await expect(page.getByRole('link',{name:/Conhecer o mapa/})).toHaveAttribute('href','/');
});
