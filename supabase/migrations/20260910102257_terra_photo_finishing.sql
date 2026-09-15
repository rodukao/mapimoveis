-- Ordered atomic photo commit; keeps the original RPC for older clients.
create function public.terra_sync_listing_photos_ordered(p_listing_id uuid,p_keep_ids uuid[],p_expected_ids uuid[],p_paths text[],p_order text[]) returns void language plpgsql security invoker set search_path='' as $$
declare actual text[];
begin
 perform public.terra_sync_listing_photos(p_listing_id,p_keep_ids,p_expected_ids,p_paths);
 select coalesce(array_agg(storage_path order by storage_path),'{}') into actual from public.terra_listing_photos where listing_id=p_listing_id;
 if p_order is null or cardinality(p_order)<>cardinality(actual) or actual<>array(select unnest(p_order) order by 1) then raise exception 'Ordem das fotos inválida.';end if;
 update public.terra_listing_photos p set sort_order=ordered.ord-1 from unnest(p_order) with ordinality ordered(path,ord) where p.listing_id=p_listing_id and p.storage_path=ordered.path;
end $$;
revoke all on function public.terra_sync_listing_photos_ordered(uuid,uuid[],uuid[],text[],text[]) from public,anon;
grant execute on function public.terra_sync_listing_photos_ordered(uuid,uuid[],uuid[],text[],text[]) to authenticated;

-- A claimed orphan cannot become newly referenced while Storage deletion runs.
create table private_terra.orphan_objects(object_id uuid primary key,bucket_id text not null,name text not null,claimed_at timestamptz not null default now(),unique(bucket_id,name));
alter table private_terra.orphan_objects enable row level security;
revoke all on private_terra.orphan_objects from public,anon,authenticated;
create function private_terra.guard_photo_reference() returns trigger language plpgsql security definer set search_path='' as $$
declare path text; bucket text;
begin
 if tg_table_name='terra_profiles' then path:=new.avatar_path;bucket:='terra-profile-photos';else path:=new.storage_path;bucket:='terra-listing-photos';end if;
 if path is null then return new;end if;
 perform 1 from storage.objects where bucket_id=bucket and name=path for update;
 if exists(select 1 from private_terra.orphan_objects where bucket_id=bucket and name=path) then raise exception 'Esta foto expirou antes de ser salva. Envie-a novamente.';end if;
 return new;
end $$;
revoke all on function private_terra.guard_photo_reference() from public,anon,authenticated;
create trigger terra_guard_photo_reference before insert or update of storage_path on public.terra_listing_photos for each row execute function private_terra.guard_photo_reference();
create trigger terra_guard_avatar_reference before insert or update of avatar_path on public.terra_profiles for each row execute function private_terra.guard_photo_reference();

create function private_terra.orphan_candidates() returns table(object_id uuid,bucket_id text,name text) language sql security definer set search_path='' as $$
 select o.id,o.bucket_id,o.name from storage.objects o where o.bucket_id in ('terra-listing-photos','terra-profile-photos')
 and greatest(o.created_at,o.updated_at)<now()-interval '48 hours'
 and not exists(select 1 from public.terra_listing_photos p where o.bucket_id='terra-listing-photos' and p.storage_path=o.name)
 and not exists(select 1 from public.terra_profiles p where o.bucket_id='terra-profile-photos' and p.avatar_path=o.name)
 order by o.created_at limit 100;
$$;
revoke all on function private_terra.orphan_candidates() from public,anon,authenticated;
create function public.terra_claim_orphan_objects(p_dry_run boolean default true) returns jsonb language plpgsql security definer set search_path='' as $$
declare candidate record; result jsonb:='[]';
begin
 delete from private_terra.orphan_objects q where not exists(select 1 from storage.objects o where o.id=q.object_id);
 for candidate in select * from private_terra.orphan_candidates() loop
  perform 1 from storage.objects where id=candidate.object_id and greatest(created_at,updated_at)<now()-interval '48 hours' for update;
  if not found then continue;end if;
  -- Re-check references after waiting for concurrent metadata commits.
  if exists(select 1 from public.terra_listing_photos where candidate.bucket_id='terra-listing-photos' and storage_path=candidate.name) or exists(select 1 from public.terra_profiles where candidate.bucket_id='terra-profile-photos' and avatar_path=candidate.name) then continue;end if;
  if not p_dry_run then insert into private_terra.orphan_objects(object_id,bucket_id,name) values(candidate.object_id,candidate.bucket_id,candidate.name) on conflict do nothing;end if;
  result:=result||jsonb_build_array(jsonb_build_object('id',candidate.object_id,'bucket_id',candidate.bucket_id,'name',candidate.name));
 end loop;return result;
end $$;
revoke all on function public.terra_claim_orphan_objects(boolean) from public,anon,authenticated;
grant execute on function public.terra_claim_orphan_objects(boolean) to service_role;

create function private_terra.guard_orphan_upload() returns trigger language plpgsql security definer set search_path='' as $$begin
 if exists(select 1 from private_terra.orphan_objects where bucket_id=new.bucket_id and name=new.name) then raise exception 'Arquivo em limpeza. Envie com um novo nome.';end if;return new;
end $$;
revoke all on function private_terra.guard_orphan_upload() from public,anon,authenticated;
create trigger terra_guard_orphan_upload before insert or update on storage.objects for each row execute function private_terra.guard_orphan_upload();
