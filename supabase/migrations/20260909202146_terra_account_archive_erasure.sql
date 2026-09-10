-- Remove only the deleting account's entries from the retained migration audit.
create function private_terra.erase_legacy_account(p_user uuid) returns void language plpgsql security definer set search_path='' as $$
declare ids text[]; audit record; item record; cleaned jsonb; data jsonb;
begin
 select array_agg(distinct id) into ids from (
  select p_user::text id union all select id::text from public.terra_listings where owner_id=p_user union all select id::text from archive.terrenos_legacy where user_id=p_user
 )x;
 for audit in select * from archive.terra_package1_audit for update loop
  data:=audit.payload;
  for item in select key,value from jsonb_each(audit.payload) where jsonb_typeof(value)='array' loop
   select coalesce(jsonb_agg(value),'[]'::jsonb) into cleaned from jsonb_array_elements(item.value) e where not exists(select 1 from unnest(ids) as u(id) where strpos(e.value::text,u.id)>0);
   data:=jsonb_set(data,array[item.key],cleaned);
  end loop;
  if data is distinct from audit.payload then update archive.terra_package1_audit set payload=data where checkpoint=audit.checkpoint;end if;
 end loop;
 delete from archive.terra_legacy_photo_map where owner_id=p_user or listing_id::text=any(ids) or legacy_id::text=any(ids);
 delete from archive.terra_legacy_listing_map where listing_id::text=any(ids) or legacy_id::text=any(ids);
 delete from archive.terrenos_legacy where user_id=p_user;
end $$;
revoke all on function private_terra.erase_legacy_account(uuid) from public,anon,authenticated;
create or replace function public.terra_finish_deletion(p_user uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from private_terra.deletion_jobs where user_id=p_user) then raise exception 'Exclusão não solicitada.';end if;
 if jsonb_array_length(public.terra_deletion_objects(p_user))>0 then raise exception 'Ainda existem fotos aguardando exclusão.';end if;
 delete from public.terra_events where user_id=p_user or listing_id in(select id from public.terra_listings where owner_id=p_user) or session_id in(select session_id from public.terra_views where user_id=p_user union select session_id from public.terra_leads where user_id=p_user);
 delete from public.terra_views where user_id=p_user;
 delete from public.terra_leads where user_id=p_user;
 perform private_terra.erase_legacy_account(p_user);
 -- Auth Admin deletion happens next, cascading profiles/listings/favorites/searches/notifications.
end $$;
