-- Short share links (/i/<code>) and optional approximate public location.
-- Approximate listings keep their exact drawing in a private table; public columns
-- (boundary_geojson, geom, latitude, longitude) hold a ~350 m circle whose centre is
-- offset by a secret per-listing vector, so the exact point cannot be recomputed.

-- Short codes -----------------------------------------------------------------
create function private_terra.new_short_code() returns text
language plpgsql volatile security definer set search_path='' as $$
declare alphabet constant text:='23456789abcdefghjkmnpqrstuvwxyz'; code text;
begin
 loop
  code:='';
  for i in 1..6 loop code:=code||substr(alphabet,1+floor(random()*length(alphabet))::int,1); end loop;
  exit when not exists(select 1 from public.terra_listings where short_code=code);
 end loop;
 return code;
end $$;
revoke all on function private_terra.new_short_code() from public;
grant execute on function private_terra.new_short_code() to authenticated;

alter table public.terra_listings add column short_code text;
update public.terra_listings set short_code=private_terra.new_short_code() where short_code is null;
alter table public.terra_listings alter column short_code set default private_terra.new_short_code();
alter table public.terra_listings alter column short_code set not null;
alter table public.terra_listings add constraint terra_listings_short_code_key unique(short_code);

-- Approximate location ----------------------------------------------------------
alter table public.terra_listings add column location_precision text not null default 'exact'
 check(location_precision in ('exact','approximate'));

create table private_terra.exact_locations(
 listing_id uuid primary key,
 boundary_geojson jsonb not null,
 offset_bearing double precision not null default random()*2*pi(),
 offset_m double precision not null default 100+random()*150,
 updated_at timestamptz not null default now()
);
alter table private_terra.exact_locations enable row level security;
revoke all on private_terra.exact_locations from public,anon,authenticated;

-- Runs before terra_listing_validate: an update that did not send a new drawing
-- (status change, renewal) keeps measuring from the exact private drawing.
create function private_terra.restore_exact_location() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.location_precision='approximate' and new.boundary_geojson is not distinct from old.boundary_geojson then
  new.boundary_geojson:=coalesce((select e.boundary_geojson from private_terra.exact_locations e where e.listing_id=old.id),new.boundary_geojson);
 end if;
 return new;
end $$;
revoke all on function private_terra.restore_exact_location() from public,anon,authenticated;
create trigger terra_listing_restore_location before update on public.terra_listings
 for each row execute function private_terra.restore_exact_location();

-- Runs after terra_listing_validate (area, perimeter and centre already come from the exact drawing).
create function private_terra.apply_location_privacy() returns trigger
language plpgsql security definer set search_path='' as $$
declare e private_terra.exact_locations; centre public.geography; circle public.geometry;
begin
 if new.location_precision<>'approximate' then
  delete from private_terra.exact_locations where listing_id=new.id;
  return new;
 end if;
 insert into private_terra.exact_locations(listing_id,boundary_geojson) values(new.id,new.boundary_geojson)
  on conflict(listing_id) do update set boundary_geojson=excluded.boundary_geojson,updated_at=now()
  returning * into e;
 centre:=public.st_project(public.st_setsrid(public.st_makepoint(new.longitude,new.latitude),4326)::public.geography,e.offset_m,e.offset_bearing);
 circle:=public.st_setsrid(public.st_buffer(centre,350)::public.geometry,4326);
 new.geom:=circle;
 new.boundary_geojson:=public.st_asgeojson(circle,6)::jsonb;
 new.latitude:=public.st_y(centre::public.geometry);
 new.longitude:=public.st_x(centre::public.geometry);
 return new;
end $$;
revoke all on function private_terra.apply_location_privacy() from public,anon,authenticated;
create trigger terra_listing_with_location_privacy before insert or update on public.terra_listings
 for each row execute function private_terra.apply_location_privacy();

create function private_terra.forget_exact_location() returns trigger
language plpgsql security definer set search_path='' as $$
begin delete from private_terra.exact_locations where listing_id=old.id; return old; end $$;
revoke all on function private_terra.forget_exact_location() from public,anon,authenticated;
create trigger terra_listing_forget_location after delete on public.terra_listings
 for each row execute function private_terra.forget_exact_location();

-- The owner (and only the owner) can read back the exact drawing to edit it.
create function public.terra_exact_boundary(p_listing uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(e.boundary_geojson,l.boundary_geojson)
 from public.terra_listings l left join private_terra.exact_locations e on e.listing_id=l.id
 where l.id=p_listing and l.owner_id=(select auth.uid())
$$;
revoke all on function public.terra_exact_boundary(uuid) from public,anon,authenticated;
grant execute on function public.terra_exact_boundary(uuid) to authenticated;

grant select(short_code,location_precision) on public.terra_listings to anon,authenticated;
grant insert(location_precision),update(location_precision) on public.terra_listings to authenticated;
