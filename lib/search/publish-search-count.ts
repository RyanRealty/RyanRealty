/**
 * Published search inventory counts — ONE number per grain, labeled.
 *
 * Fleet findings (2026-08-16, /homes-for-sale): the All-filters sheet said
 * Show 409 homes after Beds 3+ and max $800K, then the results row printed
 * 318 homes in this map view. Those are two populations:
 *
 *   filter-match   countSearchListings (URL filters, no bbox)
 *   map-viewport   getViewportSearch (same filters + current map bounds)
 *
 * City browse printed 1,298 homes for sale next to FAQ 483 active
 * single-family. Header is all property types; FAQ is SFR pulse.
 *
 * This helper is the caption. Filter-match is the coherent number for the
 * URL filters. Viewport may print only when it differs, and only as
 * "in this map view". All-types and SFR must name their type_scope (R-024).
 */

/**
 * `sfr` is the city's active single-family inventory — every class-A row on the
 * market, fractional interests included, because a share on the market is real
 * inventory.
 *
 * `sfr-whole-home-priced` is the subset a price statistic may be computed over:
 * the rows whose ListPrice is an asking price for a whole dwelling. It exists
 * because the two were published on one screen under the SAME caption.
 * /homes-for-sale/sunriver read "Active single-family homes 122" in the hero
 * over a price ladder captioned "89 active single-family listings, grouped by
 * asking price", with band notes reading "% of 89 active single-family
 * listings". Both counts are right — live listing_tile_mv 2026-08-19, Sunriver,
 * property_type A, Active or Active Under Contract: 122 rows, 33 of them
 * fractional by sub type, 89 priced whole homes, 0 unpriced — and one label
 * over two populations is the §0.5 failure. This grain is why the smaller
 * number now says which population it counted.
 */
export type SearchCountGrain =
  | 'filter-match'
  | 'map-viewport'
  | 'all-types'
  | 'sfr'
  | 'sfr-whole-home-priced'

export type PublishedSearchCount = {
  value: number
  caption: string
  phrase: string
}

function asCount(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null
  return Math.floor(value)
}

export function searchCountCaption(grain: SearchCountGrain, value: number): string {
  const singular = value === 1
  switch (grain) {
    case 'filter-match':
      return singular ? 'home' : 'homes'
    case 'map-viewport':
      return singular ? 'home in this map view' : 'homes in this map view'
    case 'all-types':
      return singular ? 'home for sale, all types' : 'homes for sale, all types'
    case 'sfr':
      return singular ? 'active single-family listing' : 'active single-family listings'
    case 'sfr-whole-home-priced':
      return singular
        ? 'active single-family listing priced as a whole home'
        : 'active single-family listings priced as whole homes'
  }
}

export function publishSearchCount(input: {
  value: number | null | undefined
  grain: SearchCountGrain
  capped?: boolean
}): PublishedSearchCount | null {
  const value = asCount(input.value)
  if (value == null) return null
  const caption = searchCountCaption(input.grain, input.capped ? 2 : value)
  const n = input.capped ? `${value.toLocaleString('en-US')}+` : value.toLocaleString('en-US')
  return { value, caption, phrase: `${n} ${caption}` }
}

/**
 * Filter-match is the number for the same URL filters. Viewport is a
 * different population and prints only when the count differs (or the
 * viewport list is capped).
 */
export function publishSearchCountPair(input: {
  matchCount: number | null | undefined
  viewportCount: number | null | undefined
  viewportCapped?: boolean
}): {
  match: PublishedSearchCount | null
  viewport: PublishedSearchCount | null
} {
  const match = publishSearchCount({ value: input.matchCount, grain: 'filter-match' })
  const viewport = publishSearchCount({
    value: input.viewportCount,
    grain: 'map-viewport',
    capped: input.viewportCapped,
  })
  if (match && viewport && match.value === viewport.value && !input.viewportCapped) {
    return { match, viewport: null }
  }
  return { match, viewport }
}
