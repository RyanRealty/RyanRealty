-- 20260730010000_rr_private_keys_customfields.sql
--
-- CustomFields privacy extension (search plan Phase 1.2, 2026-07-29).
--
-- The listing sync now requests `_expand=CustomFields` (the full Flexmls field
-- dictionary) and merges the flattened public CF fields into the anon-readable
-- listings.details. The CF payload ALSO carries agent-only confidential data,
-- verified live 2026-07-29 with our credentials:
--   "Owner Name", "Occupant Name", "Phone to Show", "Phone to Show Number",
--   "Preferred Escrow Company & Officer"
-- These are the Flexmls SPACED spellings, distinct from the RESO camelCase
-- spellings already covered by migration 20260712000000. This migration keeps
-- the SQL-side redaction in lockstep with PRIVATE_DETAIL_KEYS in
-- lib/listing-mapper.ts (the TS source of truth):
--
--   1. rr_private_keys() gains the 5 CF spellings (11 -> 16 keys).
--   2. rr_redact_listings() is rewritten to derive EVERY key list from
--      rr_private_keys() dynamically (the 20260712000000 version hardcoded the
--      11 keys in jsonb_build_object and the details subtraction, so a
--      rr_private_keys() change alone would NOT have redacted the new keys).
--      Future key additions now only touch rr_private_keys() + the TS constant.
--   3. The private upsert now MERGES into existing private_data (||) instead of
--      replacing it: a redact pass over a details row carrying only one
--      spelling family must not wipe keys the sync already diverted.
--
-- Masked values ("********") and empty strings are never diverted, matching
-- extractPrivateDetails() in the mapper.

-- ── The confidential key set (single source of truth, SQL mirror) ────────────
CREATE OR REPLACE FUNCTION public.rr_private_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    -- RESO StandardFields spellings (20260712000000)
    'PrivateRemarks', 'PrivateOfficeRemarks', 'ShowingInstructions',
    'ShowingContactName', 'ShowingContactPhone', 'ShowingPhoneNumber',
    'OwnerName', 'OwnerPhone', 'OccupantName', 'OccupantPhone',
    'ContingencyRemarks',
    -- Flexmls CustomFields spellings (this migration)
    'Owner Name', 'Occupant Name', 'Phone to Show', 'Phone to Show Number',
    'Preferred Escrow Company & Officer'
  ]
$$;

-- ── Batched redactor, now fully driven by rr_private_keys() ──────────────────
-- Same PK-cursor batching contract as 20260712000000: index-ordered scan from
-- p_after, returns (last_key, scanned, redacted); caller loops until scanned=0.
CREATE OR REPLACE FUNCTION public.rr_redact_listings(p_after text, p_limit int)
RETURNS TABLE(last_key text, scanned int, redacted int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET statement_timeout TO '55s'
AS $function$
DECLARE
  keys text[] := public.rr_private_keys();
BEGIN
  CREATE TEMP TABLE _batch ON COMMIT DROP AS
    SELECT "ListingKey" AS k, details
    FROM public.listings
    WHERE "ListingKey" > p_after
    ORDER BY "ListingKey"
    LIMIT p_limit;

  SELECT max(k), count(*) INTO last_key, scanned FROM _batch;

  -- Divert every present, non-empty, non-masked confidential key. Merge (||)
  -- so keys diverted by an earlier pass or by the sync are preserved.
  INSERT INTO public.listing_private (listing_key, private_data, updated_at)
  SELECT b.k, priv.data, now()
  FROM _batch b
  CROSS JOIN LATERAL (
    SELECT jsonb_object_agg(key, b.details->key) AS data
    FROM unnest(keys) AS key
    WHERE b.details ? key
      AND nullif(b.details->>key, '') IS NOT NULL
      AND b.details->>key !~ '^\*+$'
  ) priv
  WHERE b.details ?| keys AND priv.data IS NOT NULL
  ON CONFLICT (listing_key) DO UPDATE
    SET private_data = public.listing_private.private_data || EXCLUDED.private_data,
        updated_at = now();

  -- Strip ALL confidential keys from the anon-readable details (jsonb - text[]).
  UPDATE public.listings l
  SET details = l.details - keys
  FROM _batch b
  WHERE b.k = l."ListingKey" AND l.details ?| keys;
  GET DIAGNOSTICS redacted = ROW_COUNT;

  RETURN NEXT;
END
$function$;

-- Grants persist across CREATE OR REPLACE, restated for auditability
-- (reference: SECURITY DEFINER RPC grant lockdown).
REVOKE EXECUTE ON FUNCTION public.rr_private_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rr_private_keys() TO service_role;
REVOKE EXECUTE ON FUNCTION public.rr_redact_listings(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rr_redact_listings(text, int) TO service_role;
