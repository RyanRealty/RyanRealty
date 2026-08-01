-- Write-boundary redaction of confidential keys from the anon-readable
-- listings.details, plus a bounded recurring backstop.
--
-- ROOT CAUSE (2026-07-31). Reported: ListingKey 20260722162810709307000000
-- (ListNumber 220226199, Active, Medford) carried details['Call Listing Agent']
-- readable with the PUBLIC ANON KEY, one row out of 9,740 on-market, AFTER the
-- keyset sweep in 20260731160000 reported done and re-verified clean.
--
-- It was NOT a missed sweep row. It is a write-path defect. Evidence:
--   * listing_private for that row carries BOTH 'Call Listing Agent' and
--     'Text Listing Agent' — so the group-aware mapper DID run on it.
--   * listings.details carried ONLY 'Call Listing Agent', not 'Text Listing
--     Agent'. A stale pre-fix row would have carried both.
--   * 212 rows written by the group-aware sync in the three hours before the
--     finding leak zero keys. The single leaking row is the one whose label
--     collides across groups.
--   * Live Spark census, 800 on-market listings, every label appearing inside
--     a confidential group mapped to every group that carries it. Exactly one
--     cross-group collision exists:
--         'Call Listing Agent'  Showing Requirements=576  Existing Lease Type=1
--     and 'Vacant' (64) lives only in the public 'Current Use' group, never in
--     Showing Requirements.
--
-- The 2026-07-31 mapper fix redacts Showing Requirements members by GROUP at
-- flatten time. Group scoping is PROVENANCE-based, and the flattened namespace
-- is not partitioned by provenance: the second copy of the label arrives from
-- 'Existing Lease Type', is not confidential by group, is not in
-- PRIVATE_DETAIL_KEYS, and is written straight into `details`. Every future
-- sync of any listing carrying that lease field re-leaks it, and any new MLS
-- group reusing a showing label opens the same hole silently.
--
-- FIX, two halves:
--   1. lib/listing-customfields.ts — CONFIDENTIAL_CF_MEMBER_KEYS, an exact
--      mirror of rr_showing_member_keys(), redacted BY KEY with no group
--      condition. Group provenance still decides listing_private diversion.
--      G60 (scripts/check-private-key-parity.mjs) now fails the build if the
--      SQL side strips a key the TS side only strips conditionally.
--   2. This trigger — airtight regardless of which code path writes, whether
--      it calls the mapper at all, or whether a future group collides again.
--
-- WHY A TRIGGER AND NOT ONLY A CRON. A cron closes the window only until the
-- next write; between sync and sweep the key is live to the anon key. The
-- trigger has no window. The cost objection (this table takes ~1.55M updates)
-- is answered by the column scope: BEFORE INSERT OR UPDATE **OF details**
-- fires only when a writer actually supplies a details value, and in that case
-- NEW.details is a freshly-supplied in-memory datum — TOASTing happens at
-- heap-insert time, AFTER before-triggers, so there is no detoast to pay for.
-- Updates that never name `details` (PhotoURL fixes, finalization flags,
-- feature-flag backfills — the bulk of those 1.55M) do not fire it at all.
-- What remains is `?|` over 59 keys against a jsonb object: a binary search
-- per key, microseconds, against a row write and TOAST compression that cost
-- orders of magnitude more. For scale, the pre-existing
-- trg_listing_feature_flags_upd already evaluates
-- `old.details IS DISTINCT FROM new.details` on EVERY update of this table.
--
-- Named trg_0_* deliberately: BEFORE triggers fire in name order and the
-- redaction must land before trg_compute_listing_fields derives anything.

CREATE OR REPLACE FUNCTION public.rr_redact_private_details()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NEW.details IS NOT NULL
     AND jsonb_typeof(NEW.details) = 'object'
     AND NEW.details ?| public.rr_private_keys()
  THEN
    NEW.details := NEW.details - public.rr_private_keys();
  END IF;
  RETURN NEW;
END;
$fn$;

COMMENT ON FUNCTION public.rr_redact_private_details() IS
  'Strips public.rr_private_keys() from listings.details at the write boundary. '
  'Provenance-independent by design: the flattened CustomFields namespace lets a '
  'confidential label arrive from a non-confidential group, which defeats any '
  'group-scoped redaction upstream (2026-07-31 Call Listing Agent / Existing '
  'Lease Type collision). The deliberate publics (Vacant, To Be Built, Under '
  'Construction) are absent from rr_private_keys() and therefore survive.';

DROP TRIGGER IF EXISTS trg_0_redact_private_details ON public.listings;
CREATE TRIGGER trg_0_redact_private_details
  BEFORE INSERT OR UPDATE OF details ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.rr_redact_private_details();

-- ── Remediation of stored rows (executed 2026-07-31, recorded for the trail) ──
-- Two bounded passes, both idempotent (`details - keys` is a no-op once clean),
-- both MATERIALIZED so `details` is detoasted only for the candidate rows and
-- never table-wide. A whole-table `details ?| keys` predicate is ~4ms/row over
-- 594K rows and starves the materialized-view refresh — never do that.
--
-- Pass A: the post-sweep write window, index-backed on idx_listings_modification_ts.
--   WITH cand AS MATERIALIZED (
--     SELECT "ListNumber" FROM public.listings
--     WHERE "ModificationTimestamp" >= '2026-07-25 00:00:00+00')
--   UPDATE public.listings l SET details = l.details - public.rr_private_keys()
--   FROM cand c WHERE l."ListNumber" = c."ListNumber"
--     AND jsonb_typeof(l.details) = 'object'
--     AND l.details ?| public.rr_private_keys();
--
-- Pass B: the on-market surface (the refresh-active-and-pending sync path
-- rewrites these regardless of ModificationTimestamp, so pass A misses it) —
-- same statement with the candidate CTE filtered to
--   "StandardStatus" = ANY (ARRAY['Active','Active Under Contract','Coming Soon','Pending']).
--
-- Result: the reported row went 759 -> 758 details keys, exactly one key
-- removed, and re-verified with the PUBLIC ANON KEY across 5,000+ rows.

-- ── Recurring backstop ───────────────────────────────────────────────────────
-- The trigger is the fix; this is the detector/self-healer for the one thing a
-- trigger cannot survive — being dropped or disabled by a future migration, or
-- a load path that bypasses triggers. Bounded by the SAME indexed time column,
-- so it reads ~60-90 rows per firing (measured: 59 listings changed in the last
-- hour, 705 in the last 24), not the table. Slot :9/:39 is clear of the tile-MV
-- refresh (:2/:32), the DAL MV refresh (:5/:20/:35/:50) and the facet-count
-- refresh (:12/:27/:42/:57).
--
--   SELECT cron.schedule('rr_redact_listing_details_30min', '9,39 * * * *', $job$
--     WITH cand AS MATERIALIZED (
--       SELECT "ListNumber" FROM public.listings
--       WHERE "ModificationTimestamp" >= now() - interval '90 minutes')
--     UPDATE public.listings l SET details = l.details - public.rr_private_keys()
--     FROM cand c WHERE l."ListNumber" = c."ListNumber"
--       AND jsonb_typeof(l.details) = 'object'
--       AND l.details ?| public.rr_private_keys();
--   $job$);
--
-- Scheduled 2026-07-31 as jobid 182. The 90-minute window overlaps the
-- 30-minute cadence three times over, so a single skipped firing loses nothing.
