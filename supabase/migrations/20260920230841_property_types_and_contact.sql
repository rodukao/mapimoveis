-- Additive real-estate attributes. Existing rows, geometry, grants and RLS are preserved.
alter table public.terra_listings drop constraint terra_listings_category_check;
alter table public.terra_listings add constraint terra_listings_category_check check(category in ('residencial','condominio','chacara','rural','comercial','lote','sitio','fazenda','industrial','casa','apartamento','cobertura','sobrado','sala_comercial','galpao'));

create function private_terra.valid_property_details(d jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare k text; n numeric;
begin
 for k in select unnest(array['bedrooms','bathrooms','parking_spaces','built_area_m2']) loop
  if d ? k then
   if jsonb_typeof(d->k)<>'number' then return false; end if;
   n:=(d->>k)::numeric;
   if k='built_area_m2' then
    if n<1 or n>1000000 then return false; end if;
   elsif n<0 or n>100 or n<>trunc(n) then return false;
   end if;
  end if;
 end loop;
 return true;
end $$;
revoke all on function private_terra.valid_property_details(jsonb) from public;
grant execute on function private_terra.valid_property_details(jsonb) to authenticated;
alter table public.terra_listings add constraint terra_property_details_valid check(private_terra.valid_property_details(details));

-- Phone remains owner-only. No public phone column or policy is added.
create function private_terra.require_publication_contact() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.status in ('published','reserved') and
    (tg_op='INSERT' or old.status not in ('published','reserved')) then
  if not exists(select 1 from public.terra_contact_settings c
     where c.user_id=new.owner_id and c.enabled and c.phone ~ '^55[1-9][0-9]{9,10}$') then
   raise exception 'Cadastre e habilite seu WhatsApp em Minha conta → Perfil antes de publicar. Você pode salvar como rascunho.';
  end if;
 end if;
 return new;
end $$;
revoke all on function private_terra.require_publication_contact() from public,anon,authenticated;
create trigger terra_require_publication_contact before insert or update of status on public.terra_listings for each row execute function private_terra.require_publication_contact();

create or replace function private_terra.matches_attributes(l public.terra_listings,f jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
select
 (nullif(f->>'city','') is null or lower(l.city)=lower(f->>'city'))
 and (nullif(f->>'state','') is null or l.state=f->>'state')
 and (nullif(f->>'context','') is null or l.terrain_context=f->>'context')
 and (nullif(f->>'category','') is null or l.category=f->>'category')
 and (nullif(f->>'topography','') is null or l.topography=f->>'topography')
 and (nullif(f->>'minPrice','') is null or l.price_brl >= (f->>'minPrice')::numeric)
 and (nullif(f->>'maxPrice','') is null or l.price_brl <= (f->>'maxPrice')::numeric)
 and (nullif(f->>'minArea','') is null or l.area_m2 >= (f->>'minArea')::numeric)
 and (nullif(f->>'maxArea','') is null or l.area_m2 <= (f->>'maxArea')::numeric)
 and (nullif(f->>'minBedrooms','') is null or (l.details->>'bedrooms')::numeric >= (f->>'minBedrooms')::numeric)
 and (nullif(f->>'minBathrooms','') is null or (l.details->>'bathrooms')::numeric >= (f->>'minBathrooms')::numeric)
 and (nullif(f->>'minParking','') is null or (l.details->>'parking_spaces')::numeric >= (f->>'minParking')::numeric)
 and (nullif(f->>'minBuiltArea','') is null or (l.details->>'built_area_m2')::numeric >= (f->>'minBuiltArea')::numeric)
 and l.infrastructure @> array(select jsonb_array_elements_text(coalesce(f->'infrastructure','[]'::jsonb)))
 and l.features @> array(select jsonb_array_elements_text(coalesce(f->'features','[]'::jsonb)))
 and l.documents @> array(select jsonb_array_elements_text(coalesce(f->'documents','[]'::jsonb)))
$$;
revoke all on function private_terra.matches_attributes(public.terra_listings,jsonb) from public;
grant execute on function private_terra.matches_attributes(public.terra_listings,jsonb) to anon,authenticated;

create or replace function private_terra.validate_search() returns trigger language plpgsql security invoker set search_path='' as $$
declare probe public.terra_listings; k text; value numeric;
begin
 if tg_op='INSERT' then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.user_id::text,29));
  if (select count(*) from public.terra_saved_searches where user_id=new.user_id)>=50 then raise exception 'Você pode salvar até 50 buscas. Exclua uma para continuar.'; end if;
 end if;
 perform private_terra.search_geometry(new.filters);
 for k in select unnest(array['minPrice','maxPrice','minArea','maxArea','minBedrooms','minBathrooms','minParking','minBuiltArea']) loop
  value:=nullif(new.filters->>k,'')::numeric;
  if value<0 or value>1e12 or value='NaN'::numeric or value='Infinity'::numeric then raise exception 'Informe limites numéricos válidos.'; end if;
 end loop;
 if (new.filters->>'minPrice')::numeric > (new.filters->>'maxPrice')::numeric or (new.filters->>'minArea')::numeric > (new.filters->>'maxArea')::numeric then raise exception 'O mínimo deve ser menor ou igual ao máximo.'; end if;
 for k in select unnest(array['infrastructure','features','documents']) loop
  if new.filters ? k and (jsonb_typeof(new.filters->k)<>'array' or jsonb_array_length(new.filters->k)>12) then raise exception 'Filtros inválidos.'; end if;
 end loop;
 return new;
end $$;
revoke all on function private_terra.validate_search() from public,anon,authenticated;
