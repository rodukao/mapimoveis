begin;
alter table public.terra_profiles
 add column if not exists description text not null default '' check(length(description)<=2000),
 add column if not exists state text not null default '' check(state='' or state ~ '^[A-Z]{2}$'),
 add column if not exists creci text not null default '' check(length(creci)<=40),
 add column if not exists website text not null default '' check(website='' or website ~ '^https://[^[:space:]]+$'),
 add column if not exists instagram text not null default '' check(instagram='' or instagram ~ '^[A-Za-z0-9_.]{1,30}$');
grant select(description,state,creci,website,instagram) on public.terra_profiles to anon,authenticated;
grant update(description,state,creci,website,instagram) on public.terra_profiles to authenticated;
create or replace function private_terra.advertiser(p_owner uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',p.id,'display_name',p.display_name,'city',p.city,'state',p.state,'description',p.description,'creci',p.creci,'website',p.website,'instagram',p.instagram,'account_type',p.account_type,'avatar_path',p.avatar_path,'email_verified',p.email_verified,'phone_verified',p.phone_verified,'identity_verified',p.identity_verified,'professional_verified',p.professional_verified,'created_at',p.created_at,'active_count',(select count(*) from public.terra_listings l where l.owner_id=p.id and l.status in ('published','reserved')),'has_whatsapp',exists(select 1 from public.terra_contact_settings c where c.user_id=p.id and c.enabled and c.phone<>'')) from public.terra_profiles p where p.id=p_owner and (p.id=(select auth.uid()) or exists(select 1 from public.terra_listings l where l.owner_id=p.id and l.status in ('published','reserved','sold')))
$$;
create index if not exists terra_views_listing_created_idx on public.terra_views(listing_id,created_at);
create index if not exists terra_leads_advertiser_created_idx on public.terra_leads(advertiser_id,created_at);
create index if not exists terra_favorites_listing_created_idx on public.terra_favorites(listing_id,created_at);
create function private_terra.professional_dashboard() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare owner uuid:=auth.uid();result jsonb;
begin
 if owner is null or not private_terra.active_account() then raise exception using errcode='42501',message='Entre na sua conta.';end if;
 with listings as (select l.id,l.title,l.status from public.terra_listings l where l.owner_id=owner),
 metrics as (select l.*,(select count(*) from public.terra_views v where v.listing_id=l.id and v.created_at>=now()-interval '30 days') views,(select count(*) from public.terra_leads v where v.listing_id=l.id and v.created_at>=now()-interval '30 days') contacts,(select count(*) from public.terra_favorites v where v.listing_id=l.id and v.created_at>=now()-interval '30 days') favorites from listings l)
 select jsonb_build_object('days',30,'active',(select count(*) from listings where status in ('published','reserved')),'views',coalesce(sum(views),0),'favorites',coalesce(sum(favorites),0),'contacts',coalesce(sum(contacts),0),'top',coalesce((select jsonb_agg(row_to_json(t)) from (select * from metrics where views+contacts+favorites>0 order by contacts desc,favorites desc,views desc,id limit 5)t),'[]'::jsonb)) into result from metrics;
 return result;
end $$;
revoke all on function private_terra.professional_dashboard() from public;
grant execute on function private_terra.professional_dashboard() to authenticated;
create function public.terra_professional_dashboard() returns jsonb language sql stable security invoker set search_path='' as $$select private_terra.professional_dashboard()$$;
revoke all on function public.terra_professional_dashboard() from public,anon;
grant execute on function public.terra_professional_dashboard() to authenticated;

-- The public website holds a dedicated proxy secret; it is never a database service key.
create table private_terra.contact_proxy_keys(key_hash text primary key check(length(key_hash)=64));
alter table private_terra.contact_proxy_keys enable row level security;
revoke all on private_terra.contact_proxy_keys from public,anon,authenticated;
create function public.terra_contact_proxy_valid(p_hash text) returns boolean language sql security definer set search_path='' as $$select exists(select 1 from private_terra.contact_proxy_keys where key_hash=p_hash)$$;
revoke all on function public.terra_contact_proxy_valid(text) from public,anon,authenticated;
grant execute on function public.terra_contact_proxy_valid(text) to service_role;
create table private_terra.contact_limits(key text primary key,window_start timestamptz not null,hits integer not null);
alter table private_terra.contact_limits enable row level security;
revoke all on private_terra.contact_limits from public,anon,authenticated;
create function public.terra_contact_gate(p_ip text,p_session uuid,p_verified boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare slot timestamptz:=date_trunc('hour',now());k text;n integer;ip_hits integer:=0;session_hits integer:=0;
begin
 if p_ip is null or p_ip !~ '^[0-9a-f]{64}$' or p_session is null then raise exception 'Visitante inválido.';end if;
 -- Fixed-size counters and atomic increments persist even when a request is denied.
 foreach k in array array['global','ip:'||p_ip,'session:'||p_session::text] loop
 insert into private_terra.contact_limits values(k,slot,1) on conflict(key) do update set hits=case when private_terra.contact_limits.window_start=excluded.window_start then private_terra.contact_limits.hits+1 else 1 end,window_start=excluded.window_start returning hits into n;
 if k='global' and n>2000 then return jsonb_build_object('error','RATE_LIMIT','retry_after',3600);end if;
 if k like 'ip:%' then ip_hits:=n;else session_hits:=n;end if;
 end loop;
 delete from private_terra.contact_limits where window_start<now()-interval '48 hours';
 if ip_hits>60 or session_hits>20 then return jsonb_build_object('error','RATE_LIMIT','retry_after',3600);end if;
 if (ip_hits>5 or session_hits>3) and not p_verified then return jsonb_build_object('error','CAPTCHA_REQUIRED');end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.terra_contact_gate(text,uuid,boolean) from public,anon,authenticated;
grant execute on function public.terra_contact_gate(text,uuid,boolean) to service_role;
create function public.terra_contact_deliver(p_listing uuid,p_owner uuid,p_session uuid,p_user uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare l public.terra_listings;c text;slot timestamptz:=to_timestamp(floor(extract(epoch from now())/1800)*1800);
begin
 if p_session is null then raise exception 'Visitante inválido.';end if;
 if p_listing is not null then select * into l from public.terra_listings where id=p_listing and status in ('published','reserved') for share;
 else select * into l from public.terra_listings where owner_id=p_owner and status in ('published','reserved') order by created_at desc,id limit 1 for share;end if;
 if l.id is null or exists(select 1 from private_terra.deletion_jobs where user_id=l.owner_id) then raise exception 'Anúncio indisponível para contato.';end if;
 select phone into c from public.terra_contact_settings where user_id=l.owner_id and enabled and phone ~ '^55[0-9]{10,11}$';
 if c is null then raise exception 'WhatsApp indisponível.';end if;
 if l.owner_id is distinct from p_user then insert into public.terra_leads(listing_id,advertiser_id,user_id,session_id,window_start) values(l.id,l.owner_id,p_user,p_session,slot) on conflict do nothing;end if;
 insert into public.terra_events(event_name,listing_id,session_id,user_id) values('whatsapp_click',l.id,p_session,p_user);
 return jsonb_build_object('phone',c,'listing_id',l.id);
end $$;
revoke all on function public.terra_contact_deliver(uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.terra_contact_deliver(uuid,uuid,uuid,uuid) to service_role;
commit;
