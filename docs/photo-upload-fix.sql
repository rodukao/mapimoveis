alter table public.terra_listing_photos drop constraint terra_listing_photos_path_format;
alter table public.terra_listing_photos add constraint terra_listing_photos_path_format check (
storage_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}[.](jpg|jpeg|png|webp)$'
and split_part(storage_path,'/',1) = owner_id::text
and split_part(storage_path,'/',2) = listing_id::text
);

drop policy terra_listing_photos_storage_insert on storage.objects;
create policy terra_listing_photos_storage_insert on storage.objects for insert to authenticated with check (
bucket_id = 'terra-listing-photos'
and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}[.](jpg|jpeg|png|webp)$'
and exists (select 1 from public.terra_listings l where l.id::text = (storage.foldername(name))[2] and l.owner_id::text = (select auth.jwt()->>'sub'))
);
create policy terra_listing_photos_storage_select on storage.objects for select to authenticated using (
bucket_id = 'terra-listing-photos' and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);

create or replace function public.terra_sync_listing_photos(p_listing_id uuid, p_keep_ids uuid[], p_expected_ids uuid[], p_paths text[])
returns void language plpgsql security invoker set search_path = '' as $$
declare account_id uuid := auth.uid(); current_ids uuid[];
begin
  if account_id is null then raise exception 'Entre na sua conta.'; end if;
  perform 1 from public.terra_listings where id = p_listing_id and owner_id = account_id for update;
  if not found then raise exception 'Terreno indisponível.'; end if;
  if p_keep_ids is null or p_expected_ids is null or p_paths is null then raise exception 'Fotos inválidas.'; end if;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into current_ids from public.terra_listing_photos where listing_id = p_listing_id;
  if current_ids <> array(select unnest(p_expected_ids) order by 1) then raise exception 'As fotos mudaram. Reabra o terreno.'; end if;
  if not (p_keep_ids <@ current_ids) or cardinality(p_keep_ids) <> (select count(distinct x) from unnest(p_keep_ids) x)
    or cardinality(p_keep_ids) + cardinality(p_paths) > 12 then raise exception 'Seleção de fotos inválida (máximo 12).'; end if;
  delete from public.terra_listing_photos where listing_id = p_listing_id and not (id = any(p_keep_ids));
  update public.terra_listing_photos p set sort_order = kept.ord - 1
    from unnest(p_keep_ids) with ordinality kept(id,ord) where p.id = kept.id and p.listing_id = p_listing_id;
  insert into public.terra_listing_photos(listing_id,owner_id,storage_path,sort_order)
    select p_listing_id, account_id, paths.path, cardinality(p_keep_ids) + paths.ord - 1
    from unnest(p_paths) with ordinality paths(path,ord);
end;
$$;
revoke all on function public.terra_sync_listing_photos(uuid,uuid[],uuid[],text[]) from public, anon;
grant execute on function public.terra_sync_listing_photos(uuid,uuid[],uuid[],text[]) to authenticated;
notify pgrst, 'reload schema';

-- Applied separately as enforce_twelve_photo_slots_per_listing.
alter table public.terra_listing_photos add constraint terra_listing_photos_unique_slot
  unique (listing_id, sort_order) deferrable initially deferred;
