-- Reuse existing categories; no listing, policy or permission changes.
create or replace function private_terra.matches_attributes(l public.terra_listings,f jsonb) returns boolean language sql immutable security invoker set search_path='' as $$
select
 (nullif(f->>'city','') is null or lower(l.city)=lower(f->>'city'))
 and (nullif(f->>'state','') is null or l.state=f->>'state')
 and (nullif(f->>'context','') is null or l.terrain_context=f->>'context')
 and (nullif(f->>'propertyGroup','') is null or (case
   when l.category in ('casa','apartamento','cobertura','sobrado') then 'residential'
   when l.category in ('sala_comercial','galpao','comercial','industrial') then 'commercial'
   else 'land' end)=f->>'propertyGroup')
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

