-- Security hardening for community/ops (DM isolation, notifications, polls, announcements)

-- DMs: only get_or_create_dm may create threads/memberships
drop policy if exists dm_threads_insert on public.dm_threads;
drop policy if exists dm_members_insert on public.dm_thread_members;
revoke insert on public.dm_threads from authenticated;
revoke insert on public.dm_thread_members from authenticated;

-- Notifications: RPC-only inserts
drop policy if exists notifications_insert_auth on public.hub_notifications;
revoke insert on public.hub_notifications from authenticated;

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
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor mismatch';
  end if;
  if p_user is null or p_user = p_actor then
    return;
  end if;
  if p_kind not in (
    'comment', 'reaction', 'mention', 'rsvp', 'dm', 'announcement',
    'event', 'poll', 'moderation', 'welcome'
  ) then
    raise exception 'Invalid kind';
  end if;
  insert into public.hub_notifications (user_id, actor_id, kind, title, body, link)
  values (
    p_user,
    p_actor,
    p_kind,
    left(coalesce(p_title, ''), 160),
    left(coalesce(p_body, ''), 500),
    left(coalesce(p_link, ''), 300)
  );
end;
$$;

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
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_actor is distinct from auth.uid() then
    raise exception 'Actor mismatch';
  end if;
  if p_text is null then
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
      perform public.notify_member(
        target, p_actor, coalesce(p_kind, 'mention'),
        coalesce(p_title, 'Mention'), left(p_text, 200), coalesce(p_link, '')
      );
      n := n + 1;
    end if;
  end loop;

  return n;
end;
$$;

-- Reports: VIP updates only via resolve_post_report
drop policy if exists reports_update_vip on public.chapter_post_reports;

-- Poll votes: option must belong to poll
drop policy if exists poll_votes_insert on public.hub_poll_votes;
create policy poll_votes_insert on public.hub_poll_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_approved_member()
    and exists (
      select 1 from public.hub_poll_options o
      where o.id = option_id and o.poll_id = poll_id
    )
  );

drop policy if exists poll_votes_update on public.hub_poll_votes;
create policy poll_votes_update on public.hub_poll_votes for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.hub_poll_options o
      where o.id = option_id and o.poll_id = poll_id
    )
  );

-- Events: freeze created_by on update
create or replace function public.protect_hub_event_updates()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Cannot reassign event creator';
  end if;
  return new;
end;
$$;

drop trigger if exists hub_events_protect on public.hub_events;
create trigger hub_events_protect
  before update on public.hub_events
  for each row execute function public.protect_hub_event_updates();

-- Announcements: block non-VIP insert of is_announcement
create or replace function public.protect_chapter_post_inserts()
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
  if new.is_announcement and coalesce(actor_role, 'member') not in ('vip', 'president') then
    raise exception 'Only Board / VIP can create announcements';
  end if;
  if new.is_announcement then
    new.pinned := true;
    new.pinned_at := coalesce(new.pinned_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists chapter_posts_protect_insert on public.chapter_posts;
create trigger chapter_posts_protect_insert
  before insert on public.chapter_posts
  for each row execute function public.protect_chapter_post_inserts();

-- Storage: approved members can read post-images (fix legacy CA chapter gate if present)
drop policy if exists "post_images_select_ca" on storage.objects;
drop policy if exists post_images_select_ca on storage.objects;
drop policy if exists post_images_select_members on storage.objects;
create policy post_images_select_members
  on storage.objects for select to authenticated
  using (
    bucket_id = 'post-images'
    and public.is_approved_member()
  );

-- Revoke anon/public execute on SECURITY DEFINER RPCs (authenticated only where needed)
revoke execute on function public.get_or_create_dm(uuid) from anon, public;
revoke execute on function public.is_dm_member(uuid) from anon, public;
revoke execute on function public.notify_member(uuid, uuid, text, text, text, text) from anon, public;
revoke execute on function public.notify_mentions(text, uuid, text, text, text) from anon, public;
revoke execute on function public.resolve_post_report(uuid, text, text) from anon, public;
revoke execute on function public.protect_chapter_post_inserts() from anon, public, authenticated;
revoke execute on function public.protect_chapter_post_updates() from anon, public, authenticated;
revoke execute on function public.protect_hub_event_updates() from anon, public, authenticated;
revoke execute on function public.touch_dm_thread() from anon, public, authenticated;
grant execute on function public.get_or_create_dm(uuid) to authenticated;
grant execute on function public.is_dm_member(uuid) to authenticated;
grant execute on function public.notify_member(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function public.notify_mentions(text, uuid, text, text, text) to authenticated;
grant execute on function public.resolve_post_report(uuid, text, text) to authenticated;
