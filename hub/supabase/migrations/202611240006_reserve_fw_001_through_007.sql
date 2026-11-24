-- First Wave board holds: FW-001 through FW-007 only.
-- Releases FW-008, FW-009, FW-010, and FW-013 for sequential public auto-issue.

delete from public.hub_reserved_membership_numbers
where tag_prefix = 'FW'
  and tag_number in (8, 9, 10, 13);

insert into public.hub_reserved_membership_numbers (tag_prefix, tag_number, reason) values
  ('FW', 1, 'Board / founder held'),
  ('FW', 2, 'Board / founder held'),
  ('FW', 3, 'Board / founder held'),
  ('FW', 4, 'Board reserved'),
  ('FW', 5, 'Board reserved'),
  ('FW', 6, 'Board reserved'),
  ('FW', 7, 'Board reserved')
on conflict (tag_prefix, tag_number) do update
set reason = excluded.reason;
