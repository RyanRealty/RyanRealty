-- crm_stages — canonical pipeline (streamline v2, Phase 3, 2026-07-03).
--
-- Consolidates the 16 legacy stages to the reviewed active pipeline
-- (CRM_STAGES_AUTOMATION_2026-07-03.md). Contacts are remapped to the target
-- stages by scripts/_stage-migration.mjs FIRST; this migration then repositions the
-- targets, adds the new Engaged stage, and DEACTIVATES the now-empty legacy stages
-- (deactivate, never delete — history + any straggler stays resolvable).
--
-- Active pipeline order: Nurture · Engaged · Active Client · Pending · Closed ·
-- Past Client · Sphere · Trash. Segment/realtor identity lives on tags, so realtors
-- (-> Sphere) and the seller farm (-> Nurture) keep their smart lists.

-- New stage: Engaged (the intent phase; entered via a real signal going forward).
insert into public.crm_stages (key, label, position, is_active, is_protected)
values ('Engaged', 'Engaged', 1, true, false)
on conflict (key) do update set is_active = true, position = 1;

-- Reposition + activate the target set.
update public.crm_stages set is_active = true, position = 0 where key = 'Nurture';
update public.crm_stages set is_active = true, position = 2 where key = 'Active Client';
update public.crm_stages set is_active = true, position = 3 where key = 'Pending';
update public.crm_stages set is_active = true, position = 4 where key = 'Closed';
update public.crm_stages set is_active = true, position = 5 where key = 'Past Client';
update public.crm_stages set is_active = true, position = 6 where key = 'Sphere';
update public.crm_stages set is_active = true, position = 7 where key = 'Trash';

-- Deactivate the legacy stages the remap emptied (temperature, Lead, Seller Prospect,
-- Renter, Real Estate Agent, Vendor, Archive). Kept as rows for history.
update public.crm_stages set is_active = false
where key in (
  'Lead', 'Seller Prospect', 'A - Hot 1-3 Months', 'B - Warm 3-6 Months',
  'C - Cold 6+ Months', 'Renter - future buyer', 'Real Estate Agent', 'Vendor', 'Archive'
);
