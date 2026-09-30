-- Cadastro: grava o tipo de conta declarado (proprietário/corretor/imobiliária) e o CRECI opcional
-- vindos dos metadados do signUp. Valores inválidos caem em 'particular'. Nenhum CPF é coletado.
create or replace function public.terra_create_profile() returns trigger
language plpgsql security definer set search_path='' as $$
declare t text := coalesce(new.raw_user_meta_data->>'account_type','particular');
begin
  if t not in ('particular','corretor','imobiliaria') then t := 'particular'; end if;
  insert into public.terra_profiles(id,display_name,account_type,creci)
  values(new.id,
    left(coalesce(new.raw_user_meta_data->>'display_name',''),100),
    t,
    case when t in ('corretor','imobiliaria') then left(btrim(coalesce(new.raw_user_meta_data->>'creci','')),40) else '' end);
  return new;
end $$;
