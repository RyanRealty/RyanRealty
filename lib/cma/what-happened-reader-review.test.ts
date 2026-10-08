/**
 * READER REVIEW 2026-10-08: the "What happened" page and the "How fast" chart
 * on the rebuilt drafts cma-62475-woodsman, cma-2382-jackson and
 * cma-3037-purcell. Every fixture below is the stored row's own figures
 * (render_args, and the MLS price history for the subject listing key).
 *
 * 1. A real cut was dropped. Woodsman's MLS history carries five asks:
 *    $1,695,000 Mar 6 to Apr 30 (55 days), $1,680,000 Apr 30 to Jun 9 (40),
 *    $1,660,000 to Jul 24 (45), $1,629,000 to Aug 29 (36), $1,600,000 to the
 *    Sep 30 expiry (32). The letter told four, because a 1 percent era floor
 *    folded the 0.9 percent $1,680,000 cut into the opening ask.
 * 2. "You were asking inside the range homes like yours sold in. Your home sat
 *    208 days without an offer." Only the last 32 of 208 days were at an
 *    in-range ask, and the MLS does not record whether an offer came in.
 * 3. "Here's what happened in Summit West" on a letter that otherwise says
 *    Shevlin West, never saying the home sits in Summit West.
 * 4. The days chart numbered its bars 1, 3, 4, 5, 6, 7 with sale 2 silently
 *    gone, under "Every sale below had an offer inside 104 days".
 */
import { describe, expect, it } from 'vitest'
import { buildAskExposure, resolveListingTimeline, type ExpiredFinalCycle } from '@/lib/cma/expired-audit'
import { askExposureSentence, askStoryReading } from '@/lib/cma/ask-story'
import { askExposureFor, whatHappenedHeading, type OpinionPageArgs } from '@/lib/cma/opinion-pages'
import { placeStoryLead } from '@/lib/cma/place-pricing-story'
import { renderDaysToOfferHtml } from '@/lib/cma/market-area-chapters'
import type { PlacePricingStory } from '@/lib/cma/place-pricing-types'
import type { CmaAdjustedComp, CmaMarketContext, CmaSubject } from '@/lib/cma/types'

const SOURCE = { table: 'listings + price_history + listing_history', filter: 'f', fetchedAt: '2026-10-08', query: 'q' }

/** cma-62475-woodsman render_args.expiredAudit.finalCycle (ListingKey 20260304003912862284000000). */
const WOODSMAN_CYCLE: ExpiredFinalCycle = {
  listDate: '2026-03-06',
  initialAsk: 1_695_000,
  cuts: [
    { date: '2026-04-30', ask: 1_680_000 },
    { date: '2026-06-09', ask: 1_660_000 },
    { date: '2026-07-24', ask: 1_629_000 },
    { date: '2026-08-29', ask: 1_600_000 },
  ],
  cutsDated: true,
  finalAsk: 1_600_000,
  offMarketDate: '2026-09-30',
  status: 'Expired',
  days: 208,
  source: SOURCE,
}
const WOODSMAN_RANGE = { rangeLow: 1_467_367, rangeHigh: 1_618_053 }

/** cma-2382-jackson render_args.expiredAudit.finalCycle (ListingKey 20260217193823216791000000). */
const JACKSON_CYCLE: ExpiredFinalCycle = {
  listDate: '2026-02-17',
  initialAsk: 699_000,
  cuts: [
    { date: '2026-03-16', ask: 679_000 },
    { date: '2026-06-02', ask: 659_000 },
    { date: '2026-07-15', ask: 639_000 },
  ],
  cutsDated: true,
  finalAsk: 639_000,
  offMarketDate: '2026-10-02',
  status: 'Canceled',
  days: 227,
  source: SOURCE,
}
const JACKSON_RANGE = { rangeLow: 598_620, rangeHigh: 648_772 }

describe('1. every ask the listing carried is a segment with its true days (Woodsman)', () => {
  it('keeps the $1,680,000 cut, 0.9 percent under the opening ask, as its own 40 days', () => {
    const e = buildAskExposure({ cycle: WOODSMAN_CYCLE, ...WOODSMAN_RANGE })!
    expect(e.segments.map((s) => [s.ask, s.from, s.to, s.days])).toEqual([
      [1_695_000, '2026-03-06', '2026-04-30', 55],
      [1_680_000, '2026-04-30', '2026-06-09', 40],
      [1_660_000, '2026-06-09', '2026-07-24', 45],
      [1_629_000, '2026-07-24', '2026-08-29', 36],
      [1_600_000, '2026-08-29', '2026-09-30', 32],
    ])
    expect(e.segments.reduce((sum, s) => sum + s.days, 0)).toBe(208)
  })

  it('names all five asks in the heading sentence', () => {
    const e = buildAskExposure({ cycle: WOODSMAN_CYCLE, ...WOODSMAN_RANGE })!
    expect(askExposureSentence(e.segments)).toBe(
      'You asked $1,695,000 for 55 days, then $1,680,000 for 40, then $1,660,000 for 45, then $1,629,000 for 36, then $1,600,000 for 32.',
    )
  })

  it('draws all five asks on the step chart', () => {
    const t = resolveListingTimeline({
      subject: { lastListDate: '2026-03-06' } as unknown as CmaSubject,
      expiredAudit: { findings: [], finalCycle: WOODSMAN_CYCLE } as never,
      ...WOODSMAN_RANGE,
      rangeLabel: 'where homes like yours sold',
      domDays: 208,
    })!
    expect(t.steps.map((s) => s.ask)).toEqual([1_695_000, 1_680_000, 1_660_000, 1_629_000, 1_600_000])
  })

  it('re-derives the stored four-segment exposure from the stored cycle, so the sentence and the chart agree', () => {
    // The segments exactly as cma-62475-woodsman stored them under the old rule.
    const stored = {
      segments: [
        { ask: 1_695_000, from: '2026-03-06', to: '2026-06-09', days: 95, sharePct: 45.67, pctAboveRangeTop: 4.76 },
        { ask: 1_660_000, from: '2026-06-09', to: '2026-07-24', days: 45, sharePct: 21.63, pctAboveRangeTop: 2.59 },
        { ask: 1_629_000, from: '2026-07-24', to: '2026-08-29', days: 36, sharePct: 17.31, pctAboveRangeTop: 0.68 },
        { ask: 1_600_000, from: '2026-08-29', to: '2026-09-30', days: 32, sharePct: 15.38, pctAboveRangeTop: -1.12 },
      ],
      dominant: { ask: 1_695_000 },
      final: { ask: 1_600_000 },
      sentence: 'x',
    }
    const a = {
      subject: {
        streetAddress: '62475 Woodsman',
        city: 'Bend',
        lastListPrice: 1_600_000,
        originalListPrice: 1_695_000,
        standardStatus: 'Expired',
      },
      pricing: { valueLow: WOODSMAN_RANGE.rangeLow, valueHigh: WOODSMAN_RANGE.rangeHigh },
      comps: [],
      market: null,
      expiredAudit: { findings: [{}], finalCycle: WOODSMAN_CYCLE, askExposure: stored },
    } as unknown as OpinionPageArgs
    expect(askExposureFor(a)!.segments.map((s) => s.days)).toEqual([55, 40, 45, 36, 32])
    expect(whatHappenedHeading(a)).toBe(
      'You asked $1,695,000 for 55 days, then $1,680,000 for 40, then $1,660,000 for 45, then $1,629,000 for 36, then $1,600,000 for 32.',
    )
  })
})

describe('2. the inside-the-range story is true to every ask', () => {
  const base = { city: 'Bend', marketMedianDom: 26, status: 'Expired' }

  it('Woodsman: 176 days above the range, 32 inside, and 32 is too short to point away from the price', () => {
    const e = buildAskExposure({ cycle: WOODSMAN_CYCLE, ...WOODSMAN_RANGE })!
    const reading = askStoryReading({ ...base, ask: 1_600_000, ...WOODSMAN_RANGE, days: 208, segments: e.segments })
    expect(reading).toBe(
      'For 176 of your 208 days you were asking above the range the sales support, at four asks from $1,695,000 to $1,629,000. ' +
        'You asked $1,600,000, inside the range, for the last 32 days, and your home did not sell. ' +
        'Half of the homes that sold in Bend had an offer inside 26 days.',
    )
  })

  it('Jackson: 148 days above the range, 79 inside, and only the 79 carry the claim', () => {
    const e = buildAskExposure({ cycle: JACKSON_CYCLE, ...JACKSON_RANGE })!
    const reading = askStoryReading({
      ...base,
      status: 'Canceled',
      ask: 639_000,
      ...JACKSON_RANGE,
      days: 227,
      segments: e.segments,
    })
    expect(reading).toBe(
      'For 148 of your 227 days you were asking above the range the sales support, at three asks from $699,000 to $659,000. ' +
        'You asked $639,000, inside the range, for the last 79 days, and your home did not sell. ' +
        'Half of the homes that sold in Bend had an offer inside 26 days. ' +
        'At a price inside the range, 79 days without a sale points at something other than the number. We would walk it with you before saying more.',
    )
  })

  it('never says the home went without an offer, which the MLS does not record', () => {
    for (const [cycle, range, ask, days] of [
      [WOODSMAN_CYCLE, WOODSMAN_RANGE, 1_600_000, 208],
      [JACKSON_CYCLE, JACKSON_RANGE, 639_000, 227],
    ] as const) {
      const e = buildAskExposure({ cycle, ...range })!
      const reading = askStoryReading({ ...base, ask, ...range, days, segments: e.segments })
      expect(reading).not.toMatch(/without an offer|never got|no offer/)
      expect(reading).not.toContain('You were asking inside the range the sales support.')
      expect(reading).not.toMatch(/[—]/)
    }
  })

  it('makes no claim about the days at a price when the split is not known', () => {
    const reading = askStoryReading({ ...base, ask: 639_000, ...JACKSON_RANGE, days: 227, segments: [] })
    expect(reading).toBe(
      'You were asking inside the range the sales support. Your home sat 227 days and did not sell. ' +
        'Half of the homes that sold in Bend had an offer inside 26 days.',
    )
  })
})

const PLACE: Omit<PlacePricingStory, 'placeName'> = {
  placeKind: 'neighborhood',
  windowMonths: 12,
  asOf: '2026-10-07',
  listedHomes: 342,
  didNotSell: 44,
  droppedPrice: 177,
  typicalCutShare: 0.057,
  gaveConcessions: 76,
  typicalConcessionShare: 0.009,
  heldAskCount: 20,
  heldAskMedianDays: 6,
  cutPriceCount: 30,
  cutPriceMedianDays: 81,
  sourceNote: 's',
}

describe('3. the place story says where the home sits before it tells the place', () => {
  // Coordinates are each subject's stored latitude and longitude; the MLS row
  // for each listing key carries the same boundary_neighborhood.
  it('Woodsman: Shevlin West in Summit West', () => {
    expect(
      placeStoryLead(
        { ...PLACE, placeName: 'Summit West' },
        { subdivision: 'Shevlin West', city: 'Bend', latitude: 44.073919, longitude: -121.37172 },
      ),
    ).toBe("Your home in Shevlin West is in Bend's Summit West neighborhood. Here's what happened there over the last 12 months.")
  })

  it('Jackson: Holliday Park in Mountain View', () => {
    expect(
      placeStoryLead(
        { ...PLACE, placeName: 'Mountain View' },
        { subdivision: 'Holliday Park', city: 'Bend', latitude: 44.075079, longitude: -121.268868 },
      ),
    ).toBe("Your home in Holliday Park is in Bend's Mountain View neighborhood. Here's what happened there over the last 12 months.")
  })

  it('Purcell: Silver Sage in Mountain View', () => {
    expect(
      placeStoryLead(
        { ...PLACE, placeName: 'Mountain View' },
        { subdivision: 'Silver Sage', city: 'Bend', latitude: 44.080952, longitude: -121.272517 },
      ),
    ).toBe("Your home in Silver Sage is in Bend's Mountain View neighborhood. Here's what happened there over the last 12 months.")
  })

  it('says nothing about the home when its coordinates do not land in that place', () => {
    // Woodsman's coordinates are in Summit West, not Mountain View.
    expect(
      placeStoryLead(
        { ...PLACE, placeName: 'Mountain View' },
        { subdivision: 'Shevlin West', city: 'Bend', latitude: 44.073919, longitude: -121.37172 },
      ),
    ).toBe("Here's what happened in the Mountain View neighborhood over the last 12 months.")
    expect(placeStoryLead({ ...PLACE, placeName: 'Summit West' }, null)).toBe(
      "Here's what happened in the Summit West neighborhood over the last 12 months.",
    )
  })
})

describe('4. the days chart names a sale it leaves off, and the caption counts the bars', () => {
  const market = {
    geoLabel: 'Bend',
    medianDom: 24.5,
    // render_args.market.offerTiming as the three rows store it.
    offerTiming: {
      city: 'Bend',
      windowMonths: 12,
      n: 2214,
      medianDays: 26,
      points: [
        { pct: 31.3, days: 7 },
        { pct: 40.1, days: 14 },
        { pct: 53.1, days: 30 },
        { pct: 68.9, days: 60 },
        { pct: 80.2, days: 90 },
        { pct: 93.4, days: 180 },
      ],
    },
  } as unknown as CmaMarketContext
  const sale = (address: string, daysToOffer: number | null, domTotal: number, onMarketDate: string, closeDate: string) =>
    ({ address, daysToOffer, domTotal, onMarketDate, closeDate }) as unknown as CmaAdjustedComp
  const subject = (streetAddress: string, status: string, days: number) =>
    ({
      streetAddress,
      city: 'Bend',
      standardStatus: status,
      listingHistoryLine: `Listed at $1, came off ${status.toLowerCase()} · ${days} days on market.`,
    }) as unknown as CmaSubject

  it('Woodsman: six bars, sale 2 named under the chart, the subject bar in its status word', () => {
    const html = renderDaysToOfferHtml({
      subject: subject('62475 Woodsman', 'Expired', 208),
      market,
      comps: [
        sale('62531 Woodsman', 48, 57, '2026-07-09', '2026-09-04'),
        sale('62467 Woodsman', null, 169, '2026-01-07', '2026-06-25'),
        sale('62637 Mt Hood', 65, 88, '2026-02-07', '2026-05-06'),
        sale('62552 Woodsman', 104, 133, '2025-12-11', '2026-04-23'),
        sale('62621 Mt Hood', 50, 71, '2026-02-09', '2026-04-21'),
        sale('62667 Ember', 95, 126, '2025-10-17', '2026-02-20'),
        sale('3369 Zayden', 6, 35, '2025-11-06', '2025-12-11'),
      ],
    })
    expect(html).toContain('All six sales shown had an offer within 104 days. Bend&#39;s median is 26. Yours sat 208 days and did not sell.')
    expect(html).toContain('Sale 2, 62467 Woodsman, is not on the chart: its offer date was not recorded.')
    expect(html).toContain('208 days, expired')
    expect(html).not.toMatch(/no offer|never got one|Every sale below/)
  })

  it('Jackson: "within" is true of the sale that took exactly 146 days', () => {
    const html = renderDaysToOfferHtml({
      subject: subject('2382 Jackson', 'Canceled', 227),
      market,
      comps: [
        sale('2224 Indigo', 47, 74, '2025-11-28', '2026-02-10'),
        sale('2254 Indigo', 146, 190, '2025-07-17', '2026-01-23'),
        sale('2799 Baroness', 13, 41, '2025-06-13', '2025-07-24'),
        sale('2266 Jackson', 27, 62, '2025-02-04', '2025-04-07'),
        sale('2591 Purcell', 45, 64, '2024-09-19', '2024-11-22'),
      ],
    })
    expect(html).toContain('All five sales shown had an offer within 146 days.')
    expect(html).toContain('227 days, canceled')
    expect(html).not.toContain('is not on the chart')
  })

  it('Purcell: sale 4 named under the chart, four bars counted', () => {
    const html = renderDaysToOfferHtml({
      subject: subject('3037 Purcell', 'Canceled', 39),
      market,
      comps: [
        sale('2124 Carrie', 39, 69, '2026-07-28', '2026-10-05'),
        sale('2058 Hollow Tree', 23, 49, '2026-07-10', '2026-08-28'),
        sale('2110 Carrie', 15, 42, '2026-04-10', '2026-05-22'),
        sale('2107 Carrie', null, 66, '2024-10-08', '2024-12-13'),
        sale('2591 Purcell', 45, 64, '2024-09-19', '2024-11-22'),
      ],
    })
    expect(html).toContain('All four sales shown had an offer within 45 days.')
    expect(html).toContain('Sale 4, 2107 Carrie, is not on the chart: its offer date was not recorded.')
    // 39 days is under the slowest sale, so the plain status fact prints.
    expect(html).toContain('Yours was canceled after 39 days.')
    expect(html).toContain('39 days, canceled')
  })
})
