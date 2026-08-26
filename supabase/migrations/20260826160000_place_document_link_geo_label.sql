-- The plat's LABEL on the link row, so a listing page can resolve its plat
-- without slugifying anything.
--
-- THE PROBLEM THIS FIXES. `listings.boundary_subdivision` holds the plat's
-- `boundaries.geo_label` verbatim — refresh_listing_boundary_tags copies the
-- label and discards the slug. getPlaceDocumentsForListing therefore had to
-- RE-DERIVE the slug by running lib/slug.ts `slugify()` over that label, and
-- that function is not the one that minted `boundaries.geo_slug`. Measured
-- 2026-08-26 over all 3,218 `geo_type='subdivision'` rows: 202 of them (6.3%)
-- do NOT round-trip. Two classes:
--
--   punctuation — geo_slug turns '&' into 'and' and every other non-alphanumeric
--   run into a hyphen; slugify() DELETES them. 'Redmond Vacation Alley Blocks
--   1 & 20' -> geo_slug 'redmond-vacation-alley-blocks-1-and-20', slugify
--   'redmond-vacation-alley-blocks-1-20'. 'B.r.p.p.d.' -> 'b-r-p-p-d' vs
--   'brppd'. 187 plats.
--
--   duplicated labels — the county files more than one plat under one name, so
--   all but one carry a numeric suffix: 'Bend' is `bend`, `bend-05281` AND
--   `bend-16913`. 15 plats.
--
-- AND THE SECOND CLASS IS NOT SAFE, contrary to the comment that stood in
-- getPlaceDocumentsForListing. That comment claimed the bare form a duplicated
-- label slugifies to "is not any plat's slug", so those listings would show
-- nothing. It is the opposite: in all 13 duplicated-label groups ONE row holds
-- the bare slug, so all 15 suffixed plats resolve onto a REAL, DIFFERENT
-- recorded plat. Today only one of the 15 has any published document
-- ('Evergreen Park'), and its collision target happens to be linked to the same
-- instrument, so nothing wrong is on screen — coincidence of the corpus, not a
-- property of the code.
--
-- THE FIX. Carry the label the listing row actually holds. The read matches it
-- directly: no derivation, no second query, and `boundaries` / `place_membership`
-- stay unreadable to anon (place_membership is 2.68M rows and the listing detail
-- page is the highest-traffic public surface in the app — not somewhere to reach
-- for a service-role client).
--
-- Nullable on purpose: the column ships before the backfill, and the read falls
-- back to the slug path for any row that has not been stamped yet.
ALTER TABLE public.place_document_link
  ADD COLUMN IF NOT EXISTS geo_label text;

COMMENT ON COLUMN public.place_document_link.geo_label IS
  'The plat label verbatim from boundaries.geo_label — the same string listings.boundary_subdivision carries. Lets the listing page match its plat by label instead of re-deriving the slug, which fails on 202 of 3,218 plats. Backfilled by scripts/place-documents/backfill-geo-label.mjs; NULL means the slug path still answers for this row.';

-- The read path is "published documents for this plat label".
--
-- Deliberately (geo_type, geo_label) and NOT (geo_type, lower(geo_label)): the
-- only query that motivates this index is issued through PostgREST, which can
-- emit `geo_label = $1` but has no way to emit `lower(geo_label) = $1`, so a
-- lower() expression index could never be reached by the read it exists for.
-- Both sides of the comparison are copies of the same `boundaries.geo_label`
-- string, so equality is exact by construction; a case difference degrades to
-- the case-insensitive slug fallback, which is exactly today's behaviour.
CREATE INDEX IF NOT EXISTS place_document_link_label_idx
  ON public.place_document_link (geo_type, geo_label)
  WHERE status = 'published';
