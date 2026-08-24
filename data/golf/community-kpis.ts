/**
 * Real-estate KPIs per golf community — Market Truth leftover + inventory.
 *
 * Neighborhood cache sold/median is alias-attributed (untrusted). Cards take
 * leftover.medianClose / leftover.closedCount and getDetachedInventories
 * active_count when publishable. Neighborhood grain first; same-slug city
 * fills MLS-city communities (Sunriver). Miss is null, never cache, never 0.
 *
 * medianDom stays null: leftover days-to-contract is not DOM, and the golf LP
 * labels are median sale / sold / inventory (cannot relabel as days to contract
 * without editing the LP).
 *
 * Fail-safe: missing KPI omits on the card rather than showing a wrong number.
 */

import 'server-only'
import {
  getDetachedInventories,
  type DetachedInventory,
} from '@/lib/data/market-truth/getSellBendMarket'
import {
  EMPTY_PUBLIC_PACE,
  getPublicDetachedPace,
  type PublicPaceRow,
} from '@/lib/data/market-truth/public-pace'

export interface GolfCommunityKpi {
  geoSlug: string
  medianSalePrice: number | null
  soldCount12mo: number | null
  activeInventory: number | null
  medianDom: number | null
  computedAt: string | null
  methodologyVersion: string | null
}

const GOLF_COMMUNITY_SLUGS = [
  'tetherow',
  'broken-top',
  'pronghorn',
  'sunriver',
  'caldera-springs',
  'crosswater',
  'black-butte-ranch',
  'brasada-ranch',
  'eagle-crest',
  'awbrey-glen',
  'widgi-creek',
  'three-rivers',
] as const

export type GolfCommunitySlug = (typeof GOLF_COMMUNITY_SLUGS)[number]

function leftoverHasPublished(row: PublicPaceRow): boolean {
  return row.medianClose != null || row.closedCount != null
}

export function pickGolfCommunityLeftover(
  neighborhood: PublicPaceRow,
  city: PublicPaceRow,
): PublicPaceRow {
  if (leftoverHasPublished(neighborhood)) return neighborhood
  if (leftoverHasPublished(city)) return city
  return neighborhood
}

export function pickGolfCommunityInventory(
  slug: string,
  map: Map<string, DetachedInventory>,
): DetachedInventory | null {
  return map.get(`neighborhood:${slug}`) ?? map.get(`city:${slug}`) ?? null
}

export function assembleGolfCommunityKpi(input: {
  geoSlug: string
  leftover: PublicPaceRow
  inventory: DetachedInventory | null
}): GolfCommunityKpi | null {
  const medianSalePrice = input.leftover.medianClose
  const soldCount12mo = input.leftover.closedCount
  const activeInventory = input.inventory?.activeCount ?? null
  if (medianSalePrice == null && soldCount12mo == null && activeInventory == null) return null
  return {
    geoSlug: input.geoSlug,
    medianSalePrice,
    soldCount12mo,
    activeInventory,
    medianDom: null,
    computedAt: input.inventory?.computedAt ?? null,
    methodologyVersion: 'mt-v1',
  }
}

function emptyKpiRecord(): Record<GolfCommunitySlug, GolfCommunityKpi | null> {
  const out = {} as Record<GolfCommunitySlug, GolfCommunityKpi | null>
  for (const slug of GOLF_COMMUNITY_SLUGS) out[slug] = null
  return out
}

async function readLeftover(slug: GolfCommunitySlug): Promise<PublicPaceRow> {
  let neighborhood = EMPTY_PUBLIC_PACE
  try {
    neighborhood = await getPublicDetachedPace({ geoType: 'neighborhood', geoSlug: slug })
  } catch (e) {
    console.warn(`[golf-lp] leftover miss for ${slug}:`, e)
  }
  if (leftoverHasPublished(neighborhood)) return neighborhood
  try {
    const city = await getPublicDetachedPace({ geoType: 'city', geoSlug: slug })
    if (leftoverHasPublished(city)) return city
  } catch (e) {
    console.warn(`[golf-lp] city leftover miss for ${slug}:`, e)
  }
  return neighborhood
}

export async function loadGolfCommunityKpis(): Promise<Record<GolfCommunitySlug, GolfCommunityKpi | null>> {
  const leftoverTask = Promise.all(GOLF_COMMUNITY_SLUGS.map(readLeftover))
  const inventoryTask = getDetachedInventories(
    GOLF_COMMUNITY_SLUGS.flatMap((geoSlug) => [
      { geoType: 'neighborhood' as const, geoSlug },
      { geoType: 'city' as const, geoSlug },
    ]),
  ).catch((e) => {
    console.warn('[golf-lp] inventory query failed:', e)
    return new Map<string, DetachedInventory>()
  })

  const [leftovers, inventories] = await Promise.all([leftoverTask, inventoryTask])
  const out = emptyKpiRecord()
  GOLF_COMMUNITY_SLUGS.forEach((slug, i) => {
    out[slug] = assembleGolfCommunityKpi({
      geoSlug: slug,
      leftover: leftovers[i] ?? EMPTY_PUBLIC_PACE,
      inventory: pickGolfCommunityInventory(slug, inventories),
    })
  })
  return out
}

/** Round currency to thousands per voice rules. $895,000 not $894,750. */
export function formatCurrencyToThousands(value: number | null): string | null {
  if (value == null || !Number.isFinite(value)) return null
  const rounded = Math.round(value / 1000) * 1000
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(rounded)
}
