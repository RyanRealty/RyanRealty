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

/** Community record for detail page (from DB or derived). */
export type CommunityDetail = {
  slug: string
  entityKey: string
  city: string
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
}
