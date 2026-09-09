/**
 * getIndexableSubdivisions — the live indexable-subdivision set feeding the
 * sitemap, llms.txt, and the /subdivisions/[slug] noindex decision.
 *
 * Two conditions, one grain (SITE-24, 2026-09-08):
 *   1. public.boundaries geo_type='subdivision' — the authoritative Deschutes
 *      County GIS plat polygons, via getSubdivisionBoundarySlugs().
 *   2. >= SUBDIVISION_INDEX_MIN_LIFETIME_SALES lifetime CLOSED sales sitting
 *      INSIDE that polygon, via getPlatClosedCounts() —
 *      public.subdivision_plat_closed_mv, an ST_Contains join of the closed
 *      listing point against the plat polygon.
 *
 * WHAT CHANGED AND WHY. Condition (2) used to be a TEXT JOIN on MLS
 * "SubdivisionName", counted per Central Oregon city out of listing_tile_mv.
 * That measured a different grain from condition (1): the polygon is a recorded
 * plat, the MLS name is the resort. Every home inside Ridge At Broken Top,
 * Tennis Tracts At Broken Top, Courtyard Garages At Broken Top and Golf Tracts
 * At Broken Top is listed under the one name "Broken Top"; every home in Golf
 * Homes At Tetherow is listed under "Tetherow". No sale is EVER recorded under
 * a sub-plat name, so a sub-plat scored zero against any nonzero floor
 * permanently — 18 of the top 25 /subdivisions pages by Search Console
 * impressions (2026-06-08..2026-09-05) were served noindex by that mismatch,
 * and Google had begun dropping them on recrawl. The floor stayed at 10; the
 * join moved to geometry.
 *
 * WHAT DID NOT CHANGE. The underlying listing rows are the same rows: the
 * polygon join reads listing_tile_mv, the same MV the text join read, with the
 * same closed classification (`lower(status) LIKE '%closed%'`, byte-identical
 * to classifyLifetimeBuckets) and the same internet-display filter
 * (`permit_internet_yn IS DISTINCT FROM false AND idx_participant IS DISTINCT
 * FROM false`). One variable moved.
 *
 * AND WHAT THE MOVE COST. The old path paginated ~94K closed rows per city
 * across nine cities on every cold read (measured 34.8s for Bend alone), with
 * a documented 13.9%-duplicate hazard if any page query lost its ORDER BY.
 * That work is now done once, server-side, inside the MV; this module reads
 * ~3.2K precomputed rows. The pagination essay that used to live here has gone
 * with the code it described — the surviving stable-order requirement is
 * restated in getPlatClosedCounts.ts, which does the paging.
 *
 * The intersection + threshold logic is pure and lives in
 * lib/data/subdivisions/subdivision-index.ts (vitest-pinned). Cached 6h via
 * makeResilientCached: both underlying reads THROW on any transient error or
 * empty result, so a blip is never cached as "zero indexable subdivisions"
 * (which would noindex 3,2xx pages and empty the sitemap section for the whole
 * TTL) — one uncached retry, then the [] fallback for that single render only.
 */

import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { getSubdivisionBoundarySlugs } from '@/lib/data/subdivisions/getSubdivisionBoundarySlugs'
import { getPlatClosedCounts } from '@/lib/data/subdivisions/getPlatClosedCounts'
import {
  buildIndexableSubdivisions,
  type IndexableSubdivision,
} from '@/lib/data/subdivisions/subdivision-index'

async function fetchIndexableSubdivisions(): Promise<IndexableSubdivision[]> {
  const [boundarySlugs, platCounts] = await Promise.all([
    getSubdivisionBoundarySlugs(),
    getPlatClosedCounts(),
  ])

  // Both reads throw on failure inside their own resilient wrappers and fall
  // back to []. An empty either side here means the fallback fired, and
  // building an "indexable set" out of a fallback would noindex the class for
  // this cache window — so throw and let THIS wrapper retry uncached too.
  if (boundarySlugs.length === 0) {
    throw new Error('getIndexableSubdivisions: boundary slug set came back empty')
  }
  if (platCounts.length === 0) {
    throw new Error('getIndexableSubdivisions: plat closed-count set came back empty')
  }

  return buildIndexableSubdivisions(new Set(boundarySlugs), platCounts)
}

/**
 * The cached indexable set. 6h TTL (CACHE_WINDOWS.marketStats) — the inputs
 * (closed-sale counts) only move on closings, and the sitemap itself
 * regenerates hourly, so 6h staleness is invisible.
 *
 * KEY IS v2-polygon, NOT v1. The v1 key holds the text-join verdicts, and a
 * deploy that kept the key would have served the old noindex answers for up to
 * six more hours out of a warm cache while claiming the fix had shipped.
 */
export const getIndexableSubdivisions = makeResilientCached(
  fetchIndexableSubdivisions,
  ['indexable-subdivisions-v2-polygon'],
  {
    revalidate: CACHE_WINDOWS.marketStats,
    tags: [cacheTag.market, 'boundaries'],
  },
  [],
)

/**
 * Page-side membership check for the /subdivisions/[slug] noindex decision.
 * Below-threshold (or polygon-less) slugs still render — they just carry
 * noindex via pageMetadata.
 */
export async function isSubdivisionIndexable(slug: string): Promise<boolean> {
  const set = await getIndexableSubdivisions()
  return set.some((s) => s.slug === slug)
}
