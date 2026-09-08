-- Additive migration. Existing listings and ownership are preserved.
create schema if not exists private_terra;
revoke all on schema private_terra from public;
grant usage on schema private_terra to anon, authenticated;

alter table public.terra_listings drop constraint terra_listings_status_check;
alter table public.terra_listings add constraint terra_listings_status_check check (status in ('draft','published','reserved','sold','paused'));
alter policy terra_listings_public_read on public.terra_listings using (status in ('published','reserved','sold'));
alter policy terra_listing_photos_read on public.terra_listing_photos using (exists (select 1 from public.terra_listings l where l.id=listing_id and (l.status in ('published','reserved','sold') or l.owner_id=(select auth.uid()))));
alter policy terra_listing_photos_storage_published_read on storage.objects using (bucket_id='terra-listing-photos' and exists (select 1 from public.terra_listing_photos p join public.terra_listings l on l.id=p.listing_id where p.storage_path=objects.name and l.status in ('published','reserved','sold')));
create index terra_listings_available_idx on public.terra_listings (state,city,category,created_at desc) where status in ('published','reserved');

alter table public.terra_profiles
  add column city text not null default '' check (length(city)<=100),
  add column account_type text not null default 'particular' check (account_type in ('particular','corretor','imobiliaria','loteadora')),
  add column avatar_path text check (avatar_path is null or (split_part(avatar_path,'/',1)=id::text and avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$')),
  add column phone_verified boolean not null default false;
grant update(city,account_type,avatar_path) on public.terra_profiles to authenticated;
create policy terra_profile_public_read on public.terra_profiles for select to anon,authenticated using (exists(select 1 from public.terra_listings l where l.owner_id=terra_profiles.id and l.status in ('published','reserved','sold')));
grant select(id,display_name,city,account_type,avatar_path,phone_verified,created_at) on public.terra_profiles to anon;

create table public.terra_contact_settings (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  phone text not null default '' check(phone='' or phone ~ '^55[1-9][0-9]{9,10}$'),
  enabled boolean not null default false
);
alter table public.terra_contact_settings enable row level security;
create policy contact_own on public.terra_contact_settings for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.terra_contact_settings from anon,authenticated;
grant select,insert,delete on public.terra_contact_settings to authenticated;
grant update(phone,enabled) on public.terra_contact_settings to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('terra-profile-photos','terra-profile-photos',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy terra_avatar_select on storage.objects for select to authenticated using(bucket_id='terra-profile-photos' and split_part(name,'/',1)=(select auth.uid())::text);
create policy terra_avatar_insert on storage.objects for insert to authenticated with check(bucket_id='terra-profile-photos' and split_part(name,'/',1)=(select auth.uid())::text and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.](jpg|png|webp)$');
create policy terra_avatar_delete on storage.objects for delete to authenticated using(bucket_id='terra-profile-photos' and split_part(name,'/',1)=(select auth.uid())::text);

create table public.terra_favorites (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 listing_id uuid not null references public.terra_listings(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(user_id,listing_id)
);
create index terra_favorites_listing_idx on public.terra_favorites(listing_id);
alter table public.terra_favorites enable row level security;
create policy favorite_read_own on public.terra_favorites for select to authenticated using(user_id=(select auth.uid()));
create policy favorite_add_own on public.terra_favorites for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.terra_listings l where l.id=listing_id and l.status in ('published','reserved','sold')));
create policy favorite_delete_own on public.terra_favorites for delete to authenticated using(user_id=(select auth.uid()));
revoke all on public.terra_favorites from anon,authenticated;
grant select,delete on public.terra_favorites to authenticated;
grant insert(listing_id) on public.terra_favorites to authenticated;

create table public.terra_reports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 listing_id uuid not null references public.terra_listings(id) on delete cascade,
 reason text not null check(reason in ('false_information','nonexistent','wrong_location','scam','inappropriate','sold','other')),
 description text not null default '' check(length(description)<=2000),
 status text not null default 'pending' check(status in ('pending','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now(),
 unique(user_id,listing_id,reason)
);
create index terra_reports_listing_idx on public.terra_reports(listing_id);
alter table public.terra_reports enable row level security;
create policy report_read_own on public.terra_reports for select to authenticated using(user_id=(select auth.uid()));
create policy report_create_own on public.terra_reports for insert to authenticated with check(user_id=(select auth.uid()) and status='pending' and exists(select 1 from public.terra_listings l where l.id=listing_id and l.status in ('published','reserved','sold')));
revoke all on public.terra_reports from anon,authenticated;
grant select on public.terra_reports to authenticated;
grant insert(listing_id,reason,description) on public.terra_reports to authenticated;

create table public.terra_views (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.terra_listings(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null,
 session_id uuid not null,
 window_start timestamptz not null,
 created_at timestamptz not null default now(),
 unique(session_id,listing_id,window_start)
);
create index terra_views_listing_idx on public.terra_views(listing_id);
create index terra_views_user_idx on public.terra_views(user_id);
create table public.terra_leads (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.terra_listings(id) on delete cascade,
 advertiser_id uuid not null references auth.users(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null,
 session_id uuid not null,
 origin text not null default 'whatsapp' check(origin='whatsapp'),
 window_start timestamptz not null,
 created_at timestamptz not null default now(),
 unique(session_id,listing_id,window_start)
);
create index terra_leads_listing_idx on public.terra_leads(listing_id);
create index terra_leads_advertiser_idx on public.terra_leads(advertiser_id);
create index terra_leads_user_idx on public.terra_leads(user_id);
create table public.terra_events (
 id bigint generated always as identity primary key,
 event_name text not null check(event_name in ('view_terreno','favorite_terreno','share_terreno','whatsapp_click','search','save_search','compare_terreno')),
 listing_id uuid references public.terra_listings(id) on delete set null,
 session_id uuid not null,
 created_at timestamptz not null default now()
);
create index terra_events_session_time_idx on public.terra_events(session_id,created_at desc);
create index terra_events_listing_idx on public.terra_events(listing_id);
alter table public.terra_views enable row level security;
alter table public.terra_leads enable row level security;
alter table public.terra_events enable row level security;
-- Raw visitor/session identifiers are deliberately not exposed through the Data API.
revoke all on public.terra_views,public.terra_leads,public.terra_events from anon,authenticated;

-- A restricted recorder is needed for anonymous views and contacts. It never accepts an owner/user id.
create function private_terra.record_event(p_event text,p_listing uuid,p_session uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.terra_listings; contact_phone text; slot timestamptz; n integer; recorded integer;
begin
 if p_session is null or p_event not in ('view_terreno','favorite_terreno','share_terreno','whatsapp_click','search','save_search','compare_terreno') then raise exception 'Evento inválido.'; end if;
 if p_event in ('favorite_terreno','save_search') and auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 -- Serialize one session, bounding write rate even during concurrent clicks.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_session::text,17));
 select count(*) into n from public.terra_events where session_id=p_session and created_at>now()-interval '1 minute';
 if n>=60 then raise exception 'Aguarde um minuto antes de tentar novamente.'; end if;
 if p_listing is not null then
  select * into l from public.terra_listings where id=p_listing and (status in ('published','reserved','sold') or owner_id=auth.uid());
  if not found then raise exception 'Este terreno não está mais disponível.'; end if;
 elsif p_event not in ('search','save_search','compare_terreno') then raise exception 'Terreno obrigatório.';
 end if;
 slot:=pg_catalog.to_timestamp(pg_catalog.floor(extract(epoch from now())/1800)*1800);
 if p_event='whatsapp_click' then
  if l.status not in ('published','reserved') then raise exception 'Este terreno não está disponível para contato.'; end if;
  select phone into contact_phone from public.terra_contact_settings where user_id=l.owner_id and enabled and phone<>'';
  if contact_phone is null then raise exception 'O anunciante ainda não disponibilizou um WhatsApp.'; end if;
  if l.owner_id is distinct from auth.uid() then
   insert into public.terra_leads(listing_id,advertiser_id,user_id,session_id,window_start) values(l.id,l.owner_id,auth.uid(),p_session,slot) on conflict do nothing;
  end if;
 end if;
 if p_event='view_terreno' then
  if l.owner_id is not distinct from auth.uid() then return '{}'::jsonb; end if;
  insert into public.terra_views(listing_id,user_id,session_id,window_start) values(l.id,auth.uid(),p_session,slot) on conflict do nothing;
  get diagnostics recorded=row_count;
  if recorded=0 then return '{}'::jsonb; end if;
 end if;
 insert into public.terra_events(event_name,listing_id,session_id) values(p_event,p_listing,p_session);
 return jsonb_build_object('phone',contact_phone);
end $$;
revoke all on function private_terra.record_event(text,uuid,uuid) from public;
grant execute on function private_terra.record_event(text,uuid,uuid) to anon,authenticated;
create function public.terra_record_event(p_event text,p_listing uuid,p_session uuid) returns jsonb language sql security invoker set search_path='' as $$ select private_terra.record_event(p_event,p_listing,p_session) $$;
revoke all on function public.terra_record_event(text,uuid,uuid) from public;
grant execute on function public.terra_record_event(text,uuid,uuid) to anon,authenticated;

create function private_terra.listing_stats(p_ids uuid[]) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 if cardinality(p_ids)>100 then raise exception 'Selecione até 100 anúncios.'; end if;
 return coalesce((select jsonb_object_agg(l.id,jsonb_build_object('views',(select count(*) from public.terra_views v where v.listing_id=l.id),'leads',(select count(*) from public.terra_leads x where x.listing_id=l.id),'favorites',(select count(*) from public.terra_favorites f where f.listing_id=l.id))) from public.terra_listings l where l.id=any(p_ids) and l.owner_id=auth.uid()),'{}'::jsonb);
end $$;
revoke all on function private_terra.listing_stats(uuid[]) from public;
grant execute on function private_terra.listing_stats(uuid[]) to authenticated;
create function public.terra_listing_stats(p_ids uuid[]) returns jsonb language sql security invoker set search_path='' as $$ select private_terra.listing_stats(p_ids) $$;
revoke all on function public.terra_listing_stats(uuid[]) from public;
grant execute on function public.terra_listing_stats(uuid[]) to authenticated;

create function private_terra.advertiser(p_owner uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'display_name',p.display_name,'city',p.city,'account_type',p.account_type,'avatar_path',p.avatar_path,'phone_verified',p.phone_verified,'created_at',p.created_at,'active_count',(select count(*) from public.terra_listings l where l.owner_id=p.id and l.status in ('published','reserved')),'has_whatsapp',exists(select 1 from public.terra_contact_settings c where c.user_id=p.id and c.enabled and c.phone<>''))
 from public.terra_profiles p where p.id=p_owner and (p.id=auth.uid() or exists(select 1 from public.terra_listings l where l.owner_id=p.id and l.status in ('published','reserved','sold')))
$$;
revoke all on function private_terra.advertiser(uuid) from public;
grant execute on function private_terra.advertiser(uuid) to anon,authenticated;
create function public.terra_advertiser(p_owner uuid) returns jsonb language sql stable security invoker set search_path='' as $$ select private_terra.advertiser(p_owner) $$;
revoke all on function public.terra_advertiser(uuid) from public;
grant execute on function public.terra_advertiser(uuid) to anon,authenticated;

-- Event triggers are not user-facing endpoints.
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;
