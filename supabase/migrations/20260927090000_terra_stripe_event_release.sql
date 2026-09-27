-- Webhook retry safety: terra_stripe_event_seen marks an event before it is applied.
-- If applying fails, the webhook releases the mark so Stripe's retry is processed
-- instead of being acknowledged as a duplicate (paid plan/boost never applied).
create function public.terra_stripe_event_release(p_event_id text) returns void
language sql security definer set search_path='' as $$
  delete from private_terra.stripe_events where event_id=p_event_id
$$;
revoke all on function public.terra_stripe_event_release(text) from public,anon,authenticated;
grant execute on function public.terra_stripe_event_release(text) to service_role;
