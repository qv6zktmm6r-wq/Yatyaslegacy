-- Live Crew Finder entries + Board-only PII. Public match results never expose email.
create table if not exists public.crew_finder_entries (
  id uuid primary key default gen_random_uuid(),
  intent text not null check (intent in ('find', 'list')),
  full_name text not null check (char_length(trim(full_name)) between 1 and 120),
  email text not null check (char_length(trim(email)) between 3 and 160),
  story_raw text not null check (char_length(trim(story_raw)) between 12 and 2500),
  looking_for text,
  unit text,
  years text,
  platform text,
  station text,
  deployment text,
  schoolhouse text,
  preferred_unit text,
  ai_summary text,
  ai_confidence text,
  unit_norm text,
  platform_norm text,
  station_norm text,
  years_start int,
  years_end int,
  matchable boolean not null default false,
  status text not null default 'open'
    check (status in ('open', 'matched', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crew_finder_entries_match_idx
  on public.crew_finder_entries (intent, matchable, status, unit_norm, created_at desc);

create index if not exists crew_finder_entries_email_idx
  on public.crew_finder_entries (lower(email), created_at desc);

alter table public.crew_finder_entries enable row level security;

-- No anon access to rows (service role bypasses RLS for Hub API).
drop policy if exists crew_finder_entries_vip_all on public.crew_finder_entries;
create policy crew_finder_entries_vip_all
  on public.crew_finder_entries for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('president', 'vip')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('president', 'vip')
    )
  );

grant select, update on public.crew_finder_entries to authenticated;

create or replace function public.touch_crew_finder_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists crew_finder_entries_touch on public.crew_finder_entries;
create trigger crew_finder_entries_touch
  before update on public.crew_finder_entries
  for each row execute function public.touch_crew_finder_entries_updated_at();

revoke all on table public.crew_finder_entries from anon;
