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
