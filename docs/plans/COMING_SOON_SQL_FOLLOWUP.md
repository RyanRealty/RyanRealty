# Coming Soon — SQL-layer follow-up (opened 2026-07-21)

The app layer is fixed and gated (G-COMINGSOON, `npm run ci:public-listing-status`).
The public site no longer renders, links, counts, or indexes a Coming Soon listing.
This file tracks what remains **below** the app layer. None of it is currently
rendering Coming Soon to a visitor — each item is a defense-in-depth gap that
could become one.

## Verification of the shipped fix (2026-07-21)

| Check | Result |
|---|---|
| `/homes-for-sale/bend` headline count | `1,284` |
| `listing_tile_mv` Bend `Active + Active Under Contract` | `1,284` ✓ |
| Same, with Coming Soon (pre-fix behavior) | `1,303` (19 Coming Soon suppressed) |
| `/listing/<coming-soon-key>` | renders the 404 page, address absent |
| `/listing/<active-key>` (control) | renders normally |
| `?statusFilter=coming_soon` / `=all` / `?includeClosed=1` | 0 Coming Soon keys in DOM |
| Live Coming Soon rows in feed | 51 total (`listings`), 51 in each public MV |

## Open items

### 1. `search_listings_advanced` still accepts `p_status_filter = 'coming_soon'`
- Latest def: `supabase/migrations/20260707110000_advanced_search_neighborhood_slug_fast.sql`
- The anon key can execute this RPC directly (outside the site) and request Coming Soon.
- App layer no longer passes it: `getListingsAdvanced` dropped `coming_soon` from
  `validStatus`, and the public search page narrows to `PUBLIC_SEARCH_STATUS_FILTERS`.
- **Fix:** drop the `coming_soon` branch from the RPC body in a new migration.

### 2. Public MVs still materialize Coming Soon rows
- `listing_tile_mv`, `listing_search_mv` (51 rows each), `listing_boundary_xref_mv`.
- Every app read now filters them out, so this is storage, not exposure — but a new
  query that forgets the filter would leak again.
- **Fix (careful):** excluding at MV-build time is the strongest guarantee. Note the
  refresh-timeout history (`listing_tile_mv` outgrew the 300s statement timeout and
  went 8 days stale silently, now pg_cron 900s + health alarm). Rebuild deliberately,
  not during an incident.

### 3. `listing_boundary_xref_mv` is `GRANT SELECT`-ed to `anon` with no row filter
- `supabase/migrations/20260529020000_listing_boundary_xref_mv.sql:58`
- Contains Coming Soon + Pending rows (listing_key, lat/lng, list_price, status).
- The `listings_in_boundary` RPC that consumes it correctly filters to Active, but the
  table grant bypasses the RPC entirely.
- **Fix:** revoke the direct grant, or add an RLS-equivalent filtered view.

### 4. `geo_snapshot_mv` bakes Coming Soon into public aggregate counts
- `supabase/migrations/20260708090000_geo_snapshot_mv_sfr_medians.sql`
- `active_sfr_count`, `active_all_count`, `median_list_price` all use
  `WHERE "StandardStatus" IN ('Active', 'Coming Soon')`.
- These are public numbers on geo pages. A count that includes listings we may not
  show is both a compliance smell and a §0 data-accuracy problem.
- **Fix:** drop Coming Soon from the predicate and rebuild.

### 5. `listings` RLS is `USING (true)` for `anon`
- `supabase/migrations/20260309100013_013_rls_policies.sql:44`
- No status predicate at all — every status is readable via direct PostgREST.
- This is broader than Coming Soon (Closed/Withdrawn/Expired are equally exposed) and
  predates this incident. Worth a dedicated review.

## Separate open question (not a Coming Soon issue)

Public predicates historically treated a **null** `StandardStatus` as displayable
(`StandardStatus.is.null` branch, and `isActiveStatus('')` returning true). The
2026-07-21 fix deliberately preserved that behavior so the Coming Soon change had
exactly one observable effect. Whether a status-less row should render publicly is
worth deciding on its own.
