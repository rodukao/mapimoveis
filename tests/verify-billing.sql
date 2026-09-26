-- Synthetic fixtures only. Every mutation is rolled back. Each numbered test runs in
-- its own transaction (rather than one shared transaction) so fixtures never leak or
-- interact between tests.

-- Test 1: básica caps at 5 active listings, with the exact upgrade message.
begin;
select set_config('qa6.a',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
values(current_setting('qa6.a')::uuid,'authenticated','authenticated',current_setting('qa6.a')||'@example.invalid','{"display_name":"QA billing"}',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('qa6.a')::uuid,current_setting('qa6.a')::uuid,now(),now());
insert into public.terra_contact_settings(user_id,phone,enabled) values(current_setting('qa6.a')::uuid,'5532999999997',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa6.a'),'role','authenticated','session_id',current_setting('qa6.a'))::text,true);
set local role authenticated;
insert into public.terra_listings(title,city,state,category,price_brl,status,boundary_geojson) values
 ('QA billing 1','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}'),
 ('QA billing 2','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}'),
 ('QA billing 3','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}'),
 ('QA billing 4','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}'),
 ('QA billing 5','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
do $$begin
 begin
  insert into public.terra_listings(title,city,state,category,price_brl,status,boundary_geojson) values
   ('QA billing over cap','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
  raise exception 'FAIL: básica exceeded its 5-listing cap';
 exception when others then if sqlerrm not like 'Você atingiu o limite de 5%' then raise; end if;
 end;
end $$;

-- Privacy: billing tables/functions are invisible and unusable from the client role.
do $$declare fake_listing uuid:=gen_random_uuid(); begin
 begin perform count(*) from private_terra.subscriptions;raise exception 'FAIL: subscriptions table exposed to authenticated';exception when insufficient_privilege then null;end;
 begin perform count(*) from private_terra.boosts;raise exception 'FAIL: boosts table exposed to authenticated';exception when insufficient_privilege then null;end;
 begin perform public.terra_sync_subscription(auth.uid(),null,null,'pro','active',null,false);raise exception 'FAIL: client synced its own subscription';exception when insufficient_privilege then null;end;
 begin perform public.terra_apply_boost(auth.uid(),fake_listing,'s','p',14.9);raise exception 'FAIL: client applied its own boost';exception when insufficient_privilege then null;end;
 begin perform public.terra_stripe_event_seen('evt_x');raise exception 'FAIL: client marked a webhook event seen';exception when insufficient_privilege then null;end;
 begin perform public.terra_billing_customer(auth.uid());raise exception 'FAIL: client read the service-only customer lookup';exception when insufficient_privilege then null;end;
 begin update public.terra_listings set boosted_until=now() where owner_id=auth.uid();raise exception 'FAIL: client wrote boosted_until directly';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;

-- Test 2: a plus subscription raises the cap to 10.
begin;
select set_config('qa6.b',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
values(current_setting('qa6.b')::uuid,'authenticated','authenticated',current_setting('qa6.b')||'@example.invalid','{"display_name":"QA billing plus"}',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('qa6.b')::uuid,current_setting('qa6.b')::uuid,now(),now());
insert into public.terra_contact_settings(user_id,phone,enabled) values(current_setting('qa6.b')::uuid,'5532999999996',true);
insert into private_terra.subscriptions(user_id,plan,status) values(current_setting('qa6.b')::uuid,'plus','active');
-- Bulk-seed under a service-role context (auth.uid() null) so the unrelated
-- listing-creation rate limit (5/hour before a challenge is required) isn't hit —
-- the quota trigger itself keys off owner_id, not auth.uid().
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into public.terra_listings(owner_id,title,city,state,category,price_brl,status,boundary_geojson)
select current_setting('qa6.b')::uuid,'QA plus '||i,'QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}'
from generate_series(1,10) i;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa6.b'),'role','authenticated','session_id',current_setting('qa6.b'))::text,true);
set local role authenticated;
do $$begin
 begin
  insert into public.terra_listings(title,city,state,category,price_brl,status,boundary_geojson) values
   ('QA plus over cap','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
  raise exception 'FAIL: plus exceeded its 10-listing cap';
 exception when others then if sqlerrm not like 'Você atingiu o limite de 10%' then raise; end if;
 end;
end $$;
reset role;
rollback;

-- Test 3: pro caps at 50, with the plano Empresas message beyond that. The subscription
-- is created before the bulk seed: the quota trigger keys off new.owner_id regardless of
-- caller role, so seeding listings for a user who is still effectively básica (no
-- subscription row yet) would hit the 5-listing cap immediately.
begin;
select set_config('qa6.pro',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
values(current_setting('qa6.pro')::uuid,'authenticated','authenticated',current_setting('qa6.pro')||'@example.invalid','{"display_name":"QA pro"}',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('qa6.pro')::uuid,current_setting('qa6.pro')::uuid,now(),now());
insert into public.terra_contact_settings(user_id,phone,enabled) values(current_setting('qa6.pro')::uuid,'5532999999998',true);
insert into private_terra.subscriptions(user_id,plan,status) values(current_setting('qa6.pro')::uuid,'pro','active');
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into public.terra_listings(owner_id,title,city,state,category,price_brl,status,boundary_geojson)
select current_setting('qa6.pro')::uuid,'QA pro '||i,'QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}'
from generate_series(1,49) i;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa6.pro'),'role','authenticated','session_id',current_setting('qa6.pro'))::text,true);
set local role authenticated;
insert into public.terra_listings(title,city,state,category,price_brl,status,boundary_geojson) values
 ('QA pro 50','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
do $$begin
 begin
  insert into public.terra_listings(title,city,state,category,price_brl,status,boundary_geojson) values
   ('QA pro over cap','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
  raise exception 'FAIL: pro exceeded its 50-listing cap';
 exception when others then if sqlerrm not like '%plano Pro%Empresas%' then raise; end if;
 end;
end $$;
reset role;
rollback;

-- Test 4: repeat boosts extend the remaining time instead of resetting it, and the
-- boosted listing sorts first under any search order.
begin;
select set_config('qa6.c',gen_random_uuid()::text,true),set_config('qa6.listing',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
values(current_setting('qa6.c')::uuid,'authenticated','authenticated',current_setting('qa6.c')||'@example.invalid','{"display_name":"QA boost"}',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('qa6.c')::uuid,current_setting('qa6.c')::uuid,now(),now());
insert into public.terra_contact_settings(user_id,phone,enabled) values(current_setting('qa6.c')::uuid,'5532999999995',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa6.c'),'role','authenticated','session_id',current_setting('qa6.c'))::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson) values
 (current_setting('qa6.listing')::uuid,'QA boost target','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
reset role;
do $$declare first_until timestamptz; second_until timestamptz; begin
 perform public.terra_apply_boost(current_setting('qa6.c')::uuid,current_setting('qa6.listing')::uuid,'sess1','pi1',14.9);
 select boosted_until into first_until from public.terra_listings where id=current_setting('qa6.listing')::uuid;
 if first_until<now()+interval '6 days' or first_until>now()+interval '8 days' then raise exception 'FAIL: first boost did not set ~7 days'; end if;
 perform public.terra_apply_boost(current_setting('qa6.c')::uuid,current_setting('qa6.listing')::uuid,'sess2','pi2',14.9);
 select boosted_until into second_until from public.terra_listings where id=current_setting('qa6.listing')::uuid;
 if second_until<=first_until+interval '6 days' then raise exception 'FAIL: repeat boost did not extend the remaining time'; end if;
 if (select count(*) from private_terra.boosts where listing_id=current_setting('qa6.listing')::uuid)<>2 then raise exception 'FAIL: boost purchase history incomplete'; end if;
end $$;
-- A cheaper, unboosted listing that would otherwise win a price_asc sort.
insert into public.terra_listings(owner_id,title,city,state,category,price_brl,status,boundary_geojson) values
 (current_setting('qa6.c')::uuid,'QA cheap unboosted','QA cidade','MG','residencial',1000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
do $$declare rows jsonb; begin
 rows:=(public.terra_search_listings(jsonb_build_object('city','QA cidade','state','MG'),'price_asc',10,0,false))->'rows';
 if jsonb_array_length(rows)<2 then raise exception 'FAIL: search fixture missing rows for boost-order check'; end if;
 if rows->0->>'id'<>current_setting('qa6.listing') then raise exception 'FAIL: boosted listing did not sort first under price_asc'; end if;
end $$;
rollback;
