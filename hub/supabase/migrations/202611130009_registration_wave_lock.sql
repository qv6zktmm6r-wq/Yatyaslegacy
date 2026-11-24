-- First Wave registration lock: sequential tags, hard stop at 100, Board reopen for next wave

create table if not exists public.hub_registration_settings (
  id int primary key default 1 check (id = 1),
  registrations_open boolean not null default true,
  wave_label text not null default 'First Wave',
  tag_prefix text not null default 'FW'
    check (tag_prefix ~ '^[A-Z]{2}$'),
  tag_cap int not null default 100 check (tag_cap between 1 and 999),
  closed_at timestamptz,
  closed_reason text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.hub_registration_settings (id)
values (1)
on conflict (id) do nothing;

alter table public.hub_registration_settings enable row level security;

drop policy if exists registration_settings_select on public.hub_registration_settings;
create policy registration_settings_select
  on public.hub_registration_settings for select to authenticated
  using (true);

drop policy if exists registration_settings_update_vip on public.hub_registration_settings;
create policy registration_settings_update_vip
  on public.hub_registration_settings for update to authenticated
  using (public.is_vip())
  with check (public.is_vip());

grant select on public.hub_registration_settings to authenticated;
grant update on public.hub_registration_settings to authenticated;

-- Allow wave prefixes beyond FW (e.g. SW for Second Wave)
alter table public.profiles drop constraint if exists profiles_membership_tag_format;
alter table public.profiles
  add constraint profiles_membership_tag_format
  check (membership_tag is null or membership_tag ~ '^[A-Z]{2}-[0-9]{3}$');

alter table public.verified_members drop constraint if exists verified_members_tag_format;
alter table public.verified_members
  add constraint verified_members_tag_format
  check (membership_tag ~ '^[A-Z]{2}-[0-9]{3}$');

create or replace function public.registration_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  s public.hub_registration_settings%rowtype;
  used int;
  next_n int;
begin
  select * into s from public.hub_registration_settings where id = 1;
  select count(*)::int into used
  from (
    select membership_tag from public.profiles
    where membership_tag ~ ('^' || s.tag_prefix || '-[0-9]{3}$')
    union
    select membership_tag from public.verified_members
    where membership_tag ~ ('^' || s.tag_prefix || '-[0-9]{3}$')
  ) t;

  select coalesce(max(substring(membership_tag from 4)::int), 0) + 1 into next_n
  from (
    select membership_tag from public.profiles
    where membership_tag ~ ('^' || s.tag_prefix || '-[0-9]{3}$')
    union
    select membership_tag from public.verified_members
    where membership_tag ~ ('^' || s.tag_prefix || '-[0-9]{3}$')
  ) u;

  return jsonb_build_object(
    'registrations_open', s.registrations_open and next_n <= s.tag_cap,
    'wave_label', s.wave_label,
    'tag_prefix', s.tag_prefix,
    'tag_cap', s.tag_cap,
    'issued_count', used,
    'next_number', least(next_n, s.tag_cap + 1),
    'seats_remaining', greatest(s.tag_cap - used, 0),
    'closed_reason', s.closed_reason
  );
end;
$$;

revoke all on function public.registration_status() from public;
grant execute on function public.registration_status() to anon, authenticated;

create or replace function public.next_membership_tag()
returns text
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  s public.hub_registration_settings%rowtype;
  n int;
  tag text;
begin
  select * into s from public.hub_registration_settings where id = 1 for update;

  if not s.registrations_open then
    raise exception 'Registrations are closed for %', s.wave_label;
  end if;

  select coalesce(max(substring(membership_tag from 4)::int), 0) + 1
    into n
  from (
    select membership_tag from public.profiles
    where membership_tag ~ ('^' || s.tag_prefix || '-[0-9]{3}$')
    union
    select membership_tag from public.verified_members
    where membership_tag ~ ('^' || s.tag_prefix || '-[0-9]{3}$')
  ) t;

  if n > s.tag_cap then
    update public.hub_registration_settings
    set registrations_open = false,
        closed_at = now(),
        closed_reason = s.wave_label || ' capacity reached (' || s.tag_cap || ')',
        updated_at = now()
    where id = 1;
    raise exception '% is full (% seats). Registrations are closed.', s.wave_label, s.tag_cap;
  end if;

  tag := s.tag_prefix || '-' || lpad(n::text, 3, '0');

  if n = s.tag_cap then
    update public.hub_registration_settings
    set registrations_open = false,
        closed_at = now(),
        closed_reason = s.wave_label || ' filled — ' || tag || ' was the last seat',
        updated_at = now()
    where id = 1;
  end if;

  return tag;
end;
$$;

revoke all on function public.next_membership_tag() from public;

create or replace function public.add_verified_member(
  p_email text,
  p_first_name text,
  p_last_name text,
  p_membership_tag text default null
)
returns public.verified_members
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor public.profiles%rowtype;
  tag text;
  row public.verified_members%rowtype;
  existing_user uuid;
  dn text;
  s public.hub_registration_settings%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role not in ('president', 'vip') then
    raise exception 'Not authorized';
  end if;

  select * into s from public.hub_registration_settings where id = 1;

  if p_membership_tag is null or length(trim(p_membership_tag)) = 0 then
    tag := public.next_membership_tag();
  else
    if not s.registrations_open then
      raise exception 'Registrations are closed for %', s.wave_label;
    end if;
    tag := upper(trim(p_membership_tag));
    if tag !~ ('^' || s.tag_prefix || '-[0-9]{3}$') then
      raise exception 'Tag must match current wave format %', s.tag_prefix || '-###';
    end if;
    if substring(tag from 4)::int > s.tag_cap then
      raise exception 'Tag exceeds % capacity (%)', s.wave_label, s.tag_cap;
    end if;
  end if;

  insert into public.verified_members (
    email, email_norm, first_name, last_name, first_name_norm, last_name_norm,
    membership_tag, created_by
  ) values (
    lower(trim(p_email)),
    lower(trim(p_email)),
    trim(p_first_name),
    trim(p_last_name),
    public.normalize_person_name(p_first_name),
    public.normalize_person_name(p_last_name),
    tag,
    actor.id
  )
  returning * into row;

  select u.id into existing_user
  from auth.users u
  where lower(u.email) = row.email_norm
  limit 1;

  if existing_user is not null then
    select display_name into dn from public.profiles where id = existing_user;
    if public.normalize_person_name(split_part(coalesce(dn,''), ' ', 1)) = row.first_name_norm
       and public.normalize_person_name(nullif(substr(coalesce(dn,''), length(split_part(coalesce(dn,''), ' ', 1)) + 2), '')) = row.last_name_norm then
      update public.profiles
      set chapter = 'MEMBER',
          membership_tag = row.membership_tag,
          display_name = row.first_name || ' ' || row.last_name,
          updated_at = now()
      where id = existing_user
        and role <> 'president';

      update public.verified_members
      set claimed_user_id = existing_user
      where id = row.id
      returning * into row;
    end if;
  end if;

  return row;
end;
$$;

-- Board: reopen registrations for a new wave (different prefix/label)
create or replace function public.reopen_membership_wave(
  p_wave_label text,
  p_tag_prefix text,
  p_tag_cap int default 100
)
returns public.hub_registration_settings
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor public.profiles%rowtype;
  prefix text := upper(trim(p_tag_prefix));
  row public.hub_registration_settings%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role not in ('president', 'vip') then
    raise exception 'Not authorized';
  end if;
  if length(trim(p_wave_label)) < 2 then
    raise exception 'Wave label required';
  end if;
  if prefix !~ '^[A-Z]{2}$' then
    raise exception 'Tag prefix must be two letters (e.g. SW)';
  end if;
  if p_tag_cap < 1 or p_tag_cap > 999 then
    raise exception 'Invalid capacity';
  end if;

  update public.hub_registration_settings
  set registrations_open = true,
      wave_label = trim(p_wave_label),
      tag_prefix = prefix,
      tag_cap = p_tag_cap,
      closed_at = null,
      closed_reason = '',
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1
  returning * into row;

  return row;
end;
$$;

revoke all on function public.reopen_membership_wave(text, text, int) from public, anon;
grant execute on function public.reopen_membership_wave(text, text, int) to authenticated;

create or replace function public.set_registrations_open(p_open boolean, p_reason text default '')
returns public.hub_registration_settings
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor public.profiles%rowtype;
  row public.hub_registration_settings%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role not in ('president', 'vip') then
    raise exception 'Not authorized';
  end if;

  update public.hub_registration_settings
  set registrations_open = p_open,
      closed_at = case when p_open then null else now() end,
      closed_reason = case when p_open then '' else coalesce(nullif(trim(p_reason), ''), 'Closed by Board') end,
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1
  returning * into row;

  return row;
end;
$$;

revoke all on function public.set_registrations_open(boolean, text) from public, anon;
grant execute on function public.set_registrations_open(boolean, text) to authenticated;
