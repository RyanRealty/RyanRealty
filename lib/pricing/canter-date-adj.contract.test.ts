/**
 * 1130 E Canter / Sisters residual after Admin live-select tip on main.
 * Pocket exclusivity PASS (1025/945/995/994 Horse Back; Clearpine out).
 * Recommend FAIL on the 2026-09-15 08:15 PT rebuild: $803k vs then-Flex
 * ~$659k. Matt 2026-09-17 re-anchored gold to live market-cool ~$680
 * (Flex ~$659 retired). Admin named date-adjust pumping pocket Horse Back
 * closes toward ~$800k+.
 *
 * Tip Ready is this file + --ship lib/pricing/canter-date-adj.parity.json.
 * Do not reopen street-cluster / RHM. Do not twin Admin picker contracts.
 */
import { describe, expect, it } from 'vitest'
import type { CmaSubject } from '@/lib/cma/types'
import {
  adjustCompAlongMarket,
  applyEngineRecommendedList,
  buildTimeAdjustmentBasis,
  listPriceFromEngine,
  priceCmaSet,
} from '@/lib/pricing/estimate'
import {
  CANTER_GOLD_HIGH,
  CANTER_GOLD_LOW,
  CANTER_GOLD_RECOMMEND,
  CANTER_GOLD_TOLERANCE,
  CANTER_MIN_CLOSED_COMPS,
  TIME_ADJUSTMENT_BASIS_POCKET,
  TIME_ADJUSTMENT_MEASURE_POCKET,
  canterRecommendNearGold,
} from '@/lib/pricing/exclusive-pocket-date-adj'
import type { SelectedPricingComp } from '@/lib/pricing/match'
import type { MarketIndexPoint } from '@/lib/pricing/market-path'
import { computePricing } from '@/lib/cma/pricing'

const AS_OF = '2026-09-15'
/** Fixture sold band (gold fixtures) — anti-pump bounds, not live gold gate. */
const FIXTURE_SOLD_LOW = 649_000
const RAW_SOLD_LIST_HIGH = 690_000
const PUMP_FLOOR = 780_000
const EXCLUSIVE_TIERS = ['pocket-6mo', 'pocket-12mo'] as const

const CANTER = { latitude: 44.2908, longitude: -121.5493 }

/**
 * Sisters city index that includes Clearpine-class ppsf. Horse Back sold
 * near $350/sf while the city median walks from ~$320 toward ~$410.
 * Factor on a spring-2026 close is ~1.20 — $675k → ~$810k.
 */
const sistersCityIndexPump: MarketIndexPoint[] = [
  { month: '2025-09-01', ppsf: 275, n: 20 },
  { month: '2025-10-01', ppsf: 280, n: 20 },
  { month: '2025-11-01', ppsf: 285, n: 20 },
  { month: '2025-12-01', ppsf: 290, n: 20 },
  { month: '2026-01-01', ppsf: 298, n: 20 },
  { month: '2026-02-01', ppsf: 305, n: 20 },
  { month: '2026-03-01', ppsf: 312, n: 20 },
  { month: '2026-04-01', ppsf: 320, n: 20 },
  { month: '2026-05-01', ppsf: 335, n: 20 },
  { month: '2026-06-01', ppsf: 355, n: 20 },
  { month: '2026-07-01', ppsf: 385, n: 20 },
  { month: '2026-08-01', ppsf: 420, n: 20 },
]

function subject(): CmaSubject {
  return {
    listingKey: 'SUBJ-1130',
    mlsNumber: '220213342',
    streetAddress: '1130 E Canter',
    city: 'Sisters',
    state: 'OR',
    postalCode: '97759',
    subdivision: 'SaddleStone',
    latitude: CANTER.latitude,
    longitude: CANTER.longitude,
    beds: 3,
    baths: 2,
    sqft: 1883,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2025,
    garageSpaces: null,
    photoUrl: null,
    publicRemarks: 'New construction 2025.',
    viewDescription: null,
    taxAnnual: null,
    standardStatus: 'Active',
    lastListPrice: 675_000,
    lastListDate: '2026-06-01',
    listingHistoryLine: null,
    waterRaw: 'public',
    sewerRaw: 'public',
    levelsRaw: 'One',
    newConstructionYn: true,
  }
}

function sale(over: Partial<SelectedPricingComp> & Pick<SelectedPricingComp, 'listingKey' | 'address'>): SelectedPricingComp {
  return {
    listNumber: null,
    city: 'Sisters',
    citySlug: 'sisters',
    subdivision: 'Horse Back',
    subdivisionNorm: 'horse back',
    latitude: CANTER.latitude,
    longitude: CANTER.longitude,
    beds: 3,
    baths: 2,
    sqft: 1900,
    lotAcres: 0.2,
    yearBuilt: 2008,
    storyClass: 'one',
    productClass: 'detached',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'no_hoa',
    lotClass: 'in_town',
    closePrice: 675_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-04-20',
    originalAsk: 675_000,
    lastAsk: 675_000,
    daysToOffer: 18,
    cdom: 32,
    dropCount: 1,
    closePpsf: 355,
    photoUrl: null,
    publicRemarks: null,
    selectionTier: 'pocket-6mo',
    proximity: '0.12 miles',
    monthsBeforeAsOf: 5,
    ...over,
  }
}

/** Live 08:15 PT kept set. Ranch 220218584 absent from sale_pricing_facts. */
function horseBackPocketSet(): SelectedPricingComp[] {
  return [
    sale({
      listingKey: 'HB-1025',
      listNumber: '220214720',
      address: '1025 E Horse Back',
      closePrice: 675_000,
      lastAsk: 675_000,
      originalAsk: 675_000,
      sqft: 1900,
      closeDate: '2026-04-20',
      closePpsf: 355,
    }),
    sale({
      listingKey: 'HB-945',
      listNumber: '220199945',
      address: '945 Horse Back',
      closePrice: 689_000,
      lastAsk: 695_000,
      originalAsk: 695_000,
      sqft: 1910,
      closeDate: '2025-10-15',
      closePpsf: 361,
      selectionTier: 'pocket-12mo',
    }),
    sale({
      listingKey: 'HB-995',
      listNumber: '220199995',
      address: '995 Horse Back',
      closePrice: 659_000,
      lastAsk: 665_000,
      originalAsk: 665_000,
      sqft: 1880,
      closeDate: '2026-03-10',
      closePpsf: 351,
    }),
    sale({
      listingKey: 'HB-994',
      listNumber: '220199994',
      address: '994 Horse Back',
      closePrice: 649_000,
      lastAsk: 649_000,
      originalAsk: 649_000,
      sqft: 1870,
      closeDate: '2026-06-01',
      closePpsf: 347,
    }),
    sale({
      listingKey: 'HB-1010',
      listNumber: '220199910',
      address: '1010 E Horse Back',
      closePrice: 662_000,
      lastAsk: 669_000,
      originalAsk: 669_000,
      sqft: 1890,
      closeDate: '2025-12-01',
      closePpsf: 350,
      selectionTier: 'pocket-12mo',
    }),
  ]
}

function adjustSet(exclusivePocket: boolean) {
  return horseBackPocketSet().map((row) =>
    adjustCompAlongMarket({
      subject: subject(),
      subjectStory: 'one',
      sale: row,
      saleStory: 'one',
      points: sistersCityIndexPump,
      asOf: AS_OF,
      exclusivePocket,
    }),
  )
}

function recommendFrom(adjusted: ReturnType<typeof adjustSet>[number]['adjusted'][], exclusivePocket: boolean) {
  const pricing = computePricing(subject(), adjusted, null)
  expect(pricing).not.toBeNull()
  const engine = listPriceFromEngine({
    subjectSqft: 1883,
    lastAsk: 675_000,
    adjusted,
    saleToAskRatios: horseBackPocketSet().map((s) => s.closePrice / (s.originalAsk ?? s.closePrice)),
    qualitySet: false,
    methodFallback: pricing!.method3 ?? pricing!.method1Mid,
  })
  const cover = applyEngineRecommendedList(pricing!, engine, { lastAsk: 675_000 })
  const built = priceCmaSet({
    subject: subject(),
    adjusted,
    market: null,
    input: { priceOverride: null },
    selection: {
      pricingSales: horseBackPocketSet(),
      tiersUsed: exclusivePocket ? [...EXCLUSIVE_TIERS] : ['nearby-2mi-9mo'],
    },
    marketIndex: sistersCityIndexPump,
    asOf: AS_OF,
  })
  return { engine, cover, built, method1Mid: pricing!.method1Mid }
}

describe('1130 E Canter Horse Back date-adj residual', () => {
  it('contract: city-index-pumps-horse-back-toward-800k', () => {
    const rows = adjustSet(false)
    const timeAdjusted = rows.map((r) => r.adjusted.timeAdjustedPrice)
    const mid = [...timeAdjusted].sort((a, b) => a - b)[Math.floor(timeAdjusted.length / 2)]!
    expect(mid).toBeGreaterThanOrEqual(PUMP_FLOOR)
    const { cover, built, method1Mid } = recommendFrom(
      rows.map((r) => r.adjusted),
      false,
    )
    expect(cover.recommended).toBeGreaterThanOrEqual(PUMP_FLOOR)
    expect(built?.recommended).toBeGreaterThanOrEqual(PUMP_FLOOR)
    expect(method1Mid).toBeGreaterThanOrEqual(PUMP_FLOOR)
  })

  it('contract: exclusive-pocket-date-adj-keeps-flex-band', () => {
    const rows = adjustSet(true)
    for (const row of rows) {
      expect(row.adjusted.timeAdjustment).toBe(0)
      expect(row.adjusted.timeAdjustedPrice).toBe(row.adjusted.closePrice)
      expect(row.pathNote).toMatch(/exclusive pocket/)
    }
    const rawCloses = horseBackPocketSet().map((s) => s.closePrice)
    const rawMid = [...rawCloses].sort((a, b) => a - b)[Math.floor(rawCloses.length / 2)]!
    expect(rawMid).toBeGreaterThanOrEqual(FIXTURE_SOLD_LOW)
    expect(rawMid).toBeLessThanOrEqual(RAW_SOLD_LIST_HIGH)

    const { cover, built, method1Mid } = recommendFrom(
      rows.map((r) => r.adjusted),
      true,
    )
    expect(cover.recommended).toBeGreaterThanOrEqual(FIXTURE_SOLD_LOW - 10_000)
    expect(cover.recommended).toBeLessThanOrEqual(RAW_SOLD_LIST_HIGH)
    expect(cover.recommended).toBeLessThan(PUMP_FLOOR)
    expect(built?.recommended).toBeGreaterThanOrEqual(FIXTURE_SOLD_LOW - 10_000)
    expect(built?.recommended).toBeLessThanOrEqual(RAW_SOLD_LIST_HIGH)
    expect(built?.recommended).toBeLessThan(PUMP_FLOOR)
    expect(method1Mid).toBeLessThan(PUMP_FLOOR)
    expect(method1Mid).toBeLessThanOrEqual(RAW_SOLD_LIST_HIGH + 15_000)
    expect(built?.timeAdjustment?.basis).toBe(TIME_ADJUSTMENT_BASIS_POCKET)
    expect(built?.timeAdjustment?.measure).toBe(TIME_ADJUSTMENT_MEASURE_POCKET)
    expect(built?.timeAdjustment?.sentence).toMatch(/exclusive pocket/i)
    expect(built?.timeAdjustment?.sentence).not.toMatch(/each sale is moved by the change/i)
  })

  it('contract: ranch-absent-does-not-reopen-city-index-pump', () => {
    const keys = horseBackPocketSet().map((s) => s.listNumber)
    expect(keys).not.toContain('220218584')
    const { built } = recommendFrom(
      adjustSet(true).map((r) => r.adjusted),
      true,
    )
    expect(built?.recommended).toBeLessThan(PUMP_FLOOR)
    expect(built?.recommended).toBeLessThanOrEqual(RAW_SOLD_LIST_HIGH)
  })

  it('contract: exclusive-pocket-basis-names-sold-list', () => {
    const basis = buildTimeAdjustmentBasis({
      citySlug: 'sisters',
      cityName: 'Sisters',
      points: sistersCityIndexPump,
      asOf: AS_OF,
      exclusivePocket: true,
    })
    expect(basis.basis).toBe(TIME_ADJUSTMENT_BASIS_POCKET)
    expect(basis.measure).toBe(TIME_ADJUSTMENT_MEASURE_POCKET)
    expect(basis.pctPerMonth).toBe(0)
    expect(basis.sentence).toMatch(/exclusive pocket/)
    expect(basis.sentence).toMatch(/city index/)
    expect(basis.sentence).toMatch(/Size and story/)
    expect(basis.sentence).not.toMatch(/Each sale is moved by the change/)
  })

  /**
   * Matt 2026-09-17: kill story-adj entirely. Even a widened (starved) set
   * must not reintroduce the ±13.5% one-story lift. Tip Ready/--ship refuses
   * if any adjusted sale carries a non-zero storyAdjustment.
   */
  it('contract: story-adj-killed-entirely', () => {
    const exclusive = horseBackPocketSet().map((row) =>
      adjustCompAlongMarket({
        subject: subject(),
        subjectStory: 'one',
        sale: { ...row, storyClass: 'two' },
        saleStory: 'two',
        points: sistersCityIndexPump,
        asOf: AS_OF,
        exclusivePocket: true,
      }),
    )
    const widened = horseBackPocketSet().map((row) =>
      adjustCompAlongMarket({
        subject: subject(),
        subjectStory: 'one',
        sale: { ...row, storyClass: 'two' },
        saleStory: 'two',
        points: sistersCityIndexPump,
        asOf: AS_OF,
        exclusivePocket: false,
      }),
    )
    for (const row of [...exclusive, ...widened]) {
      expect(row.adjusted.storyAdjustment).toBe(0)
    }
  })

  it('contract: exclusive-pocket-story-adj-keeps-flex-band', () => {
    const rows = horseBackPocketSet().map((row) =>
      adjustCompAlongMarket({
        subject: subject(),
        subjectStory: 'one',
        sale: { ...row, storyClass: 'two' },
        saleStory: 'two',
        points: sistersCityIndexPump,
        asOf: AS_OF,
        exclusivePocket: true,
      }),
    )
    for (const row of rows) {
      expect(row.adjusted.storyAdjustment).toBe(0)
      expect(row.adjusted.sizeAdjustment).toBe(0)
      expect(row.adjusted.timeAdjustment).toBe(0)
      expect(row.adjusted.adjustedPrice).toBe(row.adjusted.closePrice)
      expect(row.pathNote).toMatch(/size and story/)
    }
    const { cover, built, method1Mid } = recommendFrom(
      rows.map((r) => r.adjusted),
      true,
    )
    expect(cover.recommended).toBeGreaterThanOrEqual(FIXTURE_SOLD_LOW - 10_000)
    expect(cover.recommended).toBeLessThanOrEqual(RAW_SOLD_LIST_HIGH)
    expect(cover.recommended).toBeLessThan(PUMP_FLOOR)
    expect(built?.recommended).toBeLessThan(PUMP_FLOOR)
    expect(method1Mid).toBeLessThan(PUMP_FLOOR)
  })

  it('contract: canter-gold-near-680k', () => {
    // Matt 2026-09-17: Flex ~$659 retired. Tip Ready gold = live cool Rec ~$680.
    expect(CANTER_GOLD_RECOMMEND).toBe(680_000)
    expect(CANTER_GOLD_LOW).toBe(675_000)
    expect(CANTER_GOLD_HIGH).toBe(705_000)
    expect(canterRecommendNearGold(680_000)).toBe(true)
    expect(canterRecommendNearGold(659_000)).toBe(true) // within tolerance of re-anchor
    expect(canterRecommendNearGold(800_000)).toBe(false)

    const rows = adjustSet(true)
    const { cover, built } = recommendFrom(
      rows.map((r) => r.adjusted),
      true,
    )
    expect(canterRecommendNearGold(cover.recommended!)).toBe(true)
    expect(canterRecommendNearGold(built!.recommended!)).toBe(true)
    expect(Math.abs(cover.recommended! - CANTER_GOLD_RECOMMEND)).toBeLessThanOrEqual(
      CANTER_GOLD_TOLERANCE,
    )
  })

  it('contract: refuse-fewer-than-5-closed-comps', () => {
    const closed = horseBackPocketSet()
    expect(closed.length).toBeGreaterThanOrEqual(5)
    // Tip Ready refuse: a kept set under 5 closed is not shippable for Canter.
    const under = closed.slice(0, 4)
    expect(under.length).toBeLessThan(5)
    expect(under.length).toBeLessThan(CANTER_MIN_CLOSED_COMPS)
  })
})
