-- All fixtures are rolled back. No real listing or user is modified.
begin;
select set_config('terra_test.a',gen_random_uuid()::text,true),set_config('terra_test.b',gen_random_uuid()::text,true),set_config('terra_test.listing',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at)
select current_setting('terra_test.'||who)::uuid,'authenticated','authenticated',current_setting('terra_test.'||who)||'@example.invalid',jsonb_build_object('display_name','Terra QA '||who),now(),now() from unnest(array['a','b']) as t(who);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('terra_test.a'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson)
values(current_setting('terra_test.listing')::uuid,'','','','residencial',null,'draft','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
do $$declare flag text; desired text; uf text; begin
 if not exists(select 1 from public.terra_listings where id=current_setting('terra_test.listing')::uuid and area_m2>1 and perimeter_m>1) then raise exception 'FAIL: draft geometry or owner read'; end if;
 foreach flag in array array['email_verified','phone_verified','identity_verified','professional_verified'] loop
   begin
     execute format('update public.terra_profiles set %I=true where id=auth.uid()',flag);
     raise exception 'FAIL: forged verification %',flag;
   exception when insufficient_privilege then null; end;
 end loop;
 foreach desired in array array['published','reserved','sold','paused'] loop
   begin
     update public.terra_listings set status=desired where id=current_setting('terra_test.listing')::uuid;
     raise exception 'FAIL: incomplete non-draft accepted';
   exception when check_violation then null; end;
 end loop;
 update public.terra_listings set title='QA Brazil',city='QA cidade',state='MG' where id=current_setting('terra_test.listing')::uuid;
 begin
   update public.terra_listings set status='published' where id=current_setting('terra_test.listing')::uuid;
   raise exception 'FAIL: NULL published price accepted';
 exception when check_violation then null; end;
 update public.terra_listings set price_brl=100000,status='published' where id=current_setting('terra_test.listing')::uuid;
 foreach uf in array string_to_array('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO',' ') loop
   update public.terra_listings set state=uf where id=current_setting('terra_test.listing')::uuid;
 end loop;
 begin
   update public.terra_listings set state='XX' where id=current_setting('terra_test.listing')::uuid;
   raise exception 'FAIL: invalid UF accepted';
 exception when check_violation then null; end;
 update public.terra_listings set status='draft' where id=current_setting('terra_test.listing')::uuid;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('terra_test.b'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare affected int; begin
 if exists(select 1 from public.terra_listings where id=current_setting('terra_test.listing')::uuid) then raise exception 'FAIL: another user sees draft'; end if;
 update public.terra_listings set title='Forged' where id=current_setting('terra_test.listing')::uuid;
 get diagnostics affected=row_count;if affected<>0 then raise exception 'FAIL: another user edits'; end if;
 delete from public.terra_listings where id=current_setting('terra_test.listing')::uuid;
 get diagnostics affected=row_count;if affected<>0 then raise exception 'FAIL: another user deletes'; end if;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$begin
 if exists(select 1 from public.terra_listings where id=current_setting('terra_test.listing')::uuid) then raise exception 'FAIL: anonymous draft access'; end if;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('terra_test.a'),'role','authenticated')::text,true);
set local role authenticated;
delete from public.terra_listings where id=current_setting('terra_test.listing')::uuid;
reset role;
do $$begin
 if exists(select 1 from public.terra_listings where id=current_setting('terra_test.listing')::uuid) then raise exception 'FAIL: owner deletion'; end if;
end $$;
rollback;
select 'PASS: draft/publication, 27 UFs, protected verification, owner/other/anon, geometry and deletion' as result;
