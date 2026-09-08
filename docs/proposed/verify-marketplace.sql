-- Run in a test project AFTER both proposed migrations. No data persists: final ROLLBACK.
-- This suite is prepared, not yet executed. Stop on the first SQL error.
begin;
select set_config('terra_test.a',gen_random_uuid()::text,true),set_config('terra_test.b',gen_random_uuid()::text,true),set_config('terra_test.listing_a',gen_random_uuid()::text,true),set_config('terra_test.listing_b',gen_random_uuid()::text,true),set_config('terra_test.session',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
select current_setting('terra_test.'||who)::uuid,'authenticated','authenticated',current_setting('terra_test.'||who)||'@example.invalid',jsonb_build_object('display_name','Terra QA '||who),now(),now() from unnest(array['a','b']) as t(who);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('terra_test.a'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson)
values(current_setting('terra_test.listing_a')::uuid,'QA terreno A','QA cidade','MG','residencial',100000,'draft','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
insert into public.terra_saved_searches(name,filters,alerts_enabled) values('QA alerta','{"city":"QA cidade","maxPrice":200000}',true);
do $$begin
 begin
  update public.terra_profiles set phone_verified=true where id=auth.uid();
  raise exception 'FAIL: user could forge verification';
 exception when insufficient_privilege then null; end;
end$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('terra_test.b'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson)
values(current_setting('terra_test.listing_b')::uuid,'QA terreno B','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
insert into public.terra_contact_settings(phone,enabled) values('5532999999999',true);
do $$declare n integer;begin
 if exists(select 1 from public.terra_listings where id=current_setting('terra_test.listing_a')::uuid) then raise exception 'FAIL: private listing leaked'; end if;
 update public.terra_listings set title='Forged edit' where id=current_setting('terra_test.listing_a')::uuid;
 get diagnostics n=row_count;if n<>0 then raise exception 'FAIL: another owner could edit'; end if;
 if public.terra_listing_stats(array[current_setting('terra_test.listing_a')::uuid])<>'{}'::jsonb then raise exception 'FAIL: private metrics leaked';end if;
end$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('terra_test.a'),'role','authenticated')::text,true);
set local role authenticated;
do $$begin
 if not exists(select 1 from public.terra_listings where id=current_setting('terra_test.listing_b')::uuid) then raise exception 'FAIL: public listing invisible after login';end if;
 if not exists(select 1 from public.terra_notifications where listing_id=current_setting('terra_test.listing_b')::uuid) then raise exception 'FAIL: matching notification not created';end if;
 if exists(select 1 from public.terra_contact_settings where user_id=current_setting('terra_test.b')::uuid) then raise exception 'FAIL: private contact table exposed';end if;
end$$;
insert into public.terra_favorites(listing_id) values(current_setting('terra_test.listing_b')::uuid);
do $$begin
 begin
  insert into public.terra_favorites(listing_id) values(current_setting('terra_test.listing_b')::uuid);
  raise exception 'FAIL: duplicate favorite';
 exception when unique_violation then null;end;
end$$;
insert into public.terra_reports(listing_id,reason) values(current_setting('terra_test.listing_b')::uuid,'wrong_location');
update public.terra_listings set status='sold' where id=current_setting('terra_test.listing_a')::uuid;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$declare result jsonb;begin
 if not exists(select 1 from public.terra_listings where id=current_setting('terra_test.listing_a')::uuid and status='sold') then raise exception 'FAIL: sold permalink inaccessible';end if;
 result:=public.terra_search_listings('{"city":"QA cidade"}');
 if (result->>'total')::integer<>1 then raise exception 'FAIL: sold listing included in default search';end if;
 perform public.terra_record_event('view_terreno',current_setting('terra_test.listing_b')::uuid,current_setting('terra_test.session')::uuid);
 perform public.terra_record_event('view_terreno',current_setting('terra_test.listing_b')::uuid,current_setting('terra_test.session')::uuid);
 result:=public.terra_record_event('whatsapp_click',current_setting('terra_test.listing_b')::uuid,current_setting('terra_test.session')::uuid);
 if result->>'phone' is null then raise exception 'FAIL: opted-in contact unavailable';end if;
 begin
  perform count(*) from public.terra_views;
  raise exception 'FAIL: raw visitor identifiers exposed';
 exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('terra_test.b'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare result jsonb;begin
 result:=public.terra_listing_stats(array[current_setting('terra_test.listing_b')::uuid])->current_setting('terra_test.listing_b');
 if (result->>'views')::integer<>1 or (result->>'leads')::integer<>1 or (result->>'favorites')::integer<>1 then raise exception 'FAIL: counts or deduplication incorrect';end if;
 if exists(select 1 from public.terra_reports where user_id=current_setting('terra_test.a')::uuid) then raise exception 'FAIL: another reporter exposed';end if;
end$$;
reset role;
select 'All assertions passed; test changes are being rolled back.' as verification;
rollback;
