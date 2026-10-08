/**
 * ONE STORY ABOUT THE DATE MOVE (reader review, 62475 Woodsman, 2026-10-08).
 *
 * The stored record on cma-62475-woodsman said three different things about
 * the same seven sales:
 *
 *  - `pricing.timeAdjustment` had basis 'exclusive-pocket-sold-list' and
 *    source text "Exclusive pocket: date adjustment does not walk
 *    pricing_market_index for bend", query "index computed but not applied",
 *    sentence "... The Bend city index is not used to pump prices.";
 *  - every comp row had marketPathSource 'index', and six of the seven were
 *    moved down 1.4 to 7.0 percent by exactly that index;
 *  - the letter said "Bend's median price per square foot fell", with no word
 *    on which figure that is, after a page that told the owner Shevlin West's
 *    own price per square foot held flat.
 *
 * These run Woodsman's seven sales through the city-index walk, on the Bend
 * pricing_market_index rows read for the review, and hold the stored basis,
 * each comp's path source and the printed sentences to one account. The
 * prices are pinned to the stored draft: this changes words, never a number.
 *
 * Since Matt's 2026-10-08 ruling ("Down only if local fell") the build walks
 * a pocket down only when the letter's local read fell, and Woodsman's held
 * flat, so a rebuild moves none of these sales (lib/cma/pocket-local-gate.test.ts
 * holds that). The walk here passes no local read: it is the record of a
 * pocket the index DID move (the local-fell branch moves exactly these
 * dollars), and of the rows stored before the gate, which still print.
 */
import { describe, expect, it } from 'vitest'
import { adjustCmaCompAlongMarket, buildTimeAdjustmentBasis, TIME_ADJUSTMENT_MEASURE_INDEX } from '@/lib/pricing/estimate'
import {
  isPocketTimeBasis,
  TIME_ADJUSTMENT_BASIS_POCKET,
  TIME_ADJUSTMENT_BASIS_POCKET_INDEX,
} from '@/lib/pricing/exclusive-pocket-date-adj'
import type { MarketIndexPoint } from '@/lib/pricing/market-path'
import { dateBasisCaption, salesMethodSentences } from '@/lib/cma/sales-method-note'
import type { CmaAdjustedComp, CmaComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

/**
 * pricing_market_index, city_slug = 'bend', month 2025-09 to 2026-09, read
 * 2026-10-08: `select month, n, median_ppsf from pricing_market_index where
 * city_slug = 'bend' and month >= '2025-09-01' order by month`.
 */
const BEND: MarketIndexPoint[] = [
  { month: '2025-09-01', n: 260, ppsf: 391.34 },
  { month: '2025-10-01', n: 225, ppsf: 400.25 },
  { month: '2025-11-01', n: 195, ppsf: 395.45 },
  { month: '2025-12-01', n: 191, ppsf: 367.75 },
  { month: '2026-01-01', n: 142, ppsf: 389.945 },
  { month: '2026-02-01', n: 170, ppsf: 390.605 },
  { month: '2026-03-01', n: 216, ppsf: 379.465 },
  { month: '2026-04-01', n: 206, ppsf: 398.125 },
  { month: '2026-05-01', n: 238, ppsf: 413.3 },
  { month: '2026-06-01', n: 291, ppsf: 414.36 },
  { month: '2026-07-01', n: 279, ppsf: 394.03 },
  { month: '2026-08-01', n: 243, ppsf: 384.5 },
  { month: '2026-09-01', n: 210, ppsf: 371.325 },
]

/** render_args.generatedAtIso on the stored Woodsman draft. */
const AS_OF = '2026-10-08T02:59:09.212Z'

const subject = {
  streetAddress: '62475 Woodsman',
  city: 'Bend',
  subdivision: 'Shevlin West',
  beds: 3,
  baths: 4,
  sqft: 2673,
  yearBuilt: 2025,
  lotAcres: 0.19,
} as unknown as CmaSubject

/** render_args.comps on the stored row: close, recorded concession, and the stored date move. */
const SALES = [
  { address: '62531 Woodsman', closeDate: '2026-09-04', close: 1_662_500, concessions: 0, sqft: 2824, storedDate: 0 },
  { address: '62467 Woodsman', closeDate: '2026-06-25', close: 1_708_800, concessions: 41_100, sqft: 2998, storedDate: -116_239 },
  { address: '62637 Mt Hood', closeDate: '2026-05-06', close: 1_455_000, concessions: 5_000, sqft: 2488, storedDate: -101_065 },
  { address: '62552 Woodsman', closeDate: '2026-04-23', close: 1_570_000, concessions: 10_000, sqft: 2693, storedDate: -53_352 },
  { address: '62621 Mt Hood', closeDate: '2026-04-21', close: 1_625_000, concessions: 0, sqft: 2845, storedDate: -55_575 },
  { address: '62667 Ember', closeDate: '2026-02-20', close: 1_380_000, concessions: 1_000, sqft: 2262, storedDate: -19_306 },
  { address: '3369 Zayden', closeDate: '2025-12-11', close: 1_807_500, concessions: 0, sqft: 2904, storedDate: -25_305 },
]

function sale(s: (typeof SALES)[number], i: number): CmaComp {
  return {
    listingKey: `K${i + 1}`,
    address: s.address,
    city: 'Bend',
    subdivision: 'Shevlin West',
    beds: 3,
    baths: 4,
    sqft: s.sqft,
    yearBuilt: 2025,
    lotAcres: 0.19,
    closePrice: s.close,
    closeDate: s.closeDate,
    concessions: s.concessions,
    concessionsAmount: s.concessions,
    selectionTier: 'subdivision-6mo',
    ownPlat: true,
  } as unknown as CmaComp
}

/** The build's walk (lib/cma/build.ts priceSet) and its basis (lib/pricing/estimate.ts priceCmaSet). */
function walk(points: MarketIndexPoint[]) {
  const comps = SALES.map(
    (s, i) =>
      adjustCmaCompAlongMarket({
        subject,
        subjectStory: 'unknown',
        comp: sale(s, i),
        saleStory: 'unknown',
        points,
        asOf: AS_OF,
        exclusivePocket: true,
      }).adjusted,
  )
  const basis = buildTimeAdjustmentBasis({
    citySlug: 'bend',
    cityName: 'Bend',
    points,
    asOf: AS_OF,
    exclusivePocket: true,
    applied: comps.map((c) => ({
      address: c.address,
      closePrice: c.closePrice,
      timeAdjustment: c.timeAdjustment,
      timeAdjustedPrice: c.timeAdjustedPrice,
      closeDate: c.closeDate,
    })),
  })
  const pricing = { timeAdjustment: basis } as unknown as CmaPricing
  return { comps, basis, pricing }
}

/** Words that say the city index did not move these sales. */
const DENIES_INDEX = /does not walk|not used|not applied|computed but not|stays on its own sold/i

/**
 * THE AGREEMENT. Whatever the set, the stored basis, every comp's path source
 * and the printed caption tell one story: a moved sale was moved by the city
 * index, the basis says so and names that table, and the letter names that
 * figure; an unmoved set keeps the sold-list basis and prints no date line.
 */
function expectOneStory(comps: CmaAdjustedComp[], pricing: CmaPricing): void {
  const basis = pricing.timeAdjustment!
  expect(isPocketTimeBasis(basis.basis)).toBe(true)
  const moved = comps.filter((c) => Math.abs(c.timeAdjustment) >= 1)
  const caption = dateBasisCaption({ subject, comps, pricing })
  const method = salesMethodSentences({ subject, comps, pricing }).join(' ')
  if (moved.length > 0) {
    for (const c of moved) expect(c.marketPathSource, c.address).toBe('index')
    expect(basis.basis).toBe(TIME_ADJUSTMENT_BASIS_POCKET_INDEX)
    expect(basis.source.table).toBe('pricing_market_index')
    expect(basis.measure).toBe(TIME_ADJUSTMENT_MEASURE_INDEX)
    expect(`${basis.sentence} ${basis.source.filter} ${basis.source.query}`).not.toMatch(DENIES_INDEX)
    expect(caption).toContain("Bend's median price per square foot")
    expect(caption).toContain('every home sale in Bend')
    expect(method).toContain('home sales across all of Bend')
  } else {
    expect(basis.basis).toBe(TIME_ADJUSTMENT_BASIS_POCKET)
    expect(basis.indexLevels).toBeUndefined()
    expect(caption).toBeNull()
    expect(method).toBe('None of these sales is moved for the month it sold.')
  }
  for (const line of [caption ?? '', method]) expect(line).not.toContain('—')
}

describe('62475 Woodsman: the pocket set walked the Bend city index down', () => {
  const { comps, basis, pricing } = walk(BEND)

  it('moves exactly what the stored draft moved, and every comp read the index', () => {
    expect(comps.map((c) => c.timeAdjustment)).toEqual(SALES.map((s) => s.storedDate))
    for (const c of comps) expect(c.marketPathSource).toBe('index')
  })

  it('records the path that moved them: the city index, its months and its levels', () => {
    expect(basis.basis).toBe(TIME_ADJUSTMENT_BASIS_POCKET_INDEX)
    expect(basis.referenceMonths).toEqual(['2026-07-01', '2026-08-01', '2026-09-01'])
    expect(basis.referencePpsf).toBe(384.5)
    expect(basis.indexLevels).toEqual([
      { month: '2025-12-01', ppsf: 389.94 },
      { month: '2026-02-01', ppsf: 389.94 },
      { month: '2026-04-01', ppsf: 398.13 },
      { month: '2026-05-01', ppsf: 413.3 },
      { month: '2026-06-01', ppsf: 413.3 },
    ])
    expect(basis.n).toBe(2606)
    expect(basis.source.filter).toContain("city_slug='bend'")
    expect(basis.source.filter).toContain('2026-06 413.30')
    expect(basis.source.filter).toContain('endpoint 384.50 $/sqft')
    expect(basis.sentence).toContain('Each moved sale walked the Bend city index (pricing_market_index, every home sale in Bend) down')
    expect(basis.sentence).not.toMatch(/not used to pump/)
  })

  it('each move is the ratio of the two stored levels it names', () => {
    const level = new Map(basis.indexLevels!.map((l) => [l.month.slice(0, 7), l.ppsf]))
    for (const c of comps.filter((x) => x.timeAdjustment !== 0)) {
      const from = level.get(c.closeDate.slice(0, 7))
      expect(from, c.address).toBeDefined()
      const start = c.timeAdjustedPrice - c.timeAdjustment
      const factor = +(basis.referencePpsf! / from!).toFixed(4)
      expect(c.timeAdjustedPrice, c.address).toBe(Math.round(start * factor))
    }
  })

  it('prints the figure, its months and its levels under the grid', () => {
    expect(dateBasisCaption({ subject, comps, pricing })).toBe(
      "Adjusted for date is how much Bend's median price per square foot fell between the month a sale closed and the last three full months, July to September 2026. That figure covers every home sale in Bend, not only Shevlin West, with each month read as a three-month median: $389.94 in December 2025 and February 2026, $398.13 in April 2026, $413.30 in May and June 2026, and $384.50 for July to September 2026. No sale is moved up for date.",
    )
  })

  it('names the same figure in Basis and limits', () => {
    expect(salesMethodSentences({ subject, comps, pricing })).toEqual([
      "To bring the sales to today's market, we moved six of the seven down by how much Bend's median price per square foot fell between the month each sold and the last three full months, July to September 2026. The other one is not moved. That figure is built from 2,606 home sales across all of Bend over the last 12 months, not only the sales in Shevlin West, and a rise in it never moves a sale up.",
    ])
  })

  it('tells one story', () => expectOneStory(comps, pricing))
})

describe('a pocket the city index did not move keeps the sold-list basis', () => {
  // The same months, rising into the reference: every pocket move would be
  // up, so every one is refused and each sale keeps its own price.
  const rising = BEND.map((p, i) => ({ ...p, ppsf: 300 + i * 10 }))
  const { comps, basis, pricing } = walk(rising)

  it('moves nothing and says the index was not walked', () => {
    expect(comps.every((c) => c.timeAdjustment === 0)).toBe(true)
    expect(basis.basis).toBe(TIME_ADJUSTMENT_BASIS_POCKET)
    expect(basis.sentence).toMatch(/does not walk the city index/)
  })

  it('tells one story', () => expectOneStory(comps, pricing))
})

describe('the stored Woodsman row, built before the basis named its path', () => {
  // render_args.pricing.timeAdjustment as stored on cma-62475-woodsman.
  const stored = {
    n: 2606,
    basis: 'exclusive-pocket-sold-list',
    measure: 'sold and last-ask prices in this exclusive pocket',
    sentence:
      'These sales are the exclusive pocket. Date adjustment was applied to 6 sales. The Bend city index is not used to pump prices. Story class does not adjust.',
    pctPerMonth: 0,
    windowMonths: 12,
    pctOverWindow: 0,
    referenceMonths: ['2026-07-01', '2026-08-01', '2026-09-01'],
  }
  const { comps } = walk(BEND)
  const pricing = { timeAdjustment: stored } as unknown as CmaPricing

  it('still names the city-wide figure and its months, with no levels it did not store', () => {
    expect(dateBasisCaption({ subject, comps, pricing })).toBe(
      "Adjusted for date is how much Bend's median price per square foot fell between the month a sale closed and the last three full months, July to September 2026. That figure covers every home sale in Bend, not only Shevlin West. No sale is moved up for date.",
    )
  })
})
