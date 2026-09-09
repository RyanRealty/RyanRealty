/**
 * The repetitive pricing search — time first, then distance, then similar
 * subdivisions. Matt 2026-08-14:
 *
 *   1. Same subdivision, last 3 months
 *   2. Same subdivision, 6 months
 *   3. Same subdivision, 9 months
 *   4. Expand distance, reset the clock to 3 / 6 / 9
 *   5. Keep expanding. Bring in similar-performing subdivisions.
 *      Never a gated / much-more-expensive (or much-cheaper) subdivision.
 *      Never rural vs urban. Age, stories, beds, baths, GLA filter first.
 *
 * Hard exclusions run on EVERY rung, including whole bathroom count
 * (1-bath vs 2-bath is a different buyer). Soft filters (age/story/beds)
 * start tight and loosen as the ladder widens. A half-bath still matches
 * the same whole count (1 and 1.5 both floor to 1).
 */

export type AppleStrictness = 'strict' | 'utilities' | 'product_lot'

export type PricingTier = {
  name: string
  monthsBack: number
  maxMiles: number | null
  sameSubdivision: boolean
  similarSubdivision: boolean
  apples: AppleStrictness
  sqftBand: number
  ageYears: number | null
  sameStory: boolean
  bedSlop: number | null
  bathSlop: number | null
  ignoreCity?: boolean
  ruralOnly?: boolean
  /** Membership is the ring of plats next to the subject's, inside its boundary. */
  adjacentSubdivision?: boolean
  /** May cross the neighborhood/community polygon. Runs only once the boundary is exhausted. */
  crossBoundary?: boolean
  disclosure?: string
}

export function pricingTierLadder(opts: { customOrNew?: boolean } = {}): PricingTier[] {
  const customOrNew = opts.customOrNew === true
  const sub = (months: number, sqftBand = 0.15, suffix = ''): PricingTier => ({
    name: `subdivision-${months}mo${suffix}`,
    monthsBack: months,
    maxMiles: null,
    sameSubdivision: true,
    similarSubdivision: false,
    apples: 'strict',
    sqftBand,
    ageYears: 15,
    sameStory: true,
    bedSlop: 1,
    bathSlop: 1,
  })
  const near = (miles: number, months: number, apples: AppleStrictness): PricingTier => ({
    name: `nearby-${miles}mi-${months}mo`,
    monthsBack: months,
    maxMiles: miles,
    sameSubdivision: false,
    similarSubdivision: false,
    apples,
    sqftBand: apples === 'strict' ? 0.15 : 0.2,
    ageYears: apples === 'strict' ? 15 : 25,
    sameStory: apples === 'strict',
    bedSlop: apples === 'strict' ? 1 : 2,
    bathSlop: apples === 'strict' ? 1 : 2,
  })
  // Containment (Matt 2026-09-08): the plats that touch the subject's, inside
  // the same neighborhood or community, walked 3 → 12 months before any
  // distance ring. Old Bend never again prices off Southwest Crossing.
  const adjacent = (months: number, apples: AppleStrictness): PricingTier => ({
    name: `adjacent-sub-${months}mo`,
    monthsBack: months,
    maxMiles: null,
    sameSubdivision: false,
    similarSubdivision: false,
    adjacentSubdivision: true,
    apples,
    sqftBand: 0.2,
    ageYears: apples === 'strict' ? 15 : 25,
    sameStory: apples === 'strict',
    bedSlop: apples === 'strict' ? 1 : 2,
    bathSlop: apples === 'strict' ? 1 : 2,
    disclosure:
      'These sales are in the subdivisions that touch yours, inside the same neighborhood, walked before any distance ring.',
  })
  // The exit. Only after the subdivision, its neighbours and every ring inside
  // the boundary have run, and only when they supplied fewer than the minimum.
  const beyond = (miles: number, months: number): PricingTier => ({
    name: `beyond-${miles}mi-${months}mo`,
    monthsBack: months,
    maxMiles: miles,
    sameSubdivision: false,
    similarSubdivision: true,
    crossBoundary: true,
    apples: 'product_lot',
    sqftBand: 0.25,
    ageYears: 30,
    sameStory: false,
    bedSlop: 2,
    bathSlop: 2,
    disclosure: `The subject's own neighborhood did not supply enough sales in 12 months, so the search crossed its boundary to ${miles} miles. Every sale here is outside the neighborhood and is weighed as such.`,
  })
  const similar = (months: number): PricingTier => ({
    name: `similar-sub-${months}mo`,
    monthsBack: months,
    maxMiles: 4,
    sameSubdivision: false,
    similarSubdivision: true,
    apples: 'utilities',
    sqftBand: 0.2,
    ageYears: 25,
    sameStory: false,
    bedSlop: 2,
    bathSlop: 2,
    disclosure:
      'These sales are outside the subject subdivision. They come from subdivisions whose recent median sale price per square foot is within 30% of the subject subdivision — the same buyer pool, not a gated or much-cheaper tract.',
  })
  // Custom/new: widen TIME at a modest radius before opening more geography.
  // Same-generation peers are sparse; a 9-month 1-mile ring starves North Rim.
  // GLA ±25%: live Perspective (3963) vs Rim View (4972) is 20.3% — inside
  // the listings fallback band, outside the ordinary 20% utilities band.
  const customNear = (miles: number, months: number, apples: AppleStrictness): PricingTier => ({
    ...near(miles, months, apples),
    sqftBand: 0.25,
  })
  // Live Rim View: same-gen peers are sparse inside 2mi/9mo. Push time and a
  // modest radius before similar-sub / rural padding so a third Perspective-
  // class sale can fill MIN_COMPS without reopening 1970s stock.
  const customTimeFirst: PricingTier[] = customOrNew
    ? [
        customNear(2, 12, 'utilities'),
        customNear(2, 18, 'utilities'),
        customNear(2, 24, 'utilities'),
        customNear(4, 12, 'utilities'),
        customNear(4, 18, 'product_lot'),
        customNear(4, 24, 'product_lot'),
        customNear(6, 18, 'product_lot'),
        customNear(6, 24, 'product_lot'),
      ]
    : []
  return [
    sub(3),
    sub(6),
    sub(9),
    // Same street, different floorplan, before the next tract. Hayloft 2500 vs
    // 1927 is 23% — inside 30%, outside the tight 15% band.
    sub(3, 0.3, '-wide'),
    sub(6, 0.3, '-wide'),
    sub(9, 0.3, '-wide'),
    sub(12),
    sub(12, 0.3, '-wide'),
    adjacent(3, 'strict'),
    adjacent(6, 'strict'),
    adjacent(9, 'utilities'),
    adjacent(12, 'utilities'),
    near(1, 3, 'strict'),
    near(1, 6, 'strict'),
    near(1, 9, 'strict'),
    near(2, 3, 'utilities'),
    near(2, 6, 'utilities'),
    near(2, 9, 'utilities'),
    ...customTimeFirst,
    similar(3),
    similar(6),
    similar(9),
    {
      name: 'city-5mi-9mo',
      monthsBack: 9,
      maxMiles: 5,
      sameSubdivision: false,
      similarSubdivision: true,
      apples: 'product_lot',
      sqftBand: 0.25,
      ageYears: 30,
      sameStory: false,
      bedSlop: null,
      bathSlop: null,
      disclosure:
        'The tighter rungs did not fill eight sales, so the search opened to 5 miles and 9 months inside the same city, still dropping a different product, a rural/urban mix, a resort mismatch, and a subdivision whose prices are in a different tier.',
    },
    beyond(2, 12),
    beyond(5, 12),
    {
      name: 'rural-10mi-9mo',
      monthsBack: 9,
      maxMiles: 10,
      sameSubdivision: false,
      similarSubdivision: false,
      apples: 'utilities',
      sqftBand: 0.25,
      ageYears: 30,
      sameStory: false,
      bedSlop: 2,
      bathSlop: 2,
      ignoreCity: true,
      ruralOnly: true,
      disclosure:
        'The subject is rural acreage. The MLS city is a mailing address, so sales up to 10 miles in neighboring mailing cities were included. Fannie Mae B4-1.3-08 permits a wider rural search when the widening is explained.',
    },
    {
      name: 'rural-15mi-18mo',
      monthsBack: 18,
      maxMiles: 15,
      sameSubdivision: false,
      similarSubdivision: false,
      apples: 'product_lot',
      sqftBand: 0.35,
      ageYears: null,
      sameStory: false,
      bedSlop: null,
      bathSlop: null,
      ignoreCity: true,
      ruralOnly: true,
      disclosure:
        'Rural sales inside 10 miles and 9 months were still short of eight, so the search extended to 15 miles and 18 months. Older sales carry a larger time adjustment and less weight.',
    },
  ]
}

export const PRICING_TARGET_COMPS = 8
export const PRICING_MIN_COMPS = 3
/**
 * The search may cross the subject's neighborhood/community boundary only
 * when everything inside it supplied fewer sales than a document needs
 * (lib/cma/comps.ts MIN_COMPS = 5). Matt 2026-09-08: "we would go back up to
 * 12 months within that boundary before we would ever leave it."
 */
export const BOUNDARY_EXIT_BELOW = 5
/**
 * How many sales the facts ladder must hold to price a document on its own.
 * Below this the listings ladder (lib/cma/comps.ts, MIN_COMPS = 5) is the
 * fallback. Was 3 until 2026-09-09: Merle's 1617 NW 8th reached exactly 3 on
 * facts once the 12-month subdivision rung landed, the fallback that used to
 * supply 5 never ran, and the build failed the document's own minimum.
 */
export const FACTS_STANDALONE_MIN = BOUNDARY_EXIT_BELOW
/** Cap the priced set. Extra comps past ten dilute the median. */
export const PRICING_MAX_COMPS = 10
