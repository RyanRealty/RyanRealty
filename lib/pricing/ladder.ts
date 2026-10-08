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
 * Hard exclusions run on EVERY rung. Beds and baths use the one-room rule
 * (`lib/pricing/room-counts.ts`): same whole count travels anywhere, one
 * room apart only on own ground, two or more refused everywhere. Soft
 * filters (age/story) start tight and loosen as the ladder widens. A
 * half-bath still matches the same whole count (1 and 1.5 both floor to 1).
 */

import { POCKET_RADIUS_MILES } from '@/lib/pricing/infer-pocket'
import { assertRungsClassified } from '@/lib/pricing/rung-class'

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
  /**
   * THE PARENT LEVEL (Matt 2026-09-09). Every plat inside the subject's own
   * planned, golf or resort community, from the recorded-plat registry. The
   * step above the subject's plat and below the designated neighborhood.
   */
  sameCommunity?: boolean
  /** Only sales on the subject's own street, at close to its size. Runs first. */
  sameStreetOnly?: boolean
  /**
   * Mapped tracts inside the street-cluster / inferred pocket.
   * Named MLS tracts fill this from the 0.25 mi cluster; blank MLS
   * fills it from the 0.35 mi inferred pocket. Skipped when empty.
   */
  samePocket?: boolean
  /**
   * When the community itself is exhausted at two years, another community of
   * the same kind (Matt 2026-09-09: "a Tetherow home's substitute is a Broken
   * Top home, not a subdivision across the highway"). Disclosed.
   */
  likeCommunity?: boolean
  /**
   * Plats that touch the touching plats. Not every other plat in the parent,
   * and not a sale's distance from the subject. A parent neighborhood or
   * community never gives this rung a sale from outside it.
   */
  closerSubdivision?: boolean
  /** May cross the neighborhood/community polygon. Runs only once the boundary is exhausted, and never when a parent neighborhood or community confines the home. */
  crossBoundary?: boolean
  disclosure?: string
  /**
   * Runs ONLY when every rung above left the set below PRICING_MIN_COMPS
   * (Matt 2026-09-09: widen with a disclosure instead of failing). Skipped
   * outright while the bounded ladder is still reaching the minimum.
   */
  whenStarved?: boolean
}

/**
 * The 5-mile city rungs' trace line, read off the rung itself. One sentence
 * once served all three rungs and said "9 months" on the 18- and 24-month
 * rungs and "eight sales" after the target became five (915 Saginaw trace,
 * 2026-10-07).
 */
export function cityRungDisclosure(months: number): string {
  return `The tighter rungs did not fill ${PRICING_TARGET_COMPS} sales, so the search opened to 5 miles and ${months} months inside the same city, still dropping a different product, a rural/urban mix, a resort mismatch, and a subdivision whose prices are in a different tier.`
}

export function pricingTierLadder(opts: { customOrNew?: boolean } = {}): PricingTier[] {
  const customOrNew = opts.customOrNew === true
  const sub = (months: number, sqftBand = PLAT_SQFT_BAND, suffix = ''): PricingTier => ({
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
  /**
   * The subject's own street, at the plat's size band, across the full window.
   * `sameStreetOnly` is matched in passesTier by lib/pricing/price-anchor.ts's
   * sameStreetPeer, which already decides what "same street, same size" means
   * for the price anchor and the recommendation ceiling. One definition.
   */
  const street = (months: number): PricingTier => ({
    name: `own-street-${months}mo`,
    monthsBack: months,
    maxMiles: null,
    sameSubdivision: false,
    similarSubdivision: false,
    sameStreetOnly: true,
    apples: 'utilities',
    sqftBand: PLAT_SQFT_BAND,
    ageYears: null,
    sameStory: false,
    bedSlop: null,
    bathSlop: null,
    disclosure:
      'These sales are on your own street, at close to your size. They are the nearest thing to a sale of your home and they are used before anything else.',
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
  // The plats that touch the subject's, closest first. Months widen inside
  // this row before the next row. A parent neighborhood or community still
  // refuses a touching plat that sits outside that parent.
  const adjacent = (months: number, apples: AppleStrictness): PricingTier => ({
    name: `adjacent-sub-${months}mo`,
    monthsBack: months,
    maxMiles: null,
    sameSubdivision: false,
    similarSubdivision: false,
    adjacentSubdivision: true,
    apples,
    sqftBand: PLAT_WIDE_SQFT_BAND,
    ageYears: apples === 'strict' ? 15 : 25,
    sameStory: apples === 'strict',
    bedSlop: apples === 'strict' ? 1 : 2,
    bathSlop: apples === 'strict' ? 1 : 2,
    disclosure:
      'These sales are in the subdivisions that touch yours, the closest one first. Your own subdivision is finished before any of them.',
  })
  // After the touching plats: only the plats that touch those plats. Not every
  // other plat in the parent, and not a sale's distance from the subject.
  const closer = (months: number, apples: AppleStrictness): PricingTier => ({
    name: `closer-sub-${months}mo`,
    monthsBack: months,
    maxMiles: null,
    sameSubdivision: false,
    similarSubdivision: false,
    closerSubdivision: true,
    apples,
    sqftBand: PLAT_WIDE_SQFT_BAND,
    ageYears: apples === 'strict' ? 15 : 25,
    sameStory: apples === 'strict',
    bedSlop: apples === 'strict' ? 1 : 2,
    bathSlop: apples === 'strict' ? 1 : 2,
    disclosure:
      'These sales are in the subdivisions that touch the subdivisions next to yours. A subdivision that only sits in the same neighborhood is not included.',
  })
  const pocket = (months: number, apples: AppleStrictness): PricingTier => ({
    name: `pocket-${months}mo`,
    monthsBack: months,
    maxMiles: POCKET_RADIUS_MILES,
    sameSubdivision: false,
    similarSubdivision: false,
    samePocket: true,
    apples,
    sqftBand: 0.2,
    ageYears: apples === 'strict' ? 15 : 25,
    sameStory: apples === 'strict',
    bedSlop: apples === 'strict' ? 1 : 2,
    bathSlop: apples === 'strict' ? 1 : 2,
    disclosure:
      'These sales are in the mapped pockets next to this home, inside a quarter mile, walked before any mile ring.',
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
    disclosure: `The subject's own neighborhood did not supply enough sales in ${months} months, so the search crossed its boundary to ${miles} miles. Every sale here is outside the neighborhood and is weighed as such.`,
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
  // THE PARENT LEVEL, and the one above it (Matt 2026-09-09). A plat inside a
  // planned or golf community is held to that community before anything else,
  // and the whole boundary is exhausted to TWO YEARS before a single sale from
  // outside it is considered.
  const community = (months: number, apples: AppleStrictness): PricingTier => ({
    name: `community-${months}mo`,
    monthsBack: months,
    maxMiles: null,
    sameSubdivision: false,
    similarSubdivision: false,
    sameCommunity: true,
    apples,
    sqftBand: PLAT_WIDE_SQFT_BAND,
    ageYears: null,
    sameStory: false,
    bedSlop: 1,
    bathSlop: 1,
  })
  const likeCommunity = (months: number): PricingTier => ({
    name: `like-community-${months}mo`,
    monthsBack: months,
    maxMiles: null,
    sameSubdivision: false,
    similarSubdivision: false,
    likeCommunity: true,
    apples: 'utilities',
    sqftBand: 0.3,
    ageYears: null,
    sameStory: false,
    bedSlop: 1,
    bathSlop: 1,
    ignoreCity: true,
    disclosure:
      'This home sits in a golf or resort community, and that community did not have enough of its own sales even across two years. The sales below come from comparable golf and resort communities in Central Oregon rather than from ordinary neighborhoods nearby, because that is the market a buyer of this home shops against.',
  })
  // Integer quarters so 0.25 + 0.25 does not drift. Through 2 miles.
  const distanceRings: PricingTier[] = []
  for (let quarter = 1; quarter <= 8; quarter++) {
    const miles = quarter / 4
    const apples: AppleStrictness = miles <= 1 ? 'strict' : 'utilities'
    for (const months of [3, 6, 9] as const) distanceRings.push(near(miles, months, apples))
  }
  const tiers: PricingTier[] = [
    // YOUR OWN STREET, FIRST, WHATEVER THE MLS CALLS THE TRACT (Matt
    // 2026-09-10: "We want to look specifically at that address or in that
    // subdivision"). 23 Benaiah carries "N/A" for a subdivision, so every plat
    // rung below skips, and 31 Benaiah, the identical 2,080 sqft plan next
    // door, was only reachable on the five-mile eighteen-month rung, eight
    // sales deep. Whether it made the set at all then depended on how fast the
    // rings above filled, and it moved between builds. A street is a place;
    // this rung finds it before any other plat. It is not a quarter-mile ring.
    street(24),
    // The subject's own plat, the whole clock, including the wide living-area
    // band, before any other plat (Matt 2026-10-06). A sale in another plat
    // is not taken while this clock is still unopened.
    sub(3),
    sub(6),
    sub(9),
    // Same street, different floorplan, still inside the plat. Hayloft 2500 vs
    // 1927 is 23%, inside 35%, outside the tight 25% band.
    sub(3, PLAT_WIDE_SQFT_BAND, '-wide'),
    sub(6, PLAT_WIDE_SQFT_BAND, '-wide'),
    sub(9, PLAT_WIDE_SQFT_BAND, '-wide'),
    sub(12),
    sub(12, PLAT_WIDE_SQFT_BAND, '-wide'),
    sub(18),
    sub(18, PLAT_WIDE_SQFT_BAND, '-wide'),
    sub(24),
    sub(24, PLAT_WIDE_SQFT_BAND, '-wide'),
    // Touching plats, closest first, every month of that row before the next row.
    adjacent(3, 'strict'),
    adjacent(6, 'strict'),
    adjacent(9, 'utilities'),
    adjacent(12, 'utilities'),
    adjacent(18, 'utilities'),
    adjacent(24, 'utilities'),
    // The next row only: plats that touch the touching plats. Not every other
    // plat in the parent, and not a distance ring.
    closer(3, 'strict'),
    closer(6, 'strict'),
    closer(9, 'utilities'),
    closer(12, 'utilities'),
    closer(18, 'utilities'),
    closer(24, 'utilities'),
    // No recorded plat (and rural acreage with no plat): the distance ladder.
    // A recorded subdivision opens these only when its plat rows above hold
    // fewer than the minimum; the parent wall still holds on every one.
    pocket(3, 'strict'),
    pocket(6, 'strict'),
    pocket(9, 'utilities'),
    pocket(12, 'utilities'),
    community(6, 'strict'),
    community(12, 'utilities'),
    community(24, 'utilities'),
    // Distance starts at a quarter mile and steps by a quarter mile.
    // Do not open with a 1-mile ring. One mile and two miles are later steps.
    ...distanceRings,
    ...customTimeFirst,
    // The community is exhausted; its peers are other communities of its kind.
    likeCommunity(24),
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
      disclosure: cityRungDisclosure(9),
    },
    // INSIDE THE BOUNDARY, ALL THE WAY TO TWO YEARS, BEFORE ANY EXIT (Matt
    // 2026-09-09). The polygon wall in passesTier holds on these rungs, so an
    // 18- or 24-month sale inside the subject's own boundary is reached before
    // a fresh sale outside it.
    {
      name: 'city-5mi-18mo',
      monthsBack: 18,
      maxMiles: 5,
      sameSubdivision: false,
      similarSubdivision: true,
      apples: 'product_lot',
      sqftBand: 0.25,
      ageYears: 30,
      sameStory: false,
      bedSlop: null,
      bathSlop: null,
      disclosure: cityRungDisclosure(18),
    },
    {
      name: 'city-5mi-24mo',
      monthsBack: 24,
      maxMiles: 5,
      sameSubdivision: false,
      similarSubdivision: true,
      apples: 'product_lot',
      sqftBand: 0.25,
      ageYears: 30,
      sameStory: false,
      bedSlop: null,
      bathSlop: null,
      disclosure: cityRungDisclosure(24),
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
      disclosure: `Rural sales inside 10 miles and 9 months were still short of ${PRICING_TARGET_COMPS}, so the search extended to 15 miles and 18 months. Older sales carry a larger time adjustment and less weight.`,
    },
    // THE DISCLOSED WIDENING (Matt 2026-09-09), the last rung on the facts
    // path. Reached only when everything above left the set under the
    // minimum, which is the case that used to produce no document at all. It
    // trades age and size, in that order, and nothing else: the apples rule,
    // the bed and bath slop and the product class stay exactly as they are.
    {
      name: 'widened-disclosed-24mo',
      monthsBack: 24,
      maxMiles: 10,
      sameSubdivision: false,
      similarSubdivision: false,
      apples: 'product_lot',
      sqftBand: WIDENED_SQFT_BAND,
      ageYears: null,
      sameStory: false,
      bedSlop: null,
      bathSlop: null,
      whenStarved: true,
      disclosure:
        'The bounded search did not reach the minimum number of sales this price needs, so it was widened one more step rather than left unanswered: sales up to 24 months old, within 25% of this home in size, up to 10 miles out, sales from outside the community this home sits in, where it sits in one, and where it sits outside every mapped neighborhood, sales across a highway or a river from it. An older sale carries a larger market-conditions adjustment and less weight, and a wider search means a wider range. Fannie Mae B4-1.3-08 permits the widening when it is explained.',
    },
  ]
  assertRungsClassified(tiers.map((tier) => tier.name))
  return tiers
}

/**
 * Five price-setting sales stop the AREA widening (Matt 2026-09-22, on 20506
 * Murphy: every sale past five is bought by a wider rung, and that wider rung
 * is what stretched the shaded range). Once the set holds five, no rung that
 * widens the area runs on either ladder: no touching plats, no next plat
 * ring, no distance ring, no neighborhood or community step, no boundary
 * exit, no starved rung. The subject's own ground (own street, own plat, its
 * pocket) is the same area across its whole window and keeps walking. Own
 * ground keeps up to PRICING_WALK_CAP (Matt 2026-10-07, below). The listings ladder
 * stops at the same five (`lib/cma/comps.ts` TARGET_COMPS).
 */
export const PRICING_TARGET_COMPS = 5
/**
 * Five price-setting sales is the floor (Matt 2026-10-07), reversing the
 * 2026-09-10 lowering to 3 that rescued 63 thin documents: a three-sale
 * letter printed a raw min-to-max band and one stray sale put the failed ask
 * inside it, which contradicts the letter. Equal to PRICING_TARGET_COMPS by
 * that rule: the floor and the point where widening stops are one number. A
 * sale that does not set the price (lib/pricing/price-set.ts) never counts
 * toward it; the walks refuse it at admission and go on in order.
 */
export const PRICING_MIN_COMPS = 5
/**
 * WALK TO 7, PRICE ON 5+ (Matt 2026-10-07). Asked: "with five as both the
 * floor and the stop, the search ends at exactly five sales; if the
 * comparability review drops or splits on one, the build fails. How should
 * the search handle that?" Ruling: "Walk to 7, price on 5+": keep walking
 * past five, up to seven, while the same area still holds qualifying sales,
 * so the review (lib/cma/judge.ts, lib/cma/judgment-prune.ts) can drop one or
 * two and still leave five. Nothing widens the area to get them.
 *
 * Mechanically, on both ladders: the subject's own ground (own street, own
 * plat, its pocket) walks its whole window, and no rung that widens the area
 * runs once the set holds PRICING_TARGET_COMPS. Every sale admitted before
 * the rung that reached five keeps its seat. Seats six and seven come only
 * from own ground (only what's needed, Matt 2026-10-07): when own ground
 * reached five it fills up to this many, newest closes first and nearest on a
 * tie (Matt 2026-10-07); when a rung that widens the area reached five, that
 * rung adds only the shortfall and the set is five (its closest homes on the
 * facts ladder, the tightest prices on the listings ladder). Own ground that
 * holds fewer leaves the set at five or six. Every wall (community, neighborhood polygon,
 * recorded plat, 24 months, the room rule, rule 20, the same product type) is
 * unchanged. The floor stays PRICING_MIN_COMPS.
 */
export const PRICING_WALK_CAP = 7
/**
 * The floor is the trim threshold: every priced set sets its highest and
 * lowest aside (Matt 2026-10-07, the band is always the trimmed range). A
 * future floor change moves the trim with it on purpose.
 */
export const RANGE_TRIM_MIN_N = PRICING_MIN_COMPS
/** Never peel the range below three kept sales. A five-sale set keeps three. */
export const RANGE_MIN_KEPT = 3
/**
 * The search may cross the subject's neighborhood/community boundary only
 * when everything inside it supplied fewer sales than a document needs
 * (lib/cma/comps.ts MIN_COMPS = 5, since 2026-10-07). Matt 2026-09-08: "we
 * would go back up to 12 months within that boundary before we would ever
 * leave it."
 */
export const BOUNDARY_EXIT_BELOW = 5
/**
 * Year/quality may outrank radius only when exclusive closed sales sit
 * below this (Matt 2026-09-15 residual: #242 used PRICING_MIN_COMPS = 3).
 */
export const POCKET_STARVE_BELOW = BOUNDARY_EXIT_BELOW
/**
 * Closed + pending in the exclusive pocket that holds geography exclusive
 * (Ranch + Horse Back is a tight set; 1 Horse Back is not).
 */
export const POCKET_TIGHT_SET_MIN = 2
/**
 * How many sales the facts ladder must hold to price a document on its own.
 * Below this the listings ladder (lib/cma/comps.ts, MIN_COMPS = 5 since
 * 2026-10-07) is the fallback. Was 3 until 2026-09-09: Merle's 1617 NW 8th
 * reached exactly 3 on facts once the 12-month subdivision rung landed, the
 * fallback that used to supply 5 never ran, and the build failed the
 * document's own minimum. Equal to PRICING_MIN_COMPS since 2026-10-07: under
 * five on both ladders the build is a comp shortage.
 */
export const FACTS_STANDALONE_MIN = BOUNDARY_EXIT_BELOW

/**
 * Keep the `max` sales whose close prices sit together.
 *
 * A sale older than a year is measured as farther away, so a stale close
 * that happens to match today's prices does not hold a slot a recent sale
 * should have. The list should already be best-first. When two sales are
 * equally far, the later one goes.
 *
 * `removable`, when given, names the only sales the cut may take (walk to 7,
 * Matt 2026-10-07: the place that reached five fills the open seats, and a
 * sale from an earlier place, own ground first, keeps its seat). The middle
 * price is still read over the whole set. With nothing left that may go, the
 * cut stops.
 *
 * `onRemove` sees each sale as the cut takes it, worst first. The last one
 * taken is the rung's next-best sale, which is what the review refills from
 * (Matt 2026-10-08, lib/cma/review-refill.ts).
 */
export function keepTightestByClosePrice<T extends { closePrice: number; closeDate?: string | null }>(
  comps: readonly T[],
  max: number,
  asOf?: string,
  removable?: (comp: T) => boolean,
  onRemove?: (comp: T) => void,
): T[] {
  const kept = [...comps]
  while (kept.length > max) {
    const prices = kept.map((c) => c.closePrice).filter((n) => Number.isFinite(n) && n > 0)
    if (prices.length === 0) break
    const sorted = [...prices].sort((a, b) => a - b)
    const midIndex = Math.floor(sorted.length / 2)
    const mid =
      sorted.length % 2 === 1 ? sorted[midIndex]! : (sorted[midIndex - 1]! + sorted[midIndex]!) / 2
    const dist = (c: T) => {
      const price = Math.abs(c.closePrice - mid) / mid
      const months = monthsBefore(asOf, c.closeDate)
      const stale = months > 12 ? (months - 12) / 12 : 0
      return price + stale
    }
    // The last sale that may go is the starting candidate, so a tie with it
    // still drops the later sale, exactly as before `removable` existed.
    let last = kept.length - 1
    while (last >= 0 && removable && !removable(kept[last]!)) last--
    if (last < 0) break
    let worst = last
    let worstDist = dist(kept[worst]!)
    for (let i = 0; i < last; i++) {
      if (removable && !removable(kept[i]!)) continue
      const d = dist(kept[i]!)
      if (d > worstDist) {
        worstDist = d
        worst = i
      }
    }
    onRemove?.(kept[worst]!)
    kept.splice(worst, 1)
  }
  return kept
}

function monthsBefore(asOf: string | undefined, closeDate: string | null | undefined): number {
  if (!asOf || !closeDate) return 0
  const a = new Date(`${asOf.slice(0, 10)}T00:00:00Z`).getTime()
  const b = new Date(`${closeDate.slice(0, 10)}T00:00:00Z`).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return Math.max(0, (a - b) / (30.44 * 86_400_000))
}
/**
 * How far the subject's own ground reaches for the POOL read (not for any
 * rung). Every containment rung — the plat, the plats beside it, the
 * community, and the 1- and 2-mile rings — sits inside three miles, so this is
 * the box those rungs need in order to see the whole window instead of
 * whatever fit under the citywide row cap. See selectPricingFactsNear in
 * lib/data/pricing/facts.ts for what that cap was costing.
 */
export const LOCAL_POOL_RADIUS_MILES = 3
/**
 * How far back the facts pool is loaded, in calendar months. Ordinary rungs
 * stop at 24, so the pool stops there too: an 18-month floor never loaded a
 * sale one day older than that, and a 24-month rung could not see it. Custom
 * and new rungs also stop at 24, but the pool stays at 30 so a sale the
 * 24-month rung should see is not lost to the calendar-month versus 30.44-day
 * mismatch. Do not shrink the custom window. Do not pull ordinary sales past 24.
 */
export const ORDINARY_FACTS_POOL_MONTHS = 24
export const CUSTOM_FACTS_POOL_MONTHS = 30

export function factsPoolCloseAfter(asOf: string, customOrNew: boolean): string {
  const closeAfter = new Date(asOf.slice(0, 10))
  closeAfter.setMonth(
    closeAfter.getMonth() - (customOrNew ? CUSTOM_FACTS_POOL_MONTHS : ORDINARY_FACTS_POOL_MONTHS),
  )
  return closeAfter.toISOString().slice(0, 10)
}
/**
 * The last-resort rung's size band (Matt 2026-09-10). Was 45%, which let a
 * sale half again the subject's size price it while only half the gap was
 * adjusted back. See WIDENED_SQFT_BAND in lib/cma/comp-tiers.ts.
 */
export const WIDENED_SQFT_BAND = 0.25

/** Own street, own plat, or the 0.25 mi street-cluster pocket. */
export function isPocketExclusiveTier(tier: Pick<PricingTier, 'sameSubdivision' | 'sameStreetOnly' | 'samePocket'>): boolean {
  return Boolean(tier.sameSubdivision || tier.sameStreetOnly || tier.samePocket)
}

/**
 * Mile rings, similar-performing tracts, citywide, and boundary-exit.
 * Not the exclusive pocket, not adjacent plats, not designated communities.
 */
export function isGeographyWidenTier(tier: PricingTier): boolean {
  if (tier.whenStarved || tier.ruralOnly) return false
  if (isPocketExclusiveTier(tier)) return false
  if (tier.sameCommunity || tier.likeCommunity || tier.adjacentSubdivision || tier.closerSubdivision) return false
  return true
}

/**
 * Blank-MLS street cluster (1130 E Canter), not a named plat with nearby
 * plats. Named Kenwood plus three touching plats is not this.
 */
export function isClusterPocket(input: {
  inferredPocket?: { source?: string | null; neighborNorms?: readonly string[] } | null
  pocketSubdivisionNorms?: readonly string[] | null
}): boolean {
  return input.inferredPocket?.source === 'street-cluster'
}

/** Year/quality may jump only when exclusive closed sales are below 5. */
export function pocketStarvedForYearQuality(exclusiveClosed: number): boolean {
  return exclusiveClosed < POCKET_STARVE_BELOW
}

/**
 * Street-cluster / multi-name pockets hold geography at 2 exclusive
 * (closed + pending). A single named plat still needs 5 closed.
 */
export function pocketHoldsGeographyExclusive(
  exclusiveClosed: number,
  exclusivePending: number,
  clusterPocket = false,
): boolean {
  if (clusterPocket) return exclusiveClosed + exclusivePending >= POCKET_TIGHT_SET_MIN
  return exclusiveClosed >= BOUNDARY_EXIT_BELOW
}

/**
 * Stop later rungs when the exclusive pocket already holds.
 *
 * A priceable set (kept >= PRICING_MIN_COMPS) stops, same as before.
 * Under that minimum, two closed sales and nothing pending used to stop too,
 * and the build then failed ("2 of 3 within a quarter mile") instead of
 * walking the rest of the ladder. Canter stays exclusive below the minimum
 * because its tight set includes a pending sale in the pocket (Ranch + Horse
 * Back closed, one Horse Back pending). A cluster of only closed sales that
 * cannot price the document does not stop.
 */
export function pocketStopsLaterRungs(args: {
  kept: number
  exclusiveClosed: number
  exclusivePending?: number
  clusterPocket?: boolean
  minComps?: number
}): boolean {
  const pending = args.exclusivePending ?? 0
  const holds = pocketHoldsGeographyExclusive(args.exclusiveClosed, pending, args.clusterPocket === true)
  if (!holds) return false
  const min = args.minComps ?? PRICING_MIN_COMPS
  if (args.kept >= min) return true
  return args.clusterPocket === true && pending > 0
}

/**
 * THE SIZE BAND INSIDE THE SUBJECT'S OWN PLAT (Matt 2026-09-10).
 *
 * "Location is primary, and within the subdivision, that's the truest sense of
 * comp. When we can get close comps, even if they're a bedroom off one way or
 * another, a bathroom off one way or another, 500 sq ft more or less, we want
 * to try and use stuff in that subdivision first."
 *
 * Five hundred feet on an ordinary Central Oregon home is about a quarter of
 * it, so the plat rungs carry 25% and the wider same-street rungs 35%. Inside
 * the plat this band is the ONLY dimensional test: beds, baths, vintage and
 * story count are all disclosed rather than refused (lib/pricing/match.ts).
 *
 * PLAT_WIDE_SQFT_BAND is a SEARCH band only (Matt 2026-10-08, "25%
 * everywhere"). A sale a wide rung reads past 25% passes the rung's walls and
 * is refused at the door by rule 20 (PRICE_SET_SQFT_BAND in
 * lib/pricing/price-set.ts, equal to PLAT_SQFT_BAND): it never sets the
 * price and never counts toward the five.
 */
export const PLAT_SQFT_BAND = 0.25
export const PLAT_WIDE_SQFT_BAND = 0.35
