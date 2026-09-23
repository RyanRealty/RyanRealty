/**
 * getPlatFamilyInventory — the homes for sale across every recorded phase of a
 * plat family, each listing counted once (Matt 2026-09-23: the family's main
 * page "carries the family's combined inventory").
 *
 * SOURCE. listing_boundary_xref_mv (the Coming-Soon-locked view), the
 * precomputed point-in-polygon join of every on-market listing against every
 * boundary, filtered to geo_type='subdivision', the family's member slugs and
 * PUBLIC_ACTIVE_STATUSES (Active and Active Under Contract; Coming Soon is
 * never public, R-025). A listing inside two overlapping phases (a replat and
 * the phase it replats) appears once per phase there, so the counted set is
 * DEDUPED by listing_key here.
 *
 * THE COUNTED SET is single-family, the site's one definition (CLAUDE.md §0:
 * property_type 'A' AND property_sub_type 'Single Family Residence'), because
 * "homes for sale in {place}" on a place page means exactly that set
 * (VOICE-8). The every-type rows ride along for the stock mix.
 */

import { supabaseAnon } from '@/lib/data/client'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { cacheTag } from '@/lib/data/cache/unstable-cache'
import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'
import { fetchPagedRows } from '@/lib/supabase/paginate'
import { medianListPrice } from '@/lib/data/geo/neighborhood-public-inventory'

export type PlatFamilyInventoryRow = {
  listing_key: string | null
  geo_slug: string | null
  property_type: string | null
  property_sub_type: string | null
  list_price: number | string | null
}

export type PlatFamilyInventory = {
  /** Distinct single-family listings, Active or Active Under Contract. */
  activeCount: number
  /** Median list price of those listings with a published price, null when none. */
  medianListPrice: number | null
  /** Their listing keys, distinct, in key order. */
  listingKeys: string[]
  /** Distinct listings of EVERY property type inside the family. */
  allTypeCount: number
  /** When the rows were read, ISO. */
  readAt: string
}

/** Pure rollup, so the dedup and the single-family rule are pinned by a test. */
export function rollupPlatFamilyInventory(
  rows: readonly PlatFamilyInventoryRow[],
  readAt: string,
): PlatFamilyInventory {
  const all = new Set<string>()
  const sfr = new Map<string, number | null>()
  for (const row of rows) {
    const key = (row.listing_key ?? '').trim()
    if (!key) continue
    all.add(key)
    if (row.property_type !== 'A' || row.property_sub_type !== 'Single Family Residence') continue
    const price = Number(row.list_price)
    const priced = Number.isFinite(price) && price > 0 ? price : null
    if (!sfr.has(key) || (sfr.get(key) == null && priced != null)) sfr.set(key, priced)
  }
  const listingKeys = [...sfr.keys()].sort()
  const prices = [...sfr.values()].filter((p): p is number => p != null).sort((a, b) => a - b)
  return {
    activeCount: listingKeys.length,
    medianListPrice: medianListPrice(prices),
    listingKeys,
    allTypeCount: all.size,
    readAt,
  }
}

/**
 * The uncached read. THROWS on a read error so the cache below never stores a
 * failure as "nothing for sale".
 */
async function fetchPlatFamilyInventory(slugs: readonly string[]): Promise<PlatFamilyInventory | null> {
  const readAt = new Date().toISOString()
  if (slugs.length === 0) return rollupPlatFamilyInventory([], readAt)
  const sb = supabaseAnon()
  if (!sb) throw new Error('getPlatFamilyInventory: no Supabase client')
  const { rows, error } = await fetchPagedRows<PlatFamilyInventoryRow>(
    (from, to) =>
      sb
        .from('listing_boundary_xref_mv')
        .select('listing_key,geo_slug,property_type,property_sub_type,list_price')
        .eq('geo_type', 'subdivision')
        .in('geo_slug', slugs)
        .in('standard_status', PUBLIC_ACTIVE_STATUSES)
        // (listing_key, geo_slug) is unique inside geo_type='subdivision': a
        // total order, so no page skips or repeats a row (G48 / ci:row-cap).
        .order('listing_key', { ascending: true })
        .order('geo_slug', { ascending: true })
        .range(from, to),
    8000,
  )
  if (error) throw new Error(`getPlatFamilyInventory: ${error.message}`)
  return rollupPlatFamilyInventory(rows, readAt)
}

const cachedPlatFamilyInventory = makeResilientCached(
  fetchPlatFamilyInventory,
  ['plat-family-inventory-v1'],
  // 15 minutes, the same window as the registry plat inventory
  // (getRegistryPlatPublicInventory) the /subdivisions index sits beside.
  { revalidate: 900, tags: [cacheTag.market] },
  null as PlatFamilyInventory | null,
)

/**
 * The family's on-market inventory, cached 15 minutes. NULL when the read did
 * not answer: the caller then publishes no family count (§0: unknown is not
 * zero) and falls back to the set it can stand behind.
 */
export function getPlatFamilyInventory(memberSlugs: readonly string[]): Promise<PlatFamilyInventory | null> {
  const slugs = [...new Set(memberSlugs.map((s) => s.trim()).filter(Boolean))].sort()
  return cachedPlatFamilyInventory(slugs)
}
