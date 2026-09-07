-- MAPIMOVEIS - CORRECAO POSTGIS V2
-- Cole TODO este arquivo em uma NOVA consulta no SQL Editor.
-- Terra: primeira migração de usuários e terrenos.
-- Versão corrigida: detecta e reutiliza o schema atual do PostGIS.
-- Executar o arquivo inteiro uma vez no SQL Editor.
-- A tentativa anterior com erro no guard foi revertida pela transação.
-- Não apaga tabelas nem move a extensão. Conflitos cancelam a transação.
begin;
create schema if not exists extensions;
create extension if not exists postgis with schema extensions;

do $terra_setup$
declare
  postgis_schema text;
  reference_area double precision;
begin
  select n.nspname into strict postgis_schema
  from pg_catalog.pg_extension e
  join pg_catalog.pg_namespace n on n.oid=e.extnamespace
  where e.extname='postgis';

  -- Substitui somente identificadores do PostGIS, com quoting do PostgreSQL.
  execute replace($terra_ddl$
grant usage on schema __POSTGIS_SCHEMA__ to authenticated;

create table public.terra_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name)<=100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.terra_profiles enable row level security;
revoke all on public.terra_profiles from public, anon, authenticated;
grant select on public.terra_profiles to authenticated;
grant update(display_name) on public.terra_profiles to authenticated;
create policy terra_profile_read_own on public.terra_profiles for select to authenticated using (id=(select auth.uid()));
create policy terra_profile_update_own on public.terra_profiles for update to authenticated using (id=(select auth.uid())) with check (id=(select auth.uid()));

create function public.terra_create_profile() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into public.terra_profiles(id,display_name) values(new.id,left(coalesce(new.raw_user_meta_data->>'display_name',''),100));
  return new;
end $$;
revoke all on function public.terra_create_profile() from public,anon,authenticated;
create trigger terra_user_created after insert on auth.users for each row execute function public.terra_create_profile();
-- Perfis mínimos para contas que já existam. Senhas e e-mails ficam no Auth.
insert into public.terra_profiles(id,display_name)
select id,left(coalesce(raw_user_meta_data->>'display_name',''),100) from auth.users;

create table public.terra_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 90),
  description text not null default '' check (char_length(description)<=4000),
  city text not null check (char_length(btrim(city)) between 2 and 100),
  state text not null check (state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  neighborhood text not null default '' check (char_length(neighborhood)<=100),
  category text not null default 'residencial' check (category in ('residencial','condominio','chacara','rural','comercial')),
  price_brl numeric(14,2) not null check (price_brl>0 and price_brl<=999999999999.99),
  status text not null default 'draft' check (status in ('draft','published','paused')),
  boundary_geojson jsonb not null,
  geom __POSTGIS_SCHEMA__.geometry(Polygon,4326) not null,
  area_m2 numeric(16,2) not null check (area_m2>=1 and area_m2<=10000000000),
  perimeter_m numeric(16,2) not null,
  latitude double precision not null,
  longitude double precision not null,
  price_per_m2 numeric generated always as (round(price_brl/nullif(area_m2,0),2)) stored,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index terra_listings_owner on public.terra_listings(owner_id,updated_at desc);
create index terra_listings_published on public.terra_listings(created_at desc) where status='published';
create index terra_listings_geom on public.terra_listings using gist(geom);

-- Geometria, área, perímetro, proprietário e datas não são confiados ao navegador.
create function public.terra_validate_listing() returns trigger
language plpgsql set search_path='' as $$
declare g __POSTGIS_SCHEMA__.geometry; center_point __POSTGIS_SCHEMA__.geometry;
begin
  if tg_op='UPDATE' then
    new.id:=old.id; new.owner_id:=old.owner_id; new.created_at:=old.created_at; new.revision:=old.revision+1;
  else
    new.revision:=1;
  end if;
  new.updated_at:=now();
  if jsonb_typeof(new.boundary_geojson)<>'object' or new.boundary_geojson->>'type' is distinct from 'Polygon' then
    raise exception using errcode='22023',message='Desenhe um polígono para o terreno.';
  end if;
  g:=__POSTGIS_SCHEMA__.st_setsrid(__POSTGIS_SCHEMA__.st_geomfromgeojson(new.boundary_geojson::text),4326);
  if __POSTGIS_SCHEMA__.st_isempty(g) or __POSTGIS_SCHEMA__.st_geometrytype(g)<>'ST_Polygon' or __POSTGIS_SCHEMA__.st_coorddim(g)<>2 or __POSTGIS_SCHEMA__.st_numinteriorrings(g)<>0 or __POSTGIS_SCHEMA__.st_npoints(g) not between 4 and 201 then
    raise exception using errcode='22023',message='Use de 3 a 200 vértices, sem vazios internos.';
  end if;
  if not __POSTGIS_SCHEMA__.st_isvalid(g) then
    raise exception using errcode='22023',message='Os limites do terreno se cruzam ou são inválidos.';
  end if;
  if __POSTGIS_SCHEMA__.st_xmin(g::__POSTGIS_SCHEMA__.box3d)<-180 or __POSTGIS_SCHEMA__.st_xmax(g::__POSTGIS_SCHEMA__.box3d)>180 or __POSTGIS_SCHEMA__.st_ymin(g::__POSTGIS_SCHEMA__.box3d)<-85 or __POSTGIS_SCHEMA__.st_ymax(g::__POSTGIS_SCHEMA__.box3d)>85 then
    raise exception using errcode='22023',message='Coordenadas fora da área suportada.';
  end if;
  new.geom:=g;
  new.boundary_geojson:=__POSTGIS_SCHEMA__.st_asgeojson(g,15)::jsonb;
  new.area_m2:=round(__POSTGIS_SCHEMA__.st_area(g::__POSTGIS_SCHEMA__.geography)::numeric,2);
  new.perimeter_m:=round(__POSTGIS_SCHEMA__.st_perimeter(g::__POSTGIS_SCHEMA__.geography)::numeric,2);
  center_point:=__POSTGIS_SCHEMA__.st_pointonsurface(g);
  new.latitude:=__POSTGIS_SCHEMA__.st_y(center_point); new.longitude:=__POSTGIS_SCHEMA__.st_x(center_point);
  return new;
end $$;
revoke all on function public.terra_validate_listing() from public,anon,authenticated;
create trigger terra_listing_validate before insert or update on public.terra_listings for each row execute function public.terra_validate_listing();

create function public.terra_touch_profile() returns trigger
language plpgsql set search_path='' as $$ begin new.updated_at:=now();return new;end $$;
revoke all on function public.terra_touch_profile() from public,anon,authenticated;
create trigger terra_profile_touch before update on public.terra_profiles for each row execute function public.terra_touch_profile();

alter table public.terra_listings enable row level security;
revoke all on public.terra_listings from public,anon,authenticated;
grant select(id,owner_id,title,description,city,state,neighborhood,category,price_brl,status,boundary_geojson,area_m2,perimeter_m,latitude,longitude,price_per_m2,revision,created_at,updated_at) on public.terra_listings to anon,authenticated;
grant insert(id,title,description,city,state,neighborhood,category,price_brl,status,boundary_geojson) on public.terra_listings to authenticated;
grant update(title,description,city,state,neighborhood,category,price_brl,status,boundary_geojson) on public.terra_listings to authenticated;
grant delete on public.terra_listings to authenticated;
create policy terra_listings_public_read on public.terra_listings for select to anon,authenticated using(status='published');
create policy terra_listings_owner_read on public.terra_listings for select to authenticated using(owner_id=(select auth.uid()));
create policy terra_listings_owner_insert on public.terra_listings for insert to authenticated with check(owner_id=(select auth.uid()) and coalesce((select auth.jwt()->>'is_anonymous')::boolean,false)=false);
create policy terra_listings_owner_update on public.terra_listings for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
create policy terra_listings_owner_delete on public.terra_listings for delete to authenticated using(owner_id=(select auth.uid()));
comment on column public.terra_listings.area_m2 is 'Área geodésica estimada pelo PostGIS; não substitui levantamento topográfico.';
comment on table public.terra_profiles is 'Perfil privado; somente o próprio usuário pode ler. Autenticação e senhas são responsabilidade de auth.users.';

$terra_ddl$, '__POSTGIS_SCHEMA__', pg_catalog.quote_ident(postgis_schema));

  -- Verifica a disponibilidade do cálculo geodésico na instalação existente.
  execute format(
    'select %1$I.st_area(%1$I.st_geomfromtext(''POLYGON((0 0,0.001 0,0.001 0.001,0 0.001,0 0))'',4326)::%1$I.geography)',
    postgis_schema
  ) into reference_area;
  if reference_area is null or reference_area not between 12000 and 12500 then
    raise exception 'A verificação geodésica falhou; a configuração foi cancelada.';
  end if;
end
$terra_setup$;
notify pgrst,'reload schema';
commit;

-- Resultado esperado: dois registros, ambos com rls_enabled = true.
select c.relname as table_name,c.relrowsecurity as rls_enabled,
  (select n.nspname from pg_catalog.pg_extension e
   join pg_catalog.pg_namespace n on n.oid=e.extnamespace where e.extname='postgis') as postgis_schema
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('terra_profiles','terra_listings')
order by c.relname;
