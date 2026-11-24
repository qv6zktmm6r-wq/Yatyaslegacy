-- FW-001 is issued/claimed; keep board holds on FW-002 through FW-007 only.
delete from public.hub_reserved_membership_numbers
where tag_prefix = 'FW'
  and tag_number = 1;
