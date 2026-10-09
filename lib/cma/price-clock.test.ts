/**
 * THE PRICE READS THE LETTER'S CLOCK (Matt 2026-10-08, "Yes, after this
 * landing").
 *
 * Rule 28 moved what the letter prints onto each home's last stretch on the
 * market. Two pricing steps still read the MLS OriginalListPrice:
 *
 *  1. Rule 16's failed-ask pull judged whether the subject's ask was cut by
 *     its MLS OriginalListPrice. 20676 Wild Rose counted as "cut from
 *     $625,000", a Coming Soon price changed 14 seconds before it went
 *     Active; on its last stretch it asked $599,900 the whole time.
 *  2. The list engine's sale-to-original shares over the comps divided each
 *     relisted sale's close by the ask its first listing opened at: 61197
 *     Cottonwood $715,000 over April's $849,900, though it sold on a stretch
 *     that began at $774,900.
 *
 * Both now read the last stretch. The Bend city share (the index's
 * saleToOriginal, "95.7 percent of the price they first asked") is a city
 * statistic and does not move.
 *
 * Every fixture is the MLS record read from listings, listing_history
 * ('MlsStatus: A → B', 'ListPrice: A → B'), status_history and price_history.
 */
import { describe, expect, it } from 'vitest'
import { applyFailedAskCap, buildFinalCycle, cycleOnTheMarket, failedAskCutOriginal } from '@/lib/cma/expired-audit'
import { saleOriginalAsk } from '@/lib/cma/last-stretch'
import { stampClosedCompDom } from '@/lib/cma/closed-comp-dom-stamp'
import { mergeAskChanges, type AskChange, type ListingStatusChange } from '@/lib/cma/listing-status'
import { failedAskPullShare, priceUnderFailedAsk } from '@/lib/pricing/failed-ask-under'
import { priceCmaSet } from '@/lib/pricing/estimate'
import type { BpoListingCycle } from '@/lib/bpo/types'
import type { SelectedPricingComp } from '@/lib/pricing/match'
import type { CmaComp, CmaSubject } from '@/lib/cma/types'
import type { ListingStretch } from '@/lib/cma/listing-status'

const status = (at: string, from: string, to: string): ListingStatusChange => ({ at, from, to })
const ask = (at: string, from: number | null, to: number): AskChange => ({ at, from, to })

// ── 1. Rule 16's cut test ────────────────────────────────────────────────────

// 20676 Wild Rose (20260814201801500943000000): Coming Soon at $625,000, ask
// changed to $599,900 at 04:05:49 UTC Sep 3, Active 04:06:03 UTC (Sep 2
// Pacific), withdrawn 03:10:01 UTC Sep 29 (Sep 28 Pacific) at $599,900.
const WILD_ROSE: BpoListingCycle = {
  listingKey: '20260814201801500943000000',
  mlsNumber: null,
  status: 'Withdrawn',
  listAgentName: null,
  listOfficeName: null,
  listDate: '2026-09-03T04:06:03+00:00',
  offMarketDate: '2026-09-28',
  originalListPrice: 625000,
  finalListPrice: 599900,
  closePrice: null,
  daysOnMarket: 25,
  priceCutCount: 1,
  totalPriceChangeAmt: -25100,
  wasRelisted: false,
  outcome: 'withdrawn',
  firstOnMarketAt: '2026-09-03T04:06:03+00:00',
}
const WILD_ROSE_LOG = [
  status('2026-09-03T04:06:03+00:00', 'Coming Soon', 'Active'),
  status('2026-09-29T03:10:01+00:00', 'Active', 'Withdrawn'),
]
// The price-event read: the sync's row, with the MLS log's timestamp.
const WILD_ROSE_EVENTS = [{ date: '2026-09-02', at: '2026-09-03T04:05:49+00:00', ask: 599900, previousAsk: 625000 }]

/** A failed-ask pricing object whose sales sit well over the ask, as Wild Rose's do. */
function overAskPricing(rec: number): Parameters<typeof applyFailedAskCap>[0] {
  return {
    conservative: rec - 30000,
    recommended: rec,
    highEnd: rec + 30000,
    needsReview: false,
    reviewReason: null,
    notes: [],
    valueLow: 627332,
    valueHigh: 724442,
  }
}

describe('rule 16: the cut is measured on the last stretch', () => {
  const onMarket = cycleOnTheMarket(WILD_ROSE, WILD_ROSE_LOG)

  it('20676 Wild Rose: asked $599,900 the whole stretch, so it was never cut', () => {
    // Before: the MLS OriginalListPrice, $625,000, read as a cut to $599,900.
    expect(WILD_ROSE.originalListPrice).toBe(625000)
    // After: the ask in effect when it went Active.
    const original = failedAskCutOriginal({ cycle: onMarket, priceEvents: WILD_ROSE_EVENTS, mlsOriginalListPrice: 625000 })
    expect(original).toBe(599900)
    // The same first ask the letter prints (rule 28).
    expect(buildFinalCycle({ cycle: onMarket, priceEvents: WILD_ROSE_EVENTS })!.initialAsk).toBe(original)
    expect(buildFinalCycle({ cycle: onMarket, priceEvents: WILD_ROSE_EVENTS })!.days).toBe(26)
  })

  it('20676 Wild Rose: the pull is the known-ask, no-cut pull, $591,000 rather than $593,000', () => {
    const days = 26
    // Before: a cut, half a percent at most on top of the 1 percent.
    expect(failedAskPullShare(599900, { daysOnMarket: days, originalListPrice: 625000 })).toBeCloseTo(0.01 + 0.005 * (26 / 120), 10)
    expect(priceUnderFailedAsk(599900, { daysOnMarket: days, originalListPrice: 625000 })).toBe(593000)
    // After: a known ask that did not come down, up to 2 percent on top.
    const original = failedAskCutOriginal({ cycle: onMarket, priceEvents: WILD_ROSE_EVENTS, mlsOriginalListPrice: 625000 })
    expect(failedAskPullShare(599900, { daysOnMarket: days, originalListPrice: original })).toBeCloseTo(0.01 + 0.02 * (26 / 120), 10)
    expect(priceUnderFailedAsk(599900, { daysOnMarket: days, originalListPrice: original })).toBe(591000)

    // Through the ceiling itself: the sales support $697,000, well over the ask.
    const before = overAskPricing(697000)
    applyFailedAskCap(before, {
      lastFailedListPrice: 599900,
      offMarketDate: '2026-09-28',
      asOf: new Date('2026-10-08T12:00:00Z'),
      daysOnMarket: days,
      originalListPrice: 625000,
    })
    const after = overAskPricing(697000)
    applyFailedAskCap(after, {
      lastFailedListPrice: 599900,
      offMarketDate: '2026-09-28',
      asOf: new Date('2026-10-08T12:00:00Z'),
      daysOnMarket: days,
      originalListPrice: original,
    })
    expect(before.recommended).toBe(593000)
    expect(after.recommended).toBe(591000)
    // Still inside the pull's 3 percent and nowhere near the 15 percent hold.
    expect(after.recommended).toBeGreaterThanOrEqual(Math.floor((599900 * 0.97) / 1000) * 1000)
    expect(after.clamp?.after).toBe(591000)
  })

  it('a cut made on the last stretch is still a cut', () => {
    // Went Active at $1,395,000 and was cut to $1,189,000 before it came off.
    const cut: BpoListingCycle = {
      ...WILD_ROSE,
      listDate: '2026-01-13T23:55:38+00:00',
      offMarketDate: '2026-08-12',
      originalListPrice: 1395000,
      finalListPrice: 1189000,
      firstOnMarketAt: '2026-01-13T23:55:38+00:00',
    }
    const log = [status('2026-01-13T23:55:38+00:00', 'Coming Soon', 'Active'), status('2026-08-12T21:13:52+00:00', 'Active', 'Expired')]
    const events = [
      { date: '2026-05-14', at: '2026-05-14T22:26:00+00:00', ask: 1325000, previousAsk: 1395000 },
      { date: '2026-06-17', at: '2026-06-17T22:51:22+00:00', ask: 1189000, previousAsk: 1325000 },
    ]
    const original = failedAskCutOriginal({ cycle: cycleOnTheMarket(cut, log), priceEvents: events, mlsOriginalListPrice: 1395000 })
    expect(original).toBe(1395000)
    expect(failedAskPullShare(1189000, { daysOnMarket: 211, originalListPrice: original })).toBeCloseTo(0.015, 10)
  })

  it('a home that came back reads its cut from where its last stretch began, not its first listing', () => {
    // First listed at $700,000 in May, withdrawn, back Sep 2 at $599,900 and never moved.
    const relisted = cycleOnTheMarket(
      { ...WILD_ROSE, originalListPrice: 700000, firstOnMarketAt: '2026-05-01T16:00:00+00:00' },
      [status('2026-05-01T16:00:00+00:00', 'Coming Soon', 'Active'), status('2026-06-01T16:00:00+00:00', 'Active', 'Withdrawn'), ...WILD_ROSE_LOG],
    )
    expect(relisted.restarted).toBe(true)
    const events = [{ date: '2026-06-10', at: '2026-06-10T16:00:00+00:00', ask: 599900, previousAsk: 700000 }]
    const original = failedAskCutOriginal({ cycle: relisted, priceEvents: events, mlsOriginalListPrice: 700000 })
    expect(original).toBe(599900)
    expect(priceUnderFailedAsk(599900, { daysOnMarket: 26, originalListPrice: original })).toBe(591000)
  })

  it('a home that came back with no ask on record has no original ask to judge a cut by', () => {
    const relisted = cycleOnTheMarket(
      { ...WILD_ROSE, originalListPrice: 700000, firstOnMarketAt: '2026-05-01T16:00:00+00:00' },
      [status('2026-06-01T16:00:00+00:00', 'Active', 'Withdrawn'), ...WILD_ROSE_LOG],
    )
    const original = failedAskCutOriginal({ cycle: relisted, priceEvents: [], mlsOriginalListPrice: 700000 })
    expect(original).toBeNull()
    // Rule 16: no original ask to judge a cut by adds at most half a percent.
    expect(failedAskPullShare(599900, { daysOnMarket: 26, originalListPrice: original })).toBeCloseTo(0.01 + 0.005 * (26 / 120), 10)
  })

  it('a first stretch with no OriginalListPrice and no recorded change has no original, though the chart draws the final ask flat', () => {
    const bare: BpoListingCycle = { ...WILD_ROSE, originalListPrice: null }
    const onMarketBare = cycleOnTheMarket(bare, WILD_ROSE_LOG)
    expect(buildFinalCycle({ cycle: onMarketBare, priceEvents: [] })!.initialAsk).toBe(599900)
    expect(failedAskCutOriginal({ cycle: onMarketBare, priceEvents: [], mlsOriginalListPrice: null })).toBeNull()
  })

  it('a subject with no failed cycle keeps the MLS OriginalListPrice', () => {
    expect(failedAskCutOriginal({ cycle: null, mlsOriginalListPrice: 625000 })).toBe(625000)
    expect(failedAskCutOriginal({ cycle: null, mlsOriginalListPrice: null })).toBeNull()
  })

  it('a first stretch with no recorded change keeps its opening ask', () => {
    const plain: BpoListingCycle = { ...WILD_ROSE, originalListPrice: 615000 }
    expect(failedAskCutOriginal({ cycle: cycleOnTheMarket(plain, WILD_ROSE_LOG), priceEvents: [], mlsOriginalListPrice: 615000 })).toBe(615000)
  })
})

// ── 2. The list engine's sale-to-original shares over the comps ─────────────

// 61197 Cottonwood (20250407164153264767000000): listed Apr 11 2025 at
// $849,900, cut to $774,900, Pending Oct 30, fell through, back Nov 13 (00:42
// UTC Nov 14), Pending Dec 30, closed Jan 22 at $715,000.
const COTTONWOOD_LOG = [
  status('2025-04-11T16:34:50+00:00', 'Coming Soon', 'Active'),
  status('2025-10-30T21:14:40+00:00', 'Active', 'Pending'),
  status('2025-11-14T00:42:52+00:00', 'Pending', 'Active'),
  status('2025-12-31T01:28:49+00:00', 'Active', 'Pending'),
  status('2026-01-22T21:26:06+00:00', 'Pending', 'Closed'),
]
const COTTONWOOD_ASKS = [
  ask('2025-05-01T20:48:37+00:00', 849900, 824900),
  ask('2025-05-29T23:36:47+00:00', 824900, 799900),
  ask('2025-10-01T03:56:37+00:00', 799900, 774900),
]
// 61131 Brown Trout (20241202232216229997000000): listed Dec 2 2024 at
// $629,000, withdrawn twice, back Aug 18 2025 at $569,000, Pending Sep 2,
// closed Sep 29 at $547,000.
const BROWN_TROUT_LOG = [
  status('2025-05-12T18:51:48+00:00', 'Active', 'Withdrawn'),
  status('2025-05-16T17:17:51+00:00', 'Withdrawn', 'Active'),
  status('2025-08-14T19:54:09+00:00', 'Active', 'Withdrawn'),
  status('2025-08-18T14:42:44+00:00', 'Withdrawn', 'Active'),
  status('2025-09-02T22:40:53+00:00', 'Active', 'Pending'),
  status('2025-09-30T01:44:50+00:00', 'Pending', 'Closed'),
]
const BROWN_TROUT_ASKS = [
  ask('2025-02-20T22:54:33+00:00', 629000, 624900),
  ask('2025-04-01T22:26:52+00:00', 624900, 609000),
  ask('2025-05-16T17:15:47+00:00', 609000, 599000),
  ask('2025-06-04T14:35:18+00:00', 599000, 589000),
  ask('2025-07-17T00:55:10+00:00', 589000, 569000),
]
// 628 Portland (20250711003254075732000000): listed Jul 11 2025 at
// $1,475,000, cut to $1,395,000, expired, back Jan 13 2026 at $1,395,000, cut
// to $1,189,000, Pending Aug 12, closed Sep 8 at $1,150,000.
const PORTLAND_LOG = [
  status('2026-01-13T06:00:00+00:00', 'Active', 'Expired'),
  status('2026-01-13T23:55:38+00:00', 'Expired', 'Active'),
  status('2026-08-12T21:13:52+00:00', 'Active', 'Pending'),
  status('2026-09-09T00:06:13+00:00', 'Pending', 'Closed'),
]
const PORTLAND_ASKS = mergeAskChanges(
  [
    ask('2025-10-09T19:29:18+00:00', 1475000, 1465000),
    ask('2025-11-14T16:33:42+00:00', 1465000, 1425000),
    ask('2025-12-13T20:38:06+00:00', 1425000, 1395000),
    ask('2026-05-14T22:26:00+00:00', 1395000, 1325000),
    ask('2026-05-29T14:02:48+00:00', 1325000, 1289000),
    ask('2026-06-17T22:51:22+00:00', 1289000, 1189000),
  ],
  [ask('2026-05-14T22:50:25.581+00:00', 1395000, 1325000)],
)

function closedComp(over: Partial<CmaComp>): CmaComp {
  return {
    listingKey: 'K',
    mlsNumber: null,
    address: '1 Comp',
    city: 'Bend',
    subdivision: null,
    latitude: null,
    longitude: null,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 2000,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: null,
    originalListPrice: null,
    closePrice: 500000,
    closeDate: '2026-01-01',
    onMarketDate: null,
    domTotal: null,
    selectionTier: 'subdivision-3mo',
    ...over,
  } as CmaComp
}

describe("a relisted comp's original ask is the ask in effect when its last stretch began", () => {
  it('61197 Cottonwood: $774,900, so it closed at 92.3 percent, not 84.1', () => {
    const stamped = stampClosedCompDom(
      closedComp({ listingKey: '20250407164153264767000000', closePrice: 715000, closeDate: '2026-01-22', listPrice: 774900, originalListPrice: 849900, onMarketDate: '2025-11-13' }),
      {
        onMarketDate: '2025-11-14T00:42:52+00:00',
        originalOnMarketTimestamp: '2025-04-11T16:34:50+00:00',
        statusChanges: COTTONWOOD_LOG,
        askChanges: COTTONWOOD_ASKS,
        originalListPrice: 849900,
        listPrice: 774900,
        pendingTimestamp: '2025-12-31T01:28:49+00:00',
      },
    )
    expect(stamped.stretch).toMatchObject({ firstAsk: 774900, restarted: true })
    expect(saleOriginalAsk(stamped)).toBe(774900)
    expect(+(715000 / 849900).toFixed(4)).toBe(0.8413)
    expect(+(715000 / saleOriginalAsk(stamped)!).toFixed(4)).toBe(0.9227)
  })

  it('61131 Brown Trout: $569,000, so 96.1 percent, not 87.0', () => {
    const stamped = stampClosedCompDom(
      closedComp({ listingKey: '20241202232216229997000000', closePrice: 547000, closeDate: '2025-09-29', listPrice: 569000, originalListPrice: 629000, onMarketDate: '2025-08-18' }),
      {
        onMarketDate: '2025-08-18T14:42:44+00:00',
        originalOnMarketTimestamp: '2024-12-03T00:09:00+00:00',
        statusChanges: BROWN_TROUT_LOG,
        askChanges: BROWN_TROUT_ASKS,
        originalListPrice: 629000,
        listPrice: 569000,
        pendingTimestamp: '2025-09-02T22:40:53+00:00',
      },
    )
    expect(saleOriginalAsk(stamped)).toBe(569000)
    expect(+(547000 / 629000).toFixed(4)).toBe(0.8696)
    expect(+(547000 / saleOriginalAsk(stamped)!).toFixed(4)).toBe(0.9613)
  })

  it('628 Portland: $1,395,000, so 82.4 percent, not 78.0', () => {
    const stamped = stampClosedCompDom(
      closedComp({ listingKey: '20250711003254075732000000', closePrice: 1150000, closeDate: '2026-09-08', listPrice: 1189000, originalListPrice: 1475000, onMarketDate: '2026-01-13' }),
      {
        onMarketDate: '2026-01-13T23:55:38+00:00',
        originalOnMarketTimestamp: '2025-07-11T18:20:10+00:00',
        statusChanges: PORTLAND_LOG,
        askChanges: PORTLAND_ASKS,
        originalListPrice: 1475000,
        listPrice: 1189000,
        pendingTimestamp: '2026-08-12T21:13:52+00:00',
      },
    )
    expect(saleOriginalAsk(stamped)).toBe(1395000)
    expect(+(1150000 / 1475000).toFixed(4)).toBe(0.7797)
    expect(+(1150000 / saleOriginalAsk(stamped)!).toFixed(4)).toBe(0.8244)
  })

  it('a sale with no stamped stretch keeps its MLS OriginalListPrice', () => {
    expect(saleOriginalAsk(closedComp({ originalListPrice: 520000, listPrice: 505000 }))).toBe(520000)
  })
})

describe('priceCmaSet: the share over the sales that price reads each sale on its last stretch', () => {
  const sale = (listingKey: string, closePrice: number, originalAsk: number): SelectedPricingComp =>
    ({
      listingKey,
      listNumber: null,
      address: `${listingKey} Comp`,
      city: 'Bend',
      citySlug: 'bend',
      subdivision: 'Kenwood',
      subdivisionNorm: 'kenwood',
      latitude: 44.06,
      longitude: -121.32,
      beds: 3,
      baths: 2,
      sqft: 2000,
      lotAcres: 0.2,
      yearBuilt: 1996,
      storyClass: 'one',
      productClass: 'detached',
      waterClass: 'public',
      sewerClass: 'public',
      hoaClass: 'no_hoa',
      lotClass: 'in_town',
      closePrice,
      concessionsAmount: null,
      concessionsYn: null,
      closeDate: '2025-12-15',
      originalAsk,
      lastAsk: closePrice,
      daysToOffer: 7,
      cdom: 10,
      dropCount: 0,
      closePpsf: closePrice / 2000,
      photoUrl: null,
      publicRemarks: null,
      selectionTier: 'subdivision-3mo',
      setsPrice: true,
      proximity: '0.10 miles',
      monthsBeforeAsOf: 1,
    }) as SelectedPricingComp
  const adjusted = (s: SelectedPricingComp, stretch?: ListingStretch) => ({
    listingKey: s.listingKey,
    mlsNumber: null,
    address: s.address,
    city: 'Bend',
    subdivision: 'Kenwood',
    latitude: 44.06,
    longitude: -121.32,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 1996,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: null,
    listPrice: s.lastAsk,
    originalListPrice: s.originalAsk,
    closePrice: s.closePrice,
    closeDate: s.closeDate,
    onMarketDate: '2025-11-01',
    domTotal: 10,
    selectionTier: s.selectionTier,
    monthsSinceClose: 1,
    timeAdjustment: 0,
    timeAdjustedPrice: s.closePrice,
    ppsfTimeAdjusted: s.closePrice / 2000,
    sizeAdjustment: 0,
    adjustedPrice: s.closePrice,
    weight: 1,
    ...(stretch ? { stretch } : {}),
  })
  // Three sales came back on the market; their MLS original is the first
  // listing's ask. K3 came back with no ask on record.
  const sales = [
    sale('K1', 450_000, 560_000),
    sale('K2', 480_000, 600_000),
    sale('K3', 500_000, 620_000),
    sale('K4', 520_000, 525_000),
    sale('K5', 560_000, 560_000),
  ]
  const stretches: Record<string, ListingStretch> = {
    K1: { from: '2025-11-01', firstAsk: 460_000, restarted: true },
    K2: { from: '2025-11-01', firstAsk: 490_000, restarted: true },
    K3: { from: '2025-11-01', firstAsk: null, restarted: true },
    K4: { from: '2025-11-01', firstAsk: 525_000, restarted: false },
    K5: { from: '2025-11-01', firstAsk: 560_000, restarted: false },
  }
  const subject = {
    listingKey: 'S',
    streetAddress: '1 Test',
    city: 'Bend',
    subdivision: 'Kenwood',
    latitude: 44.06,
    longitude: -121.32,
    beds: 3,
    baths: 2,
    sqft: 2000,
    lotAcres: 0.2,
    propertySubType: 'Single Family Residence',
    yearBuilt: 1998,
    standardStatus: 'Closed',
    lastListPrice: null,
    lastListDate: null,
    listingHistoryLine: null,
  } as unknown as CmaSubject
  const build = (withStretch: boolean, marketIndex: Parameters<typeof priceCmaSet>[0]['marketIndex'] = []) =>
    priceCmaSet({
      subject,
      adjusted: sales.map((s) => adjusted(s, withStretch ? stretches[s.listingKey] : undefined)) as never,
      market: null,
      input: { priceOverride: null },
      selection: { pricingSales: sales, tiersUsed: ['subdivision-3mo'] },
      marketIndex,
      asOf: '2026-01-15',
    })!

  it('the median share moves from the first listings asks to the last stretches asks', () => {
    // Before: 450/560, 480/600, 500/620, 520/525, 560/560. Median 500/620.
    const before = build(false)
    expect(before.rangeRule?.saleToAskSource).toBe('these-sales')
    expect(before.rangeRule?.saleToAskRatio).toBeCloseTo(500_000 / 620_000, 10)
    // After: 450/460, 480/490, 520/525, 560/560; K3 has no first ask on its
    // stretch and gives no share. Median of four (the upper middle) 520/525.
    const after = build(true)
    expect(after.rangeRule?.saleToAskSource).toBe('these-sales')
    expect(after.rangeRule?.saleToAskRatio).toBeCloseTo(520_000 / 525_000, 10)
    // The share carries the list from the weighted sales toward the band top.
    // Read off the first listings, the low ratios run the list to the top of
    // the sales. On the last stretches it sits just over the weighted sales.
    // The band is every seated sale, $450,000 to $560,000.
    expect([before.conservative, before.recommended, before.highEnd]).toEqual([558_000, 560_000, 560_000])
    expect([after.conservative, after.recommended, after.highEnd]).toEqual([454_000, 507_000, 560_000])
    // The worth range is the adjusted sales, and does not move when the share does.
    expect([before.valueLow, before.valueHigh]).toEqual([450_000, 560_000])
    expect([after.valueLow, after.valueHigh]).toEqual([450_000, 560_000])
  })

  it('the city index share wins when it has one, and does not move', () => {
    const index = [{ month: '2025-12-01', ppsf: 250, n: 50, saleToOriginal: 0.9571 }]
    const before = build(false, index)
    const after = build(true, index)
    expect(before.rangeRule?.saleToAskSource).toBe('city-index')
    expect(after.rangeRule?.saleToAskRatio).toBe(0.9571)
    expect([after.conservative, after.recommended, after.highEnd]).toEqual([
      before.conservative,
      before.recommended,
      before.highEnd,
    ])
  })
})
