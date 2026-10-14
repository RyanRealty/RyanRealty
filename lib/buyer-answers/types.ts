export type BuyerAnswerKind =
  | 'living'
  | 'cost'
  | 'hoa'
  | 'str'
  | 'vs'
  | 'preset'
  | 'new-construction'
  | 'from-out-of-state'
  | 'second-home'
  | 'buying'

export type BuyerAnswerPlaceKind = 'community' | 'city' | 'neighborhood'

export type BuyerAnswerTableRow = {
  label: string
  value: string
}

export type BuyerAnswerFaq = {
  question: string
  answer: string
}

export type BuyerAnswerLink = {
  href: string
  label: string
}

export type BuyerAnswerFigures = {
  name: string
  publicSlug: string
  durableSlug: string
  placeKind: BuyerAnswerPlaceKind
  cityName: string
  citySlug: string
  hubHref: string
  activeCount: number | null
  medianListPrice: number | null
  monthsOfSupply: number | null
  medianDaysToPending: number | null
  closedLast30Days: number | null
  refreshedAt: string | null
  hoaAnnual: number | null
  hoaKind: 'measured' | 'master' | null
  hoaBasis: string | null
  listingCount: number
}

export type SourcedStrFact = {
  summary: string
  sourceLabel: string
  sourceHref: string
}

export type BuyerAnswerDef = {
  id: string
  query: string
  kind: BuyerAnswerKind
  path: string
  title: string
  h1: string
  /** Public URL slug for the primary place. */
  slug: string
  placeKind: BuyerAnswerPlaceKind
  /** Comparison target public slug, vs pages only. */
  otherSlug?: string
  otherPlaceKind?: BuyerAnswerPlaceKind
  /** Existing search-preset slug when kind is preset. */
  presetSlug?: string
  citySlug?: string
}

export type BuyerAnswerModel = {
  def: BuyerAnswerDef
  answer: string
  citation: string
  asOfLabel: string | null
  asOfIso: string | null
  table: { caption: string; rows: BuyerAnswerTableRow[] }
  faqs: BuyerAnswerFaq[]
  placeName: string
  hub: BuyerAnswerLink
  buyLinks: BuyerAnswerLink[]
  byline: BuyerAnswerLink
  listings: import('@/components/site/v3').V3ListingRowData[]
  listingsHeading: string
  listingsEmpty: string
  listingsHref: string
  otherHub?: BuyerAnswerLink
}
