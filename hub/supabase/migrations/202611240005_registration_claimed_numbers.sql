-- Expose claimed FW numbers (no PII) for the public First Wave roll board.

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
  claimed_nums int[];
begin
  select * into s from public.hub_registration_settings where id = 1;

  select coalesce(array_agg(tag_number order by tag_number), '{}'::int[])
    into reserved_nums
  from public.hub_reserved_membership_numbers
  where tag_prefix = s.tag_prefix;

  select coalesce(
    array_agg(distinct n order by n),
    '{}'::int[]
  )
    into claimed_nums
  from (
    select substring(membership_tag from length(s.tag_prefix) + 2)::int as n
    from public.profiles
    where membership_tag ~ ('^' || s.tag_prefix || '-[0-9]{3}$')
    union
    select substring(membership_tag from length(s.tag_prefix) + 2)::int
    from public.verified_members
    where membership_tag ~ ('^' || s.tag_prefix || '-[0-9]{3}$')
  ) t;

  used := coalesce(cardinality(claimed_nums), 0);

  next_n := null;
  for i in 1..s.tag_cap loop
    if i = any (reserved_nums) then
      continue;
    end if;
    if i = any (claimed_nums) then
      continue;
    end if;
    next_n := i;
    exit;
  end loop;

  select count(*)::int into public_remaining
  from generate_series(1, s.tag_cap) g(n)
  where not (g.n = any (reserved_nums))
    and not (g.n = any (claimed_nums));

  return jsonb_build_object(
    'registrations_open', s.registrations_open and next_n is not null,
    'wave_label', s.wave_label,
    'tag_prefix', s.tag_prefix,
    'tag_cap', s.tag_cap,
    'issued_count', used,
    'next_number', coalesce(next_n, s.tag_cap + 1),
    'seats_remaining', public_remaining,
    'closed_reason', s.closed_reason,
    'reserved_numbers', to_jsonb(reserved_nums),
    'claimed_numbers', to_jsonb(claimed_nums)
  );
end;
$$;

revoke all on function public.registration_status() from public;
grant execute on function public.registration_status() to anon, authenticated;
