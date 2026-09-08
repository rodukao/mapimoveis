-- Pending migration; apply only after 01-marketplace.sql has been approved and validated.
alter table public.terra_listings drop constraint terra_listings_category_check;
alter table public.terra_listings add constraint terra_listings_category_check check(category in ('residencial','condominio','chacara','rural','comercial','lote','sitio','fazenda','industrial'));
alter table public.terra_listings
 add column terrain_context text not null default 'urban' check(terrain_context in ('urban','rural')),
 add column topography text not null default '' check(topography in ('','plano','aclive','declive','misto')),
 add column infrastructure text[] not null default '{}' check(infrastructure <@ array['agua','energia','esgoto','asfalto','internet','calcada']),
 add column features text[] not null default '{}' check(features <@ array['esquina','murado','cercado','nascente','vista']),
 add column documents text[] not null default '{}' check(documents <@ array['escritura','matricula','iptu','car','ccir','sigef']),
 add column details jsonb not null default '{}' check(jsonb_typeof(details)='object' and octet_length(details::text)<=4096);
-- Preserve the meaning of existing rural categories.
update public.terra_listings set terrain_context='rural' where category in ('chacara','rural');
grant select(geom,terrain_context,topography,infrastructure,features,documents,details) on public.terra_listings to anon,authenticated;
grant insert(terrain_context,topography,infrastructure,features,documents,details),update(terrain_context,topography,infrastructure,features,documents,details) on public.terra_listings to authenticated;

create function private_terra.search_geometry(f jsonb) returns public.geometry language plpgsql immutable security invoker set search_path='' as $$
declare g public.geometry; b jsonb; n integer;
begin
 if f ? 'polygon' and f->'polygon'<>'null'::jsonb then
  if jsonb_typeof(f->'polygon')<>'object' then raise exception 'Área inválida.'; end if;
  g:=public.st_setsrid(public.st_geomfromgeojson((f->'polygon')::text),4326);
  n:=public.st_npoints(g);
  if public.st_geometrytype(g)<>'ST_Polygon' or public.st_numinteriorrings(g)>0 or n<4 or n>201 or not public.st_isvalid(g) then raise exception 'Use um polígono válido com 3 a 200 vértices, sem buracos.'; end if;
 elsif f ? 'bounds' and f->'bounds'<>'null'::jsonb then
  b:=f->'bounds';
  if not (b ?& array['west','south','east','north']) or (b->>'west')::float8 >= (b->>'east')::float8 or (b->>'south')::float8 >= (b->>'north')::float8 then raise exception 'Área inválida.'; end if;
  g:=public.st_makeenvelope((b->>'west')::float8,(b->>'south')::float8,(b->>'east')::float8,(b->>'north')::float8,4326);
 end if;
 if g is not null and (public.st_xmin(g::public.box3d)<-180 or public.st_xmax(g::public.box3d)>180 or public.st_ymin(g::public.box3d)<-85 or public.st_ymax(g::public.box3d)>85) then raise exception 'Coordenadas fora do intervalo permitido.'; end if;
 return g;
end $$;
revoke all on function private_terra.search_geometry(jsonb) from public;
grant execute on function private_terra.search_geometry(jsonb) to anon,authenticated;

create function private_terra.matches_attributes(l public.terra_listings,f jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
select
 (nullif(f->>'city','') is null or lower(l.city)=lower(f->>'city'))
 and (nullif(f->>'state','') is null or l.state=f->>'state')
 and (nullif(f->>'context','') is null or l.terrain_context=f->>'context')
 and (nullif(f->>'category','') is null or l.category=f->>'category')
 and (nullif(f->>'topography','') is null or l.topography=f->>'topography')
 and (nullif(f->>'minPrice','') is null or l.price_brl >= (f->>'minPrice')::numeric)
 and (nullif(f->>'maxPrice','') is null or l.price_brl <= (f->>'maxPrice')::numeric)
 and (nullif(f->>'minArea','') is null or l.area_m2 >= (f->>'minArea')::numeric)
 and (nullif(f->>'maxArea','') is null or l.area_m2 <= (f->>'maxArea')::numeric)
 and l.infrastructure @> array(select jsonb_array_elements_text(coalesce(f->'infrastructure','[]'::jsonb)))
 and l.features @> array(select jsonb_array_elements_text(coalesce(f->'features','[]'::jsonb)))
 and l.documents @> array(select jsonb_array_elements_text(coalesce(f->'documents','[]'::jsonb)))
$$;
revoke all on function private_terra.matches_attributes(public.terra_listings,jsonb) from public;
grant execute on function private_terra.matches_attributes(public.terra_listings,jsonb) to anon,authenticated;

create function public.terra_search_listings(p_filters jsonb default '{}',p_sort text default 'recent',p_limit integer default 50,p_offset integer default 0,p_mine boolean default false) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare region public.geometry; answer jsonb;
begin
 if p_filters is null or jsonb_typeof(p_filters)<>'object' or octet_length(p_filters::text)>30000 or p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>100 or p_sort is null or p_sort not in ('recent','price_asc','price_desc','area_asc','area_desc','unit_asc') then raise exception 'Busca inválida.'; end if;
 if p_mine and auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 region:=private_terra.search_geometry(p_filters);
 with matching as materialized (
  select l.* from public.terra_listings l
  where ((p_mine and l.owner_id=auth.uid()) or (not p_mine and l.status in ('published','reserved')))
  and private_terra.matches_attributes(l,p_filters)
  and (region is null or (l.geom && region and public.st_intersects(l.geom,region)))
 ), page as (
  select m.* from matching m order by
   case when p_sort='price_asc' then price_brl end asc,
   case when p_sort='price_desc' then price_brl end desc,
   case when p_sort='area_asc' then area_m2 end asc,
   case when p_sort='area_desc' then area_m2 end desc,
   case when p_sort='unit_asc' then price_per_m2 end asc,
   created_at desc,id desc limit p_limit offset p_offset
 )
 select jsonb_build_object('total',(select count(*) from matching),'rows',coalesce((select jsonb_agg(
  (to_jsonb(p)-'geom') || jsonb_build_object('terra_listing_photos',coalesce((select jsonb_agg(to_jsonb(ph) order by ph.sort_order) from public.terra_listing_photos ph where ph.listing_id=p.id),'[]'::jsonb))
  order by
   case when p_sort='price_asc' then p.price_brl end asc,
   case when p_sort='price_desc' then p.price_brl end desc,
   case when p_sort='area_asc' then p.area_m2 end asc,
   case when p_sort='area_desc' then p.area_m2 end desc,
   case when p_sort='unit_asc' then p.price_per_m2 end asc,
   p.created_at desc,p.id desc
 ) from page p),'[]'::jsonb)) into answer;
 return answer;
end $$;
revoke all on function public.terra_search_listings(jsonb,text,integer,integer,boolean) from public;
grant execute on function public.terra_search_listings(jsonb,text,integer,integer,boolean) to anon,authenticated;

create table public.terra_saved_searches (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 name text not null check(length(trim(name)) between 1 and 100),
 filters jsonb not null default '{}' check(jsonb_typeof(filters)='object' and octet_length(filters::text)<=30000),
 sort_order text not null default 'recent' check(sort_order in ('recent','price_asc','price_desc','area_asc','area_desc','unit_asc')),
 alerts_enabled boolean not null default false,
 created_at timestamptz not null default now(),
 unique(user_id,name)
);
create index terra_saved_search_alerts_idx on public.terra_saved_searches(user_id) where alerts_enabled;
alter table public.terra_saved_searches enable row level security;
create policy saved_search_own on public.terra_saved_searches for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.terra_saved_searches from anon,authenticated;
grant select,delete on public.terra_saved_searches to authenticated;
grant insert(name,filters,sort_order,alerts_enabled),update(name,filters,sort_order,alerts_enabled) on public.terra_saved_searches to authenticated;

create table public.terra_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 search_id uuid not null references public.terra_saved_searches(id) on delete cascade,
 listing_id uuid not null references public.terra_listings(id) on delete cascade,
 is_read boolean not null default false,
 created_at timestamptz not null default now(),
 unique(user_id,search_id,listing_id)
);
create index terra_notifications_owner_idx on public.terra_notifications(user_id,created_at desc);
create index terra_notifications_search_idx on public.terra_notifications(search_id);
create index terra_notifications_listing_idx on public.terra_notifications(listing_id);
alter table public.terra_notifications enable row level security;
create policy notification_own on public.terra_notifications for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
revoke all on public.terra_notifications from anon,authenticated;
grant select,delete on public.terra_notifications to authenticated;
grant update(is_read) on public.terra_notifications to authenticated;

-- Validate saved filters before storing them so one malformed search cannot break a publication.
create function private_terra.validate_search() returns trigger language plpgsql security invoker set search_path='' as $$
declare probe public.terra_listings; k text; value numeric;
begin
 if tg_op='INSERT' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,29));
  if (select count(*) from public.terra_saved_searches where user_id=new.user_id)>=50 then raise exception 'Você pode salvar até 50 buscas. Exclua uma para continuar.'; end if;
 end if;
 perform private_terra.search_geometry(new.filters);
 for k in select unnest(array['minPrice','maxPrice','minArea','maxArea']) loop
  value:=nullif(new.filters->>k,'')::numeric;
  if value<0 or value>1e12 or value='NaN'::numeric or value='Infinity'::numeric then raise exception 'Informe limites numéricos válidos.'; end if;
 end loop;
 if (new.filters->>'minPrice')::numeric > (new.filters->>'maxPrice')::numeric or (new.filters->>'minArea')::numeric > (new.filters->>'maxArea')::numeric then raise exception 'O mínimo deve ser menor ou igual ao máximo.'; end if;
 for k in select unnest(array['infrastructure','features','documents']) loop
  if new.filters ? k and (jsonb_typeof(new.filters->k)<>'array' or jsonb_array_length(new.filters->k)>12) then raise exception 'Filtros inválidos.'; end if;
 end loop;
 return new;
end $$;
revoke all on function private_terra.validate_search() from public,anon,authenticated;
create trigger terra_validate_saved_search before insert or update on public.terra_saved_searches for each row execute function private_terra.validate_search();

-- Internal trigger creates notifications for other users; no callable RPC or client INSERT grant.
create function private_terra.notify_matches() returns trigger language plpgsql security definer set search_path='' as $$
declare s record; region public.geometry;
begin
 if new.status not in ('published','reserved') then return new; end if;
 if tg_op='UPDATE' and old.status in ('published','reserved','sold') then return new; end if;
 if auth.uid() is not null and new.owner_id<>auth.uid() then raise exception 'Proprietário inválido.'; end if;
 for s in select * from public.terra_saved_searches where alerts_enabled and user_id<>new.owner_id loop
  region:=private_terra.search_geometry(s.filters);
  if private_terra.matches_attributes(new,s.filters) and (region is null or public.st_intersects(new.geom,region)) then
   insert into public.terra_notifications(user_id,search_id,listing_id) values(s.user_id,s.id,new.id) on conflict do nothing;
  end if;
 end loop;
 return new;
end $$;
revoke all on function private_terra.notify_matches() from public,anon,authenticated;
create trigger terra_notify_new_listing after insert or update of status on public.terra_listings for each row execute function private_terra.notify_matches();
