/**
 * Live-inventory rows for /sitemaps/listings.xml.
 *
 * WHY THIS IS ITS OWN READ (2026-08-19). The listings child used to be a
 * filter over `buildAllUrls()`. That universe takes ~147s, swallows errors
 * into static-only pages, and paged `listing_tile_mv` with `fetchAllRows`
 * (no ORDER BY). Postgres does not keep a stable row order across OFFSET
 * pages without ORDER BY — measured against production this session:
 * unordered Active/AUC pages returned 7,586 rows / 5,827 unique keys, so
 * 1,759 live listings never appeared in listings.xml. A thrown universe
 * build served an empty urlset (200) while the MV still held the inventory.
 *
 * This DAL is the listings class source of truth: PUBLIC_ACTIVE_STATUSES,
 * stable `listing_key` order, throw on error (never cache/serve empty on a
 * blip). Path assembly is `listingTileHref` so locs match the listing
 * canonical. Per docs/DATABASE_FOR_AI_AGENTS.md §0, public active inventory
 * reads listing_search_mv (listing_tile_mv until 2026-09-16) — not a raw
 * `listings` scan.
 *
 * KEYSET PAGING, NOT OFFSET (2026-09-16). The original fix above paged with
 * `.order('listing_key').range(offset, offset + 999)` across PAGE_CONCURRENCY
 * (8) pages in parallel. That is what next broke it: eight concurrent
 * ORDER BY + OFFSET scans over the same filtered ~596K-row MV is enough
 * contention to blow the statement timeout under load — measured in CI (PR
 * #252, commit 7b5535bd, route-smoke "sitemaps/listings.xml returned HTTP
 * 500", 144/145) and reproduced twice against a local production build
 * ("[getListingSitemapRows] listing_tile_mv page failed: canceling statement
 * due to statement timeout"), while other runs served 200 — load/timing, not
 * a bad query. `listing_key` is already the sort column and is unique in the
 * MV, so paging is now sequential keyset: `.gt('listing_key', lastKey)
 * .order('listing_key').limit(PAGE_SIZE)`, stopping on the first short page.
 * Each page is an index range scan independent of how many rows came before
 * it — no OFFSET, no concurrency, no growing scan cost — and the stable-order
 * guarantee the 2026-08-19 fix exists for is unchanged (still ordered on the
 * same unique key, just walked forward instead of jumped into).
 */
import { supabaseAnon } from '@/lib/data/client'
import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'
import { isServiceAreaCity } from '@/lib/data/listings/service-area'
import {
  assembleListingSitemapRows,
  type ListingSitemapRow,
  type ListingSitemapTile,
} from '@/lib/data/sitemap/listing-sitemap-path'

// WHICH MV, AND WHY IT CHANGED (2026-09-16). This read paged `listing_tile_mv`
// — ~593K rows, every status, indexed for city+status lookups and NOT for
// `WHERE standard_status IN (…) ORDER BY listing_key`. Each keyset page walked
// the listing_key index and threw away ~98% of what it touched, and the exact
// count scanned the whole MV. Uncontended that was 12–19s cold; under the :00
// `refresh_listing_tile_mv_30min` window with a second CI run on the same
// database it hit the anon statement timeout and /sitemaps/listings.xml served
// 500 three times in a row (PR #252 CI, 07:05–07:07Z; production served 200
// only because the route caches for an hour). `listing_search_mv` is the
// active-only view (Active / Active Under Contract / Pending over
// listing_search_mv_src, Coming Soon hidden), ~9.7K rows, unique-indexed on
// listing_key, carrying every column this sitemap needs; the same
// PUBLIC_ACTIVE_STATUSES filter, the same ORDER BY listing_key, the same
// keyset pages — over 1/60th of the rows. ci:sitemap-listings-honest pins it.
const PAGE_SIZE = 1000
const SELECT_COLS =
  'listing_key, list_number, street_number, street_name, city, subdivision_name, boundary_city, boundary_neighborhood, modified_at'

// Exponential backoff with jitter. A statement-timeout is a contention
// signal, not a fluke: retrying instantly (the old flat 150ms backoff) just
// re-fires into the same contention. These bases give whatever else is
// scanning the MV time to clear before the next attempt.
const RETRY_BASE_DELAYS_MS = [250, 750, 2000]

/** Generic retry helper for any Supabase call shaped `{ data?, error }`. */
async function withRetry<T extends { error: unknown }>(fn: () => PromiseLike<T>, attempts = 4): Promise<T> {
  let last: T | undefined
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn()
      if (!result.error) {
        if (i > 0) {
          console.debug(`[getListingSitemapRows] withRetry succeeded on attempt ${i + 1}/${attempts}`)
        }
        return result
      }
      last = result
    } catch (err) {
      last = { error: err } as T
    }
    if (i < attempts - 1) {
      const base = RETRY_BASE_DELAYS_MS[Math.min(i, RETRY_BASE_DELAYS_MS.length - 1)]!
      const jitter = Math.random() * base
      await new Promise((r) => setTimeout(r, base + jitter))
    }
  }
  return last as T
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

type AnonClient = NonNullable<ReturnType<typeof supabaseAnon>>

/**
 * Exact count over the same filter, used only as a post-read sanity check —
 * the keyset loop below needs no total to know when to stop (it stops on the
 * first short page). A count-query timeout must never fail the sitemap, so a
 * failure here is logged and swallowed; the caller treats `null` as "unknown"
 * rather than "zero".
 */
async function fetchActiveCount(supabase: AnonClient): Promise<number | null> {
  const { count, error } = await withRetry(() =>
    supabase
      .from('listing_search_mv')
      .select('listing_key', { count: 'exact', head: true })
      .in('standard_status', PUBLIC_ACTIVE_STATUSES),
  )
  if (error) {
    console.error(
      `[getListingSitemapRows] listing_tile_mv count failed, proceeding without it: ${errorMessage(error)}`,
    )
    return null
  }
  return count ?? 0
}

/**
 * Sequential keyset pages over `listing_key` (unique, already the sort
 * column). Each page filters strictly greater than the last row's key, so
 * every page is an independent index range scan — no OFFSET, no growing scan
 * cost, no concurrency to contend with itself. A page shorter than PAGE_SIZE
 * is the last page.
 */
async function fetchAllPagesKeyset(supabase: AnonClient): Promise<ListingSitemapTile[]> {
  const rows: ListingSitemapTile[] = []
  let lastKey: string | null = null
  for (;;) {
    const page = await withRetry(() => {
      const base = supabase
        .from('listing_search_mv')
        .select(SELECT_COLS)
        .in('standard_status', PUBLIC_ACTIVE_STATUSES)
      // ORDER BY is not optional. Unordered pages on this MV returned 7,586
      // rows / 5,827 unique listing_keys (2026-08-19).
      const filtered = lastKey === null ? base : base.gt('listing_key', lastKey)
      return filtered.order('listing_key', { ascending: true }).limit(PAGE_SIZE)
    })
    if (page.error) {
      throw new Error(`[getListingSitemapRows] listing_tile_mv page failed: ${errorMessage(page.error)}`)
    }
    const pageRows = (page.data ?? []) as ListingSitemapTile[]
    rows.push(...pageRows)
    if (pageRows.length < PAGE_SIZE) break
    lastKey = String(pageRows[pageRows.length - 1]!.listing_key)
  }
  return rows
}

async function fetchActiveListingTiles(): Promise<ListingSitemapTile[]> {
  const supabase = supabaseAnon()
  if (!supabase) {
    throw new Error('[getListingSitemapRows] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY missing')
  }

  const total = await fetchActiveCount(supabase)
  // A count known to be zero means there is nothing to page for — skip the
  // read entirely. An unknown count (timeout) is NOT treated as zero; fall
  // through to the keyset read, which needs no total to terminate correctly.
  if (total === 0) return []

  const rows = await fetchAllPagesKeyset(supabase)

  if (total !== null && total > 0 && rows.length === 0) {
    throw new Error(
      `[getListingSitemapRows] listing_tile_mv reported ${total} Active/AUC rows but the page read returned 0`,
    )
  }
  return rows
}

/**
 * SITE-33 (Matt 2026-09-08). A noindexed URL does not belong in a sitemap.
 *
 * The listing detail page for a home outside the Central Oregon service area
 * now renders "noindex, follow" and carries an honesty block
 * (lib/data/listings/service-area.ts, `outOfAreaListingPolicy`). Submitting
 * those URLs asks Google to crawl pages we have told it not to index. Measured
 * live 2026-09-08 against https://ryan-realty.com/sitemaps/listings.xml: 4,190
 * of 7,506 listing URLs (56%) were out-of-area — Medford 730, Klamath Falls
 * 635, Grants Pass 541, Ashland 275, Chiloquin 184, Eagle Point 165, Central
 * Point 149.
 *
 * THE FILTER IS IN JS, NOT IN THE QUERY, ON PURPOSE. The MV read above is
 * pinned by ci:sitemap-listings-honest to a shape measured against production
 * (count + ORDER BY listing_key + keyset pages, 2026-09-16); adding an
 * `.in('city_lower', …)` predicate beside that ORDER BY changed the plan on the
 * 589K-row tile MV under a build deadline (the read moved to the ~9.7K-row
 * active-only search MV the same day; the filter stays in JS regardless). Verified this session: a `city_lower`
 * equality filter with `.order('listing_key')` on this MV hit the statement
 * timeout, while the same filter without the order returned instantly. The rows
 * are already fetched and already carry `city`; dropping them here costs
 * nothing and cannot regress the read.
 *
 * This is the SAME predicate the page's robots directive uses, so a URL cannot
 * be in the sitemap and noindexed at the same time.
 */
export function serviceAreaSitemapTiles(
  tiles: readonly ListingSitemapTile[],
): ListingSitemapTile[] {
  return tiles.filter((tile) => isServiceAreaCity(tile.city))
}

export async function getListingSitemapRows(now: Date = new Date()): Promise<ListingSitemapRow[]> {
  const tiles = await fetchActiveListingTiles()
  return assembleListingSitemapRows(serviceAreaSitemapTiles(tiles), now)
}
