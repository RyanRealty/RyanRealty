-- 20260712000000_listing_private_redaction.sql
--
-- CRITICAL leak closure (attack finding 2026-07-11, approved by Matt): the anon
-- PostgREST role could read agent-only confidential MLS data straight off
-- public.listings.details — PrivateRemarks (lockbox codes, seller circumstances,
-- agent cell numbers), ShowingInstructions, ShowingPhoneNumber, OccupantName —
-- for ~9,500 active listings and the full historical feed. public.listings has a
-- USING(true) read policy for {anon,authenticated} plus a table-wide column
-- grant, so the listing_search_mv column-grant that hid private_remarks was
-- bypassable: the same data sat unredacted in details.
--
-- Fix: relocate the confidential RETS keys into a SERVICE-ROLE-ONLY table
-- (listing_private) and STRIP them from details. Public reads of details keep
-- working (no public surface reads these keys — verified); the admin remarks
-- search reads listing_private via the MV (repointed in 20260712010000).
--
-- The historical strip is a large write, so it runs in PK-cursor batches via
-- rr_redact_listings() (each batch is an index-ordered scan, not a full jsonb
-- scan) driven from the app session. The sync mapper (lib/listing-mapper.ts)
-- strips + diverts on every future write so nothing re-leaks.
--
-- PROD APPLY NOTE (2026-07-12): table + function applied to hosted
-- dwvlophlbvvygjfxcrhm; the batched sweep is run separately in-session.

-- ── Service-role-only storage for the diverted confidential keys ─────────────
CREATE TABLE IF NOT EXISTS public.listing_private (
  listing_key text PRIMARY KEY,
  private_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Deny-by-default: RLS on with NO policy => invisible to anon/authenticated
-- through PostgREST. Only the service role (cron + guarded admin actions) reads
-- it; RLS does not apply to the service role's bypass, and the explicit grants
-- below make the intent unmistakable.
ALTER TABLE public.listing_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_private FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listing_private TO service_role;

COMMENT ON TABLE public.listing_private IS
  'Agent-only confidential MLS fields (PrivateRemarks, ShowingInstructions, ShowingPhoneNumber, OccupantName, …) diverted out of the anon-readable listings.details. Service role only. Populated by the sync mapper + rr_redact_listings().';

-- ── The confidential key set (single source of truth) ───────────────────────
CREATE OR REPLACE FUNCTION public.rr_private_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'PrivateRemarks', 'PrivateOfficeRemarks', 'ShowingInstructions',
    'ShowingContactName', 'ShowingContactPhone', 'ShowingPhoneNumber',
    'OwnerName', 'OwnerPhone', 'OccupantName', 'OccupantPhone',
    'ContingencyRemarks'
  ]
$$;

-- ── Batched redactor: divert present keys, strip from details ────────────────
-- PK-cursor batches (WHERE "ListingKey" > p_after ORDER BY "ListingKey") ride
-- the unique index, so each call is fast regardless of table size. Returns the
-- last key seen + counts; the caller loops until scanned = 0.
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

  INSERT INTO public.listing_private (listing_key, private_data, updated_at)
  SELECT k, jsonb_strip_nulls(jsonb_build_object(
      'PrivateRemarks',       nullif(details->>'PrivateRemarks',''),
      'PrivateOfficeRemarks', nullif(details->>'PrivateOfficeRemarks',''),
      'ShowingInstructions',  nullif(details->>'ShowingInstructions',''),
      'ShowingContactName',   nullif(details->>'ShowingContactName',''),
      'ShowingContactPhone',  nullif(details->>'ShowingContactPhone',''),
      'ShowingPhoneNumber',   nullif(details->>'ShowingPhoneNumber',''),
      'OwnerName',            nullif(details->>'OwnerName',''),
      'OwnerPhone',           nullif(details->>'OwnerPhone',''),
      'OccupantName',         nullif(details->>'OccupantName',''),
      'OccupantPhone',        nullif(details->>'OccupantPhone',''),
      'ContingencyRemarks',   nullif(details->>'ContingencyRemarks','')
  )), now()
  FROM _batch
  WHERE details ?| keys
  ON CONFLICT (listing_key) DO UPDATE
    SET private_data = EXCLUDED.private_data, updated_at = now();

  UPDATE public.listings l
  SET details = l.details
      - 'PrivateRemarks' - 'PrivateOfficeRemarks' - 'ShowingInstructions'
      - 'ShowingContactName' - 'ShowingContactPhone' - 'ShowingPhoneNumber'
      - 'OwnerName' - 'OwnerPhone' - 'OccupantName' - 'OccupantPhone'
      - 'ContingencyRemarks'
  FROM _batch b
  WHERE b.k = l."ListingKey" AND l.details ?| keys;
  GET DIAGNOSTICS redacted = ROW_COUNT;

  RETURN NEXT;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.rr_redact_listings(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rr_redact_listings(text, int) TO service_role;
