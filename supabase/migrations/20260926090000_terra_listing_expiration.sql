-- Free-tier (básica) listings auto-pause after 30 days without renewal, with a warning
-- notification 5 days before. Paid plans (Plus/Pro, active/trialing) are exempt for as
-- long as the subscription stays active; a downgrade/cancellation gives a fresh 30-day
-- cycle instead of an unannounced mass-pause.

-- renewed_at: same pattern as boosted_until — public read (search RPC does `select l.*`,
-- which needs column-level SELECT on every column under column-level privileges), but
-- never client-writable; only terra_renew_listing() and the transition logic below touch it.
alter table public.terra_listings add column renewed_at timestamptz not null default now();
grant select(renewed_at) on public.terra_listings to anon,authenticated;

-- Reset renewed_at only on the specific transition that means "this is live again" —
-- entering published/reserved from a non-active status. Trivial edits (which bump
-- updated_at/revision unconditionally) never touch it. Rest of the function body is
-- byte-identical to the live public.terra_validate_listing() as of this migration.
create or replace function public.terra_validate_listing() returns trigger
language plpgsql set search_path='' as $$
declare g public.geometry; center_point public.geometry;
begin
  if tg_op='UPDATE' then
    new.id:=old.id; new.owner_id:=old.owner_id; new.created_at:=old.created_at; new.revision:=old.revision+1;
    if new.status in ('published','reserved') and old.status not in ('published','reserved') then
      new.renewed_at:=now();
    end if;
  else
    new.revision:=1;
  end if;
  new.updated_at:=now();
  if jsonb_typeof(new.boundary_geojson)<>'object' or new.boundary_geojson->>'type' is distinct from 'Polygon' then
    raise exception using errcode='22023',message='Desenhe um polígono para o terreno.';
  end if;
  g:=public.st_setsrid(public.st_geomfromgeojson(new.boundary_geojson::text),4326);
  if public.st_isempty(g) or public.st_geometrytype(g)<>'ST_Polygon' or public.st_coorddim(g)<>2 or public.st_numinteriorrings(g)<>0 or public.st_npoints(g) not between 4 and 201 then
    raise exception using errcode='22023',message='Use de 3 a 200 vértices, sem vazios internos.';
  end if;
  if not public.st_isvalid(g) then
    raise exception using errcode='22023',message='Os limites do terreno se cruzam ou são inválidos.';
  end if;
  if public.st_xmin(g::public.box3d)<-180 or public.st_xmax(g::public.box3d)>180 or public.st_ymin(g::public.box3d)<-85 or public.st_ymax(g::public.box3d)>85 then
    raise exception using errcode='22023',message='Coordenadas fora da área suportada.';
  end if;
  new.geom:=g;
  new.boundary_geojson:=public.st_asgeojson(g,15)::jsonb;
  new.area_m2:=round(public.st_area(g::public.geography)::numeric,2);
  new.perimeter_m:=round(public.st_perimeter(g::public.geography)::numeric,2);
  center_point:=public.st_pointonsurface(g);
  new.latitude:=public.st_y(center_point); new.longitude:=public.st_x(center_point);
  return new;
end $$;

-- terra_notifications: widen additively to support expiration alerts alongside the
-- existing saved-search-match notifications. search_id becomes optional; a `kind`
-- discriminator distinguishes the three shapes.
alter table public.terra_notifications alter column search_id drop not null;
alter table public.terra_notifications add column kind text not null default 'saved_search_match'
  check (kind in ('saved_search_match','listing_expiring','listing_paused'));
alter table public.terra_notifications add constraint terra_notifications_kind_search_ck
  check ((kind='saved_search_match' and search_id is not null) or (kind<>'saved_search_match' and search_id is null));
-- Concurrency safety net only — the real dedup logic lives in terra_expire_listings()'s
-- `not exists` clause below, keyed off renewed_at so a genuine renewal can produce a
-- fresh warning without duplicating inside the same unrenewed cycle.
create unique index terra_notifications_cycle_idx on public.terra_notifications(listing_id,kind)
  where kind<>'saved_search_match';

-- Owner-triggered renewal: resets the 30-day clock without editing the listing.
create function public.terra_renew_listing(p_listing uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.terra_listings;
begin
  if auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
  select * into l from public.terra_listings where id=p_listing for update;
  if l.id is null or l.owner_id<>auth.uid() then raise exception 'Anúncio indisponível.'; end if;
  if l.status not in ('published','reserved','paused') then
    raise exception 'Este anúncio não pode ser renovado agora.';
  end if;
  update public.terra_listings set renewed_at=now() where id=p_listing;
  return jsonb_build_object('ok',true,'renewed_at',now());
end $$;
revoke all on function public.terra_renew_listing(uuid) from public,anon,authenticated;
grant execute on function public.terra_renew_listing(uuid) to authenticated;

-- Shared "effective plan" helper — extracted so the expiration job below can never
-- drift from enforce_listing_quota()'s own basica/plus/pro resolution.
create function private_terra.effective_plan(p_owner uuid) returns text
language sql stable security definer set search_path='' as $$
  select coalesce((select s.plan from private_terra.subscriptions s
    where s.user_id=p_owner and s.status in ('active','trialing')),'basica')
$$;
revoke all on function private_terra.effective_plan(uuid) from public,anon,authenticated;

create or replace function private_terra.enforce_listing_quota() returns trigger
language plpgsql security definer set search_path='' as $$
declare effective_plan text; cap integer; active_count integer;
begin
  if new.status in ('published','reserved','paused') and
     (tg_op='INSERT' or old.status not in ('published','reserved','paused')) then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text,61));
    effective_plan := private_terra.effective_plan(new.owner_id);
    select x.cap into cap from (values ('basica',5),('plus',10),('pro',50)) as x(plan,cap) where x.plan=effective_plan;
    if cap is not null then
      select count(*) into active_count from public.terra_listings l
        where l.owner_id=new.owner_id and l.status in ('published','reserved','paused') and l.id is distinct from new.id;
      if active_count>=cap then
        if effective_plan='pro' then
          raise exception 'Você atingiu o limite de 50 anúncios ativos do plano Pro. Fale conosco sobre o plano Empresas para publicar mais.';
        else
          raise exception 'Você atingiu o limite de % anúncios ativos do seu plano. Faça upgrade em Minha conta → Plano para publicar mais.', cap;
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;

-- Daily job: warn básica listings 5 days before expiry, pause them at 30 days.
create function public.terra_expire_listings() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_warn_days constant integer := 25; v_expire_days constant integer := 30;
        v_warned integer; v_paused integer;
begin
  insert into public.terra_notifications(user_id,listing_id,kind)
  select l.owner_id, l.id, 'listing_expiring'
  from public.terra_listings l
  where l.status in ('published','reserved')
    and private_terra.effective_plan(l.owner_id)='basica'
    and l.renewed_at <= now() - make_interval(days=>v_warn_days)
    and not exists (
      select 1 from public.terra_notifications n
      where n.listing_id=l.id and n.kind='listing_expiring' and n.created_at>=l.renewed_at
    )
  on conflict (listing_id,kind) where kind<>'saved_search_match' do nothing;
  get diagnostics v_warned = row_count;

  with expired as (
    update public.terra_listings l set status='paused'
    where l.status in ('published','reserved')
      and private_terra.effective_plan(l.owner_id)='basica'
      and l.renewed_at <= now() - make_interval(days=>v_expire_days)
    returning l.id, l.owner_id
  )
  insert into public.terra_notifications(user_id,listing_id,kind)
  select owner_id, id, 'listing_paused' from expired
  on conflict (listing_id,kind) where kind<>'saved_search_match' do nothing;
  get diagnostics v_paused = row_count;

  return jsonb_build_object('ok',true,'warned',v_warned,'paused',v_paused);
end $$;
revoke all on function public.terra_expire_listings() from public,anon,authenticated;
grant execute on function public.terra_expire_listings() to service_role;

-- On downgrade/cancellation (paid -> not paid), give listings a fresh 30-day cycle
-- instead of an unannounced mass-pause from renewed_at having sat untouched for the
-- entire time the subscription was active.
create or replace function public.terra_sync_subscription(p_user uuid,p_customer text,p_subscription text,p_plan text,p_status text,p_period_end timestamptz,p_cancel_at_period_end boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare was_paid boolean;
begin
  select (plan in ('plus','pro') and status in ('active','trialing')) into was_paid
    from private_terra.subscriptions where user_id=p_user;
  insert into private_terra.subscriptions(user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end,cancel_at_period_end,updated_at)
  values(p_user,p_plan,p_status,p_customer,p_subscription,p_period_end,p_cancel_at_period_end,now())
  on conflict(user_id) do update set plan=excluded.plan,status=excluded.status,stripe_customer_id=excluded.stripe_customer_id,
    stripe_subscription_id=excluded.stripe_subscription_id,current_period_end=excluded.current_period_end,
    cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now();
  if coalesce(was_paid,false) and not (p_plan in ('plus','pro') and p_status in ('active','trialing')) then
    update public.terra_listings set renewed_at=now() where owner_id=p_user and status in ('published','reserved');
  end if;
  return jsonb_build_object('ok',true);
end $$;

-- Scheduling: first use of pg_cron in this project. 09:00 UTC = 06:00 BRT (Brazil has
-- had no DST since 2019, so this is fixed year-round). Runs as the role that applies
-- this migration (owner of every object here), so no extra grants are needed for the
-- schedule itself to work.
create extension if not exists pg_cron;
select cron.schedule('terra-expire-listings','0 9 * * *',$$select public.terra_expire_listings();$$);
