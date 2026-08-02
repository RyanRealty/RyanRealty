-- get_subdivision_status_counts: stop counting Coming Soon as "homes for sale".
--
-- §0 DEFECT, measured 2026-08-02 against the production table.
--
-- The public "Hot communities" cards on /cities/[city] render this function's
-- `active` column as the for-sale count (getHotCommunitiesInCityUncached in
-- app/actions/listings.ts). `LIKE '%coming soon%'` sits in the OR group that
-- defines `active`, and no guard removes it, so pre-marketing listings are
-- counted on a public surface.
--
-- CLAUDE.md is unambiguous that Coming Soon must never render publicly. The
-- application's own fallback path already gets this right and says so in a
-- comment ("Public count — Coming Soon excluded (cannot show it, must not count
-- it)"), applying isPubliclyDisplayableStatus(). But that path only runs when
-- SUPABASE_SERVICE_ROLE_KEY is unset; in production the RPC fast path always
-- wins, so the correct filter never executes.
--
-- MEASURED, Bend, exact counts over the whole table (not a sample):
--   Active                 1272   counted, correctly
--   Coming Soon              16   counted, INCORRECTLY
--   Active Under Contract     9   already excluded by the NOT-guards below
--   deployed `active`      1288
--   correct                1272
--   overcount                16   (+1.3%)
--
-- The fix is one line: the coming-soon OR branch is removed and replaced by an
-- explicit NOT guard alongside the existing four. The OR group is already
-- correctly parenthesised, so the guards bind to the whole chain — 'Active
-- Under Contract' was never miscounted. Everything else about this function,
-- including `pending` and `closed`, is byte-for-byte unchanged, and grants are
-- deliberately untouched (several callers use different clients).
CREATE OR REPLACE FUNCTION get_subdivision_status_counts(p_city text)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(t) ORDER BY (t.active + t.pending) DESC), '[]'::json)
    FROM (
      SELECT
        COALESCE(TRIM("SubdivisionName"), '') AS subdivision_name,
        COUNT(*) FILTER (WHERE
          (
            COALESCE(TRIM("StandardStatus"), '') = ''
            OR LOWER(COALESCE("StandardStatus", '')) LIKE '%active%'
            OR LOWER(COALESCE("StandardStatus", '')) LIKE '%for sale%'
          )
          AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%coming soon%'
          AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%pending%'
          AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%under contract%'
          AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%undercontract%'
          AND LOWER(COALESCE("StandardStatus", '')) NOT LIKE '%contingent%'
        )::int AS active,
        COUNT(*) FILTER (WHERE
          LOWER(COALESCE("StandardStatus", '')) LIKE '%pending%'
          OR LOWER(COALESCE("StandardStatus", '')) LIKE '%under contract%'
          OR LOWER(COALESCE("StandardStatus", '')) LIKE '%undercontract%'
          OR LOWER(COALESCE("StandardStatus", '')) LIKE '%contingent%'
        )::int AS pending,
        COUNT(*) FILTER (WHERE LOWER(COALESCE("StandardStatus", '')) LIKE '%closed%')::int AS closed
      FROM listings
      WHERE TRIM("City") ILIKE TRIM(p_city)
        AND TRIM(COALESCE("SubdivisionName", '')) <> ''
      GROUP BY COALESCE(TRIM("SubdivisionName"), '')
    ) t
  );
END;
$$;
