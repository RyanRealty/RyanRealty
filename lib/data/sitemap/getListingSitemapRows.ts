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
 * reads listing_tile_mv — not a raw `listings` scan.
 */
import { supabaseAnon } from '@/lib/data/client'
import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'
import { isServiceAreaCity } from '@/lib/data/listings/service-area'
import {
  assembleListingSitemapRows,
  type ListingSitemapRow,
  type ListingSitemapTile,
} from '@/lib/data/sitemap/listing-sitemap-path'

const PAGE_SIZE = 1000
const PAGE_CONCURRENCY = 8
const SELECT_COLS =
  'listing_key, list_number, street_number, street_name, city, subdivision_name, boundary_city, boundary_neighborhood, modified_at'

async function withRetry<T extends { error: unknown }>(fn: () => PromiseLike<T>, attempts = 3): Promise<T> {
  let last: T | undefined
  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn()
      if (!result.error) return result
      last = result
    } catch (err) {
      last = { error: err } as T
    }
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 150))
  }
  return last as T
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message)
  }
  return String(error)
}

async function fetchActiveListingTiles(): Promise<ListingSitemapTile[]> {
  const supabase = supabaseAnon()
  if (!supabase) {
    throw new Error('[getListingSitemapRows] NEXT_PUBLIC_SUPABASE_URL / ANON_KEY missing')
  }

  const { count, error: countError } = await withRetry(() =>
    supabase
      .from('listing_tile_mv')
      .select('listing_key', { count: 'exact', head: true })
      .in('standard_status', PUBLIC_ACTIVE_STATUSES),
  )
  if (countError) {
    throw new Error(`[getListingSitemapRows] listing_tile_mv count failed: ${errorMessage(countError)}`)
  }
  const total = count ?? 0
  if (total === 0) return []

  const pageCount = Math.ceil(total / PAGE_SIZE)
  const rows: ListingSitemapTile[] = []
  for (let start = 0; start < pageCount; start += PAGE_CONCURRENCY) {
    const pageIndexes: number[] = []
    for (let p = start; p < Math.min(start + PAGE_CONCURRENCY, pageCount); p++) pageIndexes.push(p)
    const pages = await Promise.all(
      pageIndexes.map((p) =>
        withRetry(() =>
          supabase
            .from('listing_tile_mv')
            .select(SELECT_COLS)
            .in('standard_status', PUBLIC_ACTIVE_STATUSES)
            // ORDER BY is not optional. Unordered range pages on this MV
            // returned 7,586 rows / 5,827 unique listing_keys (2026-08-19).
            .order('listing_key', { ascending: true })
            .range(p * PAGE_SIZE, p * PAGE_SIZE + PAGE_SIZE - 1),
        ),
      ),
    )
    for (const page of pages) {
      if (page.error) {
        throw new Error(`[getListingSitemapRows] listing_tile_mv page failed: ${errorMessage(page.error)}`)
      }
      rows.push(...((page.data ?? []) as ListingSitemapTile[]))
    }
  }

  if (rows.length === 0 && total > 0) {
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
 * (count + ORDER BY listing_key + concurrent range pages); adding an
 * `.in('city_lower', …)` predicate beside that ORDER BY changes the plan on a
 * 589K-row MV under a build deadline. Verified this session: a `city_lower`
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
