render();
initializeData();

if(new URL(location.href).searchParams.has('piloto')){const u=new URL(location.href);u.searchParams.delete('piloto');history.replaceState(null,'',u);openAuth('signup');}
