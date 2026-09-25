-- Synthetic fixtures only. Every mutation is rolled back. One transaction per test case
-- (lesson learned building verify-billing.sql: reusing identical literal SQL text across
-- an exception-handled rollback-to-savepoint statement and a later real statement in the
-- same shared transaction produced flaky failures on this project's db-query tooling —
-- per-test isolation avoids it and is better practice anyway).

-- Test 1: happy path — renew resets the clock; wrong owner and bad status are rejected.
begin;
select set_config('qax.a',gen_random_uuid()::text,true),set_config('qax.b',gen_random_uuid()::text,true),set_config('qax.listing',gen_random_uuid()::text,true),set_config('qax.draft',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
select current_setting('qax.'||who)::uuid,'authenticated','authenticated',current_setting('qax.'||who)||'@example.invalid','{"display_name":"QA expiration"}',now(),now() from unnest(array['a','b'])t(who);
insert into auth.sessions(id,user_id,created_at,updated_at) select current_setting('qax.'||who)::uuid,current_setting('qax.'||who)::uuid,now(),now() from unnest(array['a','b'])t(who);
insert into public.terra_contact_settings(user_id,phone,enabled) values(current_setting('qax.a')::uuid,'5532999999990',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qax.a'),'role','authenticated','session_id',current_setting('qax.a'))::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson) values
 (current_setting('qax.listing')::uuid,'QA expire target','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson) values
 (current_setting('qax.draft')::uuid,'QA expire draft','QA cidade','MG','residencial',100000,'draft','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
reset role;
update public.terra_listings set renewed_at=now()-interval '29 days' where id=current_setting('qax.listing')::uuid;
do $$declare before_renew timestamptz; after_renew timestamptz; begin
 select renewed_at into before_renew from public.terra_listings where id=current_setting('qax.listing')::uuid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qax.a'),'role','authenticated','session_id',current_setting('qax.a'))::text,true);
 set local role authenticated;
 perform public.terra_renew_listing(current_setting('qax.listing')::uuid);
 reset role;
 select renewed_at into after_renew from public.terra_listings where id=current_setting('qax.listing')::uuid;
 if after_renew<=before_renew or after_renew<now()-interval '1 minute' then raise exception 'FAIL: renew did not reset renewed_at'; end if;
end $$;
do $$begin
 begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qax.b'),'role','authenticated','session_id',current_setting('qax.b'))::text,true);
  set local role authenticated;
  perform public.terra_renew_listing(current_setting('qax.listing')::uuid);
  raise exception 'FAIL: wrong owner renewed a listing that is not theirs';
 exception when others then if sqlerrm not like 'Anúncio indisponível%' then raise; end if;
 end;
 reset role;
end $$;
do $$begin
 begin
  perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qax.a'),'role','authenticated','session_id',current_setting('qax.a'))::text,true);
  set local role authenticated;
  perform public.terra_renew_listing(current_setting('qax.draft')::uuid);
  raise exception 'FAIL: a draft was renewed';
 exception when others then if sqlerrm not like 'Este anúncio não pode ser renovado%' then raise; end if;
 end;
 reset role;
end $$;
rollback;

-- Test 2: the expiration job warns once at day 25, never re-opens a read/already-warned
-- notification on subsequent daily runs, but a fresh renewal allows a brand new warning
-- in the next cycle.
begin;
select set_config('qax.c',gen_random_uuid()::text,true),set_config('qax.listing2',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
values(current_setting('qax.c')::uuid,'authenticated','authenticated',current_setting('qax.c')||'@example.invalid','{"display_name":"QA warn"}',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('qax.c')::uuid,current_setting('qax.c')::uuid,now(),now());
insert into public.terra_contact_settings(user_id,phone,enabled) values(current_setting('qax.c')::uuid,'5532999999991',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qax.c'),'role','authenticated','session_id',current_setting('qax.c'))::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson) values
 (current_setting('qax.listing2')::uuid,'QA warn target','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
reset role;
update public.terra_listings set renewed_at=now()-interval '26 days' where id=current_setting('qax.listing2')::uuid;
do $$declare n integer; begin
 perform public.terra_expire_listings();
 select count(*) into n from public.terra_notifications where listing_id=current_setting('qax.listing2')::uuid and kind='listing_expiring';
 if n<>1 then raise exception 'FAIL: expected exactly one warning, got %', n; end if;
 update public.terra_notifications set is_read=true where listing_id=current_setting('qax.listing2')::uuid and kind='listing_expiring';
 perform public.terra_expire_listings();
 select count(*) into n from public.terra_notifications where listing_id=current_setting('qax.listing2')::uuid and kind='listing_expiring' and is_read=false;
 if n<>0 then raise exception 'FAIL: a read warning was reopened by a later run'; end if;
 select count(*) into n from public.terra_notifications where listing_id=current_setting('qax.listing2')::uuid and kind='listing_expiring';
 if n<>1 then raise exception 'FAIL: a duplicate warning row was inserted'; end if;
end $$;
-- Renew, then age it into the warning window again — a fresh cycle should warn again.
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qax.c'),'role','authenticated','session_id',current_setting('qax.c'))::text,true);
set local role authenticated;
do $$begin perform public.terra_renew_listing(current_setting('qax.listing2')::uuid); end $$;
reset role;
update public.terra_listings set renewed_at=now()-interval '26 days' where id=current_setting('qax.listing2')::uuid;
do $$declare n integer; begin
 perform public.terra_expire_listings();
 select count(*) into n from public.terra_notifications where listing_id=current_setting('qax.listing2')::uuid and kind='listing_expiring';
 if n<>1 then raise exception 'FAIL: new cycle did not produce a fresh warning (still %)', n; end if;
end $$;
rollback;

-- Test 3: the job pauses básica listings past 30 days and records a listing_paused
-- notification; a Plus subscriber with an equally stale renewed_at is never touched.
begin;
select set_config('qax.d',gen_random_uuid()::text,true),set_config('qax.listing3',gen_random_uuid()::text,true),set_config('qax.e',gen_random_uuid()::text,true),set_config('qax.listing4',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
select current_setting('qax.'||who)::uuid,'authenticated','authenticated',current_setting('qax.'||who)||'@example.invalid','{"display_name":"QA pause"}',now(),now() from unnest(array['d','e'])t(who);
insert into auth.sessions(id,user_id,created_at,updated_at) select current_setting('qax.'||who)::uuid,current_setting('qax.'||who)::uuid,now(),now() from unnest(array['d','e'])t(who);
insert into public.terra_contact_settings(user_id,phone,enabled) values
 (current_setting('qax.d')::uuid,'5532999999992',true),
 (current_setting('qax.e')::uuid,'5532999999993',true);
insert into private_terra.subscriptions(user_id,plan,status) values(current_setting('qax.e')::uuid,'plus','active');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qax.d'),'role','authenticated','session_id',current_setting('qax.d'))::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson) values
 (current_setting('qax.listing3')::uuid,'QA básica stale','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qax.e'),'role','authenticated','session_id',current_setting('qax.e'))::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson) values
 (current_setting('qax.listing4')::uuid,'QA plus stale','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
reset role;
update public.terra_listings set renewed_at=now()-interval '90 days' where id in (current_setting('qax.listing3')::uuid,current_setting('qax.listing4')::uuid);
do $$declare basica_status text; plus_status text; n integer; begin
 perform public.terra_expire_listings();
 select status into basica_status from public.terra_listings where id=current_setting('qax.listing3')::uuid;
 if basica_status<>'paused' then raise exception 'FAIL: básica listing past 30 days was not paused'; end if;
 select count(*) into n from public.terra_notifications where listing_id=current_setting('qax.listing3')::uuid and kind='listing_paused';
 if n<>1 then raise exception 'FAIL: expected a listing_paused notification'; end if;
 select status into plus_status from public.terra_listings where id=current_setting('qax.listing4')::uuid;
 if plus_status<>'published' then raise exception 'FAIL: an active plus subscriber listing was paused'; end if;
 if exists(select 1 from public.terra_notifications where listing_id=current_setting('qax.listing4')::uuid) then raise exception 'FAIL: a plus subscriber received an expiration notification'; end if;
end $$;
rollback;

-- Test 4: downgrading from an active paid plan resets renewed_at on the owner's active
-- listings, giving them a fresh 30-day cycle instead of an immediate mass-pause.
begin;
select set_config('qax.f',gen_random_uuid()::text,true),set_config('qax.listing5',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
values(current_setting('qax.f')::uuid,'authenticated','authenticated',current_setting('qax.f')||'@example.invalid','{"display_name":"QA downgrade"}',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('qax.f')::uuid,current_setting('qax.f')::uuid,now(),now());
insert into public.terra_contact_settings(user_id,phone,enabled) values(current_setting('qax.f')::uuid,'5532999999994',true);
insert into private_terra.subscriptions(user_id,plan,status) values(current_setting('qax.f')::uuid,'plus','active');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qax.f'),'role','authenticated','session_id',current_setting('qax.f'))::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson) values
 (current_setting('qax.listing5')::uuid,'QA downgrade target','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
reset role;
update public.terra_listings set renewed_at=now()-interval '200 days' where id=current_setting('qax.listing5')::uuid;
do $$declare after_downgrade timestamptz; begin
 perform public.terra_sync_subscription(current_setting('qax.f')::uuid,'cus_x','sub_x','basica','canceled',null,false);
 select renewed_at into after_downgrade from public.terra_listings where id=current_setting('qax.listing5')::uuid;
 if after_downgrade<now()-interval '1 minute' then raise exception 'FAIL: downgrade did not reset renewed_at'; end if;
end $$;
rollback;

-- Privacy: renewed_at is not client-writable, and the job/dedupe machinery is
-- unreachable from the authenticated role — mirrors verify-billing.sql's checks.
begin;
select set_config('qax.g',gen_random_uuid()::text,true),set_config('qax.listing6',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
values(current_setting('qax.g')::uuid,'authenticated','authenticated',current_setting('qax.g')||'@example.invalid','{"display_name":"QA privacy"}',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at) values(current_setting('qax.g')::uuid,current_setting('qax.g')::uuid,now(),now());
insert into public.terra_contact_settings(user_id,phone,enabled) values(current_setting('qax.g')::uuid,'5532999999995',true);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qax.g'),'role','authenticated','session_id',current_setting('qax.g'))::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson) values
 (current_setting('qax.listing6')::uuid,'QA privacy target','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
do $$begin
 begin update public.terra_listings set renewed_at=now() where id=current_setting('qax.listing6')::uuid;raise exception 'FAIL: client wrote renewed_at directly';exception when insufficient_privilege then null;end;
 begin perform public.terra_expire_listings();raise exception 'FAIL: client ran the expiration job';exception when insufficient_privilege then null;end;
 begin perform private_terra.effective_plan(auth.uid());raise exception 'FAIL: client read the private effective_plan helper';exception when insufficient_privilege then null;end;
 begin insert into public.terra_notifications(user_id,listing_id,kind) values(auth.uid(),current_setting('qax.listing6')::uuid,'listing_paused');raise exception 'FAIL: client inserted a notification directly';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
