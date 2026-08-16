-- G3 stage truth: Lead is the inbound entry stage again.
-- Streamline v2 (20260703150000) deactivated Lead and made Nurture position 0.
-- This expand-only change reactivates Lead at position 0 and shifts the living
-- pipeline down by one. No crm_people rows are remapped (not a backfill).

update public.crm_stages set is_active = true, position = 0 where key = 'Lead';
update public.crm_stages set is_active = true, position = 1 where key = 'Nurture';
update public.crm_stages set is_active = true, position = 2 where key = 'Engaged';
update public.crm_stages set is_active = true, position = 3 where key = 'Active Client';
update public.crm_stages set is_active = true, position = 4 where key = 'Pending';
update public.crm_stages set is_active = true, position = 5 where key = 'Closed';
update public.crm_stages set is_active = true, position = 6 where key = 'Past Client';
update public.crm_stages set is_active = true, position = 7 where key = 'Sphere';
update public.crm_stages set is_active = true, position = 8 where key = 'Trash';
