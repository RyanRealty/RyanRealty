/**
 * Boundary-classifier coverage instrument (SITE-23).
 *
 * `listings.boundary_city` is written by `refresh_listing_boundary_tags()`,
 * which stamps the literal string 'Outside Boundaries' when no `city`-tier
 * polygon contains the home's point. That string is a SENTINEL, not a place —
 * lib/slug.ts:203-217 and app/listing/[listingKey]/listing-json-ld.ts:86-91
 * both refuse it as a URL segment. But a sentinel row is still a MISS in the
 * boundary set, and every figure a place page publishes from a polygon read
 * inherits it, so the size of the sentinel set is a number this shop has to be
 * able to state and re-state.
 *
 * It had no owner. Counting it meant an ad-hoc aggregate over `listings`,
 * which the stat-source gate refuses (CLAUDE.md §7.6, feedback_all_stats_one_process).
 * This function is that owner: the before/after trace on SITE-23 and the
 * standing measurement afterwards both read it.
 *
 * Counts only — `count: 'exact', head: true` sends no rows over the wire. It is
 * still a sequential count over a 589K-row table with no index on
 * `boundary_city`: measured 2026-09-08, the anon role returns HTTP 500 on it
 * (its 3s statement_timeout, and PostgREST reports that as `{"message":""}`,
 * which is why this reads through the service client). Seconds, not
 * milliseconds — this is an OPERATIONS instrument for the loop and for gates,
 * never a request-path read. Do not put it behind a public page. An
 * approximate `count: 'planned'` would be fast and is refused: §0 does not
 * take an estimate for a published number.
 */

import { unstable_cache } from 'next/cache'
import { createServiceClient } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

/** The exact string `refresh_listing_boundary_tags()` writes on a city-tier miss. */
export const BOUNDARY_CITY_SENTINEL = 'Outside Boundaries'

export type BoundarySentinelCoverage = {
  /** Listings whose boundary_city is the sentinel — the whole city-tier miss set. */
  sentinel: number
  /** Of those, the ones whose MLS City is Powell Butte (the SITE-23 gap). */
  sentinelPowellButte: number
  /** Of those, the ones whose MLS SubdivisionName names Brasada Ranch. */
  sentinelBrasada: number
  /** Brasada Ranch listings carrying a resolved boundary_neighborhood. */
  brasadaNeighborhoodTagged: number
  /** Brasada Ranch listings with coordinates at all — the denominator. */
  brasadaGeocoded: number
}

const ZERO: BoundarySentinelCoverage = {
  sentinel: 0,
  sentinelPowellButte: 0,
  sentinelBrasada: 0,
  brasadaNeighborhoodTagged: 0,
  brasadaGeocoded: 0,
}

async function fetchCoverage(): Promise<BoundarySentinelCoverage> {
  // createServiceClient throws when the service key is absent (a build without
  // secrets). Coverage is an instrument, not a page: report zeroes rather than
  // taking a build down.
  let sb: ReturnType<typeof createServiceClient>
  try {
    sb = createServiceClient()
  } catch {
    return ZERO
  }

  const head = { count: 'exact' as const, head: true }
  const [sentinel, powellButte, brasada, brasadaTagged, brasadaGeocoded] = await Promise.all([
    sb.from('listings').select('ListingKey', head).eq('boundary_city', BOUNDARY_CITY_SENTINEL),
    sb
      .from('listings')
      .select('ListingKey', head)
      .eq('boundary_city', BOUNDARY_CITY_SENTINEL)
      .eq('City', 'Powell Butte'),
    sb
      .from('listings')
      .select('ListingKey', head)
      .eq('boundary_city', BOUNDARY_CITY_SENTINEL)
      .ilike('SubdivisionName', '%brasada%'),
    sb
      .from('listings')
      .select('ListingKey', head)
      .ilike('SubdivisionName', '%brasada%')
      .not('boundary_neighborhood', 'is', null),
    sb
      .from('listings')
      .select('ListingKey', head)
      .ilike('SubdivisionName', '%brasada%')
      .not('Latitude', 'is', null),
  ])

  for (const r of [sentinel, powellButte, brasada, brasadaTagged, brasadaGeocoded]) {
    if (r.error) throw r.error
  }

  return {
    sentinel: sentinel.count ?? 0,
    sentinelPowellButte: powellButte.count ?? 0,
    sentinelBrasada: brasada.count ?? 0,
    brasadaNeighborhoodTagged: brasadaTagged.count ?? 0,
    brasadaGeocoded: brasadaGeocoded.count ?? 0,
  }
}

/** Current size of the boundary-classifier's city-tier miss set. */
export async function getBoundarySentinelCoverage(): Promise<BoundarySentinelCoverage> {
  return unstable_cache(fetchCoverage, ['boundary-sentinel-coverage-v1'], {
    revalidate: CACHE_WINDOWS.marketPulse,
    tags: [cacheTag.listings, 'boundaries'],
  })()
}
