/**
 * LAST STRETCH, LABELED (Matt 2026-10-08).
 *
 * A home that was relisted or came back on the market before it sold is
 * measured on one clock, its last stretch on the market: days to an offer run
 * from the last time it came on the market, and the first ask printed is the
 * price in effect when that stretch began. Where the stretch is not the
 * listing's first, the letter says so.
 *
 * Every fixture is the MLS record of a home the 2026-10-08 reader reviews
 * named, read from listings, listing_history ('MlsStatus: A → B' and
 * 'ListPrice: A → B'), status_history and price_history.
 */
import { describe, expect, it } from 'vitest'
import {
  askInEffectAt,
  listingStretch,
  mergeAskChanges,
  offerRunTimed,
  type AskChange,
  type ListingStatusChange,
} from '@/lib/cma/listing-status'
import {
  cycleOpeningAsk,
  listingStretchRead,
  offerDaysPhrase,
  restartedSalesLine,
  saleStretch,
  subjectFirstAsk,
} from '@/lib/cma/last-stretch'
import { stampClosedCompDom } from '@/lib/cma/closed-comp-dom-stamp'
import { closedEntries, activeEntries, unsoldEntries } from '@/lib/cma/matrix-entry'
import { bandRowStretch, bandRowToRival, competitorCutLine, withRivalStretch, type BandInventoryRow } from '@/lib/cma/band-rivals'
import { daysToOfferCaption, renderDaysToOfferHtml } from '@/lib/cma/market-area-chapters'
import { buildAskExposure, buildFinalCycle, cycleOnTheMarket, resolveListingTimeline } from '@/lib/cma/expired-audit'
import { pricePathFromFinalCycle } from '@/lib/cma/price-path'
import type { BpoListingCycle } from '@/lib/bpo/types'
import type { CmaExpiredPeer } from '@/lib/cma/market-status'
import type { CmaAdjustedComp, CmaComp, CmaSubject } from '@/lib/cma/types'

const status = (at: string, from: string, to: string): ListingStatusChange => ({ at, from, to })
const ask = (at: string, from: number | null, to: number): AskChange => ({ at, from, to })

// 61197 Cottonwood (20250407164153264767000000): listed Apr 11 2025 at
// $849,900, cut to $774,900, Pending Oct 30, fell through, back Nov 13 (00:42
// UTC Nov 14), Pending Dec 30, closed Jan 22 at $715,000.
const COTTONWOOD_LOG = [
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
// $629,000, withdrawn May 12 and Aug 14 2025, back Aug 18 at $569,000,
// Pending Sep 2, closed Sep 29 at $547,000.
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

// 628 Portland (20250711003254075732000000): listed Jul 11 2025 at $1,475,000,
// cut to $1,395,000, expired, back Jan 13 2026 at $1,395,000, cut to
// $1,189,000, Pending Aug 12, closed Sep 8 at $1,150,000. The delta sync wrote
// the May 14 cut three times.
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
  [
    ask('2026-05-14T22:50:25.581+00:00', 1395000, 1325000),
    ask('2026-05-15T04:00:51.952+00:00', 1395000, 1325000),
    ask('2026-05-21T14:10:48.867+00:00', 1395000, 1325000),
    ask('2026-05-29T14:03:39.098+00:00', 1325000, 1289000),
    ask('2026-06-17T23:03:33.573+00:00', 1289000, 1189000),
  ],
)

// 2260 Indigo (20260115215502926482000000), for sale: Coming Soon, Active Jan
// 29 2026 at $670,000, cut to $645,000, withdrawn Jun 8, back Jun 15 at
// 16:16:30 UTC at $645,000, cut 19 seconds later and on down to $550,000.
const INDIGO_ROW: BandInventoryRow = {
  ListingKey: '20260115215502926482000000',
  StreetNumber: '2260',
  StreetName: 'Indigo',
  ListPrice: 550000,
  OriginalListPrice: 670000,
  DaysOnMarket: 112,
  OnMarketDate: '2026-06-15T16:16:30+00:00',
  original_on_market_timestamp: '2026-01-29T21:47:23+00:00',
  PhotoURL: null,
  Latitude: 44.07618,
  Longitude: -121.269519,
}
const INDIGO_ASKS = mergeAskChanges(
  [
    ask('2026-02-12T19:08:45+00:00', 670000, 660000),
    ask('2026-04-02T16:04:20+00:00', 660000, 650000),
    ask('2026-05-22T15:30:58+00:00', 650000, 645000),
    ask('2026-06-15T16:16:49+00:00', 645000, 635000),
    ask('2026-07-08T16:54:56+00:00', 635000, 615000),
    ask('2026-07-28T22:30:37+00:00', 615000, 599999),
    ask('2026-08-19T22:15:58+00:00', 599999, 589999),
    ask('2026-09-09T18:13:05+00:00', 589999, 575000),
    ask('2026-09-23T15:27:43+00:00', 575000, 550000),
  ],
  [ask('2026-05-22T15:40:38.335+00:00', 650000, 645000)],
)
// 2350 Purcell, the other home in 2382 Jackson's competition: never cut.
const PURCELL_ROW: BandInventoryRow = {
  ListingKey: '20260616232154296444000000',
  StreetNumber: '2350',
  StreetName: 'Purcell',
  ListPrice: 675000,
  OriginalListPrice: 675000,
  DaysOnMarket: 107,
  OnMarketDate: '2026-06-23T19:02:21+00:00',
  original_on_market_timestamp: '2026-06-23T19:02:21+00:00',
  PhotoURL: null,
  Latitude: 44.075624,
  Longitude: -121.269354,
}

const sale = (over: Partial<CmaComp>): CmaComp =>
  ({
    listingKey: 'K',
    address: 'Sale',
    city: 'Bend',
    closeDate: '2026-01-22',
    daysToOffer: null,
    domTotal: null,
    ...over,
  }) as unknown as CmaComp

const adjusted = (c: CmaComp): CmaAdjustedComp => ({ ...c, adjustedPrice: c.closePrice, weight: 0.2 }) as unknown as CmaAdjustedComp

function stampCottonwood(): CmaComp {
  return stampClosedCompDom(
    sale({
      listingKey: '20250407164153264767000000',
      address: '61197 Cottonwood',
      listPrice: 774900,
      originalListPrice: 849900,
      closePrice: 715000,
      closeDate: '2026-01-22',
      onMarketDate: '2025-11-14',
    }),
    {
      onMarketDate: '2025-11-14T00:42:52+00:00',
      listDate: '2025-11-14T00:42:52+00:00',
      originalOnMarketTimestamp: '2025-04-11T16:34:50+00:00',
      originalEntryTimestamp: '2025-04-11T16:34:50+00:00',
      statusChanges: COTTONWOOD_LOG,
      pendingTimestamp: '2025-12-31T01:28:49+00:00',
      daysToPending: 47,
      mlsDaysOnMarket: 68,
      askChanges: COTTONWOOD_ASKS,
      originalListPrice: 849900,
      listPrice: 774900,
    },
  )
}

function stampBrownTrout(): CmaComp {
  return stampClosedCompDom(
    sale({
      listingKey: '20241202232216229997000000',
      address: '61131 Brown Trout',
      listPrice: 569000,
      originalListPrice: 629000,
      closePrice: 547000,
      closeDate: '2025-09-29',
      onMarketDate: '2025-08-18',
    }),
    {
      onMarketDate: '2025-08-18T14:42:44+00:00',
      originalOnMarketTimestamp: '2024-12-03T00:09:00+00:00',
      statusChanges: BROWN_TROUT_LOG,
      pendingTimestamp: '2025-09-02T22:40:53+00:00',
      daysToPending: 15,
      askChanges: BROWN_TROUT_ASKS,
      originalListPrice: 629000,
      listPrice: 569000,
    },
  )
}

describe('the ask in effect when a stretch began', () => {
  it('is the last recorded change at or before that moment', () => {
    expect(askInEffectAt(COTTONWOOD_ASKS, '2025-11-14T00:42:52+00:00', { openingAsk: 849900 })).toBe(774900)
    expect(askInEffectAt(PORTLAND_ASKS, '2026-01-13T23:55:38+00:00', { openingAsk: 1475000 })).toBe(1395000)
  })

  it('2260 Indigo: back at 16:16:30 at $645,000; the cut 19 seconds later is in the stretch', () => {
    expect(askInEffectAt(INDIGO_ASKS, '2026-06-15T16:16:30+00:00', { openingAsk: 670000 })).toBe(645000)
  })

  it('the MLS change log\'s timestamp wins over the sync row that repeats it', () => {
    // 20676 Wild Rose: the cut is 04:05:49 in the MLS log and 04:18:13 in price_history;
    // it went Active at 04:06:03.
    const merged = mergeAskChanges(
      [ask('2026-09-03T04:05:49+00:00', 625000, 599900)],
      [ask('2026-09-03T04:18:13.188+00:00', 625000, 599900)],
    )
    expect(merged).toHaveLength(1)
    expect(askInEffectAt(merged, '2026-09-03T04:06:03+00:00', { openingAsk: 625000 })).toBe(599900)
    expect(PORTLAND_ASKS).toHaveLength(6)
  })

  it('with no change on record: the opening ask on a first stretch, nothing on a restart unless the ask never moved', () => {
    expect(askInEffectAt([], '2025-06-03T21:58:19+00:00', { openingAsk: 799900, currentAsk: 799900, restarted: true })).toBe(799900)
    expect(askInEffectAt([], '2025-06-03T21:58:19+00:00', { openingAsk: 849900, currentAsk: 774900, restarted: true })).toBeNull()
    expect(askInEffectAt([], '2025-06-03T21:58:19+00:00', { openingAsk: 849900, currentAsk: 774900 })).toBe(849900)
    // No opening ask on record is no evidence the ask never moved.
    expect(askInEffectAt([], '2025-06-03T21:58:19+00:00', { openingAsk: null, currentAsk: 500000 })).toBeNull()
  })
})

describe('1. sales: the first ask and the offer clock are one stretch, labeled', () => {
  it('61197 Cottonwood: first ask $774,900, offer 47 days after it last came on the market, no change on that stretch', () => {
    const stamped = stampCottonwood()
    expect(stamped.daysToOffer).toBe(47)
    expect(stamped.offerFrom).toBe('2025-11-13')
    expect(stamped.stretch).toEqual({ from: '2025-11-13', firstAsk: 774900, restarted: true })
    // The MLS original stays on the row for the price engine.
    expect(stamped.originalListPrice).toBe(849900)
    const [row] = closedEntries([adjusted(stamped)])
    expect(row!.firstAsk).toBe(774900)
    expect(row!.outcome).toBe('sold $715K · offer 47 days after it last came on the market')
    expect(row!.priceChanges).toBe(0)
    expect(row!.restarted).toBe(true)
  })

  it('61131 Brown Trout: back Aug 18 at $569,000, 15 days', () => {
    const stamped = stampBrownTrout()
    expect(stamped.stretch).toEqual({ from: '2025-08-18', firstAsk: 569000, restarted: true })
    const [row] = closedEntries([adjusted(stamped)])
    expect(row!.outcome).toBe('sold $547K · offer 15 days after it last came on the market')
    expect(row!.firstAsk).toBe(569000)
  })

  it('628 Portland: the stretch that sold began at $1,395,000, not $1,475,000', () => {
    const offer = offerRunTimed({
      changes: PORTLAND_LOG,
      onMarketDate: '2026-01-13T23:55:38+00:00',
      firstOnMarketAt: '2025-07-11T18:20:10+00:00',
      closeDate: '2026-09-08',
    })!
    expect(offer.days).toBe(211)
    expect(offer.fromAt).toBe('2026-01-13T23:55:38+00:00')
    const stretch = listingStretch({
      startAt: offer.fromAt,
      changes: PORTLAND_LOG,
      firstOnMarketAt: '2025-07-11T18:20:10+00:00',
      askChanges: PORTLAND_ASKS,
      openingAsk: 1475000,
      currentAsk: 1189000,
    })
    expect(stretch).toEqual({ from: '2026-01-13', firstAsk: 1395000, restarted: true })
    const [row] = closedEntries([
      adjusted(sale({ address: '628 Portland', listPrice: 1189000, originalListPrice: 1475000, closePrice: 1150000, closeDate: '2026-09-08', daysToOffer: 211, offerFrom: '2026-01-13', onMarketDate: '2025-07-11', domTotal: 424, stretch })),
    ])
    expect(row!.firstAsk).toBe(1395000)
    expect(row!.outcome).toBe('sold $1.15M · offer 211 days after it last came on the market')
  })

  it('1613 Ithaca: relisted Jun 3 with no status log, 20 days, first listed Apr 24, labeled', () => {
    const stamped = stampClosedCompDom(
      sale({ address: '1613 Ithaca', listPrice: 799900, originalListPrice: 799900, closePrice: 775000, closeDate: '2025-07-25' }),
      {
        onMarketDate: '2025-06-03T21:58:19+00:00',
        listDate: '2025-06-03T21:58:19+00:00',
        originalOnMarketTimestamp: '2025-04-24T19:19:18+00:00',
        statusChanges: [],
        pendingTimestamp: '2025-06-23T22:06:28+00:00',
        daysToPending: 20,
        askChanges: [],
        originalListPrice: 799900,
        listPrice: 799900,
      },
    )
    expect(stamped.daysToOffer).toBe(20)
    expect(stamped.stretch).toEqual({ from: '2025-06-03', firstAsk: 799900, restarted: true })
    const [row] = closedEntries([adjusted(stamped)])
    expect(row!.outcome).toBe('sold $775K · offer 20 days after it last came on the market')
  })

  it('a first stretch is not labeled', () => {
    expect(offerDaysPhrase(4, false)).toBe('offer in 4 days')
    const stamped = stampClosedCompDom(
      sale({ address: '20825 Chloe', listPrice: 710000, originalListPrice: 710000, closePrice: 710000, closeDate: '2026-08-07' }),
      {
        onMarketDate: '2026-07-01T07:15:02+00:00',
        originalOnMarketTimestamp: '2026-07-01T07:15:02+00:00',
        statusChanges: [
          status('2026-07-01T07:15:02+00:00', 'Coming Soon', 'Active'),
          status('2026-07-05T17:43:41+00:00', 'Active', 'Pending'),
        ],
        askChanges: [],
        originalListPrice: 710000,
        listPrice: 710000,
      },
    )
    expect(stamped.stretch?.restarted).toBe(false)
    expect(closedEntries([adjusted(stamped)])[0]!.outcome).toBe('sold $710K · offer in 4 days')
  })

  it('a row stored before the stamp: restarted from its offer clock, first ask only when the ask never moved', () => {
    expect(
      saleStretch({ offerFrom: '2025-11-13', onMarketDate: '2025-04-11', originalListPrice: 849900, listPrice: 774900 }),
    ).toEqual({ firstAsk: null, restarted: true })
    expect(
      saleStretch({ offerFrom: '2025-06-03', onMarketDate: '2025-04-24', originalListPrice: 799900, listPrice: 799900 }),
    ).toEqual({ firstAsk: 799900, restarted: true })
    const [row] = closedEntries([
      adjusted(sale({ address: '61197 Cottonwood', listPrice: 774900, originalListPrice: 849900, closePrice: 715000, daysToOffer: 47, offerFrom: '2025-11-13', onMarketDate: '2025-04-11', domTotal: 286 })),
    ])
    // Never the April $849,900 beside a count from Nov 13.
    expect(row!.firstAsk).toBeNull()
    expect(row!.priceChanges).toBeNull()
    expect(row!.outcome).toBe('sold $715K · offer 47 days after it last came on the market')
  })

  // 2254 Indigo (20250714223341743203000000), reader review cma-2382-jackson.
  // The MLS log is one listing: new Jul 17 2025 at $709,999, Active to Pending
  // Aug 27 and back Aug 28 still at $709,999, cut to $699,900 on Sep 4, then
  // Pending at 2025-10-09 00:59:52 UTC and Active again at 01:22:32 UTC, still
  // $699,900 (22 minutes 40 seconds). Pending Dec 10, closed Jan 23 at $670,000.
  // The Aug 27 and Aug 28 clock times below are a one-day gap on the review's
  // dates. The review recorded the day, not the minute. The October pair and
  // the Dec 10 pending are the review's timestamps.
  const INDIGO_2254_ASKS = [
    ask('2025-09-04T17:00:00+00:00', 709999, 699900),
    ask('2025-12-01T18:00:00+00:00', 699900, 689500),
  ]
  const INDIGO_2254_BLIP = [
    status('2025-10-09T00:59:52+00:00', 'Active', 'Pending'),
    status('2025-10-09T01:22:32+00:00', 'Pending', 'Active'),
    status('2025-12-10T19:44:51+00:00', 'Active', 'Pending'),
  ]

  function stampIndigo2254(statusChanges: ListingStatusChange[]): CmaComp {
    return stampClosedCompDom(
      sale({
        listingKey: '20250714223341743203000000',
        address: '2254 Indigo',
        listPrice: 689500,
        originalListPrice: 709999,
        closePrice: 670000,
        closeDate: '2026-01-23',
        onMarketDate: '2025-10-09',
      }),
      {
        onMarketDate: '2025-10-09T01:22:32+00:00',
        originalOnMarketTimestamp: '2025-07-17T16:00:00+00:00',
        statusChanges,
        pendingTimestamp: '2025-12-10T19:44:51+00:00',
        daysToPending: 62,
        askChanges: INDIGO_2254_ASKS,
        originalListPrice: 709999,
        listPrice: 689500,
      },
    )
  }

  it('2254 Indigo: a 23-minute same-ask pending reversal does not restart the clock or the ask', () => {
    const stamped = stampIndigo2254(INDIGO_2254_BLIP)
    expect(stamped.daysToOffer).toBe(146)
    expect(stamped.offerFrom).toBe('2025-07-17')
    expect(stamped.stretch).toEqual({ from: '2025-07-17', firstAsk: 709999, restarted: false })
    const [row] = closedEntries([adjusted(stamped)])
    expect(row!.outcome).toBe('sold $670K · offer in 146 days')
    expect(row!.outcome).not.toContain('63 days')
  })

  it('2254 Indigo: a one-day same-ask fallout still starts the last stretch, and the later 23-minute blip does not', () => {
    const stamped = stampIndigo2254([
      status('2025-08-27T18:00:00+00:00', 'Active', 'Pending'),
      status('2025-08-28T18:00:00+00:00', 'Pending', 'Active'),
      ...INDIGO_2254_BLIP,
    ])
    expect(stamped.daysToOffer).toBe(104)
    expect(stamped.offerFrom).toBe('2025-08-28')
    expect(stamped.stretch).toEqual({ from: '2025-08-28', firstAsk: 709999, restarted: true })
    expect(stamped.offerFrom).not.toBe('2025-10-08')
    expect(stamped.stretch?.firstAsk).not.toBe(699900)
  })
})

describe('the days chart says which clock it counts', () => {
  it('"of last coming on the market" when any shown sale came back, and names those sales', () => {
    expect(daysToOfferCaption(5, 47)).toBe('All five sales shown had an offer within 47 days.')
    expect(daysToOfferCaption(5, 47, { lastOnMarket: true })).toBe(
      'All five sales shown had an offer within 47 days of last coming on the market.',
    )
    expect(restartedSalesLine([])).toBeNull()
    expect(restartedSalesLine([{ n: 2, address: '628 Portland' }])).toBe(
      'Sale 2, 628 Portland, counts from the day it last came on the market.',
    )
    expect(
      restartedSalesLine([
        { n: 4, address: '61197 Cottonwood' },
        { n: 5, address: '61131 Brown Trout' },
      ]),
    ).toBe('Sale 4, 61197 Cottonwood, and sale 5, 61131 Brown Trout, count from the day each last came on the market.')
  })

  it('20676 Wild Rose: the caption is true on the last-stretch clock', () => {
    const chloe = adjusted(sale({ address: '20825 Chloe', listPrice: 710000, originalListPrice: 710000, closePrice: 710000, closeDate: '2026-08-07', daysToOffer: 4, offerFrom: '2026-07-01', onMarketDate: '2026-07-01', domTotal: 37 }))
    const goldenrod = adjusted(sale({ address: '20582 Goldenrod', listPrice: 699000, originalListPrice: 699000, closePrice: 699000, closeDate: '2026-05-26', daysToOffer: 4, offerFrom: '2026-04-20', onMarketDate: '2026-04-20', domTotal: 36 }))
    const html = renderDaysToOfferHtml({
      subject: { streetAddress: '20676 Wild Rose', standardStatus: 'Withdrawn' } as unknown as CmaSubject,
      comps: [chloe, goldenrod, adjusted(stampCottonwood()), adjusted(stampBrownTrout())],
      market: null,
    })
    expect(html).toContain('All four sales shown had an offer within 47 days of last coming on the market.')
    expect(html).toContain(
      'Sale 3, 61197 Cottonwood, and sale 4, 61131 Brown Trout, count from the day each last came on the market.',
    )
  })
})

describe('4. competition: 2260 Indigo on its last stretch', () => {
  it('first ask $645,000, 115 days since it came back, a $95,000 cut', () => {
    const stretch = bandRowStretch(INDIGO_ROW, INDIGO_ASKS)
    expect(stretch).toEqual({ from: '2026-06-15', firstAsk: 645000, restarted: true })
    const rival = withRivalStretch({ ...bandRowToRival(INDIGO_ROW, 'Active')!, daysOnMarket: 115 }, stretch)
    expect(listingStretchRead(rival)).toEqual({ firstAsk: 645000, restarted: true })
    const [entry] = activeEntries([rival])
    expect(entry!.firstAsk).toBe(645000)
    expect(entry!.outcome).toBe('asking $550K · 115 days since it last came on the market')
    const purcell = withRivalStretch(bandRowToRival(PURCELL_ROW, 'Active')!, bandRowStretch(PURCELL_ROW, []))
    expect(competitorCutLine([purcell, rival])).toBe(
      '1 of the 2 homes below has come down since it last came on the market, a cut of $95,000, or 14.7 percent.',
    )
  })

  it('without its ask history, a home that came back prints no first ask, never its first stretch\'s', () => {
    const rival = bandRowToRival(INDIGO_ROW, 'Active')!
    expect(rival.stretch).toEqual({ from: '2026-06-15', firstAsk: null, restarted: true })
    expect(activeEntries([rival])[0]!.firstAsk).toBeNull()
    // Nothing to measure a cut from: the line says nothing rather than $120,000.
    expect(competitorCutLine([rival])).toBeNull()
  })

  it('a row stored before the stamp keeps its asks', () => {
    const { stretch: _s, ...stored } = bandRowToRival(INDIGO_ROW, 'Active')!
    void _s
    expect(listingStretchRead({ ...stored, originalListPrice: 670000 })).toEqual({ firstAsk: 670000, restarted: false })
  })
})

describe('came-off homes are labeled the same way', () => {
  it('a peer that came back says its days run from then', () => {
    const peer = {
      listingKey: 'P',
      address: '1 Peer',
      listPrice: 500000,
      originalListPrice: 560000,
      status: 'Expired',
      daysOnMarket: 96,
      stretch: { from: '2026-03-01', firstAsk: 520000, restarted: true },
      onMarketDate: '2026-03-01',
      photoUrl: null,
      listingHistoryLine: null,
      beds: 3,
      baths: 2,
      sqft: 1500,
      yearBuilt: 2000,
      lotAcres: 0.2,
      propertySubType: 'Single Family Residence',
      latitude: null,
      longitude: null,
    } as CmaExpiredPeer
    const [entry] = unsoldEntries([peer])
    expect(entry!.outcome).toBe('came off 96 days after it last came on the market')
    expect(entry!.firstAsk).toBe(520000)
  })
})

describe('5. the subject: its first ask is the ask in effect when it went Active', () => {
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
  const LOG = [
    status('2026-09-03T04:06:03+00:00', 'Coming Soon', 'Active'),
    status('2026-09-29T03:10:01+00:00', 'Active', 'Withdrawn'),
  ]

  it('20676 Wild Rose: Coming Soon at $625,000, changed 14 seconds before it went Active, asked $599,900 for all 26 days', () => {
    const onMarket = cycleOnTheMarket(WILD_ROSE, LOG)
    expect(onMarket.listedAt).toBe('2026-09-03T04:06:03+00:00')
    expect(onMarket.restarted).toBe(false)
    const final = buildFinalCycle({
      cycle: onMarket,
      priceEvents: [{ date: '2026-09-02', at: '2026-09-03T04:05:49+00:00', ask: 599900, previousAsk: 625000 }],
    })!
    expect(final.initialAsk).toBe(599900)
    expect(final.cuts).toEqual([])
    expect(final.days).toBe(26)
    const exposure = buildAskExposure({ cycle: final, rangeLow: 627332, rangeHigh: 724442 })!
    expect(exposure.sentence).toBe('You asked $599,900 for all 26 days you were on the market.')
    expect(pricePathFromFinalCycle({ ...final, cuts: final.cuts }, '20676 Wild Rose')!.startPrice).toBe(599900)
  })

  it('a stored cycle that opens on its Coming Soon price with a change the day it went Active reads as $599,900', () => {
    const stored = {
      listDate: '2026-09-02',
      initialAsk: 625000,
      cuts: [{ date: '2026-09-02', ask: 599900 }],
      cutsDated: true,
      finalAsk: 599900,
      offMarketDate: '2026-09-28',
      status: 'Withdrawn',
      days: 26,
    }
    expect(cycleOpeningAsk(stored)).toBe(599900)
    const path = pricePathFromFinalCycle(stored, '20676 Wild Rose')!
    expect(path.startPrice).toBe(599900)
    expect(path.cuts).toEqual([])
    const timeline = resolveListingTimeline({
      subject: { streetAddress: '20676 Wild Rose', standardStatus: 'Withdrawn', lastListPrice: 599900 } as unknown as CmaSubject,
      expiredAudit: { findings: [], services: [], finalCycle: stored as never },
      rangeLow: 627332,
      rangeHigh: 724442,
      rangeLabel: 'range',
      domDays: 26,
    })!
    expect(timeline.steps).toEqual([{ date: '2026-09-02', ask: 599900 }])
    expect(
      subjectFirstAsk({
        subject: { originalListPrice: 625000 },
        exposure: { segments: [{ ask: 599900 }] },
        finalCycle: stored,
      }),
    ).toBe(599900)
  })

  it('a subject that came back says its days count from then', () => {
    const relisted = cycleOnTheMarket(
      { ...WILD_ROSE, firstOnMarketAt: '2026-05-01T16:00:00+00:00' },
      [status('2026-06-01T16:00:00+00:00', 'Active', 'Withdrawn'), ...LOG],
    )
    expect(relisted.restarted).toBe(true)
    const final = buildFinalCycle({
      cycle: relisted,
      priceEvents: [{ date: '2026-09-02', at: '2026-09-03T04:05:49+00:00', ask: 599900, previousAsk: 625000 }],
    })!
    expect(final.restarted).toBe(true)
    expect(final.initialAsk).toBe(599900)
    const exposure = buildAskExposure({ cycle: final, rangeLow: 627332, rangeHigh: 724442 })!
    expect(exposure.sentence).toBe('You asked $599,900 for all 26 days since your home last came on the market.')
    // Without a recorded change to place its opening ask, a stretch that came
    // back never borrows the first stretch's.
    expect(buildFinalCycle({ cycle: relisted, priceEvents: [] })!.initialAsk).toBeNull()
  })
})
