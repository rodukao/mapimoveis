begin;
select set_config('qa.a',gen_random_uuid()::text,true),set_config('qa.b',gen_random_uuid()::text,true),set_config('qa.listing',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) select current_setting('qa.'||w)::uuid,'authenticated','authenticated',current_setting('qa.'||w)||'@example.invalid','{"display_name":"QA imóvel"}',now(),now() from unnest(array['a','b'])t(w);
insert into auth.sessions(id,user_id,created_at,updated_at) select current_setting('qa.'||w)::uuid,current_setting('qa.'||w)::uuid,now(),now() from unnest(array['a','b'])t(w);
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.a'),'role','authenticated','session_id',current_setting('qa.a'))::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson,details) values(current_setting('qa.listing')::uuid,'QA apartamento','Juiz de Fora','MG','apartamento',300000,'draft','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}','{"bedrooms":2,"bathrooms":2,"parking_spaces":1,"built_area_m2":72}');
do $$begin
 begin update public.terra_listings set status='published' where id=current_setting('qa.listing')::uuid;raise exception 'FAIL publication without phone';exception when others then if sqlerrm not like 'Cadastre e habilite seu WhatsApp%' then raise;end if;end;
 begin update public.terra_listings set details='{"bedrooms":-1}' where id=current_setting('qa.listing')::uuid;raise exception 'FAIL negative rooms';exception when check_violation then null;end;
 if private_terra.valid_property_details('{"bathrooms":1.5}') or private_terra.valid_property_details('{"parking_spaces":"2"}') or private_terra.valid_property_details('{"built_area_m2":0}') then raise exception 'FAIL invalid attributes';end if;
end $$;
insert into public.terra_contact_settings(phone,enabled) values('5532999999999',true);
update public.terra_listings set status='published' where id=current_setting('qa.listing')::uuid;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$declare r jsonb;begin
 r:=public.terra_search_listings('{"category":"apartamento","minBedrooms":2,"minBathrooms":2,"minParking":1,"minBuiltArea":70}');
 if not exists(select 1 from jsonb_array_elements(r->'rows') x where x->>'id'=current_setting('qa.listing')) then raise exception 'FAIL matching property missing';end if;
 r:=public.terra_search_listings('{"category":"apartamento","minBedrooms":3}');
 if exists(select 1 from jsonb_array_elements(r->'rows') x where x->>'id'=current_setting('qa.listing')) then raise exception 'FAIL rooms filter ignored';end if;
 begin if exists(select 1 from public.terra_contact_settings where user_id=current_setting('qa.a')::uuid) then raise exception 'FAIL phone leaked';end if;exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.b'),'role','authenticated','session_id',current_setting('qa.b'))::text,true);
set local role authenticated;
do $$begin
 update public.terra_listings set title='Forged' where id=current_setting('qa.listing')::uuid;if found then raise exception 'FAIL another owner edited';end if;
 delete from public.terra_listings where id=current_setting('qa.listing')::uuid;if found then raise exception 'FAIL another owner deleted';end if;
 if exists(select 1 from public.terra_contact_settings where user_id=current_setting('qa.a')::uuid) then raise exception 'FAIL another owner phone leaked';end if;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.a'),'role','authenticated','session_id',current_setting('qa.a'))::text,true);
set local role authenticated;
update public.terra_listings set status='paused' where id=current_setting('qa.listing')::uuid;
update public.terra_contact_settings set enabled=false where user_id=auth.uid();
do $$begin
 begin update public.terra_listings set status='reserved' where id=current_setting('qa.listing')::uuid;raise exception 'FAIL disabled contact reactivation';exception when others then if sqlerrm not like 'Cadastre e habilite seu WhatsApp%' then raise;end if;end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.b'),'role','authenticated','session_id',current_setting('qa.b'))::text,true);
set local role authenticated;
do $$begin if exists(select 1 from public.terra_listings where id=current_setting('qa.listing')::uuid) then raise exception 'FAIL paused listing visible';end if;end $$;
reset role;
rollback;
select 'PASS: property filters, numeric validation, publication contact, reactivation, owner isolation and phone privacy; all fixtures rolled back' as result;
