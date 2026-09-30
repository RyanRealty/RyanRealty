/**
 * Public Bend-district "homes for sale" inventory — ONE population.
 *
 * Fleet finding (2026-08-16, Awbrey Butte): the neighborhoods index tile
 * printed 52, the place-page hero printed 63, and the FAQ printed 62. Those
 * were three queries, not one market:
 *
 *   A  listing_tile_mv.boundary_neighborhood  SFR + PUBLIC_ACTIVE   (index)
 *   B  market_pulse_live.active_count         SFR/null + Active+CS  (FAQ)
 *   C  listings_in_boundary pin length        A/B/C + Active only   (hero)
 *
 * This module is the public inventory SoR. Geography is `listing_boundary_xref_mv`
 * (`public.boundaries` polygon — same table the place-page map uses). Property
 * is SFR (`property_type='A'` AND `property_sub_type='Single Family Residence'`).
 * The read is PUBLIC_ACTIVE_STATUSES (Active + Active Under Contract), every
 * listing a visitor may see. Coming Soon is already stripped by the xref
 * security-barrier view (R-025).
 *
 * "FOR SALE" IS ACTIVE (SITE-193, 2026-09-24). The count this module calls
 * activeCount, and the median beside it, are the listings for sale: status
 * Active, by publicCountState (lib/listing-status-public), the one classifier
 * the place map, the homes block under it, Market Truth's active count and the
 * homepage pulse read. Active Under Contract is counted separately
 * (underContractCount) and stays in listingKeys, because those homes are still
 * shown. Before this, the door read "N homes for sale" with the under-contract
 * homes inside it while the homes block under the same map split them out.
 *
 * Pulse `active_count` still includes Coming Soon (G27 residual) and is NOT
 * this figure. Do not fall back to pulse or to `boundary_neighborhood` tags
 * when this read is silent — absent is not a different population (R-020).
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md §0 (homes inside a boundary) + §3 (Bend
 * neighborhood slugs `bend-<slug>`).
 */

import { makeResilientCached } from '@/lib/data/cache/resilient'
import { supabaseAnon } from '@/lib/data/client'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { PUBLIC_ACTIVE_STATUSES, publicCountState } from '@/lib/listing-status-public'
import { BEND_NEIGHBORHOOD_DISTRICTS } from '@/lib/data/geo/bend-neighborhood-districts'

/** Re-export for server callers — single source lives in bend-neighborhood-districts. */
export { BEND_NEIGHBORHOOD_DISTRICTS }

/** Canonical Bend-district report. `/neighborhoods/{slug}` 301s here. */
export function bendNeighborhoodCanonicalHref(slug: string): string | null {
  const district = BEND_NEIGHBORHOOD_DISTRICTS.find((d) => d.slug === slug)
  return district ? `/cities/bend/${district.slug}` : null
}

export type NeighborhoodPublicInventory = {
  label: string
  slug: string
  geoSlug: string
  /**
   * SFR FOR SALE (status Active) inside the recorded boundary: the figure a
   * page prints as "homes for sale". 0 is a measured empty.
   */
  activeCount: number
  /** SFR under contract and still showing (Active Under Contract), inside the boundary. */
  underContractCount: number
  /**
   * How many of the for-sale listings carried a usable price — the population
   * `medianListPrice` was computed over, and a SUBSET of activeCount. A rank
   * chart may draw this beside the median; it may not draw activeCount, which
   * counts listings the median never saw.
   */
  pricedCount: number
  medianListPrice: number | null
  /** Every SFR listing still showing: for sale and under contract. */
  listingKeys: string[]
  href: string
}

export type NeighborhoodInventoryRow = {
  geo_slug: string
  listing_key: string
  list_price: number | null
  /** MLS status. Under contract by publicCountState, else for sale (as placeHomesCount). */
  standard_status?: string | null
}

export function neighborhoodGeoSlug(citySlug: string, neighborhoodSlug: string): string {
  return `${citySlug}-${neighborhoodSlug}`
}

export function medianListPrice(sorted: number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor((sorted.length - 1) / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid]! + sorted[mid + 1]!) / 2
}

/** Pure rollup — unit-tested so the page and the index cannot invent a second group-by. */
export function rollupNeighborhoodPublicInventory(
  rows: readonly NeighborhoodInventoryRow[],
  districts: readonly { label: string; slug: string }[] = BEND_NEIGHBORHOOD_DISTRICTS,
): NeighborhoodPublicInventory[] {
  type Bucket = { keys: string[]; forSale: number; underContract: number; prices: number[] }
  const empty = (): Bucket => ({ keys: [], forSale: 0, underContract: 0, prices: [] })
  const bySlug = new Map<string, Bucket>()
  for (const row of rows) {
    if (!row.geo_slug || !row.listing_key) continue
    const bucket = bySlug.get(row.geo_slug) ?? empty()
    bucket.keys.push(row.listing_key)
    if (publicCountState(row.standard_status) === 'under-contract') {
      bucket.underContract += 1
    } else {
      bucket.forSale += 1
      if (row.list_price != null && Number.isFinite(Number(row.list_price)) && Number(row.list_price) > 0) {
        bucket.prices.push(Number(row.list_price))
      }
    }
    bySlug.set(row.geo_slug, bucket)
  }

  return districts.map((n) => {
    const geoSlug = neighborhoodGeoSlug('bend', n.slug)
    const bucket = bySlug.get(geoSlug) ?? empty()
    const priced = [...bucket.prices].sort((a, b) => a - b)
    return {
      label: n.label,
      slug: n.slug,
      geoSlug,
      activeCount: bucket.forSale,
      underContractCount: bucket.underContract,
      pricedCount: priced.length,
      medianListPrice: medianListPrice(priced),
      listingKeys: bucket.keys,
      href: `/cities/bend/${n.slug}`,
    }
  })
}

async function fetchBendNeighborhoodPublicInventory(): Promise<NeighborhoodPublicInventory[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  const slugs = BEND_NEIGHBORHOOD_DISTRICTS.map((n) => neighborhoodGeoSlug('bend', n.slug))
  const { rows, error } = await fetchPagedRows<NeighborhoodInventoryRow>(
    (from, to) =>
      sb
        .from('listing_boundary_xref_mv')
        .select('geo_slug, listing_key, list_price, standard_status')
        .eq('geo_type', 'neighborhood')
        .in('geo_slug', slugs)
        .in('standard_status', PUBLIC_ACTIVE_STATUSES)
        .eq('property_type', 'A')
        .eq('property_sub_type', 'Single Family Residence')
        .order('listing_key', { ascending: true })
        .range(from, to),
    5000,
  )

  if (error) {
    throw new Error(
      `[fetchBendNeighborhoodPublicInventory] listing_boundary_xref_mv query failed: ${error.message}`,
    )
  }

  return rollupNeighborhoodPublicInventory(rows)
}

/**
 * Cached batch for all 13 districts. Index tiles, city tiles, peer links, and
 * the place page all read this same payload so they cannot drift inside the TTL.
 */
export const getBendNeighborhoodPublicInventory = makeResilientCached(
  fetchBendNeighborhoodPublicInventory,
  // v2: the row grew pricedCount. A cached v1 entry has no such field, and an
  // undefined n would draw as a missing sample beside a median that has one.
  // v3 (SITE-193): activeCount is for sale only and underContractCount is new;
  // a cached v2 entry would print the under-contract homes as for sale.
  ['bend-neighborhood-public-inventory-v3'],
  {
    revalidate: 900,
    tags: [cacheTag.city('bend'), cacheTag.market],
  },
  [],
)

export async function getNeighborhoodPublicInventory(
  geoSlug: string,
): Promise<NeighborhoodPublicInventory | null> {
  const rows = await getBendNeighborhoodPublicInventory()
  if (rows.length === 0) return null
  return rows.find((r) => r.geoSlug === geoSlug) ?? null
}
