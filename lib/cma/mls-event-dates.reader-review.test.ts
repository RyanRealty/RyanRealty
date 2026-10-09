/**
 * THE DAY A HOME LEFT ACTIVE IS THE MLS'S DATE FOR THE EVENT, NOT THE DAY IT
 * WAS KEYED IN (reader review 2026-10-09, cma-1355-jacksonville).
 *
 * 1355 Jacksonville went Active Sep 23, 2026 (23:33 UTC, 4:33 PM in Bend).
 * Its MLS row says WithdrawDate 2026-09-28 and OffMarketDate 2026-09-28; the
 * change "MlsStatus: Active → Withdrawn" was entered Sep 29 at 17:24 UTC
 * (WithdrawnTimestamp, StatusChangeTimestamp). The letter printed "Status date
 * Sep 29, 2026" and "withdrawn after 6 days". It was withdrawn Sep 28, after 5.
 *
 * The rule: when the MLS row carries its own dated field for the event that
 * ended the stretch (WithdrawDate, CancellationDate, ExpirationDate,
 * OffMarketDate for the status of record, PurchaseContractDate, CloseDate),
 * that date is the day the home left Active and the end of its day count;
 * the status-log time stands only when the field is missing or falls outside
 * the stretch the log shows. Days stay Pacific, and rule 28's last stretch is
 * unchanged.
 *
 * Fixtures: listings + listing_history + status_history for 1355 Jacksonville
 * (ListingKey 20260923221358552279000000) and 3177 Coho
 * (20251130212207116790000000), read 2026-10-09.
 */
import { describe, expect, it } from 'vitest'
import type { BpoListingCycle } from '@/lib/bpo/types'
import { analyzeListingHistory } from '@/lib/bpo/history'
import { buildFinalCycle, cycleOnTheMarket, finalCycleDaysOnMarket } from '@/lib/cma/expired-audit'
import { lastActiveRun, mlsEventDay, type ListingStatusChange } from '@/lib/cma/listing-status'
import { subjectEntry } from '@/lib/cma/matrix-entry'
import { timelineEndLabel } from '@/lib/cma/market-charts'
import { resolveListingTimeline } from '@/lib/cma/expired-audit'
import { pickExpiredPeers } from '@/lib/cma/market-status'
import type { CmaMarketAreaRow } from '@/lib/data/cma/marketAreaReads'
import type { CmaSubject } from '@/lib/cma/types'

const JACKSONVILLE_LOG: ListingStatusChange[] = [
  // listing_history: the MLS change log.
  { at: '2026-09-29T17:24:44+00:00', from: 'Active', to: 'Withdrawn' },
  // status_history: the delta sync saw it nine minutes later.
  { at: '2026-09-29T17:33:13.379+00:00', from: 'Active', to: 'Withdrawn' },
]

/** listings row 20260923221358552279000000, the columns the cycle read selects. */
const JACKSONVILLE_ROW = {
  ListingKey: '20260923221358552279000000',
  StreetNumber: '1355',
  StreetName: 'Jacksonville',
  StandardStatus: 'Withdrawn',
  ListDate: '2026-09-23T23:33:01+00:00',
  OnMarketDate: '2026-09-23T23:33:01+00:00',
  off_market_date: '2026-09-28',
  status_change_timestamp: '2026-09-29T17:24:44+00:00',
  OriginalListPrice: 734999,
  ListPrice: 734999,
  DaysOnMarket: 9,
  // details->>WithdrawDate, the RETS payload.
  withdraw_date: '2026-09-28',
  cancellation_date: null,
  expiration_date: null,
  purchase_contract_date: null,
  CloseDate: null,
}

const subject = {
  listingKey: '20260923221358552279000000',
  streetAddress: '1355 Jacksonville',
  city: 'Bend',
  standardStatus: 'Withdrawn',
  lastListPrice: 734999,
  lastListDate: '2026-09-23T23:33:01+00:00',
  listingHistoryLine: null,
} as unknown as CmaSubject

describe('mlsEventDay: the row\'s own date for each event', () => {
  const dates = {
    withdrawDate: '2026-09-28',
    cancellationDate: '2026-09-20',
    expirationDate: '2026-12-31',
    offMarketDate: '2026-09-28',
    purchaseContractDate: '2026-09-15',
    closeDate: '2026-10-05T00:00:00+00:00',
  }
  it('reads the field that dates that event', () => {
    expect(mlsEventDay('Withdrawn', dates, 'Withdrawn')).toBe('2026-09-28')
    expect(mlsEventDay('Canceled', dates, 'Canceled')).toBe('2026-09-20')
    expect(mlsEventDay('Cancelled', dates, 'Canceled')).toBe('2026-09-20')
    expect(mlsEventDay('Expired', dates, 'Expired')).toBe('2026-12-31')
    expect(mlsEventDay('Pending', dates, 'Closed')).toBe('2026-09-15')
    expect(mlsEventDay('Active Under Contract', dates, 'Closed')).toBe('2026-09-15')
    // A date-only column read through a timestamp stays its own day.
    expect(mlsEventDay('Closed', dates, 'Closed')).toBe('2026-10-05')
  })

  it('OffMarketDate dates only the status of record (3177 Coho: Sep 30 is the expiry, not the withdrawal)', () => {
    const coho = { withdrawDate: null, offMarketDate: '2026-09-30' }
    expect(mlsEventDay('Withdrawn', coho, 'Expired')).toBeNull()
    expect(mlsEventDay('Expired', coho, 'Expired')).toBe('2026-09-30')
    expect(mlsEventDay('Withdrawn', { offMarketDate: '2026-09-28' }, 'Withdrawn')).toBe('2026-09-28')
  })

  it('no row dates, no date', () => {
    expect(mlsEventDay('Withdrawn', null, 'Withdrawn')).toBeNull()
    expect(mlsEventDay('Active', { withdrawDate: '2026-09-28' }, 'Withdrawn')).toBeNull()
  })
})

describe('1355 Jacksonville: withdrawn Sep 28 after 5 days, not Sep 29 after 6', () => {
  const eventDates = { withdrawDate: '2026-09-28', offMarketDate: '2026-09-28' }

  it('the run ends on the MLS withdraw date; without it, on the day the change was keyed in', () => {
    const base = { changes: JACKSONVILLE_LOG, onMarketDate: JACKSONVILLE_ROW.OnMarketDate, offMarketDate: '2026-09-28', status: 'Withdrawn' }
    expect(lastActiveRun({ ...base, eventDates })).toEqual({
      from: '2026-09-23',
      to: '2026-09-28',
      leftAs: 'Withdrawn',
      days: 5,
      source: 'status-history',
    })
    expect(lastActiveRun(base)).toMatchObject({ to: '2026-09-29', days: 6 })
  })

  it('a dated field outside the stretch the log shows is not this stretch\'s date', () => {
    const base = { changes: JACKSONVILLE_LOG, onMarketDate: JACKSONVILLE_ROW.OnMarketDate, status: 'Withdrawn' }
    // Before the stretch began: an earlier withdrawal of a listing that came back.
    expect(lastActiveRun({ ...base, eventDates: { withdrawDate: '2026-09-01' } })).toMatchObject({ to: '2026-09-29', days: 6 })
    // After the change was keyed in: not a record of this change.
    expect(lastActiveRun({ ...base, eventDates: { withdrawDate: '2026-10-02' } })).toMatchObject({ to: '2026-09-29', days: 6 })
  })

  it('the cycle read carries the row\'s dates, and the letter dates and counts by them', () => {
    const history = analyzeListingHistory([JACKSONVILLE_ROW], subject, null)
    const cycle = history.currentCycle as BpoListingCycle
    expect(cycle.eventDates).toMatchObject({ withdrawDate: '2026-09-28', offMarketDate: '2026-09-28' })
    const onMarket = cycleOnTheMarket(cycle, JACKSONVILLE_LOG)
    expect(onMarket.listDate).toBe('2026-09-23')
    expect(onMarket.offMarketDate).toBe('2026-09-28')
    expect(finalCycleDaysOnMarket(onMarket)).toBe(5)
    const final = buildFinalCycle({ cycle: onMarket, priceEvents: [], fetchedAt: '2026-10-09T00:00:00Z' })!
    expect(final.offMarketDate).toBe('2026-09-28')
    expect(final.days).toBe(5)
    // The grid's Status date and the chart's end label.
    const entry = subjectEntry({ subject, finalCycle: final, domDays: 5, printableAsk: 734999 })
    expect(entry.statusDate).toBe('2026-09-28')
    const timeline = resolveListingTimeline({
      subject,
      expiredAudit: { findings: [], services: [], finalCycle: final },
      rangeLow: 700_000,
      rangeHigh: 760_000,
      rangeLabel: 'where homes like yours sold',
      domDays: 5,
    })!
    expect(timelineEndLabel(timeline)).toBe('withdrawn after 5 days')
  })
})

describe('3177 Coho: the withdrawal is dated by WithdrawDate, the expiry by OffMarketDate', () => {
  const COHO_LOG: ListingStatusChange[] = [
    { at: '2026-02-10T21:49:04+00:00', from: 'Active', to: 'Withdrawn' },
    { at: '2026-10-01T05:00:00+00:00', from: 'Withdrawn', to: 'Expired' },
  ]
  const COHO: BpoListingCycle = {
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
    eventDates: { withdrawDate: '2026-02-09', offMarketDate: '2026-09-30' },
  }

  it('left Active Feb 9 (WithdrawDate; keyed in Feb 10), 70 days, and the listing expired Sep 30', () => {
    const onMarket = cycleOnTheMarket(COHO, COHO_LOG)
    expect(onMarket.listDate).toBe('2025-12-01')
    expect(onMarket.offMarketDate).toBe('2026-02-09')
    expect(onMarket.leftActiveAs).toBe('Withdrawn')
    expect(onMarket.statusDate).toBe('2026-09-30')
    expect(finalCycleDaysOnMarket(onMarket)).toBe(70)
    // A cycle read before the dates were selected keeps the log's Feb 10, 71 days.
    expect(finalCycleDaysOnMarket(cycleOnTheMarket({ ...COHO, eventDates: null }, COHO_LOG))).toBe(71)
  })
})

describe('a came-off home in the competition is dated the same way', () => {
  const row = (over: Partial<CmaMarketAreaRow>): CmaMarketAreaRow => ({
    ListingKey: 'PEER-1',
    StreetNumber: '88',
    StreetName: 'Wren',
    City: 'Bend',
    StandardStatus: 'Withdrawn',
    ListPrice: 519_000,
    ClosePrice: null,
    CloseDate: null,
    ListDate: '2026-09-23T23:33:01+00:00',
    OnMarketDate: '2026-09-23T23:33:01+00:00',
    TotalLivingAreaSqFt: 1420,
    BedroomsTotal: 3,
    BathroomsTotal: 3,
    DaysOnMarket: 9,
    CumulativeDaysOnMarket: 9,
    status_change_timestamp: '2026-09-29T17:24:44+00:00',
    off_market_date: '2026-09-28',
    withdraw_date: '2026-09-28',
    SubdivisionName: 'Tetherow',
    statusChanges: JACKSONVILLE_LOG,
    ...over,
  })
  const subj = {
    beds: 3,
    baths: 3,
    sqft: 1450,
    yearBuilt: 2005,
    subdivision: 'Tetherow',
    city: 'Bend',
    latitude: 43.7,
    longitude: -121.5,
    listingKey: 'SUBJECT',
    mlsNumber: '1',
    streetAddress: '15991 Falcon',
  }

  it('its days end, and its status is dated, on the MLS withdraw date', () => {
    const [peer] = pickExpiredPeers([row({})], subj)
    expect(peer).toMatchObject({ offMarketDate: '2026-09-28', daysOnMarket: 5, statusDate: '2026-09-28' })
    const [unread] = pickExpiredPeers([row({ withdraw_date: null, off_market_date: null })], subj)
    expect(unread).toMatchObject({ offMarketDate: '2026-09-29', daysOnMarket: 6, statusDate: '2026-09-29' })
  })
})
