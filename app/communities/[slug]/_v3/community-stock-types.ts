/**
 * SITE-177. Community Field type sections and the SERP mix derived from them.
 *
 * The mix a crawler reads may name lots or cabins only when those rows exist
 * in the same listed set the page body renders. No count is derived here —
 * listedCount is the length of that set, or omitted.
 */
import { formatCount } from '@/lib/format/count'
import { getCommunityPopulation } from '@/lib/place/community-population'
import {
  PLACE_BUYER_GROUP_HEADING,
  PLACE_BUYER_GROUPS,
  placeBuyerGroup,
  type PlaceBuyerGroup,
} from '@/lib/place/place-type-style'
import { placeStockSectionsFromTiles } from '@/lib/place/place-inventory-stock'

export type { PlaceBuyerGroup }

export type CommunityStockType = PlaceBuyerGroup

export type CommunityFieldType = {
  key: PlaceBuyerGroup
  heading: string
  count: number
  countLabel: string
}

export type CommunitySerpStock = {
  /** On-page listed count. Null when unknown or empty — never a degraded zero. */
  listedCount: number | null
  types: readonly PlaceBuyerGroup[]
}

const MIX_NOUN: Record<PlaceBuyerGroup, { one: string; many: string }> = {
  homes: { one: 'home', many: 'homes' },
  cabins: { one: 'cabin', many: 'cabins' },
  attached: { one: 'attached home', many: 'attached homes' },
  multifamily: { one: 'multifamily home', many: 'multifamily homes' },
  lots: { one: 'lot', many: 'lots' },
  other: { one: 'other listing', many: 'other listings' },
}

export function communityStockTypeKey(
  propertyType?: string | null,
  propertySubType?: string | null,
): PlaceBuyerGroup {
  return placeBuyerGroup(propertyType, propertySubType)
}

export function communityStockTypesFromListings(
  listings: readonly { propertyType?: string | null; propertySubType?: string | null }[],
): PlaceBuyerGroup[] {
  const present = new Set<PlaceBuyerGroup>()
  for (const listing of listings) {
    present.add(placeBuyerGroup(listing.propertyType, listing.propertySubType))
  }
  return PLACE_BUYER_GROUPS.filter((key) => present.has(key))
}

export function communityFieldTypeIndex(
  listings: readonly { propertyType?: string | null; propertySubType?: string | null }[],
): CommunityFieldType[] {
  const counts: Record<PlaceBuyerGroup, number> = {
    homes: 0,
    cabins: 0,
    attached: 0,
    multifamily: 0,
    lots: 0,
    other: 0,
  }
  for (const listing of listings) {
    counts[placeBuyerGroup(listing.propertyType, listing.propertySubType)] += 1
  }
  return PLACE_BUYER_GROUPS.flatMap((key) => {
    const count = counts[key]
    if (count <= 0) return []
    return [
      {
        key,
        heading: PLACE_BUYER_GROUP_HEADING[key],
        count,
        countLabel: `${formatCount(count)} for sale`,
      },
    ]
  })
}

/** "homes and lots" — only the types the listed set actually carries. */
export function communityStockMixPhrase(types: readonly PlaceBuyerGroup[]): string | null {
  const nouns = types.map((key) => MIX_NOUN[key].many)
  if (nouns.length === 0) return null
  if (nouns.length === 1) return nouns[0]
  if (nouns.length === 2) return `${nouns[0]} and ${nouns[1]}`
  return `${nouns.slice(0, -1).join(', ')}, and ${nouns[nouns.length - 1]}`
}

export function communityStockMixSentence(types: readonly PlaceBuyerGroup[]): string | null {
  const phrase = communityStockMixPhrase(types)
  if (!phrase) return null
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} for sale.`
}

/**
 * The listed set generateMetadata and the Field type index must agree with:
 * the community's for-sale population, the one set the page body lists and
 * the map draws (lib/place/community-population.ts). Every publicly active
 * type. A population that did not read completely THROWS, so the caller's
 * guarded read omits the count instead of printing a short one; a timeout at
 * the caller omits it the same way.
 */
export async function loadCommunitySerpStock(input: {
  slug: string
}): Promise<{ listedCount: number; types: PlaceBuyerGroup[] }> {
  const population = await getCommunityPopulation(input.slug)
  if (!population || !population.complete) {
    throw new Error(`[loadCommunitySerpStock] ${input.slug}: population read did not complete`)
  }
  const rows = placeStockSectionsFromTiles(population.tiles).flatMap((section) => section.rows)
  return {
    listedCount: rows.length,
    types: communityStockTypesFromListings(rows),
  }
}
