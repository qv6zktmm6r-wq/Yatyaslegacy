-- Board-approved organization sponsors for the public logo wall.
create table if not exists public.association_sponsors (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null check (char_length(trim(organization_name)) between 1 and 160),
  contact_name text,
  contact_email text,
  website_url text,
  logo_url text,
  interest_type text,
  support_focus text,
  gift_range text,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'archived')),
  display_order int not null default 100,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists association_sponsors_status_order_idx
  on public.association_sponsors (status, display_order, created_at);

alter table public.association_sponsors enable row level security;

drop policy if exists association_sponsors_public_select on public.association_sponsors;
create policy association_sponsors_public_select
  on public.association_sponsors for select to anon, authenticated
  using (status = 'approved' and logo_url is not null and length(trim(logo_url)) > 0);

drop policy if exists association_sponsors_vip_all on public.association_sponsors;
create policy association_sponsors_vip_all
  on public.association_sponsors for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('president', 'vip')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('president', 'vip')
    )
  );

grant select on public.association_sponsors to anon, authenticated;
grant insert, update, delete on public.association_sponsors to authenticated;

create or replace function public.touch_association_sponsors_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists association_sponsors_touch on public.association_sponsors;
create trigger association_sponsors_touch
  before update on public.association_sponsors
  for each row execute function public.touch_association_sponsors_updated_at();
