-- Reserve First Wave board/held numbers: FW-001..010 and FW-013
-- Auto-issue skips these; Board may still assign them manually.

create table if not exists public.hub_reserved_membership_numbers (
  tag_prefix text not null check (tag_prefix ~ '^[A-Z]{2}$'),
  tag_number int not null check (tag_number between 1 and 999),
  reason text not null default 'Board reserved',
  created_at timestamptz not null default now(),
  primary key (tag_prefix, tag_number)
);

alter table public.hub_reserved_membership_numbers enable row level security;

drop policy if exists reserved_numbers_select on public.hub_reserved_membership_numbers;
create policy reserved_numbers_select
  on public.hub_reserved_membership_numbers for select to authenticated
  using (true);

grant select on public.hub_reserved_membership_numbers to authenticated;

insert into public.hub_reserved_membership_numbers (tag_prefix, tag_number, reason) values
  ('FW', 1,  'Board / founder held'),
  ('FW', 2,  'Board / founder held'),
  ('FW', 3,  'Board / founder held'),
  ('FW', 4,  'Board reserved'),
  ('FW', 5,  'Board reserved'),
  ('FW', 6,  'Board reserved'),
  ('FW', 7,  'Board reserved'),
  ('FW', 8,  'Board reserved'),
  ('FW', 9,  'Board reserved'),
  ('FW', 10, 'Board reserved'),
  ('FW', 13, 'Board reserved')
on conflict (tag_prefix, tag_number) do nothing;

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
  reserved_nums int[];
  public_remaining int;
begin
  select * into s from public.hub_registration_settings where id = 1;

  select coalesce(array_agg(tag_number order by tag_number), '{}'::int[])
    into reserved_nums
  from public.hub_reserved_membership_numbers
  where tag_prefix = s.tag_prefix;

  select count(*)::int into used
  from (
    select membership_tag from public.profiles
    where membership_tag ~ ('^' || s.tag_prefix || '-[0-9]{3}$')
    union
    select membership_tag from public.verified_members
    where membership_tag ~ ('^' || s.tag_prefix || '-[0-9]{3}$')
  ) t;

  next_n := null;
  for i in 1..s.tag_cap loop
    if i = any (reserved_nums) then
      continue;
    end if;
    if exists (
      select 1 from public.profiles
      where membership_tag = s.tag_prefix || '-' || lpad(i::text, 3, '0')
    ) or exists (
      select 1 from public.verified_members
      where membership_tag = s.tag_prefix || '-' || lpad(i::text, 3, '0')
    ) then
      continue;
    end if;
    next_n := i;
    exit;
  end loop;

  select count(*)::int into public_remaining
  from generate_series(1, s.tag_cap) g(n)
  where not (g.n = any (reserved_nums))
    and not exists (
      select 1 from public.profiles
      where membership_tag = s.tag_prefix || '-' || lpad(g.n::text, 3, '0')
    )
    and not exists (
      select 1 from public.verified_members
      where membership_tag = s.tag_prefix || '-' || lpad(g.n::text, 3, '0')
    );

  return jsonb_build_object(
    'registrations_open', s.registrations_open and next_n is not null,
    'wave_label', s.wave_label,
    'tag_prefix', s.tag_prefix,
    'tag_cap', s.tag_cap,
    'issued_count', used,
    'next_number', coalesce(next_n, s.tag_cap + 1),
    'seats_remaining', public_remaining,
    'closed_reason', s.closed_reason,
    'reserved_numbers', to_jsonb(reserved_nums)
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
  reserved_nums int[];
begin
  select * into s from public.hub_registration_settings where id = 1 for update;

  if not s.registrations_open then
    raise exception 'Registrations are closed for %', s.wave_label;
  end if;

  select coalesce(array_agg(tag_number), '{}'::int[])
    into reserved_nums
  from public.hub_reserved_membership_numbers
  where tag_prefix = s.tag_prefix;

  n := null;
  for i in 1..s.tag_cap loop
    if i = any (reserved_nums) then
      continue;
    end if;
    tag := s.tag_prefix || '-' || lpad(i::text, 3, '0');
    if exists (select 1 from public.profiles where membership_tag = tag) then
      continue;
    end if;
    if exists (select 1 from public.verified_members where membership_tag = tag) then
      continue;
    end if;
    n := i;
    exit;
  end loop;

  if n is null then
    update public.hub_registration_settings
    set registrations_open = false,
        closed_at = now(),
        closed_reason = s.wave_label || ' capacity reached (public seats filled)',
        updated_at = now()
    where id = 1;
    raise exception '% has no public seats left. Registrations are closed.', s.wave_label;
  end if;

  tag := s.tag_prefix || '-' || lpad(n::text, 3, '0');

  -- Close when this was the last public seat
  if not exists (
    select 1 from generate_series(1, s.tag_cap) g(i)
    where g.i <> n
      and not (g.i = any (reserved_nums))
      and not exists (
        select 1 from public.profiles
        where membership_tag = s.tag_prefix || '-' || lpad(g.i::text, 3, '0')
      )
      and not exists (
        select 1 from public.verified_members
        where membership_tag = s.tag_prefix || '-' || lpad(g.i::text, 3, '0')
      )
  ) then
    update public.hub_registration_settings
    set registrations_open = false,
        closed_at = now(),
        closed_reason = s.wave_label || ' filled — ' || tag || ' was the last public seat',
        updated_at = now()
    where id = 1;
  end if;

  return tag;
end;
$$;

revoke all on function public.next_membership_tag() from public, anon, authenticated;
