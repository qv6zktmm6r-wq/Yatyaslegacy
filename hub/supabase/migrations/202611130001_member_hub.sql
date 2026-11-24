-- YAT-YAS Association Member Hub (CA chapter MVP)
-- Backend project: YATYAS Association (tfavgqqqagcqhfeeutzc)

create extension if not exists "pgcrypto";

-- Profiles (authorization data lives here — not in user_metadata)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  chapter text not null default 'CA'
    check (chapter in ('CA', 'PENDING')),
  bio text not null default '',
  branch text not null default '',
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_chapter_idx on public.profiles (chapter);

-- Chapter posts (Facebook-like feed)
create table if not exists public.chapter_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  chapter text not null default 'CA'
    check (chapter in ('CA')),
  body text not null check (char_length(trim(body)) between 1 and 4000),
  image_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chapter_posts_chapter_created_idx
  on public.chapter_posts (chapter, created_at desc);

-- Soft reactions on posts
create table if not exists public.chapter_post_reactions (
  post_id uuid not null references public.chapter_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null default 'like' check (reaction in ('like')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Chapter chat messages
create table if not exists public.chapter_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  chapter text not null default 'CA'
    check (chapter in ('CA')),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists chapter_messages_chapter_created_idx
  on public.chapter_messages (chapter, created_at desc);

-- Auto profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists chapter_posts_set_updated_at on public.chapter_posts;
create trigger chapter_posts_set_updated_at
  before update on public.chapter_posts
  for each row execute function public.set_updated_at();

-- Helper: current user's chapter (from profiles, not JWT user_metadata)
create or replace function public.current_chapter()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select chapter from public.profiles where id = (select auth.uid());
$$;

revoke all on function public.current_chapter() from public;
grant execute on function public.current_chapter() to authenticated;

-- RLS
alter table public.profiles enable row level security;
alter table public.chapter_posts enable row level security;
alter table public.chapter_post_reactions enable row level security;
alter table public.chapter_messages enable row level security;

-- Profiles: CA members see CA + own; users update own
create policy "profiles_select_chapter"
  on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (
      chapter = 'CA'
      and public.current_chapter() = 'CA'
    )
  );

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and chapter in ('CA', 'PENDING')
  );

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));

-- Posts: CA chapter only
create policy "posts_select_ca"
  on public.chapter_posts for select to authenticated
  using (
    chapter = 'CA'
    and public.current_chapter() = 'CA'
  );

create policy "posts_insert_ca"
  on public.chapter_posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and chapter = 'CA'
    and public.current_chapter() = 'CA'
  );

create policy "posts_update_own"
  on public.chapter_posts for update to authenticated
  using (author_id = (select auth.uid()))
  with check (
    author_id = (select auth.uid())
    and chapter = 'CA'
    and public.current_chapter() = 'CA'
  );

create policy "posts_delete_own"
  on public.chapter_posts for delete to authenticated
  using (author_id = (select auth.uid()));

-- Reactions
create policy "reactions_select_ca"
  on public.chapter_post_reactions for select to authenticated
  using (
    exists (
      select 1 from public.chapter_posts p
      where p.id = post_id
        and p.chapter = 'CA'
        and public.current_chapter() = 'CA'
    )
  );

create policy "reactions_insert_own"
  on public.chapter_post_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.current_chapter() = 'CA'
    and exists (
      select 1 from public.chapter_posts p
      where p.id = post_id and p.chapter = 'CA'
    )
  );

create policy "reactions_delete_own"
  on public.chapter_post_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- Messages
create policy "messages_select_ca"
  on public.chapter_messages for select to authenticated
  using (
    chapter = 'CA'
    and public.current_chapter() = 'CA'
  );

create policy "messages_insert_ca"
  on public.chapter_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and chapter = 'CA'
    and public.current_chapter() = 'CA'
  );

create policy "messages_delete_own"
  on public.chapter_messages for delete to authenticated
  using (author_id = (select auth.uid()));

-- Grants for Data API
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.chapter_posts to authenticated;
grant select, insert, delete on public.chapter_post_reactions to authenticated;
grant select, insert, delete on public.chapter_messages to authenticated;

-- Storage buckets
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'post-images',
    'post-images',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do nothing;

-- Storage policies: path = {user_id}/...
create policy "avatars_select_ca"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.current_chapter() = 'CA'
  );

create policy "avatars_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "post_images_select_ca"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'post-images'
    and public.current_chapter() = 'CA'
  );

create policy "post_images_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "post_images_update_own"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "post_images_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'post-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Realtime for chat + feed
alter publication supabase_realtime add table public.chapter_messages;
alter publication supabase_realtime add table public.chapter_posts;
