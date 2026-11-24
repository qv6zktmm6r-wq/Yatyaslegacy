-- Mark FW-002–004 as claimed on the roster (provisional board+ emails until real addresses are set).
-- Release those numbers from board holds; FW-005–007 remain held.

with founder as (
  select created_by as id from public.verified_members where membership_tag = 'FW-001' limit 1
)
insert into public.verified_members (
  email, email_norm, first_name, last_name, first_name_norm, last_name_norm,
  membership_tag, created_by, dues_status
)
select v.email, v.email, v.first_name, v.last_name,
       public.normalize_person_name(v.first_name),
       public.normalize_person_name(v.last_name),
       v.tag, f.id, 'none'
from founder f
cross join (values
  ('board+fw002-jose-guerra@yatyasassociation.com', 'Jose', 'Guerra', 'FW-002'),
  ('board+fw003-fausto-cabrera@yatyasassociation.com', 'Fausto', 'Cabrera', 'FW-003'),
  ('board+fw004-sammy-subnet@yatyasassociation.com', 'Sammy', 'Subnet', 'FW-004')
) as v(email, first_name, last_name, tag)
on conflict (membership_tag) do update
set email = excluded.email,
    email_norm = excluded.email_norm,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    first_name_norm = excluded.first_name_norm,
    last_name_norm = excluded.last_name_norm;

delete from public.hub_reserved_membership_numbers
where tag_prefix = 'FW' and tag_number in (2, 3, 4);
