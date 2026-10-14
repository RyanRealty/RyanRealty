/**
 * A listing's days are the days it was Active, counted between Pacific days
 * (reader review 2026-10-08). Every fixture below is the MLS status log of a
 * listing the review named, read from listing_history and status_history.
 */
import { describe, expect, it } from 'vitest'
import {
  CAME_OFF_MIXED,
  PENDING_REVERSAL_BLIP_MS,
  activePeriods,
  cameOffStatus,
  cameOffThenSentence,
  lastActiveRun,
  listingStretch,
  mergeStatusChanges,
  offerRun,
  offerRunTimed,
  pacificDay,
  pacificDaysBetween,
  parseMlsStatusChange,
  statusKind,
  type AskChange,
  type ListingStatusChange,
} from '@/lib/cma/listing-status'

const change = (at: string, description: string): ListingStatusChange => {
  const parsed = parseMlsStatusChange(description)!
  return { at, from: parsed.from, to: parsed.to }
}

// 3177 Coho (key 20251130212207116790000000).
const COHO = [
  change('2026-02-10T21:49:04+00:00', 'MlsStatus: Active → Withdrawn'),
  change('2026-10-01T05:00:00+00:00', 'MlsStatus: Withdrawn → Expired'),
]
// 2745 Aldrich (key 20260313154940567863000000).
const ALDRICH = [
  change('2026-03-13T19:39:50+00:00', 'MlsStatus: Coming Soon → Active'),
  change('2026-06-29T21:53:36+00:00', 'MlsStatus: Active → Withdrawn'),
  change('2026-10-01T05:00:00+00:00', 'MlsStatus: Withdrawn → Expired'),
]
// 2124 Carrie (key 20260728231643861137000000): Coming Soon from Jul 28.
const CARRIE = [
  change('2026-08-17T18:50:35+00:00', 'MlsStatus: Coming Soon → Active'),
  change('2026-09-05T23:32:51+00:00', 'MlsStatus: Active → Pending'),
  change('2026-10-05T23:08:00+00:00', 'MlsStatus: Pending → Closed'),
]
// 61197 Cottonwood: Pending Oct 30, back on the market, Pending again.
const COTTONWOOD = [
  change('2025-10-30T21:14:40+00:00', 'MlsStatus: Active → Pending'),
  change('2025-11-14T00:42:52+00:00', 'MlsStatus: Pending → Active'),
  change('2025-12-31T01:28:49+00:00', 'MlsStatus: Active → Pending'),
  change('2026-01-22T21:26:06+00:00', 'MlsStatus: Pending → Closed'),
]
// 61131 Brown Trout: two withdrawals before the period that sold.
const BROWN_TROUT = [
  change('2025-05-12T18:51:48+00:00', 'MlsStatus: Active → Withdrawn'),
  change('2025-05-16T17:17:51+00:00', 'MlsStatus: Withdrawn → Active'),
  change('2025-08-14T19:54:09+00:00', 'MlsStatus: Active → Withdrawn'),
  change('2025-08-18T14:42:44+00:00', 'MlsStatus: Withdrawn → Active'),
  change('2025-09-02T22:40:53+00:00', 'MlsStatus: Active → Pending'),
  change('2025-09-30T01:44:50+00:00', 'MlsStatus: Pending → Closed'),
]

describe('pacificDay', () => {
  it('reads an MLS timestamp as the day it was in Bend', () => {
    // 3177 Coho's list, 7:13 PM Dec 1 Pacific, printed "Dec 2".
    expect(pacificDay('2025-12-02T03:13:18+00:00')).toBe('2025-12-01')
    expect(pacificDay('2025-12-02 03:13:18+00')).toBe('2025-12-01')
    // Its cut, 6:42 PM Jan 1 Pacific, printed "Jan 2".
    expect(pacificDay('2026-01-02T02:42:56+00:00')).toBe('2026-01-01')
    // 2745 Aldrich's cut, 6:07 PM Jun 23 Pacific.
    expect(pacificDay('2026-06-24T01:07:33+00:00')).toBe('2026-06-23')
    // 20676 Wild Rose went Active 9:06 PM Sep 2 Pacific.
    expect(pacificDay('2026-09-03T04:06:03+00:00')).toBe('2026-09-02')
  })

  it('keeps a calendar date as written, including one stored at midnight UTC', () => {
    expect(pacificDay('2026-09-30')).toBe('2026-09-30')
    expect(pacificDay('2026-10-05T00:00:00+00:00')).toBe('2026-10-05')
    expect(pacificDay('2026-10-05 00:00:00+00')).toBe('2026-10-05')
    expect(pacificDay(null)).toBeNull()
    expect(pacificDay('not a date')).toBeNull()
  })

  it('counts whole calendar days between Pacific days', () => {
    expect(pacificDaysBetween('2025-12-02T03:13:18+00:00', '2026-02-10T21:49:04+00:00')).toBe(71)
    // Wild Rose: Sep 2 to Sep 28 is 26 days; the MLS DaysOnMarket said 25.
    expect(pacificDaysBetween('2026-09-03T04:06:03+00:00', '2026-09-29T03:10:01+00:00')).toBe(26)
    expect(pacificDaysBetween('2026-09-28', '2026-09-02')).toBeNull()
  })
})

describe('the status log', () => {
  it('parses the change-log line and classifies each status', () => {
    expect(parseMlsStatusChange('MlsStatus: Active → Withdrawn')).toEqual({ from: 'Active', to: 'Withdrawn' })
    expect(parseMlsStatusChange('MlsStatus:  → Active')).toEqual({ from: null, to: 'Active' })
    expect(parseMlsStatusChange('ListPrice: 585000.00 → 569000.00')).toBeNull()
    expect(statusKind('Coming Soon')).toBe('pre')
    expect(statusKind('Active')).toBe('active')
    expect(statusKind('Active Under Contract')).toBe('offer')
    expect(statusKind('Pending')).toBe('offer')
    expect(statusKind('Withdrawn')).toBe('off')
    expect(statusKind('Closed')).toBe('sold')
  })

  it('merges the sync log into the MLS log without doubling a change', () => {
    const merged = mergeStatusChanges(CARRIE, [
      { at: '2026-08-17T19:03:14.807+00:00', from: 'Coming Soon', to: 'Active' },
      { at: '2026-09-05T23:48:13.553+00:00', from: 'Active', to: 'Pending' },
      { at: '2026-10-07T00:00:00+00:00', from: 'Closed', to: 'Closed' },
    ])
    expect(merged.map((c) => c.at)).toEqual([
      '2026-08-17T18:50:35+00:00',
      '2026-09-05T23:32:51+00:00',
      '2026-10-05T23:08:00+00:00',
      '2026-10-07T00:00:00+00:00',
    ])
  })

  it('opens a log that starts mid-listing at the listing\'s own on-market day', () => {
    expect(activePeriods(COHO, { listedAt: '2025-12-02T03:13:18+00:00' })).toEqual([
      { from: '2025-12-01', to: '2026-02-10', endedAs: 'Withdrawn' },
    ])
    // Without a start the record cannot give, the stretch is left out.
    expect(activePeriods(COHO)).toEqual([])
  })
})

describe('lastActiveRun: a listing that came off unsold', () => {
  it('3177 Coho: withdrawn Feb 10 after 71 days, not 302 to its expiry', () => {
    expect(
      lastActiveRun({
        changes: COHO,
        onMarketDate: '2025-12-02T03:13:18+00:00',
        offMarketDate: '2026-09-30',
        status: 'Expired',
      }),
    ).toEqual({ from: '2025-12-01', to: '2026-02-10', leftAs: 'Withdrawn', days: 71, source: 'status-history' })
  })

  it('2745 Aldrich: Active Mar 13 to withdrawn Jun 29 is 108 days, not 201', () => {
    const run = lastActiveRun({ changes: ALDRICH, onMarketDate: '2026-03-13T19:39:50+00:00', offMarketDate: '2026-09-30' })
    expect(run?.days).toBe(108)
    expect(run?.to).toBe('2026-06-29')
  })

  it('falls back to the listing row\'s own days when there is no log', () => {
    expect(
      lastActiveRun({ changes: [], onMarketDate: '2026-09-03T04:06:03+00:00', offMarketDate: '2026-09-28', status: 'Withdrawn' }),
    ).toEqual({ from: '2026-09-02', to: '2026-09-28', leftAs: 'Withdrawn', days: 26, source: 'listing-dates' })
  })
})

describe('offerRun: days to an accepted offer, on the period that produced it', () => {
  it('2124 Carrie: Active Aug 17 to Pending Sep 5 is 19 days, never the Coming Soon weeks', () => {
    expect(
      offerRun({
        changes: CARRIE,
        onMarketDate: '2026-08-17T18:50:35+00:00',
        pendingAt: '2026-09-05T23:32:51+00:00',
        mlsDaysToPending: 19,
        closeDate: '2026-10-05',
      }),
    ).toEqual({ from: '2026-08-17', to: '2026-09-05', days: 19, source: 'status-history' })
  })

  it('61197 Cottonwood: the period after it came back, 47 days, not 264 from April', () => {
    const run = offerRun({
      changes: COTTONWOOD,
      onMarketDate: '2025-11-14T00:42:52+00:00',
      firstOnMarketAt: '2025-04-11T16:34:50+00:00',
      closeDate: '2026-01-22',
    })
    expect(run).toEqual({ from: '2025-11-13', to: '2025-12-30', days: 47, source: 'status-history' })
  })

  it('61131 Brown Trout: back Aug 18, Pending Sep 2, 15 days, not 273', () => {
    const run = offerRun({ changes: BROWN_TROUT, firstOnMarketAt: '2024-12-03T00:09:00+00:00', closeDate: '2025-09-29' })
    expect(run?.days).toBe(15)
    expect(run?.from).toBe('2025-08-18')
  })

  it('20825 Chloe and 20606 Songbird count from Active, in Pacific days', () => {
    const chloe = [
      change('2026-07-01T07:15:02+00:00', 'MlsStatus: Coming Soon → Active'),
      change('2026-07-05T17:43:41+00:00', 'MlsStatus: Active → Pending'),
    ]
    expect(offerRun({ changes: chloe })?.days).toBe(4)
    const songbird = [
      change('2026-02-05T18:00:44+00:00', 'MlsStatus: Coming Soon → Active'),
      change('2026-03-20T14:35:31+00:00', 'MlsStatus: Active → Pending'),
    ]
    // Feb 5 to Mar 20 is 43 calendar days; days_to_pending's 42 counts hours.
    expect(offerRun({ changes: songbird, mlsDaysToPending: 42 })?.days).toBe(43)
  })

  it('without a log, counts on-market to pending; without either date, the MLS figure', () => {
    // 2820 Aldrich: listed Aug 24, Pending Sep 11.
    expect(
      offerRun({ onMarketDate: '2026-08-24T21:35:27+00:00', pendingAt: '2026-09-11T16:14:31+00:00', mlsDaysToPending: 17 }),
    ).toEqual({ from: '2026-08-24', to: '2026-09-11', days: 18, source: 'listing-dates' })
    expect(offerRun({ onMarketDate: '2026-08-24T21:35:27+00:00', mlsDaysToPending: 17 })).toEqual({
      from: '2026-08-24',
      to: null,
      days: 17,
      source: 'mls-days-to-pending',
    })
    expect(offerRun({})).toBeNull()
  })

  it('1654 Meadow: a zero MLS count whose on-market day is after the close is not an offer clock', () => {
    expect(
      offerRun({
        onMarketDate: '2025-06-06T21:16:52+00:00',
        pendingAt: '2025-06-06T21:18:25+00:00',
        mlsDaysToPending: 0,
        closeDate: '2025-05-30',
      }),
    ).toBeNull()
    expect(
      offerRun({
        onMarketDate: '2025-05-30T21:16:52+00:00',
        mlsDaysToPending: 0,
        closeDate: '2025-05-30',
      }),
    ).toEqual({ from: '2025-05-30', to: null, days: 0, source: 'mls-days-to-pending' })
  })
})

describe('a same-ask pending reversal inside an hour is not a new stretch', () => {
  // 2254 Indigo's October pair, from the cma-2382-jackson reader review.
  const listed = '2025-07-17T16:00:00+00:00'
  const pending = '2025-10-09T00:59:52+00:00'
  const back = '2025-10-09T01:22:32+00:00'
  const soldPending = '2025-12-10T19:44:51+00:00'
  const asks: AskChange[] = [{ at: '2025-09-04T17:00:00+00:00', from: 709999, to: 699900 }]
  const blip = [
    change(pending, 'MlsStatus: Active → Pending'),
    change(back, 'MlsStatus: Pending → Active'),
    change(soldPending, 'MlsStatus: Active → Pending'),
  ]

  it('keeps the original on-market clock and the ask that stretch opened at', () => {
    const run = offerRunTimed({
      changes: blip,
      firstOnMarketAt: listed,
      askChanges: asks,
      closeDate: '2026-01-23',
    })
    expect(run).toMatchObject({ from: '2025-07-17', to: '2025-12-10', days: 146, source: 'status-history' })
    expect(run?.fromAt).toBe(listed)
    expect(
      listingStretch({
        startAt: run?.fromAt,
        changes: blip,
        firstOnMarketAt: listed,
        askChanges: asks,
        openingAsk: 709999,
        currentAsk: 689500,
      }),
    ).toEqual({ from: '2025-07-17', firstAsk: 709999, restarted: false })
    expect(
      lastActiveRun({
        changes: [
          change(pending, 'MlsStatus: Active → Pending'),
          change(back, 'MlsStatus: Pending → Active'),
          change(soldPending, 'MlsStatus: Active → Withdrawn'),
        ],
        firstOnMarketAt: listed,
        askChanges: asks,
        status: 'Withdrawn',
      }),
    ).toMatchObject({ from: '2025-07-17', to: '2025-12-10', days: 146, leftAs: 'Withdrawn' })
  })

  it('glues a reversal at exactly the window and starts over one millisecond past it', () => {
    const atWindow = new Date(Date.parse(pending) + PENDING_REVERSAL_BLIP_MS).toISOString()
    const pastWindow = new Date(Date.parse(pending) + PENDING_REVERSAL_BLIP_MS + 1).toISOString()
    const run = (returnAt: string) =>
      offerRun({
        changes: [
          change(pending, 'MlsStatus: Active → Pending'),
          change(returnAt, 'MlsStatus: Pending → Active'),
          change(soldPending, 'MlsStatus: Active → Pending'),
        ],
        firstOnMarketAt: listed,
        askChanges: [],
        closeDate: '2026-01-23',
      })
    expect(run(atWindow)?.from).toBe('2025-07-17')
    expect(run(pastWindow)?.from).toBe('2025-10-08')
    expect(run(pastWindow)?.days).toBe(63)
  })

  it('a reversal inside the window at a new ask is a new stretch', () => {
    const changed: AskChange[] = [{ at: '2025-10-09T01:10:00+00:00', from: 699900, to: 689500 }]
    const run = offerRunTimed({
      changes: blip,
      firstOnMarketAt: listed,
      askChanges: changed,
      closeDate: '2026-01-23',
    })
    expect(run).toMatchObject({ from: '2025-10-08', to: '2025-12-10', days: 63 })
    expect(
      listingStretch({
        startAt: run?.fromAt,
        changes: blip,
        firstOnMarketAt: listed,
        askChanges: changed,
        openingAsk: 709999,
        currentAsk: 689500,
      }),
    ).toEqual({ from: '2025-10-08', firstAsk: 689500, restarted: true })
  })

  it('does not glue when the ask log was not read, or when the gap is a withdrawal', () => {
    expect(offerRun({ changes: blip, firstOnMarketAt: listed, closeDate: '2026-01-23' })?.from).toBe('2025-10-08')
    const withdrawn = [
      change(pending, 'MlsStatus: Active → Withdrawn'),
      change(back, 'MlsStatus: Withdrawn → Active'),
      change(soldPending, 'MlsStatus: Active → Pending'),
    ]
    expect(
      offerRun({ changes: withdrawn, firstOnMarketAt: listed, askChanges: [], closeDate: '2026-01-23' })?.from,
    ).toBe('2025-10-08')
  })

  it('a one-day same-ask fallout still starts the clock over', () => {
    const run = offerRun({
      changes: [
        change('2025-08-27T18:00:00+00:00', 'MlsStatus: Active → Pending'),
        change('2025-08-28T18:00:00+00:00', 'MlsStatus: Pending → Active'),
        ...blip,
      ],
      firstOnMarketAt: listed,
      askChanges: asks,
      closeDate: '2026-01-23',
    })
    expect(run).toMatchObject({ from: '2025-08-28', to: '2025-12-10', days: 104 })
  })
})

describe('how a listing came off, in one word', () => {
  it('uses the status word when the listing left Active for its status of record', () => {
    expect(cameOffStatus('Withdrawn', 'Withdrawn')).toBe('Withdrawn')
    expect(cameOffStatus('Expired', null)).toBe('Expired')
  })

  it('says "came off" when it was withdrawn and expired later, and tells both dates', () => {
    expect(cameOffStatus('Expired', 'Withdrawn')).toBe(CAME_OFF_MIXED)
    expect(
      cameOffThenSentence({
        offMarketDate: '2026-02-10',
        days: 71,
        leftAs: 'Withdrawn',
        status: 'Expired',
        statusDate: '2026-09-30',
      }),
    ).toBe('It came off the market on Feb 10 after 71 days, and the listing expired on Sep 30.')
    expect(
      cameOffThenSentence(
        { offMarketDate: '2026-06-29', days: 108, leftAs: 'Withdrawn', status: 'Expired', statusDate: '2026-09-30' },
        { withDays: false },
      ),
    ).toBe('It came off the market on Jun 29, and the listing expired on Sep 30.')
  })

  it('says nothing extra when there is no later status', () => {
    expect(
      cameOffThenSentence({ offMarketDate: '2026-09-28', days: 26, leftAs: 'Withdrawn', status: 'Withdrawn', statusDate: null }),
    ).toBeNull()
  })
})
