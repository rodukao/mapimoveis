-- Package 5. Additive operations; no PostGIS moves or removal.
create table private_terra.admins(user_id uuid primary key references auth.users(id) on delete cascade,created_at timestamptz not null default now());
create table private_terra.moderation_holds(listing_id uuid primary key references public.terra_listings(id) on delete cascade,previous_status text not null,created_at timestamptz not null default now());
create table private_terra.admin_history(id bigint generated always as identity primary key,actor_id uuid references auth.users(id) on delete set null,report_id uuid,listing_id uuid,action text not null,note text not null check(length(note) between 3 and 1000),created_at timestamptz not null default now());
create index terra_admin_history_listing_idx on private_terra.admin_history(listing_id,created_at desc);
create index terra_admin_history_actor_idx on private_terra.admin_history(actor_id);
create table private_terra.usage_limits(user_id uuid not null references auth.users(id) on delete cascade,action text not null,window_start timestamptz not null,hits integer not null,primary key(user_id,action,window_start));
create table private_terra.challenge_passes(user_id uuid not null references auth.users(id) on delete cascade,action text not null,expires_at timestamptz not null,primary key(user_id,action));
create table private_terra.deletion_jobs(user_id uuid primary key references auth.users(id) on delete cascade,requested_at timestamptz not null default now());
alter table private_terra.admins enable row level security;
alter table private_terra.moderation_holds enable row level security;
alter table private_terra.admin_history enable row level security;
alter table private_terra.usage_limits enable row level security;
alter table private_terra.challenge_passes enable row level security;
alter table private_terra.deletion_jobs enable row level security;
revoke all on private_terra.admins,private_terra.moderation_holds,private_terra.admin_history,private_terra.usage_limits,private_terra.challenge_passes,private_terra.deletion_jobs from public,anon,authenticated;
create index terra_reports_queue_idx on public.terra_reports(status,created_at desc,id);
alter table public.terra_events add column user_id uuid references auth.users(id) on delete cascade default auth.uid();
create index terra_events_user_idx on public.terra_events(user_id);

create function private_terra.active_account() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from auth.users where id=(select auth.uid())) and not exists(select 1 from private_terra.deletion_jobs where user_id=(select auth.uid()))
$$;
revoke all on function private_terra.active_account() from public;
grant execute on function private_terra.active_account() to authenticated;
create function private_terra.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select private_terra.active_account() and exists(select 1 from private_terra.admins where user_id=(select auth.uid())) and exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=(select auth.uid()) and (not_after is null or not_after>now()))
$$;
revoke all on function private_terra.is_admin() from public;
grant execute on function private_terra.is_admin() to authenticated;
create function public.terra_is_admin() returns boolean language sql stable security invoker set search_path='' as $$select private_terra.is_admin()$$;
revoke all on function public.terra_is_admin() from public;
grant execute on function public.terra_is_admin() to authenticated;

create function private_terra.check_usage(p_action text) returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); h integer; d integer; soft_limit integer; hour_limit integer; day_limit integer; slot timestamptz:=date_trunc('hour',now()); consumed integer;
begin
 if not private_terra.active_account() then raise exception using errcode='42501',message='Entre em uma conta ativa para continuar.'; end if;
 select x.soft,x.hourly,x.daily into soft_limit,hour_limit,day_limit from (values ('contact',5,20,60),('report',3,10,20),('listing',5,20,100),('sensitive',60,120,500)) as x(action,soft,hourly,daily) where x.action=p_action;
 if not found then raise exception 'Operação inválida.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||p_action,51));
 select coalesce(sum(hits),0),coalesce(sum(hits) filter(where window_start=slot),0) into d,h from private_terra.usage_limits where user_id=u and action=p_action and window_start>=date_trunc('day',now());
 if h>=hour_limit or d>=day_limit then raise exception using errcode='P0001',message='RATE_LIMIT: Limite temporário atingido. Tente novamente mais tarde.'; end if;
 if h>=soft_limit then
  delete from private_terra.challenge_passes where user_id=u and action=p_action and expires_at>now();get diagnostics consumed=row_count;
  if consumed=0 then raise exception using errcode='P0001',message='CAPTCHA_REQUIRED: Confirme a verificação de segurança para continuar.'; end if;
 end if;
 insert into private_terra.usage_limits values(u,p_action,slot,1) on conflict(user_id,action,window_start) do update set hits=private_terra.usage_limits.hits+1;
 delete from private_terra.usage_limits where user_id=u and window_start<now()-interval '2 days';
end $$;
revoke all on function private_terra.check_usage(text) from public,anon,authenticated;

create function private_terra.guard_write() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null then
  if not private_terra.active_account() then raise exception 'Sua conta está em exclusão. Conclua o processo no perfil.'; end if;
  if tg_table_name='terra_listings' then
   if tg_op='INSERT' then perform private_terra.check_usage('listing');
   else
    perform private_terra.check_usage('sensitive');
    if new.status<>'paused' and exists(select 1 from private_terra.moderation_holds where listing_id=old.id) then raise exception 'Anúncio pausado pela moderação. Apenas a administração pode restaurá-lo.';end if;
   end if;
  elsif tg_table_name='terra_reports' and tg_op='INSERT' then perform private_terra.check_usage('report');
  else perform private_terra.check_usage('sensitive');end if;
 end if;
 return new;
end $$;
revoke all on function private_terra.guard_write() from public,anon,authenticated;
create trigger terra_operations_guard before insert or update on public.terra_listings for each row execute function private_terra.guard_write();
create trigger terra_report_guard before insert on public.terra_reports for each row execute function private_terra.guard_write();
create trigger terra_search_guard before insert on public.terra_saved_searches for each row execute function private_terra.guard_write();
create trigger terra_contact_guard before insert or update on public.terra_contact_settings for each row execute function private_terra.guard_write();
-- Pending deletion cannot race with a new upload. Existing read/delete policies remain unchanged.
create policy terra_storage_active_upload on storage.objects as restrictive for insert to authenticated with check(bucket_id not in ('terra-listing-photos','terra-profile-photos') or (select private_terra.active_account()));
create policy terra_storage_active_update on storage.objects as restrictive for update to authenticated using(bucket_id not in ('terra-listing-photos','terra-profile-photos') or (select private_terra.active_account())) with check(bucket_id not in ('terra-listing-photos','terra-profile-photos') or (select private_terra.active_account()));

create function private_terra.admin_reports(p_status text,p_offset integer) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private_terra.is_admin() then raise exception using errcode='42501',message='Acesso administrativo necessário.'; end if;
 if p_status not in ('all','pending','reviewing','resolved','dismissed') or p_offset<0 or p_offset>10000 then raise exception 'Filtro inválido.'; end if;
 perform private_terra.check_usage('sensitive');
 return coalesce((select jsonb_agg(row_to_json(x)) from (select r.id,r.listing_id,r.reason,r.description,r.status,r.created_at,l.title,l.owner_id,l.status listing_status,p.display_name advertiser,(select count(*) from public.terra_reports z where z.listing_id=r.listing_id) report_count,exists(select 1 from private_terra.moderation_holds where listing_id=r.listing_id) held from public.terra_reports r join public.terra_listings l on l.id=r.listing_id left join public.terra_profiles p on p.id=l.owner_id where p_status='all' or r.status=p_status order by r.created_at desc,r.id limit 50 offset p_offset)x),'[]'::jsonb);
end $$;
create function private_terra.admin_action(p_report uuid,p_action text,p_note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.terra_reports; l public.terra_listings; prior text;
begin
 if not private_terra.is_admin() then raise exception using errcode='42501',message='Acesso administrativo necessário.'; end if;
 if p_action not in ('review','archive','pause','restore') or length(trim(p_note)) not between 3 and 1000 then raise exception 'Informe uma justificativa de 3 a 1000 caracteres.'; end if;
 perform private_terra.check_usage('sensitive');
 select * into r from public.terra_reports where id=p_report for update;if not found then raise exception 'Denúncia indisponível.';end if;
 select * into l from public.terra_listings where id=r.listing_id for update;
 if p_action='review' then update public.terra_reports set status='resolved' where id=r.id;
 elsif p_action='archive' then update public.terra_reports set status='dismissed' where id=r.id;
 elsif p_action='pause' then
  if l.status='draft' then raise exception 'Um rascunho já não é público.';end if;
  insert into private_terra.moderation_holds(listing_id,previous_status) values(l.id,l.status) on conflict do nothing;
  update public.terra_listings set status='paused' where id=l.id;
 else
  delete from private_terra.moderation_holds where listing_id=l.id returning previous_status into prior;
  if not found then raise exception 'Este anúncio não está pausado pela moderação.';end if;
  if exists(select 1 from private_terra.deletion_jobs where user_id=l.owner_id) then raise exception 'A conta do anunciante está em exclusão.';end if;
  update public.terra_listings set status=prior where id=l.id;
 end if;
 insert into private_terra.admin_history(actor_id,report_id,listing_id,action,note) values(auth.uid(),r.id,l.id,p_action,trim(p_note));
 return jsonb_build_object('ok',true);
end $$;
create function private_terra.admin_history(p_listing uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$begin
 if not private_terra.is_admin() then raise exception using errcode='42501',message='Acesso administrativo necessário.';end if;
 return coalesce((select jsonb_agg(row_to_json(x)) from (select id,actor_id,action,note,created_at from private_terra.admin_history where listing_id=p_listing order by created_at desc,id desc limit 100)x),'[]'::jsonb);end $$;
revoke all on function private_terra.admin_reports(text,integer),private_terra.admin_action(uuid,text,text),private_terra.admin_history(uuid) from public;
grant execute on function private_terra.admin_reports(text,integer),private_terra.admin_action(uuid,text,text),private_terra.admin_history(uuid) to authenticated;
create function public.terra_admin_reports(p_status text default 'pending',p_offset integer default 0) returns jsonb language sql security invoker set search_path='' as $$select private_terra.admin_reports(p_status,p_offset)$$;
create function public.terra_admin_action(p_report uuid,p_action text,p_note text) returns jsonb language sql security invoker set search_path='' as $$select private_terra.admin_action(p_report,p_action,p_note)$$;
create function public.terra_admin_history(p_listing uuid) returns jsonb language sql security invoker set search_path='' as $$select private_terra.admin_history(p_listing)$$;
revoke all on function public.terra_admin_reports(text,integer),public.terra_admin_action(uuid,text,text),public.terra_admin_history(uuid) from public;
grant execute on function public.terra_admin_reports(text,integer),public.terra_admin_action(uuid,text,text),public.terra_admin_history(uuid) to authenticated;

-- Grants are issued only by the Edge Function after validating a Turnstile token.
create function public.terra_grant_challenge(p_user uuid,p_session uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$begin
 if p_action not in ('contact','report','listing','sensitive') or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and (not_after is null or not_after>now())) or exists(select 1 from private_terra.deletion_jobs where user_id=p_user) then raise exception 'Sessão inválida.';end if;
 insert into private_terra.challenge_passes values(p_user,p_action,now()+interval '3 minutes') on conflict(user_id,action) do update set expires_at=excluded.expires_at;
end $$;
revoke all on function public.terra_grant_challenge(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.terra_grant_challenge(uuid,uuid,text) to service_role;

-- Reuse the existing recorder while enforcing a server-side account quota first.
alter function private_terra.record_event(text,uuid,uuid) rename to record_event_unchecked;
revoke all on function private_terra.record_event_unchecked(text,uuid,uuid) from public,anon,authenticated;
create function private_terra.record_event(p_event text,p_listing uuid,p_session uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if p_event='whatsapp_click' then
  if not exists(select 1 from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=auth.uid() and (not_after is null or not_after>now())) then raise exception using errcode='42501',message='Entre na sua conta para falar com o anunciante.';end if;
  perform private_terra.check_usage('contact');
 elsif auth.uid() is not null and not private_terra.active_account() then raise exception 'Conta indisponível.';end if;
 return private_terra.record_event_unchecked(p_event,p_listing,p_session);
end $$;
revoke all on function private_terra.record_event(text,uuid,uuid) from public;
grant execute on function private_terra.record_event(text,uuid,uuid) to anon,authenticated;
-- Rebind the wrapper after renaming the old implementation.
create or replace function public.terra_record_event(p_event text,p_listing uuid,p_session uuid) returns jsonb language sql security invoker set search_path='' as $$select private_terra.record_event(p_event,p_listing,p_session)$$;

create function public.terra_prepare_deletion(p_user uuid,p_session uuid,p_confirmation text) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if p_confirmation is distinct from 'EXCLUIR MINHA CONTA' or not exists(select 1 from auth.sessions where id=p_session and user_id=p_user and created_at>now()-interval '10 minutes' and (not_after is null or not_after>now())) then raise exception 'Entre novamente na conta e confirme a frase para excluir.';end if;
 -- Keep unfinished drafts unchanged; only public records need to become private.
 update public.terra_listings set status='paused' where owner_id=p_user and status in ('published','reserved','sold');
 insert into private_terra.deletion_jobs(user_id) values(p_user) on conflict do nothing;
 return jsonb_build_object('pending',true);
end $$;
create function public.terra_deletion_objects(p_user uuid) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from private_terra.deletion_jobs where user_id=p_user) then raise exception 'Exclusão não solicitada.';end if;
 return coalesce((select jsonb_agg(row_to_json(x)) from (select o.bucket_id,o.name from storage.objects o where o.bucket_id in ('terra-listing-photos','terra-profile-photos','terreno-fotos') and (o.owner_id=p_user::text or split_part(o.name,'/',1)=p_user::text or exists(select 1 from public.terra_listing_photos p where p.owner_id=p_user and p.storage_path=o.name and o.bucket_id='terra-listing-photos')) order by o.bucket_id,o.name limit 100)x),'[]'::jsonb);
end $$;
create function public.terra_finish_deletion(p_user uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not exists(select 1 from private_terra.deletion_jobs where user_id=p_user) then raise exception 'Exclusão não solicitada.';end if;
 if jsonb_array_length(public.terra_deletion_objects(p_user))>0 then raise exception 'Ainda existem fotos aguardando exclusão.';end if;
 delete from public.terra_events where user_id=p_user or listing_id in(select id from public.terra_listings where owner_id=p_user) or session_id in(select session_id from public.terra_views where user_id=p_user union select session_id from public.terra_leads where user_id=p_user);
 delete from public.terra_views where user_id=p_user;
 delete from public.terra_leads where user_id=p_user;
 delete from archive.terrenos_legacy where user_id=p_user;
 -- Auth Admin deletion happens next, cascading profiles/listings/favorites/searches/notifications.
end $$;
revoke all on function public.terra_prepare_deletion(uuid,uuid,text),public.terra_deletion_objects(uuid),public.terra_finish_deletion(uuid) from public,anon,authenticated;
grant execute on function public.terra_prepare_deletion(uuid,uuid,text),public.terra_deletion_objects(uuid),public.terra_finish_deletion(uuid) to service_role;

-- Explicit housekeeping endpoint: service role only; run daily from an operator schedule.
create function public.terra_retention_cleanup() returns void language plpgsql security definer set search_path='' as $$begin
 delete from public.terra_events where created_at<now()-interval '90 days';
 delete from public.terra_views where created_at<now()-interval '90 days';
 delete from public.terra_leads where created_at<now()-interval '90 days';
 delete from public.terra_reports where status in ('resolved','dismissed') and created_at<now()-interval '180 days';
 delete from private_terra.admin_history where created_at<now()-interval '180 days';
 delete from private_terra.usage_limits where window_start<now()-interval '2 days';
 delete from private_terra.challenge_passes where expires_at<now();
end $$;
revoke all on function public.terra_retention_cleanup() from public,anon,authenticated;
grant execute on function public.terra_retention_cleanup() to service_role;

create table private_terra.analysis_budget(listing_id uuid not null references public.terra_listings(id) on delete cascade,window_start timestamptz not null,hits integer not null,primary key(listing_id,window_start));
alter table private_terra.analysis_budget enable row level security;
revoke all on private_terra.analysis_budget from public,anon,authenticated;
create function public.terra_rayx_budget(p_listing uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare n integer; slot timestamptz:=date_trunc('hour',now());begin
 if not exists(select 1 from public.terra_listings where id=p_listing and status in ('published','reserved','sold')) then return false;end if;
 insert into private_terra.analysis_budget values(p_listing,slot,1) on conflict(listing_id,window_start) do update set hits=private_terra.analysis_budget.hits+1 returning hits into n;
 delete from private_terra.analysis_budget where listing_id=p_listing and window_start<now()-interval '2 days';
 return n<=30;
end $$;
revoke all on function public.terra_rayx_budget(uuid) from public,anon,authenticated;
grant execute on function public.terra_rayx_budget(uuid) to service_role;

create or replace function private_terra.notify_matches() returns trigger language plpgsql security definer set search_path='' as $$
declare s record; region public.geometry;
begin
 if new.status not in ('published','reserved') then return new;end if;
 if tg_op='UPDATE' and old.status in ('published','reserved','sold') then return new;end if;
 if auth.uid() is not null and new.owner_id<>auth.uid() then
  -- Restoration is authorized by private membership, not editable metadata.
  if private_terra.is_admin() then return new;end if;
  raise exception 'Proprietário inválido.';
 end if;
 for s in select * from public.terra_saved_searches where alerts_enabled and user_id<>new.owner_id loop
  region:=private_terra.search_geometry(s.filters);
  if private_terra.matches_attributes(new,s.filters) and (region is null or public.st_intersects(new.geom,region)) then
   insert into public.terra_notifications(user_id,search_id,listing_id) values(s.user_id,s.id,new.id) on conflict do nothing;
  end if;
 end loop;
 return new;
end $$;
