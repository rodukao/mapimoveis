-- Qualify the PostGIS operator while retaining the empty function search_path.
create or replace function public.terra_search_listings(p_filters jsonb default '{}',p_sort text default 'recent',p_limit integer default 50,p_offset integer default 0,p_mine boolean default false) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare region public.geometry; answer jsonb;
begin
 if p_filters is null or jsonb_typeof(p_filters)<>'object' or octet_length(p_filters::text)>30000 or p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>100 or p_sort is null or p_sort not in ('recent','price_asc','price_desc','area_asc','area_desc','unit_asc') then raise exception 'Busca inválida.'; end if;
 if p_mine and auth.uid() is null then raise exception 'Entre na sua conta.'; end if;
 region:=private_terra.search_geometry(p_filters);
 with matching as materialized (
  select l.* from public.terra_listings l
  where ((p_mine and l.owner_id=auth.uid()) or (not p_mine and l.status in ('published','reserved')))
  and private_terra.matches_attributes(l,p_filters)
  and (region is null or (l.geom operator(public.&&) region and public.st_intersects(l.geom,region)))
 ), page as (
  select m.* from matching m order by
   case when p_sort='price_asc' then price_brl end asc,
   case when p_sort='price_desc' then price_brl end desc,
   case when p_sort='area_asc' then area_m2 end asc,
   case when p_sort='area_desc' then area_m2 end desc,
   case when p_sort='unit_asc' then price_per_m2 end asc,
   created_at desc,id desc limit p_limit offset p_offset
 )
 select jsonb_build_object('total',(select count(*) from matching),'rows',coalesce((select jsonb_agg(
  (to_jsonb(p)-'geom') || jsonb_build_object('terra_listing_photos',coalesce((select jsonb_agg(to_jsonb(ph) order by ph.sort_order) from public.terra_listing_photos ph where ph.listing_id=p.id),'[]'::jsonb))
  order by
   case when p_sort='price_asc' then p.price_brl end asc,
   case when p_sort='price_desc' then p.price_brl end desc,
   case when p_sort='area_asc' then p.area_m2 end asc,
   case when p_sort='area_desc' then p.area_m2 end desc,
   case when p_sort='unit_asc' then p.price_per_m2 end asc,
   p.created_at desc,p.id desc
 ) from page p),'[]'::jsonb)) into answer;
 return answer;
end $$;
