/** Community row for the index page. */
export type CommunityForIndex = {
  slug: string
  entityKey: string
  city: string
  subdivision: string
  activeCount: number
  medianPrice: number | null
  heroImageUrl: string | null
  isResort: boolean
  description?: string
}

/** Resort community names to show first on index (Section 17). */
export const RESORT_DISPLAY_NAMES = [
  'Tetherow',
  'Broken Top',
  'Black Butte Ranch',
  'Brasada Ranch',
  'Eagle Crest',
  'Pronghorn',
  'Sunriver',
  'Caldera Springs',
  'Crosswater',
  'Vandevert Ranch',
]

/** Return resort communities in primary Central Oregon cities, sorted by city order then by RESORT_DISPLAY_NAMES / activity. */
export function sortResortCommunitiesInPrimaryCities(
  communities: CommunityForIndex[],
  getPrimaryCityRank: (cityName: string) => number
): CommunityForIndex[] {
  const resort = communities.filter((c) => c.isResort && getPrimaryCityRank(c.city) >= 0)
  const displayOrder = new Map(RESORT_DISPLAY_NAMES.map((name, i) => [name.toLowerCase(), i]))
  resort.sort((a, b) => {
    const cityRankA = getPrimaryCityRank(a.city)
    const cityRankB = getPrimaryCityRank(b.city)
    if (cityRankA !== cityRankB) return cityRankA - cityRankB
    const orderA = displayOrder.get(a.subdivision.toLowerCase().trim()) ?? 999
    const orderB = displayOrder.get(b.subdivision.toLowerCase().trim()) ?? 999
    if (orderA !== orderB) return orderA - orderB
    return b.activeCount - a.activeCount || a.subdivision.localeCompare(b.subdivision)
  })
  return resort
}

/** Community record for detail page (from DB or derived). */
export type CommunityDetail = {
  slug: string
  entityKey: string
  city: string
  citySlug: string
  subdivision: string
  name: string
  description: string | null
  heroImageUrl: string | null
  boundaryGeojson: unknown
  isResort: boolean
  resortContent: Record<string, unknown> | null
  activeCount: number
  medianPrice: number | null
  avgDom: number | null
  closedLast12Months: number
  /** Neighborhood name (null if community is not within a named neighborhood). */
  neighborhoodName: string | null
  /** Neighborhood URL slug (null if community is not within a named neighborhood). */
  neighborhoodSlug: string | null
}
