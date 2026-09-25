window.TerraBilling = (() => {
  const {el,dialog,field,busy,error}=TerraUI, api=TerraMarketData;
  const planNames={basica:'Básica',plus:'Plus',pro:'Pro'};
  const planCaps={basica:5,plus:10,pro:50};
  async function invoke(body){const result=await TerraRepository.db().functions.invoke('terra-billing',{body});if(result.error){let message;try{message=(await result.error.context.json()).error;}catch(_){}throw new Error(message||'Não foi possível concluir a operação. Tente novamente.');}if(result.data?.error)throw new Error(result.data.error);return result.data;}
  function planCard(plan,price,current,onSubscribe){
    const card=el('article',{class:'account-item plan-card'+(current?' selected':'')});
    card.append(el('h3',{},planNames[plan]),el('p',{class:'amount'},price),el('p',{class:'small'},'Até '+planCaps[plan]+' anúncios ativos.'));
    if(current)card.append(el('p',{class:'status-label'},'Seu plano atual'));
    else{const button=el('button',{class:'primary full'},'Assinar');button.onclick=()=>busy(button,onSubscribe,card);card.append(button);}
    return card;
  }
  async function planTab(target,panel){
    target.append(el('h3',{},'Plano e cobrança'),el('p',{class:'small'},'Contas grátis publicam até 5 anúncios ativos. Assine um plano para publicar mais.'));
    const [subscription,dashboard]=await Promise.all([api.mySubscription(),api.dashboard()]);
    const plan=subscription.plan||'basica';
    target.append(el('p',{},`${dashboard.active} de ${planCaps[plan]} anúncios ativos usados no plano ${planNames[plan]}.`));
    const grid=el('div',{class:'billing-plans'},
      planCard('basica','Grátis',plan==='basica'),
      planCard('plus','R$ 29/mês',plan==='plus',()=>invoke({operation:'checkout_subscription',plan:'plus'}).then(r=>location.assign(r.url))),
      planCard('pro','R$ 79/mês',plan==='pro',()=>invoke({operation:'checkout_subscription',plan:'pro'}).then(r=>location.assign(r.url)))
    );
    target.append(grid);
    target.append(el('p',{class:'small'},'Precisa de mais de 50 anúncios ativos? Temos o plano Empresas sob consulta.'),
      el('a',{class:'action-link',href:'mailto:contato@terramapa.com.br?subject=Plano%20Empresas'},'Fale conosco sobre o plano Empresas'));
    if(subscription.has_customer){
      const manage=el('button',{},subscription.cancel_at_period_end?'Assinatura será cancelada — gerenciar':'Gerenciar assinatura');
      manage.onclick=()=>busy(manage,()=>invoke({operation:'billing_portal'}).then(r=>location.assign(r.url)),target);
      target.append(manage);
    }
  }
  function boostModal(listing){
    const panel=dialog('Impulsionar anúncio');
    const active=listing.boosted_until&&new Date(listing.boosted_until)>new Date();
    panel.content.append(
      el('p',{},active?`Este anúncio já está em destaque até ${new Date(listing.boosted_until).toLocaleDateString('pt-BR')}.`:'Destaque este anúncio no topo da busca por 7 dias.'),
      el('p',{},active?'Impulsionar de novo estende o destaque por mais 7 dias a partir do prazo atual.':'Ele aparece primeiro na busca, em qualquer ordenação, por R$ 14,90.')
    );
    const submit=el('button',{class:'primary full'},active?'Estender por mais 7 dias — R$ 14,90':'Impulsionar por R$ 14,90');
    submit.onclick=()=>busy(submit,()=>TerraBilling.checkoutBoost(listing.id).then(r=>location.assign(r.url)),panel.content);
    panel.content.append(submit);
  }
  return {planTab,boostModal,checkoutBoost:listingId=>invoke({operation:'checkout_boost',listingId})};
})();
