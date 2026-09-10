-- Synthetic fixtures only. Every mutation is rolled back.
begin;
select set_config('qa5.a',gen_random_uuid()::text,true),set_config('qa5.b',gen_random_uuid()::text,true),set_config('qa5.admin',gen_random_uuid()::text,true),set_config('qa5.listing',gen_random_uuid()::text,true),set_config('qa5.report',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
select current_setting('qa5.'||who)::uuid,'authenticated','authenticated',current_setting('qa5.'||who)||'@example.invalid','{"display_name":"QA operations","admin":true}',now(),now() from unnest(array['a','b','admin'])t(who);
insert into auth.sessions(id,user_id,created_at,updated_at) select current_setting('qa5.'||who)::uuid,current_setting('qa5.'||who)::uuid,now(),now() from unnest(array['a','b','admin'])t(who);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa5.a'),'role','authenticated','session_id',current_setting('qa5.a'))::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson) values(current_setting('qa5.listing')::uuid,'QA operations','QA cidade','MG','residencial',100000,'published','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
insert into public.terra_contact_settings(phone,enabled) values('5532999999999',true);
do $$begin
 if public.terra_is_admin() then raise exception 'FAIL: user_metadata granted administration';end if;
 begin perform public.terra_admin_reports();raise exception 'FAIL: non-admin read reports';exception when insufficient_privilege then null;end;
 begin perform count(*) from private_terra.admins;raise exception 'FAIL: private admin membership exposed';exception when insufficient_privilege then null;end;
 begin perform public.terra_grant_challenge(auth.uid(),auth.uid(),'contact');raise exception 'FAIL: client granted its own challenge';exception when insufficient_privilege then null;end;
 begin perform public.terra_prepare_deletion(auth.uid(),auth.uid(),'EXCLUIR MINHA CONTA');raise exception 'FAIL: client bypassed deletion server';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa5.b'),'role','authenticated','session_id',current_setting('qa5.b'))::text,true);
set local role authenticated;
insert into public.terra_reports(listing_id,reason) values(current_setting('qa5.listing')::uuid,'wrong_location'),(current_setting('qa5.listing')::uuid,'false_information'),(current_setting('qa5.listing')::uuid,'nonexistent');
do $$declare x jsonb;begin
 if exists(select 1 from public.terra_contact_settings where user_id=current_setting('qa5.a')::uuid) then raise exception 'FAIL: private phone exposed';end if;
 if public.terra_advertiser(current_setting('qa5.a')::uuid) ? 'phone' then raise exception 'FAIL: advertiser includes phone';end if;
 x:=public.terra_record_event('whatsapp_click',current_setting('qa5.listing')::uuid,gen_random_uuid());if x->>'phone'<>'5532999999999' then raise exception 'FAIL: permitted contact missing';end if;
 begin insert into public.terra_reports(listing_id,reason) values(current_setting('qa5.listing')::uuid,'scam');raise exception 'FAIL: report quota bypassed';exception when others then if sqlerrm not like 'CAPTCHA_REQUIRED:%' then raise;end if;end;
end $$;
reset role;
select public.terra_grant_challenge(current_setting('qa5.b')::uuid,current_setting('qa5.b')::uuid,'report');
set local role authenticated;
insert into public.terra_reports(listing_id,reason) values(current_setting('qa5.listing')::uuid,'scam');
reset role;
select set_config('qa5.report',(select id::text from public.terra_reports where user_id=current_setting('qa5.b')::uuid and reason='scam'),true);
insert into private_terra.admins(user_id) values(current_setting('qa5.admin')::uuid);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa5.admin'),'role','authenticated','session_id',current_setting('qa5.admin'))::text,true);
set local role authenticated;
do $$begin
 if not public.terra_is_admin() then raise exception 'FAIL: legitimate admin denied';end if;
 if not exists(select 1 from jsonb_array_elements(public.terra_admin_reports('all',0))x where x->>'id'=current_setting('qa5.report') and (x->>'report_count')::int=4) then raise exception 'FAIL: admin queue incomplete';end if;
end $$;
select public.terra_admin_action(current_setting('qa5.report')::uuid,'pause','QA moderation pause');
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa5.a'),'role','authenticated','session_id',current_setting('qa5.a'))::text,true);
set local role authenticated;
do $$begin
 begin update public.terra_listings set status='published' where id=current_setting('qa5.listing')::uuid;raise exception 'FAIL: owner bypassed moderation';exception when others then if sqlerrm not like 'Anúncio pausado pela moderação%' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$begin
 if exists(select 1 from public.terra_listings where id=current_setting('qa5.listing')::uuid) then raise exception 'FAIL: moderated listing public';end if;
 begin perform public.terra_record_event('whatsapp_click',current_setting('qa5.listing')::uuid,gen_random_uuid());raise exception 'FAIL: anonymous phone scraping';exception when insufficient_privilege then null;end;
 begin perform private_terra.record_event_unchecked('whatsapp_click',current_setting('qa5.listing')::uuid,gen_random_uuid());raise exception 'FAIL: legacy recorder bypass';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa5.admin'),'role','authenticated','session_id',current_setting('qa5.admin'))::text,true);
set local role authenticated;
select public.terra_admin_action(current_setting('qa5.report')::uuid,'restore','QA moderation restore');
select public.terra_admin_action(current_setting('qa5.report')::uuid,'review','QA reviewed report');
select public.terra_admin_action(current_setting('qa5.report')::uuid,'archive','QA archived report');
do $$begin if jsonb_array_length(public.terra_admin_history(current_setting('qa5.listing')::uuid))<>4 then raise exception 'FAIL: incomplete administrative history';end if;end $$;
reset role;
-- Simulate exhausted limits; rotating visitor UUIDs must not bypass account quotas.
update private_terra.usage_limits set hits=20 where user_id=current_setting('qa5.b')::uuid and action='contact';
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa5.b'),'role','authenticated','session_id',current_setting('qa5.b'))::text,true);
set local role authenticated;
do $$begin begin perform public.terra_record_event('whatsapp_click',current_setting('qa5.listing')::uuid,gen_random_uuid());raise exception 'FAIL: contact hard limit bypassed';exception when others then if sqlerrm not like 'RATE_LIMIT:%' then raise;end if;end;end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$begin begin perform public.terra_prepare_deletion(current_setting('qa5.a')::uuid,current_setting('qa5.a')::uuid,'WRONG');raise exception 'FAIL: deletion without strong confirmation';exception when others then if sqlerrm not like 'Entre novamente%' then raise;end if;end;end $$;
select public.terra_prepare_deletion(current_setting('qa5.a')::uuid,current_setting('qa5.a')::uuid,'EXCLUIR MINHA CONTA');
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa5.a'),'role','authenticated','session_id',current_setting('qa5.a'))::text,true);
set local role authenticated;
do $$begin
 if private_terra.active_account() then raise exception 'FAIL: deleting account still active';end if;
 begin update public.terra_listings set status='published' where id=current_setting('qa5.listing')::uuid;raise exception 'FAIL: pending deletion republished';exception when others then if sqlerrm not like 'Sua conta está em exclusão%' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
insert into archive.terra_package1_audit(checkpoint,payload) values('qa5-'||current_setting('qa5.a'),jsonb_build_object('legacy',jsonb_build_array(jsonb_build_object('user_id',current_setting('qa5.a'),'description','remove'),jsonb_build_object('user_id',current_setting('qa5.b'),'description','preserve'))));
select public.terra_finish_deletion(current_setting('qa5.a')::uuid);
do $$begin if (select jsonb_array_length(payload->'legacy') from archive.terra_package1_audit where checkpoint='qa5-'||current_setting('qa5.a'))<>1 then raise exception 'FAIL: targeted archive erasure';end if;end $$;
-- Simulate the Auth Admin API's final deletion only for this transaction's synthetic account.
delete from auth.users where id=current_setting('qa5.a')::uuid;
do $$begin
 if exists(select 1 from public.terra_listings where id=current_setting('qa5.listing')::uuid) or exists(select 1 from public.terra_profiles where id=current_setting('qa5.a')::uuid) or exists(select 1 from auth.sessions where user_id=current_setting('qa5.a')::uuid) then raise exception 'FAIL: account cascade incomplete';end if;
 if not exists(select 1 from auth.users where id=current_setting('qa5.b')::uuid) then raise exception 'FAIL: another user removed';end if;
end $$;
select 'Package 5 SQL assertions passed; fixtures rolled back.' as result;
rollback;
