-- Redact the flattened Showing Requirements MEMBER keys from the anon-readable
-- listings.details, and teach the SQL mirror about them.
--
-- Found by the long-tail census 2026-07-31 and confirmed with the PUBLIC ANON
-- KEY on 400 on-market rows: Call Listing Agent 290, Appointment Only 226,
-- Vacant 63, Pet(s) on Premises 39, Combination Lock Box 10, Security System
-- 10. Same class as the 2026-07-30 leak, one level deeper: the MLS flattens a
-- multi-select GROUP into one boolean per member, and PRIVATE_DETAIL_KEYS only
-- ever held the grouped spellings ('Showing Requirements'), never the members.
-- 'Combination Lock Box' next to a listing address is an access disclosure.
--
-- Scoped by MEMBER LIST, not by blanket label, because the flat namespace
-- collides: 'Vacant' is confidential as an occupancy signal but a legitimate
-- public Current Use value for land, and 'To Be Built' / 'Under Construction'
-- are construction status the MLS files inside this group — a buyer is
-- entitled to both. Those three are deliberately absent below. The TS mapper
-- (lib/listing-customfields.ts) redacts by GROUP at flatten time, which it can
-- do because the group name is still in the payload; stored rows have already
-- lost that provenance, so this pass names the members explicitly.

-- The pre-existing 43-key list, lifted verbatim from the live definition so
-- composition below cannot drift from what shipped.
CREATE OR REPLACE FUNCTION public.rr_private_keys_base()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'PrivateRemarks', 'PrivateOfficeRemarks', 'ShowingInstructions',
    'ShowingContactName', 'ShowingContactPhone', 'ShowingPhoneNumber',
    'OwnerName', 'OwnerPhone', 'OccupantName', 'OccupantPhone',
    'ContingencyRemarks', 'SemiPrivateRemarks',
    'Owner Name', 'Occupant Name', 'Phone to Show', 'Phone to Show Number',
    'Preferred Escrow Company & Officer',
    'Private Remarks', 'Private Office Remarks', 'Showing Instructions',
    'Showing Contact Name', 'Showing Contact Phone', 'Showing Phone Number',
    'Owner Phone', 'Occupant Phone', 'Contingency Remarks',
    'Semi Private Remarks',
    'ShowingRequirements', 'Showing Requirements',
    'ShowingConsiderations', 'Showing Considerations',
    'TenantName', 'Tenant Name',
    'CallOwner', 'Call Owner',
    'LockBoxLocation', 'LockBoxNumber', 'LockBoxSerialNumber',
    'Lock Box Location', 'Lock Box Number', 'Lock Box Serial Number',
    'AccessCode', 'Access Code'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public.rr_showing_member_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    '24 Hour Notice',
    'Appointment Only',
    'Call Listing Agent',
    'Call Owner',
    'Call Tenant',
    'Combination Lock Box',
    'Day Sleeper',
    'Key In Office',
    'Listing Agent Must Accompany',
    'Lockbox',
    'Lockbox CBS Code Required',
    'No Appointment/Call Needed',
    'Pet(s) on Premises',
    'Security System',
    'See Showing Instructions',
    'Text Listing Agent'
  ]::text[];
$$;

-- Fold the members into the canonical private-key list so every existing
-- consumer (rr_redact_listings, the parity gate's SQL side) sees them.
CREATE OR REPLACE FUNCTION public.rr_private_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT public.rr_private_keys_base() || public.rr_showing_member_keys();
$$;

-- Remediation of stored rows (executed 2026-07-31, recorded here for the
-- migration trail; the machinery was torn down after it reported done).
--
-- The obvious single UPDATE cannot work: `details ?| keys` is a sequential
-- scan over 594K rows with TOAST reads, and every channel has a ceiling —
-- the API gateway drops the connection, and pg_cron's role carries a 600s
-- statement_timeout that killed both a plain UPDATE and a DO-block loop.
-- A DO block cannot raise it either: statement_timeout is armed for the
-- top-level statement before set_config runs inside it, so the whole block
-- rolled back at 600s having committed nothing, twice.
--
-- What worked: keyset pagination over the PRIMARY KEY, 40,000 rows per
-- cron firing, each firing a single committing statement, with a cursor
-- table carrying its own done flag. 15 firings, 399 rows cleaned, verified
-- with the PUBLIC ANON KEY across 5,000 rows spanning all five statuses:
-- zero showing-member keys, while 'Vacant' (287) and 'To Be Built' (50)
-- survived untouched — the collision guard held in both directions.
