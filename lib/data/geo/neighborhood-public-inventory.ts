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
 * Status is PUBLIC_ACTIVE_STATUSES (Active + Active Under Contract). Coming Soon
 * is already stripped by the xref security-barrier view (R-025).
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
import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'

/** Bend NA districts. Label = display name; slug = URL + `bend-{slug}` geo_slug. */
export const BEND_NEIGHBORHOOD_DISTRICTS: ReadonlyArray<{ label: string; slug: string }> = [
  { label: 'Awbrey Butte', slug: 'awbrey-butte' },
  { label: 'Boyd Acres', slug: 'boyd-acres' },
  { label: 'Century West', slug: 'century-west' },
  { label: 'Larkspur', slug: 'larkspur' },
  { label: 'Mountain View', slug: 'mountain-view' },
  { label: 'Old Bend', slug: 'old-bend' },
  { label: 'Old Farm District', slug: 'old-farm-district' },
  { label: 'Orchard District', slug: 'orchard-district' },
  { label: 'River West', slug: 'river-west' },
  { label: 'Southeast Bend', slug: 'southeast-bend' },
  { label: 'Southern Crossing', slug: 'southern-crossing' },
  { label: 'Southwest Bend', slug: 'southwest-bend' },
  { label: 'Summit West', slug: 'summit-west' },
]

/** Canonical Bend-district report. `/neighborhoods/{slug}` 301s here. */
export function bendNeighborhoodCanonicalHref(slug: string): string | null {
  const district = BEND_NEIGHBORHOOD_DISTRICTS.find((d) => d.slug === slug)
  return district ? `/cities/bend/${district.slug}` : null
}

export type NeighborhoodPublicInventory = {
  label: string
  slug: string
  geoSlug: string
  /** SFR + PUBLIC_ACTIVE inside the recorded boundary. 0 is a measured empty. */
  activeCount: number
  medianListPrice: number | null
  listingKeys: string[]
  href: string
}

export type NeighborhoodInventoryRow = {
  geo_slug: string
  listing_key: string
  list_price: number | null
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
  const bySlug = new Map<string, { keys: string[]; prices: number[] }>()
  for (const row of rows) {
    if (!row.geo_slug || !row.listing_key) continue
    const bucket = bySlug.get(row.geo_slug) ?? { keys: [], prices: [] }
    bucket.keys.push(row.listing_key)
    if (row.list_price != null && Number.isFinite(Number(row.list_price)) && Number(row.list_price) > 0) {
      bucket.prices.push(Number(row.list_price))
    }
    bySlug.set(row.geo_slug, bucket)
  }

  return districts.map((n) => {
    const geoSlug = neighborhoodGeoSlug('bend', n.slug)
    const bucket = bySlug.get(geoSlug) ?? { keys: [], prices: [] }
    const priced = [...bucket.prices].sort((a, b) => a - b)
    return {
      label: n.label,
      slug: n.slug,
      geoSlug,
      activeCount: bucket.keys.length,
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
        .select('geo_slug, listing_key, list_price')
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
  ['bend-neighborhood-public-inventory-v1'],
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
