-- First Wave payments ledger + auto tag issuance after entrance paid
-- Numbers only via next_membership_tag (skips reserved). Refunds do not recycle tags.

create table if not exists public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_norm text not null,
  first_name text not null default '',
  last_name text not null default '',
  kind text not null check (kind in ('entrance', 'monthly')),
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'usd',
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded', 'past_due', 'void')),
  membership_tag text,
  verified_member_id uuid references public.verified_members (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  application_id uuid,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  stripe_invoice_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint membership_payments_tag_format
    check (membership_tag is null or membership_tag ~ '^[A-Z]{2}-[0-9]{3}$')
);

create index if not exists membership_payments_email_norm_idx
  on public.membership_payments (email_norm);
create index if not exists membership_payments_status_idx
  on public.membership_payments (status);
create index if not exists membership_payments_tag_idx
  on public.membership_payments (membership_tag)
  where membership_tag is not null;

alter table public.membership_payments enable row level security;

drop policy if exists membership_payments_select_vip on public.membership_payments;
create policy membership_payments_select_vip
  on public.membership_payments for select to authenticated
  using (public.is_vip());

-- No insert/update/delete for authenticated — service role / SECURITY DEFINER only
revoke all on table public.membership_payments from anon, authenticated;
grant select on table public.membership_payments to authenticated;

-- Soft seat holds while Checkout is open (~30 min)
create table if not exists public.membership_checkout_holds (
  id uuid primary key default gen_random_uuid(),
  email_norm text not null,
  first_name text not null default '',
  last_name text not null default '',
  stripe_checkout_session_id text unique,
  application_id uuid,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists membership_checkout_holds_expires_idx
  on public.membership_checkout_holds (expires_at);
create unique index if not exists membership_checkout_holds_email_active_uidx
  on public.membership_checkout_holds (email_norm);

alter table public.membership_checkout_holds enable row level security;

drop policy if exists membership_checkout_holds_select_vip on public.membership_checkout_holds;
create policy membership_checkout_holds_select_vip
  on public.membership_checkout_holds for select to authenticated
  using (public.is_vip());

revoke all on table public.membership_checkout_holds from anon, authenticated;
grant select on table public.membership_checkout_holds to authenticated;

-- Audited Board overrides (offline pay / force issue)
create table if not exists public.membership_payment_overrides (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  action text not null check (action in ('mark_entrance_paid', 'force_issue_tag', 'void_access')),
  email_norm text not null,
  membership_tag text,
  reason text not null check (length(trim(reason)) >= 8),
  payment_id uuid references public.membership_payments (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.membership_payment_overrides enable row level security;

drop policy if exists membership_payment_overrides_select_vip on public.membership_payment_overrides;
create policy membership_payment_overrides_select_vip
  on public.membership_payment_overrides for select to authenticated
  using (public.is_vip());

revoke all on table public.membership_payment_overrides from anon, authenticated;
grant select on table public.membership_payment_overrides to authenticated;

alter table public.verified_members
  add column if not exists entrance_paid_at timestamptz;
alter table public.verified_members
  add column if not exists dues_status text not null default 'none'
    check (dues_status in ('none', 'active', 'past_due', 'canceled'));

alter table public.profiles
  add column if not exists dues_status text not null default 'none'
    check (dues_status in ('none', 'active', 'past_due', 'canceled'));
alter table public.profiles
  add column if not exists entrance_paid_at timestamptz;
alter table public.profiles
  add column if not exists stripe_customer_id text;

create or replace function public.purge_expired_checkout_holds()
returns int
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  n int;
begin
  delete from public.membership_checkout_holds
  where expires_at < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.purge_expired_checkout_holds() from public, anon, authenticated;

-- Create / refresh soft hold; returns seats remaining after hold
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

  -- Count active holds that are not this email
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

-- Core: after entrance paid, issue next public tag in order (idempotent on session id)
create or replace function public.issue_membership_after_entrance_payment(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_amount_cents int,
  p_currency text default 'usd',
  p_stripe_checkout_session_id text default null,
  p_stripe_payment_intent_id text default null,
  p_stripe_customer_id text default null,
  p_stripe_subscription_id text default null,
  p_application_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  email_n text := lower(trim(p_email));
  fn text := trim(coalesce(p_first_name, ''));
  ln text := trim(coalesce(p_last_name, ''));
  existing public.membership_payments%rowtype;
  member public.verified_members%rowtype;
  tag text;
  pay_id uuid;
begin
  if email_n is null or email_n = '' or position('@' in email_n) = 0 then
    raise exception 'Valid email required';
  end if;
  if fn = '' or ln = '' then
    raise exception 'First and last name required';
  end if;

  perform public.purge_expired_checkout_holds();

  -- Idempotent: same Checkout session already processed
  if p_stripe_checkout_session_id is not null then
    select * into existing
    from public.membership_payments
    where stripe_checkout_session_id = p_stripe_checkout_session_id
    limit 1;
    if existing.id is not null and existing.status = 'paid' and existing.membership_tag is not null then
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'membership_tag', existing.membership_tag,
        'payment_id', existing.id,
        'verified_member_id', existing.verified_member_id
      );
    end if;
  end if;

  -- Already rostered for this email — attach payment, do not issue second tag
  select * into member from public.verified_members where email_norm = email_n limit 1;
  if member.id is not null then
    insert into public.membership_payments (
      email, email_norm, first_name, last_name, kind, amount_cents, currency,
      status, membership_tag, verified_member_id, application_id,
      stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id,
      stripe_subscription_id, paid_at, updated_at
    ) values (
      email_n, email_n, coalesce(nullif(fn, ''), member.first_name),
      coalesce(nullif(ln, ''), member.last_name),
      'entrance', p_amount_cents, lower(coalesce(p_currency, 'usd')),
      'paid', member.membership_tag, member.id, p_application_id,
      p_stripe_checkout_session_id, p_stripe_payment_intent_id, p_stripe_customer_id,
      p_stripe_subscription_id, now(), now()
    )
    on conflict (stripe_checkout_session_id) do update set
      status = 'paid',
      paid_at = coalesce(public.membership_payments.paid_at, now()),
      membership_tag = coalesce(public.membership_payments.membership_tag, excluded.membership_tag),
      verified_member_id = coalesce(public.membership_payments.verified_member_id, excluded.verified_member_id),
      updated_at = now()
    returning id into pay_id;

    update public.verified_members
    set entrance_paid_at = coalesce(entrance_paid_at, now()),
        dues_status = case
          when p_stripe_subscription_id is not null then 'active'
          else dues_status
        end
    where id = member.id;

    delete from public.membership_checkout_holds where email_norm = email_n;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'membership_tag', member.membership_tag,
      'payment_id', pay_id,
      'verified_member_id', member.id
    );
  end if;

  -- Issue next public tag in order
  tag := public.next_membership_tag();

  insert into public.verified_members (
    email, email_norm, first_name, last_name, first_name_norm, last_name_norm,
    membership_tag, created_by, entrance_paid_at, dues_status
  ) values (
    email_n,
    email_n,
    fn,
    ln,
    public.normalize_person_name(fn),
    public.normalize_person_name(ln),
    tag,
    null,
    now(),
    case when p_stripe_subscription_id is not null then 'active' else 'none' end
  )
  returning * into member;

  insert into public.membership_payments (
    email, email_norm, first_name, last_name, kind, amount_cents, currency,
    status, membership_tag, verified_member_id, application_id,
    stripe_checkout_session_id, stripe_payment_intent_id, stripe_customer_id,
    stripe_subscription_id, paid_at, updated_at
  ) values (
    email_n, email_n, fn, ln, 'entrance', p_amount_cents, lower(coalesce(p_currency, 'usd')),
    'paid', tag, member.id, p_application_id,
    p_stripe_checkout_session_id, p_stripe_payment_intent_id, p_stripe_customer_id,
    p_stripe_subscription_id, now(), now()
  )
  returning id into pay_id;

  if p_application_id is not null then
    update public.first_wave_applications
    set status = 'accepted',
        membership_tag = tag,
        verified_member_id = member.id
    where id = p_application_id
      and status in ('pending', 'accepted');
  else
    update public.first_wave_applications
    set status = 'accepted',
        membership_tag = tag,
        verified_member_id = member.id
    where lower(email) = email_n
      and status = 'pending';
  end if;

  delete from public.membership_checkout_holds where email_norm = email_n;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'membership_tag', tag,
    'payment_id', pay_id,
    'verified_member_id', member.id
  );
end;
$$;

revoke all on function public.issue_membership_after_entrance_payment(
  text, text, text, int, text, text, text, text, text, uuid
) from public, anon, authenticated;

-- Monthly dues status only (never issues a second tag)
create or replace function public.record_monthly_payment(
  p_email text,
  p_amount_cents int,
  p_currency text default 'usd',
  p_status text default 'paid',
  p_stripe_invoice_id text default null,
  p_stripe_customer_id text default null,
  p_stripe_subscription_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  email_n text := lower(trim(p_email));
  member public.verified_members%rowtype;
  dues text;
  pay_id uuid;
begin
  if p_status not in ('paid', 'past_due', 'failed', 'refunded') then
    raise exception 'Invalid monthly status';
  end if;

  select * into member from public.verified_members where email_norm = email_n limit 1;

  dues := case
    when p_status = 'paid' then 'active'
    when p_status = 'past_due' then 'past_due'
    else 'canceled'
  end;

  insert into public.membership_payments (
    email, email_norm, first_name, last_name, kind, amount_cents, currency,
    status, membership_tag, verified_member_id,
    stripe_invoice_id, stripe_customer_id, stripe_subscription_id,
    paid_at, updated_at
  ) values (
    email_n, email_n,
    coalesce(member.first_name, ''), coalesce(member.last_name, ''),
    'monthly', p_amount_cents, lower(coalesce(p_currency, 'usd')),
    p_status, member.membership_tag, member.id,
    p_stripe_invoice_id, p_stripe_customer_id, p_stripe_subscription_id,
    case when p_status = 'paid' then now() else null end,
    now()
  )
  on conflict (stripe_invoice_id) where stripe_invoice_id is not null
  do nothing
  returning id into pay_id;

  if member.id is not null then
    update public.verified_members set dues_status = dues where id = member.id;
    if member.claimed_user_id is not null then
      update public.profiles
      set dues_status = dues,
          stripe_customer_id = coalesce(p_stripe_customer_id, stripe_customer_id)
      where id = member.claimed_user_id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'payment_id', pay_id, 'dues_status', dues);
end;
$$;

revoke all on function public.record_monthly_payment(text, int, text, text, text, text, text)
  from public, anon, authenticated;

-- VIP Board override: mark entrance paid offline and optionally issue tag
create or replace function public.board_mark_entrance_paid(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_reason text,
  p_issue_tag boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor public.profiles%rowtype;
  result jsonb;
  email_n text := lower(trim(p_email));
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role not in ('president', 'vip') then
    raise exception 'Not authorized';
  end if;
  if length(trim(coalesce(p_reason, ''))) < 8 then
    raise exception 'Reason must be at least 8 characters';
  end if;

  if p_issue_tag then
    result := public.issue_membership_after_entrance_payment(
      p_email, p_first_name, p_last_name, 10000, 'usd',
      null, null, null, null, null
    );
  else
    result := jsonb_build_object('ok', true, 'membership_tag', null);
  end if;

  insert into public.membership_payment_overrides (
    actor_id, action, email_norm, membership_tag, reason, payment_id
  ) values (
    actor.id,
    'mark_entrance_paid',
    email_n,
    result->>'membership_tag',
    trim(p_reason),
    nullif(result->>'payment_id', '')::uuid
  );

  return result || jsonb_build_object('override', true, 'actor_id', actor.id);
end;
$$;

revoke all on function public.board_mark_entrance_paid(text, text, text, text, boolean)
  from public, anon;
grant execute on function public.board_mark_entrance_paid(text, text, text, text, boolean)
  to authenticated;

-- Mark entrance refunded — keep tag history, do not recycle
create or replace function public.mark_entrance_refunded(
  p_stripe_checkout_session_id text default null,
  p_payment_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  pay public.membership_payments%rowtype;
begin
  if p_payment_id is not null then
    select * into pay from public.membership_payments where id = p_payment_id;
  elsif p_stripe_checkout_session_id is not null then
    select * into pay from public.membership_payments
    where stripe_checkout_session_id = p_stripe_checkout_session_id;
  else
    raise exception 'payment id or session id required';
  end if;

  if pay.id is null then
    return jsonb_build_object('ok', false, 'error', 'payment_not_found');
  end if;

  update public.membership_payments
  set status = 'refunded',
      refunded_at = now(),
      updated_at = now()
  where id = pay.id;

  -- Tag stays on verified_members; Board may void access separately
  return jsonb_build_object(
    'ok', true,
    'payment_id', pay.id,
    'membership_tag', pay.membership_tag,
    'note', 'Tag retained; not recycled'
  );
end;
$$;

revoke all on function public.mark_entrance_refunded(text, uuid)
  from public, anon, authenticated;

-- Harden verified_members reads to VIP (Board) when not already set remotely
alter table public.verified_members enable row level security;

drop policy if exists verified_members_select_vip on public.verified_members;
create policy verified_members_select_vip
  on public.verified_members for select to authenticated
  using (public.is_vip());

-- Claimed member can read own roster row (for profile claim UX)
drop policy if exists verified_members_select_own_claim on public.verified_members;
create policy verified_members_select_own_claim
  on public.verified_members for select to authenticated
  using (claimed_user_id = auth.uid());

-- Monthly invoice idempotency
create unique index if not exists membership_payments_stripe_invoice_uidx
  on public.membership_payments (stripe_invoice_id)
  where stripe_invoice_id is not null;

-- One paid entrance per email
create unique index if not exists membership_payments_entrance_paid_email_uidx
  on public.membership_payments (email_norm)
  where kind = 'entrance' and status = 'paid';
