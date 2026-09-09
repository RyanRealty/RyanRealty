/**
 * getSubdivisionCityInventory — lifetime listing counts per (MLS city, MLS
 * SubdivisionName), read from public.subdivision_city_inventory_mv
 * (migration 20260909120000_subdivision_city_inventory_mv.sql).
 *
 * WHY THIS EXISTS (SITE-54, 2026-09-09). Two readers computed this same
 * aggregate by paging every row of public.listing_tile_mv for a city through
 * PostgREST — 1,000 rows at a time, 12 pages concurrently, 6 cities
 * concurrently, every failed page retried 3 times:
 *
 *   lib/data/subdivisions/getSubdivisionBrowseSlugsByCity.ts (deleted with this
 *     change) — the sitemap's /homes-for-sale/<city>/<subdivision> browse pairs
 *   getSubdivisionLifetimeCounts() in lib/data/listings/getSearchMatrixInventory.ts
 *     — the /homes-for-sale/<city>/<area>/<preset> matrix leg
 *
 * The row counts are history-sized (Bend ~129,192, Redmond ~45,726) because
 * listing_tile_mv holds one row per MLS listing ever seen. PostgREST has no
 * server-side GROUP BY on this project (PGRST123), so the count ran
 * client-side over every row.
 *
 * §0 MEASUREMENT, 2026-09-09, this worktree against production:
 *   old path  getSubdivisionBrowseSlugsByCity(24 Central Oregon city slugs,
 *             floor 3) = 1,816 browse pairs in 32,749 ms, 24 count queries +
 *             ~300 page queries against listing_tile_mv
 *   new path  getSubdivisionCityInventory() = 2,216 MV rows in 929 ms, one
 *             filtered read, and the SAME 1,816 pairs — the per-city counts
 *             matched slug for slug, 0 added and 0 missing
 *
 * And the latency was the smaller half. PostgREST roles run with
 * statement_timeout=8s (authenticator/authenticated) and 3s (anon), while
 * pg_cron job 164 holds listing_tile_mv_src under REFRESH ... CONCURRENTLY for
 * 13-21 minutes of every 30-minute slot overnight. Grouped by query_id over
 * 24h, that page read was the single largest statement-timeout source on the
 * whole database — 19,655 timeouts plus 1,136 for its count query, an order of
 * magnitude above #2 — and it took listing detail, tiles, boundary_geojson and
 * blog down with it through the connection pool. The /sitemaps/geo.xml 504s
 * were the symptom that surfaced it.
 *
 * THE CLASSIFICATION DID NOT MOVE. The MV stores the raw per-status counts;
 * classifyLifetimeBuckets (lib/data/subdivisions/subdivision-sitemap-inventory.ts,
 * vitest-pinned) still decides what "active" means, exactly as it did per row.
 * Summing `buckets.length * n` is the same arithmetic as adding
 * `buckets.length` once per listing.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import {
  buildSubdivisionSlugsForCity,
  type SubdivisionInventoryRow,
} from '@/lib/data/subdivisions/subdivision-sitemap-inventory'

/**
 * City slug -> listing_tile_mv.city_lower. Hyphenless allowlist slugs map back
 * to the MLS spelling by swapping hyphens for spaces ('la-pine' -> 'la pine'),
 * already lowercase. This is the exact mapping both deleted readers used, and
 * it matches get_subdivision_status_counts' `TRIM("City") ILIKE TRIM(p_city)`
 * semantics for a no-wildcard pattern.
 */
export function citySlugToMlsCityLower(citySlug: string): string {
  return citySlug.replace(/-/g, ' ')
}

type InventoryMvRow = {
  city_lower?: string | null
  subdivision_name?: string | null
  listing_count?: number | string | null
  status_counts?: Record<string, unknown> | null
}

/**
 * One (city, subdivision name) pair with its statuses already counted. The
 * `rows` are the SAME shape the old per-listing readers built, each carrying an
 * `n` instead of appearing n times.
 */
export type SubdivisionCityInventoryEntry = {
  /** listing_tile_mv.city_lower = lower(trim("City")). */
  cityLower: string
  /** Trimmed MLS SubdivisionName, case preserved. */
  subdivisionName: string
  /** Counted status rows, ready for classifyLifetimeBuckets. */
  rows: SubdivisionInventoryRow[]
}

function toCount(value: number | string | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0
}

async function fetchSubdivisionCityInventory(): Promise<SubdivisionCityInventoryEntry[]> {
  // SERVICE client. The MV grants select to anon/authenticated/service_role
  // identically, but anon runs with statement_timeout=3s and this read happens
  // inside the sitemap build, which is exactly the caller that has been dying
  // to that timeout. service_role's 120s ceiling is the honest one for a
  // server-only crawl-surface read; the payload is slugs and counts, no listing
  // rows.
  const supabase = createServiceClient()

  // Scoped to the service area. The MV holds all 347 MLS cities (6,885 rows);
  // both consumers only ever ask about CENTRAL_OREGON_CITY_SLUGS, and the
  // filter walks the (city_lower, subdivision_name) unique index.
  const cityLowers = [...CENTRAL_OREGON_CITY_SLUGS].map(citySlugToMlsCityLower)

  // Stable order is mandatory for range paging (G48 / ci:row-cap, and the
  // 13.9%-duplicate incident documented in getIndexableSubdivisions.ts). The
  // two columns below are the MV's unique key, so together they are a total
  // order.
  const { rows, error } = await fetchPagedRows<InventoryMvRow>((from, to) =>
    supabase
      .from('subdivision_city_inventory_mv')
      .select('city_lower,subdivision_name,listing_count,status_counts')
      .in('city_lower', cityLowers)
      .order('city_lower', { ascending: true })
      .order('subdivision_name', { ascending: true })
      .range(from, to),
  )
  if (error) {
    // THROW, never return []: makeResilientCached must not cache a blip as "no
    // city has any subdivisions", which would empty the browse-pair section of
    // the sitemap and the matrix's subdivision leg for the whole TTL.
    throw new Error(
      `getSubdivisionCityInventory: subdivision_city_inventory_mv read failed: ${error.message}`,
    )
  }
  if (rows.length === 0) {
    // Production holds thousands of rows for the service area. Zero is a failed
    // or unrefreshed read, never a service area with no subdivisions.
    throw new Error('getSubdivisionCityInventory: subdivision_city_inventory_mv returned 0 rows')
  }

  const out: SubdivisionCityInventoryEntry[] = []
  for (const row of rows) {
    const cityLower = (row.city_lower ?? '').trim()
    const subdivisionName = (row.subdivision_name ?? '').trim()
    if (!cityLower || !subdivisionName) continue
    const counts = row.status_counts
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) continue
    const statusRows: SubdivisionInventoryRow[] = []
    for (const [status, raw] of Object.entries(counts)) {
      const n = toCount(raw as number | string | null | undefined)
      if (n === 0) continue
      statusRows.push({ subdivision_name: subdivisionName, standard_status: status, n })
    }
    if (statusRows.length === 0) continue
    out.push({ cityLower, subdivisionName, rows: statusRows })
  }
  return out
}

/**
 * The cached service-area inventory. 6h TTL (CACHE_WINDOWS.marketStats) — the
 * MV behind it refreshes nightly, so a shorter window would only re-read the
 * same rows. Tagged `listings` so a listing-side revalidate busts it.
 */
export const getSubdivisionCityInventory = makeResilientCached(
  fetchSubdivisionCityInventory,
  ['subdivision-city-inventory-v1'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.listings, cacheTag.market],
  },
  [],
)

/**
 * The inventory grouped by city_lower — the shape both consumers want. Built
 * from the one cached read, so asking for 24 cities costs one query.
 */
export async function getSubdivisionCityInventoryByCityLower(): Promise<
  Map<string, SubdivisionCityInventoryEntry[]>
> {
  const entries = await getSubdivisionCityInventory()
  const byCity = new Map<string, SubdivisionCityInventoryEntry[]>()
  for (const entry of entries) {
    const list = byCity.get(entry.cityLower)
    if (list) list.push(entry)
    else byCity.set(entry.cityLower, [entry])
  }
  return byCity
}

/**
 * citySlug -> subdivision slugs clearing `minLifetimeListings`, the sitemap's
 * /homes-for-sale/<city>/<subdivision> browse-pair set.
 *
 * The direct replacement for getSubdivisionBrowseSlugsByCity (deleted 2026-09-09,
 * SITE-54). Same city allowlist, same pure aggregator
 * (buildSubdivisionSlugsForCity), same floor, same output — one filtered MV
 * read instead of ~320 paged reads of a 525 MB history view.
 *
 * A city with no MV rows gets an empty list, exactly as the old reader's
 * per-city catch did, so one thin city can never blank the whole set.
 */
export async function getSubdivisionBrowsePairsByCity(
  citySlugs: readonly string[],
  minLifetimeListings: number,
): Promise<Map<string, string[]>> {
  const byCityLower = await getSubdivisionCityInventoryByCityLower()
  const out = new Map<string, string[]>()
  for (const citySlug of citySlugs) {
    const entries = byCityLower.get(citySlugToMlsCityLower(citySlug)) ?? []
    const rows: SubdivisionInventoryRow[] = []
    for (const entry of entries) rows.push(...entry.rows)
    out.set(citySlug, buildSubdivisionSlugsForCity(rows, minLifetimeListings))
  }
  return out
}
