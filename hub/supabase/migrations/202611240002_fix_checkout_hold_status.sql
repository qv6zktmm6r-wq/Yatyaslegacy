-- Fix PL/pgSQL variable name colliding with membership_payments.status
create or replace function public.create_checkout_hold(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_session_id text default null,
  p_application_id uuid default null,
  p_hold_minutes int default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  s public.hub_registration_settings%rowtype;
  reg_status jsonb;
  seats int;
  email_n text := lower(trim(p_email));
begin
  perform public.purge_expired_checkout_holds();

  select * into s from public.hub_registration_settings where id = 1 for update;
  if not s.registrations_open then
    raise exception 'Registrations are closed for %', s.wave_label;
  end if;

  reg_status := public.registration_status();
  seats := coalesce((reg_status->>'seats_remaining')::int, 0);

  seats := seats - (
    select count(*)::int from public.membership_checkout_holds
    where expires_at >= now() and email_norm <> email_n
  );

  if seats <= 0 then
    raise exception '% has no public seats left (including open Checkout holds).', s.wave_label;
  end if;

  if exists (
    select 1 from public.verified_members where email_norm = email_n
  ) then
    raise exception 'This email already has a membership number.';
  end if;

  if exists (
    select 1 from public.membership_payments
    where email_norm = email_n and kind = 'entrance' and status = 'paid'
  ) then
    raise exception 'Entrance already paid for this email.';
  end if;

  insert into public.membership_checkout_holds (
    email_norm, first_name, last_name, stripe_checkout_session_id,
    application_id, expires_at
  ) values (
    email_n,
    trim(coalesce(p_first_name, '')),
    trim(coalesce(p_last_name, '')),
    nullif(trim(coalesce(p_session_id, '')), ''),
    p_application_id,
    now() + make_interval(mins => greatest(p_hold_minutes, 5))
  )
  on conflict (email_norm) do update set
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    stripe_checkout_session_id = coalesce(
      excluded.stripe_checkout_session_id,
      public.membership_checkout_holds.stripe_checkout_session_id
    ),
    application_id = coalesce(excluded.application_id, public.membership_checkout_holds.application_id),
    expires_at = excluded.expires_at;

  return jsonb_build_object(
    'ok', true,
    'email_norm', email_n,
    'expires_at', (select expires_at from public.membership_checkout_holds where email_norm = email_n),
    'seats_remaining_estimate', seats - 1
  );
end;
$$;

revoke all on function public.create_checkout_hold(text, text, text, text, uuid, int)
  from public, anon, authenticated;
