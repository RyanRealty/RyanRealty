/**
 * Live Active PropertyType-A inventory for the under-$500K Central Oregon hub.
 *
 * Reads listing_search_mv (the same MV searchListingsAll / getSearchMatrixInventory
 * use). Filters Active + PropertyType A for the six towns, then the pure
 * aggregator in under-500k-classify.ts applies ListPrice < 500000 and the
 * subtype split. SFR medians use every Active SFR list price in that town
 * (Query B), never market_pulse_live.median_list_price — that Bend pulse cell
 * has printed $745K, which is the mixed-type figure, not single-family.
 *
 * Per docs/DATABASE_FOR_AI_AGENTS.md §0: this is an inventory count, not a
 * sold-sale market report. The cache tables do not carry an under-$500K
 * residential split.
 */

import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import {
  aggregateUnder500kTowns,
  headlineUnder500kTotals,
  UNDER_500K_TOWNS,
  type Under500kListingRow,
  type Under500kTownCounts,
} from '@/lib/data/listings/under-500k-classify'

export type { Under500kTownCounts } from '@/lib/data/listings/under-500k-classify'

const PAGE_SIZE = 1000
const MAX_ROWS = 8000

const CITY_LOWERS = UNDER_500K_TOWNS.map((t) => t.cityLower)

export type Under500kCityInventory = {
  asOfIso: string
  towns: Under500kTownCounts[]
  headlineResidential: number
  headlineSfr: number
}

type MvRow = {
  city_lower: string | null
  property_sub_type: string | null
  list_price: number | null
}

async function fetchUnder500kCityInventory(): Promise<Under500kCityInventory> {
  const supabase = supabaseAnon()
  if (!supabase) throw new Error('[getUnder500kCityInventory] supabase not configured')

  const rows: Under500kListingRow[] = []
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('listing_search_mv')
      .select('city_lower, property_sub_type, list_price')
      .in('city_lower', CITY_LOWERS)
      .eq('standard_status', 'Active')
      .eq('property_type', 'A')
      .order('listing_key', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)
    if (error) {
      throw new Error(`[getUnder500kCityInventory] supabase error: ${error.message}`)
    }
    const page = (data ?? []) as unknown as MvRow[]
    for (const row of page) {
      rows.push({
        cityLower: row.city_lower,
        propertySubType: row.property_sub_type,
        listPrice: row.list_price == null ? null : Number(row.list_price),
      })
    }
    if (page.length < PAGE_SIZE) break
  }

  const towns = aggregateUnder500kTowns(rows)
  const headline = headlineUnder500kTotals(towns)
  return {
    asOfIso: new Date().toISOString(),
    towns,
    headlineResidential: headline.residential,
    headlineSfr: headline.sfr,
  }
}

export const getUnder500kCityInventory = makeResilientCached(
  fetchUnder500kCityInventory,
  ['under-500k-city-inventory-v1'],
  {
    revalidate: CACHE_WINDOWS.listingTile,
    tags: [cacheTag.listings],
  },
  null,
)
