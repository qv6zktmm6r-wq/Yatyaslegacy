-- Verified member roster + profile cover photos
-- See remote: verified_members_roster_v2

create or replace function public.normalize_person_name(raw text)
returns text language sql immutable as $$
  select trim(both from regexp_replace(lower(coalesce(raw, '')), '\s+', ' ', 'g'));
$$;

create table if not exists public.verified_members (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_norm text not null,
  first_name text not null,
  last_name text not null,
  first_name_norm text not null,
  last_name_norm text not null,
  membership_tag text not null,
  claimed_user_id uuid unique references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint verified_members_tag_format check (membership_tag ~ '^FW-[0-9]{3}$')
);

create unique index if not exists verified_members_email_norm_uidx on public.verified_members (email_norm);
create unique index if not exists verified_members_tag_uidx on public.verified_members (membership_tag);

alter table public.profiles add column if not exists cover_path text;
alter table public.profiles add column if not exists home_region text not null default '';
alter table public.profiles add column if not exists chat_quiet_hours boolean not null default false;

insert into storage.buckets (id, name, public)
values ('covers', 'covers', false)
on conflict (id) do nothing;
