# Coming Soon — full-stack lockdown (2026-07-21)

Coming Soon is an MLS pre-marketing state. It must never reach a public-facing
surface. This documents the complete fix, at both layers, and the proof.

## Why the app-layer fix alone was not enough

The first pass fixed the website. It did not close the real hole.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` ships in the browser bundle. Anyone can copy it
and query PostgREST directly, bypassing every application filter. Verified live
before the database work:

```
GET /rest/v1/listings?StandardStatus=eq.Coming%20Soon   -> 52 rows,
                                                           full address + price
```

| Anon-reachable object | Coming Soon rows exposed |
|---|---|
| `listings` (raw table, ~800 cols) | 52 |
| `listing_tile_mv` | 52 |
| `listing_search_mv` | 52 (via column-level grants) |
| `listing_boundary_xref_mv` | 152 |
| `listing_detail_mv` | 62 |
| `beacon_comparable_listings_v` | 52 |
| `similar_listings_mv` | 582 pairs recommending a Coming Soon listing |
| `search_listings_advanced` RPC | full records incl. photo + lat/long |

## Layer 1 — application (commit a3413aab)

Single source of truth `lib/listing-status-public.ts`; every public predicate
imports from it. Detail page gated in `getListingDetail`'s existing IDX
suppression block (also kills metadata/OG/JSON-LD). `?statusFilter=coming_soon`
sanitized at the entry point. `getListingTiles` `'all'` branch no longer applies
zero status filter. Sitemap, homepage tiles, neighborhood ledger, city and
subdivision counts, video-tour feed, and json-ld all corrected.

Enforced by gate **G-COMINGSOON** (`ci:public-listing-status`, in `ci:gates`).

## Layer 2 — database (migrations 20260721090000 → 20260721093000)

- **`listings`** — the two stacked `USING (true)` policies replaced with one
  that excludes Coming Soon for `anon` + `authenticated`. Safe because every
  admin / broker / sync / prospecting / cron path uses `SUPABASE_SERVICE_ROLE_KEY`
  (audited exhaustively), and `service_role` bypasses RLS. The
  `is_super_admin()` policy is untouched.
- **MVs cannot carry RLS.** `listing_tile_mv`, `listing_search_mv`,
  `listing_boundary_xref_mv`, `similar_listings_mv` each renamed to `<name>_src`
  with a filtered view published under the original name, so every call site and
  SQL function keeps working unchanged. `anon`/`authenticated` revoked on `_src`.
  Refresh functions repointed. No rebuild, no downtime.
- **`listing_search_mv`** — 97 column grants replicated exactly;
  `private_remarks` stays redacted (verified: permission denied).
- **`geo_snapshot_mv`** — Coming Soon sat inside aggregate `FILTER` clauses, so a
  row-filtering view could not fix it. Definition rebuilt. This was also a §0
  data-accuracy bug: public geo counts included listings we cannot show.
- **`listing_detail_mv`, `beacon_comparable_listings_v`** — no application
  reader at all; `anon` revoked outright.
- **`search_listings_advanced`** — dead `coming_soon` branch neutralised.

## Proof (anon key, after)

Every object returns empty or permission denied:

```
listings                     LOCKED (empty)      listing_tile_mv_src           LOCKED (denied)
listing_tile_mv              LOCKED (empty)      listing_search_mv_src         LOCKED (denied)
listing_search_mv            LOCKED (empty)      listing_boundary_xref_mv_src  LOCKED (denied)
listing_boundary_xref_mv     LOCKED (empty)      similar_listings_mv_src       LOCKED (denied)
listing_detail_mv            LOCKED (denied)     beacon_comparable_listings_v  LOCKED (denied)
RPC p_status_filter=coming_soon                  LOCKED (empty)
private_remarks column                           LOCKED (denied)
```

Controls — the site still works, brokers unaffected:

| Check | Result |
|---|---|
| `/homes-for-sale/bend` | 1,283 = DB Active+AUC exactly (19 Coming Soon suppressed) |
| `/homes-for-sale/redmond` | 474 = DB exactly (2 suppressed) |
| `/homes-for-sale/bend/mountain-view` | 35 = DB exactly (boundary-xref view path) |
| Active listing detail page | renders normally |
| Coming Soon detail page | 404 |
| `listings_in_boundary`, `community_subdivisions` | work (SECURITY DEFINER) |
| service_role sees Coming Soon | yes — broker visibility intact |
| All 5 MV refresh functions | run clean; pg_cron observed refreshing `_src` |

## Incident during the work (resolved)

The first RLS policy used a case-insensitive **regex** evaluated per row on
589K rows. `anon` has a hard 3s `statement_timeout`, and
`search_listings_advanced` needs ~6.7s cold **even as service_role** — so it was
already at the edge, and the regex pushed cold runs over into 57014 timeouts.
Replaced with `lower()` + an anchored `LIKE` (migration 20260721092000).
After: detail reads 57–85ms, indexed city query 105ms, warm RPC 1.4s.

That RPC's cold-run fragility is **pre-existing**, not introduced here — the
search page already wraps it in a 12s timeout with a degraded fallback, and the
primary search path is `listing_search_mv`, not the RPC.

## Still open (not Coming Soon, worth a separate decision)

1. **`listings` RLS is still `USING (true)`-equivalent for other off-market
   statuses.** Closed/Withdrawn/Expired/Canceled remain anon-readable on the raw
   table. Not a Coming Soon issue, but the same class of exposure.
2. **Null `StandardStatus` is treated as publicly displayable.** Preserved
   deliberately so this change had exactly one observable effect. Worth deciding
   on its own.
3. **`activity_events`** has `USING (true)` RLS and is consumed over Realtime by
   `ActivityFeedSection`. If the sync process ever writes a `new_listing` event
   for a Coming Soon listing, the row would broadcast to subscribed browsers.
   Not traced to a confirmed leak; worth verifying.
4. **`search_listings_advanced` cold-run cost (~6.7s)** exceeds anon's 3s budget.
   Pre-existing and already handled by a degraded fallback, but it means cold
   advanced-filter searches serve the empty state rather than results.
