-- Association-wide Member Hub: PENDING | MEMBER (was CA-only)
-- Shared feed/chat room: HUB

alter table public.profiles drop constraint if exists profiles_chapter_check;
update public.profiles set chapter = 'MEMBER' where chapter = 'CA';
alter table public.profiles
  add constraint profiles_chapter_check
  check (chapter in ('PENDING', 'MEMBER'));
alter table public.profiles alter column chapter set default 'PENDING';

alter table public.chapter_posts drop constraint if exists chapter_posts_chapter_check;
update public.chapter_posts set chapter = 'HUB' where chapter = 'CA';
alter table public.chapter_posts
  add constraint chapter_posts_chapter_check
  check (chapter = 'HUB');
alter table public.chapter_posts alter column chapter set default 'HUB';

alter table public.chapter_messages drop constraint if exists chapter_messages_chapter_check;
update public.chapter_messages set chapter = 'HUB' where chapter = 'CA';
alter table public.chapter_messages
  add constraint chapter_messages_chapter_check
  check (chapter = 'HUB');
alter table public.chapter_messages alter column chapter set default 'HUB';

create or replace function public.is_approved_member()
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  ch text;
  r text;
begin
  select chapter, role into ch, r from public.profiles where id = auth.uid();
  if r in ('vip', 'president') then
    return true;
  end if;
  return ch = 'MEMBER';
end;
$$;

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
  set chapter = 'MEMBER',
      membership_tag = tag,
      updated_at = now()
  where id = target_id
  returning * into target;

  return target;
end;
$$;

drop policy if exists profiles_select_chapter on public.profiles;
create policy profiles_select_chapter
  on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or (
      chapter = 'MEMBER'
      and public.is_approved_member()
    )
  );

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_vip())
  with check (
    (id = auth.uid() and chapter in ('PENDING', 'MEMBER'))
    or public.is_vip()
  );

drop policy if exists posts_select_ca on public.chapter_posts;
drop policy if exists posts_select_hub on public.chapter_posts;
create policy posts_select_hub
  on public.chapter_posts for select to authenticated
  using (chapter = 'HUB' and public.is_approved_member());

drop policy if exists posts_insert_ca on public.chapter_posts;
drop policy if exists posts_insert_hub on public.chapter_posts;
create policy posts_insert_hub
  on public.chapter_posts for insert to authenticated
  with check (
    author_id = auth.uid()
    and chapter = 'HUB'
    and public.is_approved_member()
  );

drop policy if exists posts_update_own on public.chapter_posts;
create policy posts_update_own
  on public.chapter_posts for update to authenticated
  using (author_id = auth.uid() or public.is_vip())
  with check (
    chapter = 'HUB'
    and (author_id = auth.uid() or public.is_vip())
  );

drop policy if exists reactions_select_ca on public.chapter_post_reactions;
drop policy if exists reactions_select_hub on public.chapter_post_reactions;
create policy reactions_select_hub
  on public.chapter_post_reactions for select to authenticated
  using (public.is_approved_member());

drop policy if exists reactions_insert_ca on public.chapter_post_reactions;
drop policy if exists reactions_insert_hub on public.chapter_post_reactions;
create policy reactions_insert_hub
  on public.chapter_post_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_approved_member()
    and exists (
      select 1 from public.chapter_posts p
      where p.id = post_id and p.chapter = 'HUB'
    )
  );

drop policy if exists messages_select_ca on public.chapter_messages;
drop policy if exists messages_select_hub on public.chapter_messages;
create policy messages_select_hub
  on public.chapter_messages for select to authenticated
  using (chapter = 'HUB' and public.is_approved_member());

drop policy if exists messages_insert_ca on public.chapter_messages;
drop policy if exists messages_insert_hub on public.chapter_messages;
create policy messages_insert_hub
  on public.chapter_messages for insert to authenticated
  with check (
    author_id = auth.uid()
    and chapter = 'HUB'
    and public.is_approved_member()
  );
