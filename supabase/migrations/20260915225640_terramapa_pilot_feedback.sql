begin;
create table public.terra_pilot_feedback (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 rating smallint not null check(rating between 1 and 5),
 category text not null check(category in ('map','registration','search','leads','dashboard','performance','other')),
 message text not null check(length(trim(message)) between 10 and 4000),
 page text not null default '/' check(length(page) between 1 and 200 and page ~ '^/[A-Za-z0-9/_-]*$'),
 created_at timestamptz not null default now(),
 status text not null default 'new' check(status in ('new','reviewed','planned','done'))
);
alter table public.terra_pilot_feedback enable row level security;
revoke all on public.terra_pilot_feedback from public,anon,authenticated;
grant select on public.terra_pilot_feedback to authenticated;
grant insert(rating,category,message,page) on public.terra_pilot_feedback to authenticated;
grant update(status,category) on public.terra_pilot_feedback to authenticated;
create policy terra_feedback_read on public.terra_pilot_feedback for select to authenticated using ((select auth.uid())=user_id or (select private_terra.is_admin()));
create policy terra_feedback_submit on public.terra_pilot_feedback for insert to authenticated with check ((select auth.uid())=user_id and (select private_terra.active_account()) and status='new');
create policy terra_feedback_admin on public.terra_pilot_feedback for update to authenticated using ((select private_terra.is_admin())) with check ((select private_terra.is_admin()));
create index terra_feedback_user_created_idx on public.terra_pilot_feedback(user_id,created_at desc);
create index terra_feedback_status_created_idx on public.terra_pilot_feedback(status,created_at desc,id);
create index terra_feedback_category_created_idx on public.terra_pilot_feedback(category,created_at desc,id);
create function private_terra.feedback_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if auth.uid() is null or not private_terra.active_account() then raise exception using errcode='42501',message='Entre em sua conta para enviar feedback.';end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'pilot_feedback',67));
  if (select count(*) from public.terra_pilot_feedback where user_id=auth.uid() and created_at>now()-interval '1 day')>=10 then raise exception 'Limite de 10 feedbacks por dia. Tente novamente amanhã.';end if;
 else
  if not private_terra.is_admin() then raise exception using errcode='42501',message='Acesso administrativo necessário.';end if;
  if new.status is distinct from old.status or new.category is distinct from old.category then
   insert into private_terra.admin_history(actor_id,report_id,action,note) values(auth.uid(),old.id,'pilot_feedback',old.status||' → '||new.status||'; '||old.category||' → '||new.category);
  end if;
 end if;
 return new;
end $$;
revoke all on function private_terra.feedback_guard() from public,anon,authenticated;
create trigger terra_feedback_guard before insert or update on public.terra_pilot_feedback for each row execute function private_terra.feedback_guard();
commit;
