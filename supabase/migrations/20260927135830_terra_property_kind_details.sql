-- Per-kind property attributes: suites, floor, ceiling height, condominium fee and IPTU,
-- plus residential/commercial amenities. Additive: every existing row stays valid.
create or replace function private_terra.valid_property_details(d jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare k text; lo numeric; hi numeric; whole boolean; n numeric;
begin
 for k, lo, hi, whole in select * from (values
   ('bedrooms',0,100,true),('bathrooms',0,100,true),('parking_spaces',0,100,true),('suites',0,100,true),
   ('built_area_m2',1,1000000,false),('floor',-5,300,true),('ceiling_height_m',1,100,false),
   ('condo_fee_brl',0,1000000,false),('iptu_brl',0,100000000,false)) v loop
  if d ? k then
   if jsonb_typeof(d->k)<>'number' then return false; end if;
   n:=(d->>k)::numeric;
   if n<lo or n>hi or (whole and n<>trunc(n)) then return false; end if;
  end if;
 end loop;
 return true;
end $$;

alter table public.terra_listings drop constraint terra_listings_features_check;
alter table public.terra_listings add constraint terra_listings_features_check check(features <@ array['esquina','murado','cercado','nascente','vista','piscina','churrasqueira','varanda','elevador','portaria','area_lazer','mobiliado']);
