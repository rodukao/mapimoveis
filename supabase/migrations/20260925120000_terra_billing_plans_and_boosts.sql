-- Monetization: subscription plans (listing quota) and paid listing boosts.
-- Plan state is intentionally private (never cached on public.terra_profiles, which
-- grants unrestricted select to authenticated) — read only via terra_my_subscription().

create table private_terra.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'basica' check (plan in ('basica','plus','pro')),
  status text not null default 'inactive' check (status in ('inactive','active','trialing','past_due','canceled')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table private_terra.subscriptions enable row level security;
revoke all on private_terra.subscriptions from public,anon,authenticated;

-- Boost purchase audit trail (payment history), distinct from the public boosted_until
-- flag on the listing that search/sort actually reads.
create table private_terra.boosts (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.terra_listings(id) on delete cascade,
  buyer_id uuid not null references auth.users(id) on delete cascade,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  amount_brl numeric(10,2) not null check (amount_brl>0),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index terra_boosts_listing_idx on private_terra.boosts(listing_id,ends_at desc);
alter table private_terra.boosts enable row level security;
revoke all on private_terra.boosts from public,anon,authenticated;

-- Idempotency guard for Stripe's at-least-once webhook delivery/retries.
create table private_terra.stripe_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);
alter table private_terra.stripe_events enable row level security;
revoke all on private_terra.stripe_events from public,anon,authenticated;

-- Public, server-only-writable boost flag consumed by search ordering.
alter table public.terra_listings add column boosted_until timestamptz;
grant select(boosted_until) on public.terra_listings to anon,authenticated;
create index terra_listings_boosted_idx on public.terra_listings(boosted_until desc) where boosted_until is not null;

-- Quota gate: blocks a listing from entering the active set (published/reserved/paused)
-- once the owner's plan cap is reached. security definer because it must read the
-- locked-down private_terra.subscriptions table; mirrors private_terra.guard_write()'s
-- shape and private_terra.require_publication_contact()'s status-transition condition.
create function private_terra.enforce_listing_quota() returns trigger
language plpgsql security definer set search_path='' as $$
declare effective_plan text; cap integer; active_count integer;
begin
  if new.status in ('published','reserved','paused') and
     (tg_op='INSERT' or old.status not in ('published','reserved','paused')) then
    -- Serializes concurrent publish attempts per owner so two simultaneous requests
    -- can't both read "N active, cap N" and both succeed.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.owner_id::text,61));
    select coalesce((select s.plan from private_terra.subscriptions s
      where s.user_id=new.owner_id and s.status in ('active','trialing')),'basica') into effective_plan;
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
revoke all on function private_terra.enforce_listing_quota() from public,anon,authenticated;
create trigger terra_listing_quota_gate before insert or update of status on public.terra_listings
  for each row execute function private_terra.enforce_listing_quota();

-- Applies a paid boost: extends (never resets) the current boosted_until by 7 days,
-- and records the purchase. Called only by terra-billing-webhook with the service key.
create function public.terra_apply_boost(p_user uuid,p_listing uuid,p_session text,p_payment_intent text,p_amount numeric)
returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.terra_listings; new_until timestamptz;
begin
  select * into l from public.terra_listings where id=p_listing for update;
  if l.id is null or l.owner_id<>p_user or l.status not in ('published','reserved','paused') then
    raise exception 'Anúncio indisponível para impulsionar.';
  end if;
  new_until := greatest(coalesce(l.boosted_until,now()),now()) + interval '7 days';
  update public.terra_listings set boosted_until=new_until where id=p_listing;
  insert into private_terra.boosts(listing_id,buyer_id,stripe_checkout_session_id,stripe_payment_intent_id,amount_brl,starts_at,ends_at)
    values(p_listing,p_user,p_session,p_payment_intent,p_amount,now(),new_until);
  return jsonb_build_object('ok',true,'boosted_until',new_until);
end $$;
revoke all on function public.terra_apply_boost(uuid,uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.terra_apply_boost(uuid,uuid,text,text,numeric) to service_role;

-- Upserts subscription state from a verified Stripe event. Called only by the webhook.
create function public.terra_sync_subscription(p_user uuid,p_customer text,p_subscription text,p_plan text,p_status text,p_period_end timestamptz,p_cancel_at_period_end boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  insert into private_terra.subscriptions(user_id,plan,status,stripe_customer_id,stripe_subscription_id,current_period_end,cancel_at_period_end,updated_at)
  values(p_user,p_plan,p_status,p_customer,p_subscription,p_period_end,p_cancel_at_period_end,now())
  on conflict(user_id) do update set plan=excluded.plan,status=excluded.status,stripe_customer_id=excluded.stripe_customer_id,
    stripe_subscription_id=excluded.stripe_subscription_id,current_period_end=excluded.current_period_end,
    cancel_at_period_end=excluded.cancel_at_period_end,updated_at=now();
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.terra_sync_subscription(uuid,text,text,text,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.terra_sync_subscription(uuid,text,text,text,text,timestamptz,boolean) to service_role;

-- Webhook delivery dedupe: returns true only the first time an event_id is seen.
create function public.terra_stripe_event_seen(p_event_id text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
  insert into private_terra.stripe_events(event_id) values(p_event_id) on conflict do nothing;
  return found;
end $$;
revoke all on function public.terra_stripe_event_seen(text) from public,anon,authenticated;
grant execute on function public.terra_stripe_event_seen(text) to service_role;

-- Stripe customer id lookup for the Billing Portal operation. Service-role only —
-- the Edge Function needs this to open a portal session; the client never reads it
-- directly (it goes through terra_my_subscription()'s has_customer boolean instead).
create function public.terra_billing_customer(p_user uuid) returns text
language sql stable security definer set search_path='' as $$
  select stripe_customer_id from private_terra.subscriptions where user_id=p_user
$$;
revoke all on function public.terra_billing_customer(uuid) from public,anon,authenticated;
grant execute on function public.terra_billing_customer(uuid) to service_role;

-- Self-scoped read for the account holder's own "Plano e cobrança" tab. Never exposes
-- another user's plan; mirrors private_terra.professional_dashboard()'s wrapper shape.
create function private_terra.my_subscription() returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce((select jsonb_build_object('plan',s.plan,'status',s.status,'current_period_end',s.current_period_end,
    'cancel_at_period_end',s.cancel_at_period_end,'has_customer',s.stripe_customer_id is not null)
    from private_terra.subscriptions s where s.user_id=(select auth.uid())),
    jsonb_build_object('plan','basica','status','inactive','has_customer',false))
$$;
revoke all on function private_terra.my_subscription() from public;
grant execute on function private_terra.my_subscription() to authenticated;
create function public.terra_my_subscription() returns jsonb language sql security invoker set search_path='' as $$select private_terra.my_subscription()$$;
revoke all on function public.terra_my_subscription() from public,anon;
grant execute on function public.terra_my_subscription() to authenticated;

-- Boosted listings sort first regardless of the visitor's chosen order — a paid boost
-- should not depend on the visitor happening to pick a "featured" sort. Same signature
-- as the live public.terra_search_listings, just reprioritized ordering.
create or replace function public.terra_search_listings(p_filters jsonb default '{}',p_sort text default 'recent',p_limit integer default 50,p_offset integer default 0,p_mine boolean default false) returns jsonb
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
  and (region is null or (l.geom operator(public.&&) region and public.st_intersects(l.geom,region)))
 ), page as (
  select m.* from matching m order by
   (m.boosted_until is not null and m.boosted_until>now()) desc,
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
   (p.boosted_until is not null and p.boosted_until>now()) desc,
   case when p_sort='price_asc' then p.price_brl end asc,
   case when p_sort='price_desc' then p.price_brl end desc,
   case when p_sort='area_asc' then p.area_m2 end asc,
   case when p_sort='area_desc' then p.area_m2 end desc,
   case when p_sort='unit_asc' then p.price_per_m2 end asc,
   p.created_at desc,p.id desc
 ) from page p),'[]'::jsonb)) into answer;
 return answer;
end $$;
