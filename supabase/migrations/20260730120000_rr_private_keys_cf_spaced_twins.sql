-- 20260730120000_rr_private_keys_cf_spaced_twins.sql
--
-- PRIVACY INCIDENT FIX (found + fixed 2026-07-30 by adversarial audit of the
-- search-plan Phase 1 CustomFields ingest, commit deed9e4b).
--
-- The listing sync flattens the Flexmls CustomFields payload using MLS DISPLAY
-- names ("Private Remarks"), while the RESO StandardFields payload uses
-- camelCase ("PrivateRemarks"). Those are DIFFERENT jsonb keys in
-- listings.details. PRIVATE_DETAIL_KEYS / rr_private_keys() carried only the
-- camelCase spellings, so the CF ingest wrote broker-private remarks and
-- showing instructions into the ANON-READABLE listings.details:
--   'Private Remarks'      real values on 1,658 of a 2,000-row on-market sample
--   'Showing Instructions' real values on 1,543 of the same sample
-- Verified reachable with the public anon key (tenant-occupancy notes, showing
-- directions). Same class as the 2026-07-11 attack finding that migration
-- 20260712000000 closed, reopened under a different spelling.
--
-- This migration adds every spaced twin. rr_redact_listings() already derives
-- its key list from rr_private_keys(), so the batched redactor strips the leaked
-- keys out of listings.details and diverts them into listing_private.
--
-- Applied to production 2026-07-30 (via the dashboard SQL channel), then swept
-- with a pg_cron one-shot running rr_redact_listings() to the end of the table.
-- Guarded going forward by scripts/check-private-key-parity.mjs (G58), which
-- fails the build when a camelCase key loses its spaced twin or when this
-- function drifts from the TS constant.

CREATE OR REPLACE FUNCTION public.rr_private_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    -- RESO StandardFields spellings (20260712000000)
    'PrivateRemarks', 'PrivateOfficeRemarks', 'ShowingInstructions',
    'ShowingContactName', 'ShowingContactPhone', 'ShowingPhoneNumber',
    'OwnerName', 'OwnerPhone', 'OccupantName', 'OccupantPhone',
    'ContingencyRemarks', 'SemiPrivateRemarks',
    -- Flexmls CustomFields spellings (20260730010000 + this fix)
    'Owner Name', 'Occupant Name', 'Phone to Show', 'Phone to Show Number',
    'Preferred Escrow Company & Officer',
    'Private Remarks', 'Private Office Remarks', 'Showing Instructions',
    'Showing Contact Name', 'Showing Contact Phone', 'Showing Phone Number',
    'Owner Phone', 'Occupant Phone', 'Contingency Remarks',
    'Semi Private Remarks'
  ]
$$;

REVOKE EXECUTE ON FUNCTION public.rr_private_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rr_private_keys() TO service_role;
