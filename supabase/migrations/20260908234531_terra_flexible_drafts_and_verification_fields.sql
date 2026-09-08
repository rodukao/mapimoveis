-- Package 3: incomplete draft information, without changing geometry or RLS.
-- Non-draft listings retain the original publication requirements.
begin;
alter table public.terra_listings
  drop constraint terra_listings_title_check,
  drop constraint terra_listings_city_check,
  drop constraint terra_listings_state_check,
  drop constraint terra_listings_price_brl_check,
  alter column price_brl drop not null,
  add constraint terra_listings_title_check check (
    char_length(btrim(title)) between 3 and 90 or (status='draft' and title='')),
  add constraint terra_listings_city_check check (
    char_length(btrim(city)) between 2 and 100 or (status='draft' and city='')),
  add constraint terra_listings_state_check check (
    state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')
    or (status='draft' and state='')),
  add constraint terra_listings_price_brl_check check (
    (price_brl is not null and price_brl>0 and price_brl<=999999999999.99)
    or (status='draft' and price_brl is null));

-- Prepared for independent verification workflows. No verification is inferred
-- from a self-declared account type or from user-editable Auth metadata.
alter table public.terra_profiles
  add column email_verified boolean not null default false,
  add column identity_verified boolean not null default false,
  add column professional_verified boolean not null default false;
grant select(email_verified,identity_verified,professional_verified) on public.terra_profiles to anon,authenticated;
revoke insert(email_verified,identity_verified,professional_verified), update(email_verified,identity_verified,professional_verified) on public.terra_profiles from public,anon,authenticated;

create or replace function private_terra.advertiser(p_owner uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
   'id',p.id,'display_name',p.display_name,'city',p.city,'account_type',p.account_type,
   'avatar_path',p.avatar_path,'email_verified',p.email_verified,'phone_verified',p.phone_verified,
   'identity_verified',p.identity_verified,'professional_verified',p.professional_verified,
   'created_at',p.created_at,
   'active_count',(select count(*) from public.terra_listings l where l.owner_id=p.id and l.status in ('published','reserved')),
   'has_whatsapp',exists(select 1 from public.terra_contact_settings c where c.user_id=p.id and c.enabled and c.phone<>''))
 from public.terra_profiles p where p.id=p_owner and
   (p.id=(select auth.uid()) or exists(select 1 from public.terra_listings l where l.owner_id=p.id and l.status in ('published','reserved','sold')))
$$;
commit;
