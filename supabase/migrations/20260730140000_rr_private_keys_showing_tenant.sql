-- 20260730140000_rr_private_keys_showing_tenant.sql
--
-- PRIVACY, SECOND PASS (found 2026-07-30, AFTER 20260730120000 deployed).
--
-- The spaced-twin migration was correct but incomplete. It closed every key
-- that had a camelCase/display-name PAIR. These keys have no twin among the
-- listed ones, so nothing caught them, and they kept flowing into the
-- ANON-READABLE listings.details.
--
-- Re-verified with the PUBLIC ANON KEY against production after 846a9268 was
-- live, reading 400 Active rows (8 pages of 50):
--   ShowingRequirements   399 of 400 rows   appointment-only / call-listing-agent
--                                           / pets-on-premises showing logistics
--   Tenant Name             6 of 400 rows   real occupant names, one a named church
--   Call Owner              2 of 400 rows   routes a buyer around the listing broker
--
-- Tenant Name is the serious one: third-party PII published without the
-- occupant's consent. The other two are agent-only showing logistics under the
-- same MLS rule the existing keys enforce. LockBox* and AccessCode are added
-- pre-emptively — they are property-access credentials, they appeared as keys in
-- the anon read, and they must never carry a value publicly even once.
--
-- rr_redact_listings() derives its key list from rr_private_keys(), so applying
-- this and running the batched redactor strips these out of listings.details and
-- diverts them into the service-role-only listing_private table.
--
-- After applying: run rr_redact_listings() to the end of the table, then
-- re-verify with the anon key. Do not assume the sweep is complete.

CREATE OR REPLACE FUNCTION public.rr_private_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    -- RESO StandardFields spellings (20260712000000)
    'PrivateRemarks', 'PrivateOfficeRemarks', 'ShowingInstructions',
    'ShowingContactName', 'ShowingContactPhone', 'ShowingPhoneNumber',
    'OwnerName', 'OwnerPhone', 'OccupantName', 'OccupantPhone',
    'ContingencyRemarks', 'SemiPrivateRemarks',
    -- Flexmls CustomFields spellings (20260730010000 + 20260730120000)
    'Owner Name', 'Occupant Name', 'Phone to Show', 'Phone to Show Number',
    'Preferred Escrow Company & Officer',
    'Private Remarks', 'Private Office Remarks', 'Showing Instructions',
    'Showing Contact Name', 'Showing Contact Phone', 'Showing Phone Number',
    'Owner Phone', 'Occupant Phone', 'Contingency Remarks',
    'Semi Private Remarks',
    -- Second pass (this migration): no camelCase/display twin, so the
    -- twin-parity rule could not surface them.
    'ShowingRequirements', 'Showing Requirements',
    'ShowingConsiderations', 'Showing Considerations',
    'TenantName', 'Tenant Name',
    'CallOwner', 'Call Owner',
    'LockBoxLocation', 'LockBoxNumber', 'LockBoxSerialNumber',
    'Lock Box Location', 'Lock Box Number', 'Lock Box Serial Number',
    'AccessCode', 'Access Code'
  ]::text[];
$$;
