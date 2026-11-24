-- Remaining hub recommendations: mutes, shares, home_region, quiet hours

alter table public.profiles
  add column if not exists home_region text not null default '',
  add column if not exists chat_quiet_hours boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_home_region_len;
alter table public.profiles
  add constraint profiles_home_region_len
  check (char_length(home_region) <= 80);

alter table public.chapter_posts
  add column if not exists shared_from_post_id uuid references public.chapter_posts (id) on delete set null;

create table if not exists public.member_mutes (
  muter_id uuid not null references public.profiles (id) on delete cascade,
  muted_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (muter_id, muted_id),
  check (muter_id <> muted_id)
);

alter table public.member_mutes enable row level security;

drop policy if exists mutes_select_own on public.member_mutes;
create policy mutes_select_own
  on public.member_mutes for select to authenticated
  using (muter_id = auth.uid() and public.is_approved_member());

drop policy if exists mutes_insert_own on public.member_mutes;
create policy mutes_insert_own
  on public.member_mutes for insert to authenticated
  with check (
    muter_id = auth.uid()
    and public.is_approved_member()
  );

drop policy if exists mutes_delete_own on public.member_mutes;
create policy mutes_delete_own
  on public.member_mutes for delete to authenticated
  using (muter_id = auth.uid());

grant select, insert, delete on public.member_mutes to authenticated;

alter table public.chapter_post_reactions
  drop constraint if exists chapter_post_reactions_reaction_check;
alter table public.chapter_post_reactions
  add constraint chapter_post_reactions_reaction_check
  check (reaction in ('like', 'fire', 'clap'));
