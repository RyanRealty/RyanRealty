-- crm_geo_backfill_candidates() — set-based resolver for the CRM geo gap.
--
-- Problem (found 2026-07-10): 8,246 of 22,510 active contacts had no
-- neighborhood_slug and most had no subdivision, making them invisible to
-- community smart lists (subdivision-contains, per 593f5fe4) and to
-- neighborhood default subscriptions. The old resolver
-- (scripts/_crm-geo-populate.mjs) read ONLY custom.customSubdivision /
-- customNeighborhood — it never looked at the contact's address, the listings
-- table, or westside_parcels.
--
-- This function computes fill-only candidates from every signal we hold, in
-- confidence order per column:
--   neighborhood_slug: parcel → listing.boundary_neighborhood → point-in-
--     polygon vs boundaries (smallest neighborhood polygon wins, same rule as
--     lookup_address_geo) → subdivision rollup via neighborhood_subdivisions →
--     canonical customNeighborhood match.
--   subdivision: parcel → matched listing's SubdivisionName (most recent
--     listing at the address, per the 6766f4b3 most-recent rule) → humanized
--     customSubdivision label.
--
-- Address matching: crm addresses are full strings ("2305 Ne Wilcox Ave");
-- listings."StreetName" is the BARE name ("Wilcox") — so the join strips the
-- leading number, one direction token, and one trailing suffix token.
-- Measured yield at creation: 1,227 of 1,755 street+city contacts match.
--
-- Fill-only contract: a candidate row NEVER overwrites an existing value —
-- fill_neighborhood_slug / fill_subdivision are NULL when the contact already
-- has that column set. Callers (scripts/crm-geo-backfill.mjs, the
-- crm-geo-resolve cron, crm-e2e-verify coverage check) apply exactly what is
-- returned.

CREATE OR REPLACE FUNCTION public.crm_geo_backfill_candidates()
RETURNS TABLE(
  person_id bigint,
  fill_neighborhood_slug text,
  fill_subdivision text,
  fill_source text
)
LANGUAGE sql STABLE AS $$
WITH targets AS (
  SELECT id,
         neighborhood_slug AS cur_nbhd,
         nullif(trim(coalesce(subdivision, '')), '') AS cur_sub,
         -- Junk sentinels ("N/A", "none") in the free-text field must never
         -- become a subdivision value (smoke test 2026-07-10 caught "N/A").
         CASE WHEN lower(trim(coalesce(custom->>'customSubdivision', ''))) IN ('', 'n/a', 'na', 'none', 'unknown', 'tbd', '-', 'x')
              THEN NULL ELSE trim(custom->>'customSubdivision') END AS customsub,
         nullif(trim(coalesce(custom->>'customNeighborhood', '')), '') AS customnbhd,
         nullif(trim(coalesce(addresses->0->>'street', '')), '') AS street,
         nullif(trim(coalesce(addresses->0->>'city', '')), '') AS city
  FROM public.crm_people
  WHERE NOT deleted
    AND (neighborhood_slug IS NULL OR coalesce(subdivision, '') = '')
),
parcel AS (
  SELECT DISTINCT ON (w.person_id)
         w.person_id, w.neighborhood_slug, w.subdivision
  FROM public.westside_parcels w
  WHERE w.person_id IS NOT NULL
    AND (w.neighborhood_slug IS NOT NULL OR w.subdivision IS NOT NULL)
  -- Prefer the parcel that actually carries geo data, then the address-matched
  -- one (the home they live at) over other owned parcels.
  ORDER BY w.person_id, (w.neighborhood_slug IS NOT NULL) DESC, (w.match_method = 'address') DESC
),
addr AS (
  SELECT t.id,
         split_part(t.street, ' ', 1) AS num,
         trim(regexp_replace(
           regexp_replace(
             lower(substr(t.street, length(split_part(t.street, ' ', 1)) + 2)),
             '^(nw|ne|sw|se|n|s|e|w)\s+', ''),
           '\s+(rd|road|ave|avenue|st|street|dr|drive|ln|lane|loop|pl|place|blvd|ct|court|way|cir|circle|ter|terrace)\.?$', ''
         )) AS bare_name,
         lower(t.city) AS city
  FROM targets t
  WHERE t.street ~ '^\d+\s' AND t.city IS NOT NULL
),
addr_listing_raw AS (
  SELECT DISTINCT ON (a.id)
         a.id,
         l."SubdivisionName" AS sub_name,
         l.boundary_neighborhood AS bn_label,
         l."Latitude" AS lat,
         l."Longitude" AS lon
  FROM addr a
  JOIN public.listings l
    ON l."StreetNumber" = a.num
   AND lower(l."StreetName") = a.bare_name
   AND lower(l."City") = a.city
  ORDER BY a.id, l."ModificationTimestamp" DESC NULLS LAST
),
addr_listing AS (
  -- boundary_neighborhood carries display LABELS ("Summit West", "Outside
  -- City Limits") — resolve to the canonical geo_slug via boundaries.geo_label
  -- and drop sentinels with no boundary row so a label never lands in
  -- crm_people.neighborhood_slug.
  SELECT alr.id, alr.sub_name, alr.lat, alr.lon,
         (SELECT b.geo_slug FROM public.boundaries b
           WHERE b.geo_type = 'neighborhood' AND b.geo_label = alr.bn_label
           LIMIT 1) AS bn
  FROM addr_listing_raw alr
),
addr_spatial AS (
  SELECT al.id,
         (SELECT b.geo_slug FROM public.boundaries b
           WHERE b.geo_type = 'neighborhood'
             AND ST_Contains(b.polygon, ST_SetSRID(ST_MakePoint(al.lon, al.lat), 4326))
           ORDER BY ST_Area(b.polygon) ASC LIMIT 1) AS nbhd
  FROM addr_listing al
  WHERE al.lat IS NOT NULL AND al.lon IS NOT NULL AND al.bn IS NULL
),
vocab AS (
  SELECT DISTINCT geo_slug
  FROM public.boundaries
  WHERE geo_type IN ('neighborhood', 'community')
),
custom_sig AS (
  SELECT t.id,
         regexp_replace(regexp_replace(lower(coalesce(t.customsub, t.cur_sub)), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') AS sig
  FROM targets t
  WHERE t.cur_nbhd IS NULL AND coalesce(t.customsub, t.cur_sub) IS NOT NULL
),
custom_sig2 AS (
  SELECT id, sig,
         regexp_replace(regexp_replace(sig, '-(phase|ph|phases)(-.*)?$', ''), '-\d+$', '') AS base
  FROM custom_sig
),
ns_norm AS MATERIALIZED (
  -- Normalize the mapping table ONCE. As a correlated subquery this regex ran
  -- per contact (1,453 × 21ms seq scans ≈ 30s — blew the PostgREST statement
  -- timeout); as a materialized hash-join side it runs once.
  SELECT DISTINCT ON (sub_slug) sub_slug, neighborhood_slug
  FROM (
    SELECT regexp_replace(regexp_replace(lower(subdivision_label), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g') AS sub_slug,
           neighborhood_slug
    FROM public.neighborhood_subdivisions
  ) x
),
custom_nbhd AS (
  SELECT cs.id,
         coalesce(v1.geo_slug, v2.geo_slug, ns1.neighborhood_slug, ns2.neighborhood_slug) AS nbhd
  FROM custom_sig2 cs
  LEFT JOIN vocab v1 ON v1.geo_slug = cs.sig
  LEFT JOIN vocab v2 ON v2.geo_slug = cs.base
  LEFT JOIN ns_norm ns1 ON ns1.sub_slug = cs.sig
  LEFT JOIN ns_norm ns2 ON ns2.sub_slug = cs.base
),
field_nbhd AS (
  SELECT t.id, v.geo_slug AS nbhd
  FROM targets t
  JOIN vocab v
    ON v.geo_slug = regexp_replace(regexp_replace(lower(t.customnbhd), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '', 'g')
  WHERE t.cur_nbhd IS NULL AND t.customnbhd IS NOT NULL
),
resolved AS (
  SELECT t.id, t.cur_nbhd, t.cur_sub,
         p.neighborhood_slug AS parcel_nbhd,
         -- Same junk-sentinel guard as customsub: parcel subdivisions and MLS
         -- SubdivisionName can be literally "N/A" (full-apply 2026-07-10
         -- caught one from a listing).
         CASE WHEN lower(trim(coalesce(p.subdivision, ''))) IN ('', 'n/a', 'na', 'none', 'unknown', 'tbd', '-', 'x')
              THEN NULL ELSE trim(p.subdivision) END AS parcel_sub,
         CASE WHEN lower(trim(coalesce(al.sub_name, ''))) IN ('', 'n/a', 'na', 'none', 'unknown', 'tbd', '-', 'x')
              THEN NULL ELSE trim(al.sub_name) END AS sub_name,
         al.bn,
         sp.nbhd AS spatial_nbhd,
         cn.nbhd AS custom_nbhd,
         fn.nbhd AS field_nbhd,
         CASE WHEN t.customsub IS NOT NULL THEN
           -- Slug-shaped values ("hayden-village-phase-iii-07395") become a
           -- spaced label so subdivision-contains smart lists can match them;
           -- a trailing MLS numeric code is dropped. Label-shaped values pass
           -- through untouched.
           CASE WHEN t.customsub ~ '^[a-z0-9-]+$'
             THEN initcap(replace(regexp_replace(t.customsub, '-\d{4,}$', ''), '-', ' '))
             ELSE t.customsub END
         END AS customsub_label
  FROM targets t
  LEFT JOIN parcel p ON p.person_id = t.id
  LEFT JOIN addr_listing al ON al.id = t.id
  LEFT JOIN addr_spatial sp ON sp.id = t.id
  LEFT JOIN custom_nbhd cn ON cn.id = t.id
  LEFT JOIN field_nbhd fn ON fn.id = t.id
)
SELECT id AS person_id,
       CASE WHEN cur_nbhd IS NULL
            THEN coalesce(parcel_nbhd, bn, spatial_nbhd, custom_nbhd, field_nbhd) END AS fill_neighborhood_slug,
       CASE WHEN cur_sub IS NULL
            THEN coalesce(parcel_sub, sub_name, customsub_label) END AS fill_subdivision,
       CASE
         WHEN cur_nbhd IS NULL AND parcel_nbhd IS NOT NULL THEN 'parcel'
         WHEN cur_nbhd IS NULL AND bn IS NOT NULL THEN 'listing-address'
         WHEN cur_nbhd IS NULL AND spatial_nbhd IS NOT NULL THEN 'listing-spatial'
         WHEN cur_nbhd IS NULL AND custom_nbhd IS NOT NULL THEN 'subdivision-rollup'
         WHEN cur_nbhd IS NULL AND field_nbhd IS NOT NULL THEN 'neighborhood-field'
         ELSE 'subdivision-fill'
       END AS fill_source
FROM resolved
WHERE (cur_nbhd IS NULL AND coalesce(parcel_nbhd, bn, spatial_nbhd, custom_nbhd, field_nbhd) IS NOT NULL)
   OR (cur_sub IS NULL AND coalesce(parcel_sub, sub_name, customsub_label) IS NOT NULL)
$$;

-- Service-role only — this walks the whole contact book.
REVOKE EXECUTE ON FUNCTION public.crm_geo_backfill_candidates() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.crm_geo_backfill_candidates() FROM anon;
GRANT EXECUTE ON FUNCTION public.crm_geo_backfill_candidates() TO service_role;

-- Address-lookup index: the candidates function joins ~1,700 normalized CRM
-- addresses against 590K listings on (bare street name, number, city). Without
-- this index that join is a full seq scan and the RPC blows past the
-- PostgREST statement timeout when called by the service role; with it the
-- planner nested-loops ~1,700 index probes. Also serves any address→listing
-- resolution (CMA subject lookup class). Applied CONCURRENTLY in production.
CREATE INDEX IF NOT EXISTS listings_addr_lookup_idx
  ON public.listings (lower("StreetName"), "StreetNumber", lower("City"));
