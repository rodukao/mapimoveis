begin;
select set_config('qa6.user',gen_random_uuid()::text,true),set_config('qa6.listing',gen_random_uuid()::text,true);
insert into auth.users(id,aud,role,email,raw_user_meta_data,created_at,updated_at) values(current_setting('qa6.user')::uuid,'authenticated','authenticated',current_setting('qa6.user')||'@example.invalid','{"display_name":"QA photos"}',now(),now());
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa6.user'),'role','authenticated')::text,true);
set local role authenticated;
insert into public.terra_listings(id,title,city,state,category,price_brl,status,boundary_geojson) values(current_setting('qa6.listing')::uuid,'QA photos','QA cidade','MG','residencial',100000,'draft','{"type":"Polygon","coordinates":[[[-43,-21],[-42.999,-21],[-42.999,-20.999],[-43,-21]]]}');
reset role;
insert into storage.objects(bucket_id,name,owner_id,created_at,updated_at) select 'terra-listing-photos',current_setting('qa6.user')||'/'||current_setting('qa6.listing')||'/'||('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))||'.jpg',current_setting('qa6.user'),now()-interval '72 hours',now()-interval '72 hours' from generate_series(1,4)n;
insert into storage.objects(bucket_id,name,owner_id) values('terra-listing-photos',current_setting('qa6.user')||'/'||current_setting('qa6.listing')||'/00000000-0000-4000-8000-000000000005.jpg',current_setting('qa6.user'));
set local role authenticated;
do $$declare base text:=current_setting('qa6.user')||'/'||current_setting('qa6.listing')||'/';ids uuid[];begin
 perform public.terra_sync_listing_photos_ordered(current_setting('qa6.listing')::uuid,'{}','{}',array[base||'00000000-0000-4000-8000-000000000001.jpg',base||'00000000-0000-4000-8000-000000000002.jpg'],array[base||'00000000-0000-4000-8000-000000000002.jpg',base||'00000000-0000-4000-8000-000000000001.jpg']);
 if (select storage_path from public.terra_listing_photos where listing_id=current_setting('qa6.listing')::uuid order by sort_order limit 1)<>base||'00000000-0000-4000-8000-000000000002.jpg' then raise exception 'FAIL: cover not persisted';end if;
 select array_agg(id) into ids from public.terra_listing_photos where listing_id=current_setting('qa6.listing')::uuid;
 begin perform public.terra_sync_listing_photos_ordered(current_setting('qa6.listing')::uuid,ids,ids,'{}',array[base||'00000000-0000-4000-8000-000000000001.jpg',base||'00000000-0000-4000-8000-000000000001.jpg']);raise exception 'FAIL: duplicate order accepted';exception when others then if sqlerrm<>'Ordem das fotos inválida.' then raise;end if;end;
 begin perform public.terra_claim_orphan_objects(false);raise exception 'FAIL: public cleanup access';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$declare candidates jsonb;begin
 candidates:=public.terra_claim_orphan_objects(true);
 if exists(select 1 from jsonb_array_elements(candidates)c where c->>'name' like '%/00000000-0000-4000-8000-000000000005.jpg') then raise exception 'FAIL: recent upload selected';end if;
 if exists(select 1 from jsonb_array_elements(candidates)c join public.terra_listing_photos p on p.storage_path=c->>'name') then raise exception 'FAIL: referenced object selected';end if;
 if not exists(select 1 from jsonb_array_elements(candidates)c where c->>'name'=current_setting('qa6.user')||'/'||current_setting('qa6.listing')||'/00000000-0000-4000-8000-000000000003.jpg') then raise exception 'FAIL: old orphan not selected';end if;
 perform public.terra_claim_orphan_objects(false);
 begin insert into public.terra_listing_photos(listing_id,owner_id,storage_path,sort_order) values(current_setting('qa6.listing')::uuid,current_setting('qa6.user')::uuid,current_setting('qa6.user')||'/'||current_setting('qa6.listing')||'/00000000-0000-4000-8000-000000000003.jpg',2);raise exception 'FAIL: claimed orphan linked';exception when others then if sqlerrm not like 'Esta foto expirou%' then raise;end if;end;
end $$;
select 'Package 6 photo order, permissions and orphan safety passed; rolled back.' result;
rollback;
