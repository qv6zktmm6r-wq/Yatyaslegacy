-- Block Hub auth.users inserts unless email+name match an unclaimed verified_members row.
-- Paid entrance (or Board roster) → verified_members → then create login.

create or replace function public.roster_allows_signup(
  p_email text,
  p_first_name text,
  p_last_name text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
declare
  email_n text := lower(trim(coalesce(p_email, '')));
  fn text := public.normalize_person_name(p_first_name);
  ln text := public.normalize_person_name(p_last_name);
begin
  if email_n = '' or position('@' in email_n) = 0 or fn = '' or ln = '' then
    return false;
  end if;

  return exists (
    select 1
    from public.verified_members vm
    where vm.email_norm = email_n
      and vm.first_name_norm = fn
      and vm.last_name_norm = ln
      and vm.claimed_user_id is null
      and vm.membership_tag is not null
  );
end;
$$;

revoke all on function public.roster_allows_signup(text, text, text)
  from public, anon, authenticated;

create or replace function public.enforce_member_signup()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  fn text := trim(coalesce(new.raw_user_meta_data ->> 'first_name', ''));
  ln text := trim(coalesce(new.raw_user_meta_data ->> 'last_name', ''));
begin
  if not public.roster_allows_signup(new.email, fn, ln) then
    raise exception 'MEMBERSHIP_REQUIRED'
      using errcode = 'P0001',
            hint = 'Pay First Wave entrance first, then create a Hub login with the same email and name.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_member_signup on auth.users;
create trigger enforce_member_signup
  before insert on auth.users
  for each row execute function public.enforce_member_signup();

-- Version claim_verified_membership in-repo; require confirmed email before tagging.
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
