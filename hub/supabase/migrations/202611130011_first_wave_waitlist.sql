-- First Wave public waitlist → Board review → verified roster

create table if not exists public.first_wave_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  first_name text not null check (char_length(trim(first_name)) between 1 and 60),
  last_name text not null check (char_length(trim(last_name)) between 1 and 60),
  email text not null,
  email_norm text not null,
  phone text not null default '',
  service_status text not null check (service_status in ('veteran', 'active', 'reserve')),
  unit text not null default '',
  years text not null default '',
  platform text not null default '',
  message text not null default '',
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'duplicate')),
  membership_tag text,
  verified_member_id uuid references public.verified_members (id) on delete set null,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint first_wave_applications_email_uidx unique (email_norm)
);

create index if not exists first_wave_applications_status_idx
  on public.first_wave_applications (status, created_at desc);

alter table public.first_wave_applications enable row level security;

drop policy if exists first_wave_apps_vip_select on public.first_wave_applications;
create policy first_wave_apps_vip_select
  on public.first_wave_applications for select to authenticated
  using (public.is_vip());

drop policy if exists first_wave_apps_vip_update on public.first_wave_applications;
create policy first_wave_apps_vip_update
  on public.first_wave_applications for update to authenticated
  using (public.is_vip())
  with check (public.is_vip());

grant select, update on public.first_wave_applications to authenticated;

create or replace function public.split_person_name(p_full text)
returns table (first_name text, last_name text)
language plpgsql
immutable
set search_path = public
as $$
declare
  cleaned text := trim(both from regexp_replace(coalesce(p_full, ''), '\s+', ' ', 'g'));
  parts text[];
begin
  parts := string_to_array(cleaned, ' ');
  if array_length(parts, 1) is null or array_length(parts, 1) < 2 then
    first_name := cleaned;
    last_name := cleaned;
  else
    first_name := parts[1];
    last_name := array_to_string(parts[2:array_length(parts, 1)], ' ');
  end if;
  return next;
end;
$$;

create or replace function public.submit_first_wave_application(
  p_full_name text,
  p_email text,
  p_service_status text,
  p_phone text default '',
  p_unit text default '',
  p_years text default '',
  p_platform text default '',
  p_message text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  status_now jsonb := public.registration_status();
  mail text := lower(trim(p_email));
  names record;
  row public.first_wave_applications%rowtype;
begin
  if coalesce((status_now->>'registrations_open')::boolean, false) is not true then
    return jsonb_build_object(
      'ok', false,
      'error', 'First Wave registrations are closed.',
      'registration', status_now
    );
  end if;

  if mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok', false, 'error', 'Valid email required');
  end if;

  if trim(p_full_name) = '' or length(trim(p_full_name)) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Full name required');
  end if;

  if p_service_status not in ('veteran', 'active', 'reserve') then
    return jsonb_build_object('ok', false, 'error', 'Service connection required');
  end if;

  select * into names from public.split_person_name(p_full_name);

  insert into public.first_wave_applications (
    full_name, first_name, last_name, email, email_norm, phone,
    service_status, unit, years, platform, message
  ) values (
    trim(p_full_name),
    names.first_name,
    names.last_name,
    mail,
    mail,
    left(trim(coalesce(p_phone, '')), 40),
    p_service_status,
    left(trim(coalesce(p_unit, '')), 120),
    left(trim(coalesce(p_years, '')), 80),
    left(trim(coalesce(p_platform, '')), 40),
    left(trim(coalesce(p_message, '')), 1200)
  )
  on conflict (email_norm) do update
    set full_name = excluded.full_name,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        phone = excluded.phone,
        service_status = excluded.service_status,
        unit = excluded.unit,
        years = excluded.years,
        platform = excluded.platform,
        message = excluded.message,
        status = case
          when first_wave_applications.status = 'accepted' then first_wave_applications.status
          else 'pending'
        end
  returning * into row;

  return jsonb_build_object(
    'ok', true,
    'id', row.id,
    'status', row.status,
    'registration', status_now
  );
exception
  when others then
    return jsonb_build_object('ok', false, 'error', sqlerrm);
end;
$$;

revoke all on function public.submit_first_wave_application(text, text, text, text, text, text, text, text) from public;
grant execute on function public.submit_first_wave_application(text, text, text, text, text, text, text, text) to anon, authenticated;

create or replace function public.promote_first_wave_application(
  p_application_id uuid,
  p_membership_tag text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor public.profiles%rowtype;
  app public.first_wave_applications%rowtype;
  member public.verified_members%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role not in ('president', 'vip') then
    raise exception 'Not authorized';
  end if;

  select * into app
  from public.first_wave_applications
  where id = p_application_id
  for update;

  if app.id is null then
    raise exception 'Application not found';
  end if;
  if app.status = 'accepted' and app.verified_member_id is not null then
    return jsonb_build_object(
      'ok', true,
      'already', true,
      'membership_tag', app.membership_tag,
      'verified_member_id', app.verified_member_id
    );
  end if;

  member := public.add_verified_member(
    app.email,
    app.first_name,
    app.last_name,
    nullif(trim(p_membership_tag), '')
  );

  update public.first_wave_applications
  set status = 'accepted',
      membership_tag = member.membership_tag,
      verified_member_id = member.id,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = app.id;

  return jsonb_build_object(
    'ok', true,
    'membership_tag', member.membership_tag,
    'verified_member_id', member.id,
    'email', member.email,
    'display_name', member.first_name || ' ' || member.last_name
  );
end;
$$;

revoke all on function public.promote_first_wave_application(uuid, text) from public, anon;
grant execute on function public.promote_first_wave_application(uuid, text) to authenticated;

create or replace function public.reject_first_wave_application(
  p_application_id uuid,
  p_as_duplicate boolean default false
)
returns public.first_wave_applications
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor public.profiles%rowtype;
  row public.first_wave_applications%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role not in ('president', 'vip') then
    raise exception 'Not authorized';
  end if;

  update public.first_wave_applications
  set status = case when p_as_duplicate then 'duplicate' else 'rejected' end,
      reviewed_by = auth.uid(),
      reviewed_at = now()
  where id = p_application_id
    and status = 'pending'
  returning * into row;

  if row.id is null then
    raise exception 'Pending application not found';
  end if;
  return row;
end;
$$;

revoke all on function public.reject_first_wave_application(uuid, boolean) from public, anon;
grant execute on function public.reject_first_wave_application(uuid, boolean) to authenticated;
