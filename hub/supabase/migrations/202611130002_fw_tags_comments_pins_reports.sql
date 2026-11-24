-- First Wave membership tags + comments + pins + reports
-- Applied remotely as fw_tags_comments_pins_reports_v2

create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor_role text;
begin
  if auth.uid() is null then
    return new;
  end if;

  select role into actor_role from public.profiles where id = auth.uid();

  if actor_role in ('president', 'vip') then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.title is distinct from old.title
     or new.chapter is distinct from old.chapter
     or new.membership_tag is distinct from old.membership_tag then
    raise exception 'Cannot change membership privileges';
  end if;

  return new;
end;
$$;

alter table public.profiles
  add column if not exists membership_tag text;

alter table public.profiles
  drop constraint if exists profiles_membership_tag_format;

alter table public.profiles
  add constraint profiles_membership_tag_format
  check (membership_tag is null or membership_tag ~ '^FW-[0-9]{3}$');

create unique index if not exists profiles_membership_tag_uidx
  on public.profiles (membership_tag)
  where membership_tag is not null;

alter table public.chapter_posts
  add column if not exists pinned boolean not null default false;

alter table public.chapter_posts
  add column if not exists pinned_at timestamptz;

create table if not exists public.chapter_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.chapter_posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists chapter_post_comments_post_created_idx
  on public.chapter_post_comments (post_id, created_at);

create table if not exists public.chapter_post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.chapter_posts (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create or replace function public.next_membership_tag()
returns text
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  n int;
begin
  select coalesce(max(substring(membership_tag from 4)::int), 0) + 1
    into n
  from public.profiles
  where membership_tag ~ '^FW-[0-9]{3}$';

  if n > 999 then
    raise exception 'Membership tag pool exhausted';
  end if;

  return 'FW-' || lpad(n::text, 3, '0');
end;
$$;

revoke all on function public.next_membership_tag() from public;

create or replace function public.approve_member(target_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor public.profiles%rowtype;
  target public.profiles%rowtype;
  tag text;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role not in ('president', 'vip') then
    raise exception 'Not authorized';
  end if;

  select * into target from public.profiles where id = target_id for update;
  if target.id is null then
    raise exception 'Member not found';
  end if;
  if target.chapter <> 'PENDING' then
    raise exception 'Member is not pending';
  end if;

  tag := target.membership_tag;
  if tag is null then
    tag := public.next_membership_tag();
  end if;

  update public.profiles
  set chapter = 'CA',
      membership_tag = tag,
      updated_at = now()
  where id = target_id
  returning * into target;

  return target;
end;
$$;

revoke all on function public.approve_member(uuid) from public;
grant execute on function public.approve_member(uuid) to authenticated;

update public.profiles
set membership_tag = 'FW-001'
where role = 'president'
  and membership_tag is null;

alter table public.chapter_post_comments enable row level security;
alter table public.chapter_post_reports enable row level security;

drop policy if exists comments_select_ca on public.chapter_post_comments;
create policy comments_select_ca
  on public.chapter_post_comments for select to authenticated
  using (public.is_approved_member());

drop policy if exists comments_insert_ca on public.chapter_post_comments;
create policy comments_insert_ca
  on public.chapter_post_comments for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_approved_member()
  );

drop policy if exists comments_delete_own on public.chapter_post_comments;
create policy comments_delete_own
  on public.chapter_post_comments for delete to authenticated
  using (
    author_id = auth.uid()
    or public.is_vip()
  );

drop policy if exists reports_insert_own on public.chapter_post_reports;
create policy reports_insert_own
  on public.chapter_post_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and public.is_approved_member()
  );

drop policy if exists reports_select_vip on public.chapter_post_reports;
create policy reports_select_vip
  on public.chapter_post_reports for select to authenticated
  using (public.is_vip() or reporter_id = auth.uid());

drop policy if exists posts_update_vip_pin on public.chapter_posts;
create policy posts_update_vip_pin
  on public.chapter_posts for update to authenticated
  using (public.is_vip())
  with check (public.is_vip());
