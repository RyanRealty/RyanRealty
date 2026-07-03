-- crm_saved_views — canonical smart-list rebuild (streamline v2, 2026-07-03).
--
-- After the tag/segment streamline (CRM_STREAMLINE_PLAN_V2_2026-07-03.md), the
-- sidebar lists key on the CANONICAL segment/realtor tags the migration emits.
-- This replaces the SYSTEM view set (owner_email null) with the 12 canonical lists
-- and drops the retired ones (Leads/Hot Prospects/Nurture/Sphere/Seller Prospects/
-- Closed/Realtors/Stay In Touch/Email Activity/IDX Activity/Expired Pipeline/FSBO
-- Pipeline — stage navigation moves to the Stages strip; the intent:* lists broke
-- when those tags were collapsed to segment:*).
--
-- Broker-created private views (owner_email not null) are UNTOUCHED. Idempotent:
-- delete-all-system + insert reproduces the same 12 rows on a re-run.
-- ASTs mirror lib/crm/saved-view-seeds.ts exactly (guarded by saved-view-seeds.test.ts).

delete from public.crm_saved_views where owner_email is null;

insert into public.crm_saved_views (name, description, ast, owner_email, is_shared, is_protected, position)
values
  (
    'Sellers',
    'Seller prospects (the farm).',
    '{"type":"group","op":"and","nodes":[{"field":"tag","op":"has","value":"segment:seller"}]}'::jsonb,
    null, true, true, 0
  ),
  (
    'Buyers',
    'Active and prospective buyers.',
    '{"type":"group","op":"and","nodes":[{"field":"tag","op":"has","value":"segment:buyer"}]}'::jsonb,
    null, true, true, 1
  ),
  (
    'Expired',
    'Expired listings to recover.',
    '{"type":"group","op":"and","nodes":[{"field":"tag","op":"has","value":"segment:expired"}]}'::jsonb,
    null, true, true, 2
  ),
  (
    'FSBO',
    'For-sale-by-owner leads.',
    '{"type":"group","op":"and","nodes":[{"field":"tag","op":"has","value":"segment:fsbo"}]}'::jsonb,
    null, true, true, 3
  ),
  (
    'Out Of Area Home Owners',
    'Own a local property, mail out of the area.',
    '{"type":"group","op":"and","nodes":[{"field":"tag","op":"has","value":"segment:out-of-area"}]}'::jsonb,
    null, true, true, 4
  ),
  (
    'Local Realtors',
    'Central Oregon agents.',
    '{"type":"group","op":"and","nodes":[{"field":"tag","op":"has","value":"realtor:local"}]}'::jsonb,
    null, true, true, 5
  ),
  (
    'Migration Realtors',
    'Feeder-market referral agents.',
    '{"type":"group","op":"and","nodes":[{"field":"tag","op":"has","value":"realtor:migration"}]}'::jsonb,
    null, true, true, 6
  ),
  (
    'Vendors',
    'Your vendor rolodex.',
    '{"type":"group","op":"and","nodes":[{"field":"tag","op":"has","value":"segment:vendor"}]}'::jsonb,
    null, true, true, 7
  ),
  (
    'Active Clients',
    'Clients under active representation.',
    '{"type":"group","op":"and","nodes":[{"field":"stage","value":"Active Client"}]}'::jsonb,
    null, true, true, 8
  ),
  (
    'Past Clients',
    'Closed clients to stay in touch with.',
    '{"type":"group","op":"and","nodes":[{"field":"stage","value":"Past Client"}]}'::jsonb,
    null, true, true, 9
  ),
  (
    'Pending',
    'Transactions in progress.',
    '{"type":"group","op":"and","nodes":[{"field":"stage","value":"Pending"}]}'::jsonb,
    null, true, true, 10
  ),
  (
    'Compliance Blocked',
    'Do-not-contact / hard stop.',
    '{"type":"group","op":"and","nodes":[{"field":"tag","op":"has","value":"compliance:hard-stop"}]}'::jsonb,
    null, true, true, 11
  )
on conflict (name) where owner_email is null do nothing;
