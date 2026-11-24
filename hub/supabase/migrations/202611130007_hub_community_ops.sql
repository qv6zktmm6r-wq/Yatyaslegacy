-- Ensure VIP helper exists (may already be remote)
create or replace function public.is_vip()
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('vip', 'president')
  );
$$;

revoke all on function public.is_vip() from public;
grant execute on function public.is_vip() to authenticated;

-- High-value + community depth + ops/trust
-- Events/RSVP, DMs, notifications, albums, polls, announcements,
-- report queue status, digest/welcome prefs, mention notify helper

-- ---------------------------------------------------------------------------
-- Profile prefs
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists digest_opt_in boolean not null default true,
  add column if not exists welcome_completed boolean not null default false,
  add column if not exists welcome_steps jsonb not null default '{}'::jsonb;

-- Announcements (board posts that stay above the fold with pins)
alter table public.chapter_posts
  add column if not exists is_announcement boolean not null default false;

-- Report moderation queue
alter table public.chapter_post_reports
  add column if not exists status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed')),
  add column if not exists resolved_by uuid references public.profiles (id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_note text not null default ''
    check (char_length(resolution_note) <= 500);

-- ---------------------------------------------------------------------------
-- Events + RSVP
-- ---------------------------------------------------------------------------
create table if not exists public.hub_events (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 4000),
  location text not null default '' check (char_length(location) <= 200),
  starts_at timestamptz not null,
  ends_at timestamptz,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index if not exists hub_events_starts_idx
  on public.hub_events (starts_at asc);

create table if not exists public.hub_event_rsvps (
  event_id uuid not null references public.hub_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('going', 'maybe', 'declined')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

drop trigger if exists hub_events_set_updated_at on public.hub_events;
create trigger hub_events_set_updated_at
  before update on public.hub_events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Direct messages
-- ---------------------------------------------------------------------------
create table if not exists public.dm_threads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dm_thread_members (
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists dm_thread_members_user_idx
  on public.dm_thread_members (user_id);

create table if not exists public.dm_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.dm_threads (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists dm_messages_thread_created_idx
  on public.dm_messages (thread_id, created_at desc);

create or replace function public.is_dm_member(p_thread uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1 from public.dm_thread_members
    where thread_id = p_thread and user_id = auth.uid()
  );
$$;

revoke all on function public.is_dm_member(uuid) from public;
grant execute on function public.is_dm_member(uuid) to authenticated;

create or replace function public.get_or_create_dm(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  me uuid := auth.uid();
  existing uuid;
  new_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if other_user_id is null or other_user_id = me then
    raise exception 'Invalid recipient';
  end if;
  if not public.is_approved_member() then
    raise exception 'Not authorized';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = other_user_id and chapter = 'MEMBER'
  ) and not exists (
    select 1 from public.profiles
    where id = other_user_id and role in ('vip', 'president')
  ) then
    raise exception 'Recipient is not an approved member';
  end if;

  select t.id into existing
  from public.dm_threads t
  join public.dm_thread_members a on a.thread_id = t.id and a.user_id = me
  join public.dm_thread_members b on b.thread_id = t.id and b.user_id = other_user_id
  where (
    select count(*) from public.dm_thread_members m where m.thread_id = t.id
  ) = 2
  limit 1;

  if existing is not null then
    return existing;
  end if;

  insert into public.dm_threads default values returning id into new_id;
  insert into public.dm_thread_members (thread_id, user_id) values
    (new_id, me),
    (new_id, other_user_id);
  return new_id;
end;
$$;

revoke all on function public.get_or_create_dm(uuid) from public;
grant execute on function public.get_or_create_dm(uuid) to authenticated;

create or replace function public.touch_dm_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.dm_threads set updated_at = now() where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists dm_messages_touch_thread on public.dm_messages;
create trigger dm_messages_touch_thread
  after insert on public.dm_messages
  for each row execute function public.touch_dm_thread();

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
create table if not exists public.hub_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in (
    'comment', 'reaction', 'mention', 'rsvp', 'dm', 'announcement',
    'event', 'poll', 'moderation', 'welcome'
  )),
  title text not null check (char_length(title) <= 160),
  body text not null default '' check (char_length(body) <= 500),
  link text not null default '' check (char_length(link) <= 300),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists hub_notifications_user_created_idx
  on public.hub_notifications (user_id, created_at desc);

create or replace function public.notify_member(
  p_user uuid,
  p_actor uuid,
  p_kind text,
  p_title text,
  p_body text default '',
  p_link text default ''
)
returns void
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if p_user is null or p_user = p_actor then
    return;
  end if;
  insert into public.hub_notifications (user_id, actor_id, kind, title, body, link)
  values (p_user, p_actor, p_kind, p_title, coalesce(p_body, ''), coalesce(p_link, ''));
end;
$$;

revoke all on function public.notify_member(uuid, uuid, text, text, text, text) from public;
grant execute on function public.notify_member(uuid, uuid, text, text, text, text) to authenticated;

-- Mention by FW tag or display name fragment
create or replace function public.notify_mentions(
  p_text text,
  p_actor uuid,
  p_kind text,
  p_title text,
  p_link text default ''
)
returns int
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  tag text;
  n int := 0;
  target uuid;
begin
  if p_text is null or p_actor is null then
    return 0;
  end if;

  for tag in
    select distinct upper(m[1])
    from regexp_matches(p_text, 'FW-([0-9]{3})', 'gi') as m
  loop
    select id into target
    from public.profiles
    where membership_tag = 'FW-' || tag
    limit 1;
    if target is not null and target <> p_actor then
      perform public.notify_member(target, p_actor, p_kind, p_title, left(p_text, 200), p_link);
      n := n + 1;
    end if;
  end loop;

  return n;
end;
$$;

revoke all on function public.notify_mentions(text, uuid, text, text, text) from public;
grant execute on function public.notify_mentions(text, uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Albums
-- ---------------------------------------------------------------------------
create table if not exists public.hub_albums (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 1000),
  created_at timestamptz not null default now()
);

create table if not exists public.hub_album_photos (
  id uuid primary key default gen_random_uuid(),
  album_id uuid not null references public.hub_albums (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete cascade,
  image_path text not null,
  caption text not null default '' check (char_length(caption) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists hub_album_photos_album_idx
  on public.hub_album_photos (album_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Polls
-- ---------------------------------------------------------------------------
create table if not exists public.hub_polls (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(trim(question)) between 1 and 240),
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.hub_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.hub_polls (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 120),
  sort_order int not null default 0
);

create table if not exists public.hub_poll_votes (
  poll_id uuid not null references public.hub_polls (id) on delete cascade,
  option_id uuid not null references public.hub_poll_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

create index if not exists hub_poll_votes_option_idx
  on public.hub_poll_votes (option_id);

-- ---------------------------------------------------------------------------
-- Moderation RPC
-- ---------------------------------------------------------------------------
create or replace function public.resolve_post_report(
  p_report_id uuid,
  p_status text,
  p_note text default ''
)
returns public.chapter_post_reports
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor public.profiles%rowtype;
  row public.chapter_post_reports%rowtype;
begin
  select * into actor from public.profiles where id = auth.uid();
  if actor.id is null or actor.role not in ('president', 'vip') then
    raise exception 'Not authorized';
  end if;
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'Invalid status';
  end if;

  update public.chapter_post_reports
  set status = p_status,
      resolved_by = auth.uid(),
      resolved_at = now(),
      resolution_note = coalesce(left(p_note, 500), '')
  where id = p_report_id
  returning * into row;

  if row.id is null then
    raise exception 'Report not found';
  end if;
  return row;
end;
$$;

revoke all on function public.resolve_post_report(uuid, text, text) from public;
grant execute on function public.resolve_post_report(uuid, text, text) to authenticated;

-- Protect announcement flag (VIP only) — extend post update guard
create or replace function public.protect_chapter_post_updates()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  actor_role text;
begin
  select role into actor_role from public.profiles where id = auth.uid();

  if actor_role in ('president', 'vip') then
    return new;
  end if;

  if new.pinned is distinct from old.pinned
     or new.pinned_at is distinct from old.pinned_at
     or new.is_announcement is distinct from old.is_announcement then
    raise exception 'Only Board / VIP can pin or announce';
  end if;

  if new.author_id is distinct from old.author_id
     or new.chapter is distinct from old.chapter then
    raise exception 'Cannot change post ownership';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.hub_events enable row level security;
alter table public.hub_event_rsvps enable row level security;
alter table public.dm_threads enable row level security;
alter table public.dm_thread_members enable row level security;
alter table public.dm_messages enable row level security;
alter table public.hub_notifications enable row level security;
alter table public.hub_albums enable row level security;
alter table public.hub_album_photos enable row level security;
alter table public.hub_polls enable row level security;
alter table public.hub_poll_options enable row level security;
alter table public.hub_poll_votes enable row level security;

-- Events
drop policy if exists events_select on public.hub_events;
create policy events_select on public.hub_events for select to authenticated
  using (public.is_approved_member());

drop policy if exists events_insert on public.hub_events;
create policy events_insert on public.hub_events for insert to authenticated
  with check (created_by = auth.uid() and public.is_approved_member());

drop policy if exists events_update on public.hub_events;
create policy events_update on public.hub_events for update to authenticated
  using (created_by = auth.uid() or public.is_vip())
  with check (created_by = auth.uid() or public.is_vip());

drop policy if exists events_delete on public.hub_events;
create policy events_delete on public.hub_events for delete to authenticated
  using (created_by = auth.uid() or public.is_vip());

drop policy if exists rsvps_select on public.hub_event_rsvps;
create policy rsvps_select on public.hub_event_rsvps for select to authenticated
  using (public.is_approved_member());

drop policy if exists rsvps_upsert on public.hub_event_rsvps;
create policy rsvps_upsert on public.hub_event_rsvps for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved_member());

drop policy if exists rsvps_update on public.hub_event_rsvps;
create policy rsvps_update on public.hub_event_rsvps for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists rsvps_delete on public.hub_event_rsvps;
create policy rsvps_delete on public.hub_event_rsvps for delete to authenticated
  using (user_id = auth.uid());

-- DMs
drop policy if exists dm_threads_select on public.dm_threads;
create policy dm_threads_select on public.dm_threads for select to authenticated
  using (public.is_dm_member(id));

drop policy if exists dm_threads_insert on public.dm_threads;
create policy dm_threads_insert on public.dm_threads for insert to authenticated
  with check (public.is_approved_member());

drop policy if exists dm_members_select on public.dm_thread_members;
create policy dm_members_select on public.dm_thread_members for select to authenticated
  using (public.is_dm_member(thread_id));

drop policy if exists dm_members_insert on public.dm_thread_members;
create policy dm_members_insert on public.dm_thread_members for insert to authenticated
  with check (public.is_approved_member());

drop policy if exists dm_members_update on public.dm_thread_members;
create policy dm_members_update on public.dm_thread_members for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists dm_messages_select on public.dm_messages;
create policy dm_messages_select on public.dm_messages for select to authenticated
  using (public.is_dm_member(thread_id));

drop policy if exists dm_messages_insert on public.dm_messages;
create policy dm_messages_insert on public.dm_messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and public.is_dm_member(thread_id)
  );

-- Notifications
drop policy if exists notifications_select_own on public.hub_notifications;
create policy notifications_select_own on public.hub_notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.hub_notifications;
create policy notifications_update_own on public.hub_notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_insert_auth on public.hub_notifications;
create policy notifications_insert_auth on public.hub_notifications for insert to authenticated
  with check (public.is_approved_member());

-- Albums
drop policy if exists albums_select on public.hub_albums;
create policy albums_select on public.hub_albums for select to authenticated
  using (public.is_approved_member());

drop policy if exists albums_insert on public.hub_albums;
create policy albums_insert on public.hub_albums for insert to authenticated
  with check (created_by = auth.uid() and public.is_approved_member());

drop policy if exists albums_delete on public.hub_albums;
create policy albums_delete on public.hub_albums for delete to authenticated
  using (created_by = auth.uid() or public.is_vip());

drop policy if exists album_photos_select on public.hub_album_photos;
create policy album_photos_select on public.hub_album_photos for select to authenticated
  using (public.is_approved_member());

drop policy if exists album_photos_insert on public.hub_album_photos;
create policy album_photos_insert on public.hub_album_photos for insert to authenticated
  with check (uploaded_by = auth.uid() and public.is_approved_member());

drop policy if exists album_photos_delete on public.hub_album_photos;
create policy album_photos_delete on public.hub_album_photos for delete to authenticated
  using (uploaded_by = auth.uid() or public.is_vip());

-- Polls
drop policy if exists polls_select on public.hub_polls;
create policy polls_select on public.hub_polls for select to authenticated
  using (public.is_approved_member());

drop policy if exists polls_insert on public.hub_polls;
create policy polls_insert on public.hub_polls for insert to authenticated
  with check (created_by = auth.uid() and public.is_approved_member());

drop policy if exists polls_delete on public.hub_polls;
create policy polls_delete on public.hub_polls for delete to authenticated
  using (created_by = auth.uid() or public.is_vip());

drop policy if exists poll_options_select on public.hub_poll_options;
create policy poll_options_select on public.hub_poll_options for select to authenticated
  using (public.is_approved_member());

drop policy if exists poll_options_insert on public.hub_poll_options;
create policy poll_options_insert on public.hub_poll_options for insert to authenticated
  with check (
    public.is_approved_member()
    and exists (
      select 1 from public.hub_polls p
      where p.id = poll_id and p.created_by = auth.uid()
    )
  );

drop policy if exists poll_votes_select on public.hub_poll_votes;
create policy poll_votes_select on public.hub_poll_votes for select to authenticated
  using (public.is_approved_member());

drop policy if exists poll_votes_insert on public.hub_poll_votes;
create policy poll_votes_insert on public.hub_poll_votes for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved_member());

drop policy if exists poll_votes_update on public.hub_poll_votes;
create policy poll_votes_update on public.hub_poll_votes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists poll_votes_delete on public.hub_poll_votes;
create policy poll_votes_delete on public.hub_poll_votes for delete to authenticated
  using (user_id = auth.uid());

-- Reports: VIP can update status via RPC; also allow select of all for VIP (already)
drop policy if exists reports_update_vip on public.chapter_post_reports;
create policy reports_update_vip on public.chapter_post_reports for update to authenticated
  using (public.is_vip())
  with check (public.is_vip());

grant select, insert, update, delete on public.hub_events to authenticated;
grant select, insert, update, delete on public.hub_event_rsvps to authenticated;
grant select, insert on public.dm_threads to authenticated;
grant select, insert, update on public.dm_thread_members to authenticated;
grant select, insert on public.dm_messages to authenticated;
grant select, insert, update on public.hub_notifications to authenticated;
grant select, insert, delete on public.hub_albums to authenticated;
grant select, insert, delete on public.hub_album_photos to authenticated;
grant select, insert, delete on public.hub_polls to authenticated;
grant select, insert on public.hub_poll_options to authenticated;
grant select, insert, update, delete on public.hub_poll_votes to authenticated;
