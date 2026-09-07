-- Terra: instalação das fotos sem comparação UUID/texto.
-- Execute este arquivo inteiro. Ele pode ser executado mesmo que a tentativa anterior tenha falhado.
begin;

create table if not exists public.terra_listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.terra_listings(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  alt_text text not null default '' check (char_length(alt_text) <= 200),
  sort_order smallint not null default 0 check (sort_order between 0 and 11),
  created_at timestamptz not null default now(),
  constraint terra_listing_photos_path_format check (
    storage_path ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{32}\.(jpg|jpeg|png|webp)$'
  )
);

create index if not exists terra_listing_photos_listing
  on public.terra_listing_photos(listing_id, sort_order, created_at);
create index if not exists terra_listing_photos_owner
  on public.terra_listing_photos(owner_id, created_at desc);

alter table public.terra_listing_photos enable row level security;
revoke all on public.terra_listing_photos from public, anon, authenticated;
grant select on public.terra_listing_photos to anon, authenticated;
grant insert, update, delete on public.terra_listing_photos to authenticated;

drop policy if exists terra_listing_photos_read on public.terra_listing_photos;
create policy terra_listing_photos_read on public.terra_listing_photos
for select to anon, authenticated
using (
  exists (
    select 1 from public.terra_listings as l
    where l.id = listing_id
      and (l.status = 'published' or l.owner_id::text = (select auth.jwt()->>'sub'))
  )
);

drop policy if exists terra_listing_photos_insert on public.terra_listing_photos;
create policy terra_listing_photos_insert on public.terra_listing_photos
for insert to authenticated
with check (
  owner_id::text = (select auth.jwt()->>'sub')
  and exists (
    select 1 from public.terra_listings as l
    where l.id = listing_id and l.owner_id::text = (select auth.jwt()->>'sub')
  )
);

drop policy if exists terra_listing_photos_update on public.terra_listing_photos;
create policy terra_listing_photos_update on public.terra_listing_photos
for update to authenticated
using (
  owner_id::text = (select auth.jwt()->>'sub')
  and exists (
    select 1 from public.terra_listings as l
    where l.id = listing_id and l.owner_id::text = (select auth.jwt()->>'sub')
  )
)
with check (
  owner_id::text = (select auth.jwt()->>'sub')
  and exists (
    select 1 from public.terra_listings as l
    where l.id = listing_id and l.owner_id::text = (select auth.jwt()->>'sub')
  )
);

drop policy if exists terra_listing_photos_delete on public.terra_listing_photos;
create policy terra_listing_photos_delete on public.terra_listing_photos
for delete to authenticated
using (
  owner_id::text = (select auth.jwt()->>'sub')
  and exists (
    select 1 from public.terra_listings as l
    where l.id = listing_id and l.owner_id::text = (select auth.jwt()->>'sub')
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'terra-listing-photos', 'terra-listing-photos', true, 10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists terra_listing_photos_storage_insert on storage.objects;
create policy terra_listing_photos_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'terra-listing-photos'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
  and (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
  and name ~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}/[0-9a-fA-F-]{32}\.(jpg|jpeg|png|webp)$'
);

drop policy if exists terra_listing_photos_storage_delete on storage.objects;
create policy terra_listing_photos_storage_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'terra-listing-photos'
  and (storage.foldername(name))[1] = (select auth.jwt()->>'sub')
);

notify pgrst, 'reload schema';
commit;

select c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_catalog.pg_class as c
join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'terra_listing_photos';
