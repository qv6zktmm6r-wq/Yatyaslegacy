-- Named First Wave board holds (not yet on verified_members until emails exist).
update public.hub_reserved_membership_numbers
set reason = 'Issued hold — Jose Guerra'
where tag_prefix = 'FW' and tag_number = 2;

update public.hub_reserved_membership_numbers
set reason = 'Issued hold — Fausto Cabrera'
where tag_prefix = 'FW' and tag_number = 3;

update public.hub_reserved_membership_numbers
set reason = 'Issued hold — Sammy Subnet'
where tag_prefix = 'FW' and tag_number = 4;
