render();
Promise.resolve(initializeData()).then(()=>window.TerraMobileNav?.openInitial());

if(new URL(location.href).searchParams.has('piloto')){const u=new URL(location.href);u.searchParams.delete('piloto');history.replaceState(null,'',u);openAuth('signup');}

{
  const params=new URL(location.href).searchParams;
  if(params.has('checkout')||params.has('boost')){
    const checkout=params.get('checkout'),boost=params.get('boost');
    const u=new URL(location.href);u.searchParams.delete('checkout');u.searchParams.delete('boost');history.replaceState(null,'',u);
    document.addEventListener('terra:ready',()=>{
      if(checkout==='success'){toast('Pagamento confirmado. Atualizando seu plano…');TerraAccount.open('billing');}
      else if(boost==='success'){toast('Destaque ativado por 7 dias.');TerraAccount.open('listings');}
      else if(checkout==='cancel'||boost==='cancel')toast('Pagamento não concluído.');
    },{once:true});
  }
}
