-- Harden VIP pin updates, VIP delete, signup PENDING, tag ACL

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
  if auth.uid() is null then
    return new;
  end if;

  if new.author_id = auth.uid() then
    if new.author_id is distinct from old.author_id then
      raise exception 'Cannot reassign post authorship';
    end if;
    return new;
  end if;

  select role into actor_role from public.profiles where id = auth.uid();
  if actor_role not in ('president', 'vip') then
    raise exception 'Not authorized to update this post';
  end if;

  if new.body is distinct from old.body
     or new.image_path is distinct from old.image_path
     or new.chapter is distinct from old.chapter
     or new.author_id is distinct from old.author_id then
    raise exception 'VIP may only pin or unpin posts';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_chapter_post_updates on public.chapter_posts;
create trigger protect_chapter_post_updates
  before update on public.chapter_posts
  for each row execute function public.protect_chapter_post_updates();

drop policy if exists posts_delete_vip on public.chapter_posts;
create policy posts_delete_vip
  on public.chapter_posts for delete to authenticated
  using (public.is_vip());

revoke all on function public.next_membership_tag() from public;
revoke all on function public.next_membership_tag() from anon;
revoke all on function public.next_membership_tag() from authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  insert into public.profiles (id, display_name, chapter, role, title)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(new.email, '@', 1),
      'Member'
    ),
    'PENDING',
    'member',
    ''
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
