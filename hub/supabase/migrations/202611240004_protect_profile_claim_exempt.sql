-- Attach privilege protection on profiles; allow verified self-claim only.
-- Align claim with roster_allows_signup (require membership_tag).

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

  -- Verified self-claim: PENDING → MEMBER with the roster tag for this email
  if new.id = auth.uid()
     and new.role is not distinct from old.role
     and new.title is not distinct from old.title
     and new.chapter = 'MEMBER'
     and new.membership_tag is not null
     and exists (
       select 1
       from public.verified_members vm
       join auth.users u on lower(u.email) = vm.email_norm
       where u.id = new.id
         and vm.membership_tag = new.membership_tag
         and (vm.claimed_user_id is null or vm.claimed_user_id = new.id)
     )
  then
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

drop trigger if exists protect_profile_privileges on public.profiles;
create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

create or replace function public.claim_verified_membership(
  p_first_name text,
  p_last_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  uid uuid := auth.uid();
  mail text;
  confirmed timestamptz;
  fn text := public.normalize_person_name(p_first_name);
  ln text := public.normalize_person_name(p_last_name);
  row public.verified_members%rowtype;
  prof public.profiles%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select lower(email), email_confirmed_at
    into mail, confirmed
  from auth.users
  where id = uid;

  if mail is null then
    return jsonb_build_object('matched', false, 'reason', 'no_email');
  end if;

  if confirmed is null then
    return jsonb_build_object('matched', false, 'reason', 'email_unconfirmed');
  end if;

  select * into row
  from public.verified_members
  where email_norm = mail
    and first_name_norm = fn
    and last_name_norm = ln
    and membership_tag is not null
    and (claimed_user_id is null or claimed_user_id = uid)
  for update;

  if row.id is null then
    return jsonb_build_object('matched', false, 'reason', 'not_verified');
  end if;

  update public.profiles
  set chapter = 'MEMBER',
      membership_tag = row.membership_tag,
      display_name = row.first_name || ' ' || row.last_name,
      updated_at = now()
  where id = uid
  returning * into prof;

  update public.verified_members
  set claimed_user_id = uid
  where id = row.id;

  return jsonb_build_object(
    'matched', true,
    'membership_tag', row.membership_tag,
    'display_name', prof.display_name,
    'chapter', prof.chapter
  );
end;
$$;

revoke all on function public.claim_verified_membership(text, text) from public;
grant execute on function public.claim_verified_membership(text, text) to authenticated;
