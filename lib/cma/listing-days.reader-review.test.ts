/**
 * Reader review of the rebuilt expired-listing letters, 2026-10-08
 * (cma-3177-coho, cma-2745-aldrich, cma-3037-purcell, cma-20676-wild-rose).
 *
 *  1. Withdrawn time was counted as time on the market.
 *  2. Coming Soon days were counted as time to an offer, and an offer clock
 *     was moved back across a relist to the first list.
 *  3. A home under contract printed its list date and its days since listing.
 *  4. MLS timestamps were cut to their UTC day.
 *
 * Every fixture is the MLS record of a listing the review named
 * (listings + listing_history + status_history, read 2026-10-08).
 */
import { describe, expect, it } from 'vitest'
import type { BpoListingCycle } from '@/lib/bpo/types'
import {
  buildAskExposure,
  buildFinalCycle,
  cycleOnTheMarket,
  finalCycleDaysOnMarket,
  listingTimelineReading,
  resolveListingTimeline,
  stampFinalCycleDom,
} from '@/lib/cma/expired-audit'
import { stampClosedCompDom } from '@/lib/cma/closed-comp-dom-stamp'
import { bandRowToRival, type BandInventoryRow } from '@/lib/cma/band-rivals'
import { activeEntries, closedEntries, subjectEntry } from '@/lib/cma/matrix-entry'
import { domCell } from '@/lib/cma/comp-matrix'
import { timelineEndLabel } from '@/lib/cma/market-charts'
import { pricePathFromSale } from '@/lib/cma/price-path'
import type { ListingStatusChange } from '@/lib/cma/listing-status'
import type { CmaAdjustedComp, CmaComp, CmaSubject } from '@/lib/cma/types'

const COHO_LOG: ListingStatusChange[] = [
  { at: '2026-02-10T21:49:04+00:00', from: 'Active', to: 'Withdrawn' },
  { at: '2026-10-01T05:00:00+00:00', from: 'Withdrawn', to: 'Expired' },
]

const cycle = (over: Partial<BpoListingCycle>): BpoListingCycle => ({
  listingKey: '20251130212207116790000000',
  mlsNumber: null,
  status: 'Expired',
  listAgentName: null,
  listOfficeName: null,
  listDate: '2025-12-02T03:13:18+00:00',
  offMarketDate: '2026-09-30',
  originalListPrice: 585000,
  finalListPrice: 569000,
  closePrice: null,
  daysOnMarket: 303,
  priceCutCount: 1,
  totalPriceChangeAmt: -16000,
  wasRelisted: false,
  outcome: 'expired',
  ...over,
})

const COHO = cycle({})

describe('1. a listing\'s time on the market ends the day it left Active', () => {
  it('3177 Coho: 71 days, Dec 1 to Feb 10, and the listing expired Sep 30', () => {
    const onMarket = cycleOnTheMarket(COHO, COHO_LOG)
    expect(onMarket.listDate).toBe('2025-12-01')
    expect(onMarket.offMarketDate).toBe('2026-02-10')
    expect(onMarket.leftActiveAs).toBe('Withdrawn')
    expect(onMarket.statusDate).toBe('2026-09-30')
    expect(finalCycleDaysOnMarket(onMarket)).toBe(71)
    // Without the log the row's own dates stand, read as Pacific days.
    expect(finalCycleDaysOnMarket(cycleOnTheMarket(COHO, []))).toBe(303)
  })

  it('3177 Coho: the asks ran 31 days and 40 days, and the cut is dated Jan 1', () => {
    const final = buildFinalCycle({
      cycle: cycleOnTheMarket(COHO, COHO_LOG),
      priceEvents: [{ date: '2026-01-01', ask: 569000 }],
      fetchedAt: '2026-10-08T00:00:00Z',
    })!
    expect(final.listDate).toBe('2025-12-01')
    expect(final.cuts).toEqual([{ date: '2026-01-01', ask: 569000 }])
    expect(final.offMarketDate).toBe('2026-02-10')
    expect(final.days).toBe(71)
    expect(final.status).toBe('Expired')
    expect(final.leftActiveAs).toBe('Withdrawn')
    expect(final.statusDate).toBe('2026-09-30')
    const exposure = buildAskExposure({ cycle: final, rangeLow: 531576, rangeHigh: 551876 })!
    expect(exposure.segments.map((s) => [s.ask, s.from, s.to, s.days])).toEqual([
      [585000, '2025-12-01', '2026-01-01', 31],
      [569000, '2026-01-01', '2026-02-10', 40],
    ])
    expect(exposure.sentence).toContain('of your 71 days')
    expect(exposure.sentence).not.toContain('302')
  })

  it('2745 Aldrich: four asks over 108 days, the last one 6 days, not 98', () => {
    const aldrich = cycle({
      listingKey: '20260313154940567863000000',
      listDate: '2026-03-13T19:39:50+00:00',
      offMarketDate: '2026-09-30',
      originalListPrice: 520000,
      finalListPrice: 495000,
    })
    const log: ListingStatusChange[] = [
      { at: '2026-03-13T19:39:50+00:00', from: 'Coming Soon', to: 'Active' },
      { at: '2026-06-29T21:53:36+00:00', from: 'Active', to: 'Withdrawn' },
      { at: '2026-10-01T05:00:00+00:00', from: 'Withdrawn', to: 'Expired' },
    ]
    const final = buildFinalCycle({
      cycle: cycleOnTheMarket(aldrich, log),
      // Pacific days of the three cuts (the Jun 23 one is 01:07 UTC Jun 24).
      priceEvents: [
        { date: '2026-05-29', ask: 515000 },
        { date: '2026-06-09', ask: 505000 },
        { date: '2026-06-23', ask: 495000 },
      ],
    })!
    const exposure = buildAskExposure({ cycle: final, rangeLow: 473949, rangeHigh: 479161 })!
    expect(exposure.segments.map((s) => [s.ask, s.days])).toEqual([
      [520000, 77],
      [515000, 11],
      [505000, 14],
      [495000, 6],
    ])
    expect(final.days).toBe(108)
  })

  it('says how it came off, once, in the story and on the line', () => {
    const final = buildFinalCycle({
      cycle: cycleOnTheMarket(COHO, COHO_LOG),
      priceEvents: [{ date: '2026-01-01', ask: 569000 }],
    })!
    const subject = {
      streetAddress: '3177 Coho',
      city: 'Bend',
      standardStatus: 'Expired',
      lastListPrice: 569000,
      lastListDate: '2025-12-02T03:13:18+00:00',
      listingHistoryLine: null,
    } as unknown as CmaSubject
    const timeline = resolveListingTimeline({
      subject,
      expiredAudit: { findings: [], services: [], finalCycle: final },
      rangeLow: 531576,
      rangeHigh: 551876,
      rangeLabel: 'where homes like yours sold',
      domDays: 71,
    })!
    expect(timeline.days).toBe(71)
    expect(timeline.offMarketDate).toBe('2026-02-10')
    // The day it came off is not the day it expired.
    expect(timelineEndLabel(timeline)).toBe('came off after 71 days')
    const reading = listingTimelineReading({ timeline, city: 'Bend', marketMedianDom: 26 })
    expect(reading).toContain('It came off the market on Feb 10 after 71 days, and the listing expired on Sep 30.')
    expect(reading).not.toMatch(/302|sat 71 days|expired after/)
    expect(reading).not.toContain('—')
  })

  it('stamps the subject with its days on the market and how it came off', () => {
    const subject = {
      streetAddress: '3177 Coho',
      standardStatus: 'Expired',
      lastListPrice: 569000,
      lastListDate: '2025-12-02T03:13:18+00:00',
      listingHistoryLine: null,
    } as unknown as CmaSubject
    expect(stampFinalCycleDom(subject, cycleOnTheMarket(COHO, COHO_LOG))).toBe(71)
    expect(subject.cameOffAs).toBe('Withdrawn')
    expect(subject.listingHistoryLine).toBe(
      'Listed Dec 1, 2025 at $585,000, cut to $569,000, came off the market · 71 days on market.',
    )
  })

  it('prints the status of record with its own date in the subject column', () => {
    const final = buildFinalCycle({ cycle: cycleOnTheMarket(COHO, COHO_LOG) })!
    const entry = subjectEntry({
      subject: {
        streetAddress: '3177 Coho',
        standardStatus: 'Expired',
        lastListPrice: 569000,
        lastListDate: '2025-12-02T03:13:18+00:00',
      } as unknown as CmaSubject,
      finalCycle: final,
      domDays: 71,
      printableAsk: 569000,
    })
    expect(entry.outcome).toBe('Came off after 71 days')
    expect(entry.statusDate).toBe('2026-09-30')
    expect(entry.mlsStatus).toBe('Expired')
  })
})

describe('2. days to an offer start the day it went Active, on the period that sold', () => {
  const sale = (over: Partial<CmaComp>): CmaComp =>
    ({
      listingKey: 'K',
      address: '2124 Carrie',
      city: 'Bend',
      listPrice: 559000,
      originalListPrice: 559000,
      closePrice: 559000,
      closeDate: '2026-10-05',
      onMarketDate: '2026-07-28',
      daysToOffer: 39,
      domTotal: 69,
      ...over,
    }) as unknown as CmaComp

  it('2124 Carrie: Coming Soon Jul 28, Active Aug 17, Pending Sep 5: offer in 19 days', () => {
    const stamped = stampClosedCompDom(sale({}), {
      onMarketDate: '2026-08-17T18:50:35+00:00',
      listDate: '2026-08-17T18:50:35+00:00',
      originalEntryTimestamp: '2026-07-28T23:41:00+00:00',
      originalOnMarketTimestamp: '2026-08-17T18:50:35+00:00',
      historyListDates: ['2026-08-17'],
      statusChanges: [
        { at: '2026-08-17T18:50:35+00:00', from: 'Coming Soon', to: 'Active' },
        { at: '2026-09-05T23:32:51+00:00', from: 'Active', to: 'Pending' },
        { at: '2026-10-05T23:08:00+00:00', from: 'Pending', to: 'Closed' },
      ],
      pendingTimestamp: '2026-09-05T23:32:51+00:00',
      daysToPending: 19,
      mlsDaysOnMarket: 48,
    })
    expect(stamped.onMarketDate).toBe('2026-08-17')
    expect(stamped.daysToOffer).toBe(19)
    expect(stamped.offerFrom).toBe('2026-08-17')
    expect(stamped.domTotal).toBe(49)
    const [row] = closedEntries([{ ...stamped, adjustedPrice: 550951, weight: 1 } as unknown as CmaAdjustedComp])
    expect(row!.outcome).toContain('offer in 19 days')
    expect(row!.path?.startDate).toBe('2026-08-17')
  })

  it('a Coming Soon entry is dropped even on a row with no first on-market day', () => {
    const stamped = stampClosedCompDom(sale({}), {
      onMarketDate: '2026-08-17T18:50:35+00:00',
      originalEntryTimestamp: '2026-07-28T23:41:00+00:00',
      originalOnMarketTimestamp: null,
      statusChanges: [{ at: '2026-08-17T18:50:35+00:00', from: 'Coming Soon', to: 'Active' }],
      pendingTimestamp: '2026-09-05T23:32:51+00:00',
    })
    expect(stamped.onMarketDate).toBe('2026-08-17')
    expect(stamped.daysToOffer).toBe(19)
  })

  it('61197 Cottonwood: offer in 47 days after it came back, and the path starts that day', () => {
    const stamped = stampClosedCompDom(
      sale({ address: '61197 Cottonwood', closeDate: '2026-01-22', onMarketDate: '2025-04-11', daysToOffer: 264, domTotal: 286 }),
      {
        onMarketDate: '2025-11-14T00:42:52+00:00',
        originalOnMarketTimestamp: '2025-04-11T16:34:50+00:00',
        statusChanges: [
          { at: '2025-10-30T21:14:40+00:00', from: 'Active', to: 'Pending' },
          { at: '2025-11-14T00:42:52+00:00', from: 'Pending', to: 'Active' },
          { at: '2025-12-31T01:28:49+00:00', from: 'Active', to: 'Pending' },
          { at: '2026-01-22T21:26:06+00:00', from: 'Pending', to: 'Closed' },
        ],
        pendingTimestamp: '2025-12-31T01:28:49+00:00',
        daysToPending: 47,
      },
    )
    expect(stamped.daysToOffer).toBe(47)
    expect(stamped.offerFrom).toBe('2025-11-13')
    expect(stamped.onMarketDate).toBe('2025-04-11')
    const path = pricePathFromSale(stamped)!
    expect(path.startDate).toBe('2025-11-13')
    expect(path.days).toBe(47)
    expect(path.daysMeasure).toBe('offer')
  })
})

describe('3. a home under contract is dated the day it went under contract', () => {
  const row: BandInventoryRow = {
    ListingKey: '20260824184931201031000000',
    StreetNumber: '2820',
    StreetName: 'Aldrich',
    ListPrice: 549000,
    OriginalListPrice: 564000,
    DaysOnMarket: 22,
    OnMarketDate: '2026-08-24T21:35:27+00:00',
    PhotoURL: null,
    Latitude: 44.08,
    Longitude: -121.26,
    pending_timestamp: '2026-09-11T16:14:31+00:00',
    days_to_pending: 17,
  }

  it('2820 Aldrich: under contract Sep 11, 18 days to an offer, not 44 days since Aug 24', () => {
    const rival = bandRowToRival(row, 'Pending')!
    expect(rival.pendingDate).toBe('2026-09-11')
    expect(rival.daysOnMarket).toBe(18)
    const [entry] = activeEntries([rival])
    expect(entry!.statusDate).toBe('2026-09-11')
    expect(entry!.outcome).toBe('under contract at $549K · offer in 18 days')
    expect(domCell(entry!, entry!.domDays)).toBe('18 days to an offer')
  })

  it('a stored Pending row with no contract day prints neither its list date nor its days since', () => {
    const stored = { ...bandRowToRival(row, 'Pending')!, pendingDate: undefined, daysOnMarket: 44 }
    const [entry] = activeEntries([stored])
    expect(entry!.statusDate).toBeNull()
    expect(entry!.domDays).toBeNull()
    expect(entry!.outcome).toBe('under contract at $549K')
  })

  it('an Active home keeps its days on the market and its list day', () => {
    const rival = bandRowToRival({ ...row, pending_timestamp: null }, 'Active')!
    expect(rival.pendingDate).toBeUndefined()
    const [entry] = activeEntries([rival])
    expect(entry!.statusDate).toBe('2026-08-24')
    expect(entry!.outcome).toMatch(/^asking \$549K · \d+ days$/)
  })
})
