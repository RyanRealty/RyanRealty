import { describe, it, expect } from 'vitest'
import { computeDeltaPlan, type ExistingListingLite, type SparkDeltaResult } from './deltaSync'

const NOW = '2026-07-19T12:00:00.000Z'

/** Minimal-but-realistic Spark StandardFields; override per test. */
function mkResult(overrides: Record<string, unknown> = {}, id?: string): SparkDeltaResult {
  return {
    Id: id ?? String(overrides.ListingKey ?? overrides.ListNumber ?? 'k'),
    StandardFields: {
      ListNumber: '220000001',
      ListingKey: 'KEY1',
      StandardStatus: 'Active',
      ListPrice: 500000,
      ModificationTimestamp: '2026-07-19T11:00:00.000Z',
      City: 'Bend',
      SubdivisionName: 'Tetherow',
      ...overrides,
    },
  }
}

function existing(overrides: Partial<ExistingListingLite> = {}): ExistingListingLite {
  return {
    ListNumber: '220000001',
    ListingKey: 'KEY1',
    StandardStatus: 'Active',
    ListPrice: 500000,
    is_finalized: false,
    City: 'Bend',
    CloseDate: null,
    ClosePrice: null,
    property_sub_type: null,
    TotalLivingAreaSqFt: null,
    media_finalized: false,
    ...overrides,
  }
}

function mapOf(...rows: ExistingListingLite[]): Map<string, ExistingListingLite> {
  return new Map(rows.map((r) => [r.ListNumber, r]))
}

function eventTypes(plan: ReturnType<typeof computeDeltaPlan>): string[] {
  return plan.activityEvents.map((e) => e.event_type)
}

describe('computeDeltaPlan', () => {
  it('new active listing: new_listing event, row upserted, no finalize', () => {
    const plan = computeDeltaPlan([mkResult()], mapOf(), { nowIso: NOW })
    expect(eventTypes(plan)).toEqual(['new_listing'])
    expect(plan.rowsToUpsert).toHaveLength(1)
    expect(plan.rowsToUpsert[0].ListNumber).toBe('220000001')
    expect(plan.finalizeTargets).toHaveLength(0)
    expect(plan.counters.newListings).toBe(1)
    expect(plan.statusHistoryRows).toHaveLength(0)
  })

  it('new listing born terminal: new_listing + queued finalize', () => {
    const plan = computeDeltaPlan([mkResult({ StandardStatus: 'Closed' })], mapOf(), { nowIso: NOW })
    expect(eventTypes(plan)).toEqual(['new_listing'])
    expect(plan.finalizeTargets).toHaveLength(1)
    expect(plan.finalizeTargets[0].listingKey).toBe('KEY1')
  })

  it('Active -> Pending: status_pending event + status_history row, no finalize', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Pending' })],
      mapOf(existing({ StandardStatus: 'Active' })),
      { nowIso: NOW },
    )
    expect(eventTypes(plan)).toEqual(['status_pending'])
    expect(plan.statusHistoryRows).toEqual([
      { listing_key: 'KEY1', old_status: 'Active', new_status: 'Pending', changed_at: NOW },
    ])
    expect(plan.finalizeTargets).toHaveLength(0)
    expect(plan.counters.statusChanges).toBe(1)
  })

  it('Active -> Closed: status_closed event, media_finalized on row, status_history, finalize queued', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Closed' })],
      mapOf(existing({ StandardStatus: 'Active' })),
      { nowIso: NOW },
    )
    expect(eventTypes(plan)).toEqual(['status_closed'])
    expect(plan.rowsToUpsert[0].media_finalized).toBe(true)
    expect(plan.statusHistoryRows[0].new_status).toBe('Closed')
    expect(plan.finalizeTargets).toHaveLength(1)
  })

  it('Pending -> Active: status_active event (action-lane behavior preserved)', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Active' })],
      mapOf(existing({ StandardStatus: 'Pending' })),
      { nowIso: NOW },
    )
    expect(eventTypes(plan)).toEqual(['status_active'])
    // sparkToListingRow defaults media_finalized:false on every row; only the
    // status_closed branch overrides it to true, so it stays false here.
    expect(plan.rowsToUpsert[0].media_finalized).toBe(false)
    expect(plan.finalizeTargets).toHaveLength(0)
  })

  it('Active -> Expired: generic status_expired event + finalize queued (not status_closed)', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Expired' })],
      mapOf(existing({ StandardStatus: 'Active' })),
      { nowIso: NOW },
    )
    expect(eventTypes(plan)).toEqual(['status_expired'])
    expect(plan.finalizeTargets).toHaveLength(1)
    // Expired is terminal but NOT closed, so media_finalized is not overridden.
    expect(plan.rowsToUpsert[0].media_finalized).toBe(false)
  })

  it('price drop: price_drop event + price_history row with change_pct', () => {
    const plan = computeDeltaPlan(
      [mkResult({ ListPrice: 450000 })],
      mapOf(existing({ ListPrice: 500000 })),
      { nowIso: NOW },
    )
    expect(eventTypes(plan)).toEqual(['price_drop'])
    expect(plan.priceHistoryRows).toEqual([
      { listing_key: 'KEY1', old_price: 500000, new_price: 450000, change_pct: -10, changed_at: NOW },
    ])
    expect(plan.counters.priceChanges).toBe(1)
  })

  it('price increase: price_increase event (cron-lane behavior)', () => {
    const plan = computeDeltaPlan(
      [mkResult({ ListPrice: 550000 })],
      mapOf(existing({ ListPrice: 500000 })),
      { nowIso: NOW },
    )
    expect(eventTypes(plan)).toEqual(['price_increase'])
    expect(plan.priceHistoryRows[0].change_pct).toBe(10)
  })

  it('finalized existing row with no material change: skipped entirely — no upsert, no events', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Closed', CloseDate: '2026-04-03', ClosePrice: 825000, SubdivisionName: 'Renamed' })],
      mapOf(
        existing({
          is_finalized: true,
          StandardStatus: 'Closed',
          CloseDate: '2026-04-03T00:00:00+00:00',
          ClosePrice: 825000,
        }),
      ),
      { nowIso: NOW },
    )
    expect(plan.rowsToUpsert).toHaveLength(0)
    expect(plan.reopenedRows).toHaveLength(0)
    expect(plan.activityEvents).toHaveLength(0)
    expect(plan.priceHistoryRows).toHaveLength(0)
    expect(plan.counters.skippedFinalized).toBe(1)
    expect(plan.counters.reopenedFinalized).toBe(0)
  })

  it('finalized Withdrawn row that Spark now reports Closed: reopens, status_closed, re-finalizes', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Closed', CloseDate: '2026-08-11', ClosePrice: 3824000 })],
      mapOf(existing({ is_finalized: true, StandardStatus: 'Withdrawn', media_finalized: false })),
      { nowIso: NOW },
    )
    expect(plan.counters.skippedFinalized).toBe(0)
    expect(plan.counters.reopenedFinalized).toBe(1)
    expect(plan.rowsToUpsert).toHaveLength(0)
    expect(plan.reopenedRows).toHaveLength(1)
    expect(plan.reopenedRows[0].is_finalized).toBe(false)
    expect(plan.reopenedRows[0].history_finalized).toBe(false)
    expect(plan.reopened[0].reasons).toEqual(['status', 'close_date', 'close_price'])
    expect(plan.reopened[0].preserveMedia).toBe(false)
    expect(eventTypes(plan)).toEqual(['status_closed'])
    expect(plan.statusHistoryRows).toHaveLength(1)
    expect(plan.finalizeTargets.map((t) => t.listingKey)).toEqual(['KEY1'])
  })

  it('finalized Closed row whose close date was corrected: reopens on close_date, no status event', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Closed', CloseDate: '2026-08-14', ClosePrice: 925000 })],
      mapOf(
        existing({
          is_finalized: true,
          StandardStatus: 'Closed',
          CloseDate: '2026-07-28T00:00:00+00:00',
          ClosePrice: 925000,
          media_finalized: true,
        }),
      ),
      { nowIso: NOW },
    )
    expect(plan.reopened).toEqual([
      { listNumber: '220000001', listingKey: 'KEY1', reasons: ['close_date'], preserveMedia: true },
    ])
    expect(plan.activityEvents).toHaveLength(0)
    expect(plan.finalizeTargets).toHaveLength(1)
  })

  it('finalized row we hold without a sub-type or living area: reopens when Spark has them', () => {
    const plan = computeDeltaPlan(
      [
        mkResult({
          StandardStatus: 'Closed',
          CloseDate: '2026-04-03',
          ClosePrice: 825000,
          PropertySubType: 'Single Family Residence',
          BuildingAreaTotal: 2838,
        }),
      ],
      mapOf(
        existing({ is_finalized: true, StandardStatus: 'Closed', CloseDate: '2026-04-03', ClosePrice: 825000 }),
      ),
      { nowIso: NOW },
    )
    expect(plan.reopened[0]?.reasons).toEqual(['sub_type', 'sqft'])
  })

  it('a fact Spark leaves blank or masks never reopens a finalized row', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Closed', City: '********', CloseDate: null, ClosePrice: null })],
      mapOf(
        existing({ is_finalized: true, StandardStatus: 'Closed', CloseDate: '2026-04-03', ClosePrice: 825000 }),
      ),
      { nowIso: NOW },
    )
    expect(plan.counters.skippedFinalized).toBe(1)
    expect(plan.reopenedRows).toHaveLength(0)
  })

  it('a reopened row that sold months ago reopens quietly: no sold event, no status history', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Closed', CloseDate: '2026-03-02', ClosePrice: 610000 })],
      mapOf(existing({ is_finalized: true, StandardStatus: 'Pending' })),
      { nowIso: NOW },
    )
    expect(plan.reopenedRows).toHaveLength(1)
    expect(plan.activityEvents).toHaveLength(0)
    expect(plan.statusHistoryRows).toHaveLength(0)
    expect(plan.finalizeTargets).toHaveLength(1)
  })

  it('a reopened row never announces a price change', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Closed', CloseDate: '2026-07-10', ClosePrice: 480000, ListPrice: 495000 })],
      mapOf(existing({ is_finalized: true, StandardStatus: 'Pending', ListPrice: 500000 })),
      { nowIso: NOW },
    )
    expect(eventTypes(plan)).toEqual(['status_closed'])
    expect(plan.priceHistoryRows).toHaveLength(0)
  })

  it('a withdrawn listing back on the market is still news when it reopens', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Active', ListPrice: 749999 })],
      mapOf(existing({ is_finalized: true, StandardStatus: 'Withdrawn', ListPrice: 799000 })),
      { nowIso: NOW },
    )
    expect(eventTypes(plan)).toEqual(['status_active'])
    expect(plan.statusHistoryRows).toHaveLength(1)
    expect(plan.finalizeTargets).toHaveLength(0)
  })

  it('a listing sent twice in one window is written once, as last sent', () => {
    const plan = computeDeltaPlan(
      [mkResult({ ListPrice: 510000 }), mkResult({ ListPrice: 505000 })],
      mapOf(existing()),
      { nowIso: NOW },
    )
    expect(plan.rowsToUpsert).toHaveLength(1)
    expect(plan.rowsToUpsert[0].ListPrice).toBe(505000)
  })

  it('reopened rows never share a batch with ordinary rows', () => {
    const plan = computeDeltaPlan(
      [
        mkResult({ ListNumber: '220000001', ListingKey: 'KEY1', StandardStatus: 'Closed', CloseDate: '2026-08-11', ClosePrice: 1 }),
        mkResult({ ListNumber: '220000002', ListingKey: 'KEY2', StandardStatus: 'Active' }),
      ],
      mapOf(
        existing({ is_finalized: true, StandardStatus: 'Withdrawn' }),
        existing({ ListNumber: '220000002', ListingKey: 'KEY2' }),
      ),
      { nowIso: NOW },
    )
    expect(plan.reopenedRows.map((r) => r.ListNumber)).toEqual(['220000001'])
    expect(plan.rowsToUpsert.map((r) => r.ListNumber)).toEqual(['220000002'])
    expect('is_finalized' in plan.rowsToUpsert[0]).toBe(false)
  })

  it('simultaneous status change AND price change: both events emitted', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Pending', ListPrice: 480000 })],
      mapOf(existing({ StandardStatus: 'Active', ListPrice: 500000 })),
      { nowIso: NOW },
    )
    expect(eventTypes(plan).sort()).toEqual(['price_drop', 'status_pending'])
    expect(plan.statusHistoryRows).toHaveLength(1)
    expect(plan.priceHistoryRows).toHaveLength(1)
  })

  it('maxProcessedTs = newest ModificationTimestamp across the window', () => {
    const plan = computeDeltaPlan(
      [
        mkResult({ ListNumber: '1', ListingKey: 'A', ModificationTimestamp: '2026-07-19T10:00:00.000Z' }),
        mkResult({ ListNumber: '2', ListingKey: 'B', ModificationTimestamp: '2026-07-19T11:30:00.000Z' }),
        mkResult({ ListNumber: '3', ListingKey: 'C', ModificationTimestamp: '2026-07-19T09:00:00.000Z' }),
      ],
      mapOf(),
      { nowIso: NOW },
    )
    expect(plan.maxProcessedTs).toBe('2026-07-19T11:30:00.000Z')
    expect(plan.counters.fetched).toBe(3)
  })

  it('confidential fields diverted into a private row', () => {
    const plan = computeDeltaPlan(
      [mkResult({ PrivateRemarks: 'Seller is motivated', ShowingContactPhone: '5415551234' })],
      mapOf(),
      { nowIso: NOW },
    )
    expect(plan.privateRows).toHaveLength(1)
    expect(plan.privateRows[0].listing_key).toBe('KEY1')
    expect(plan.privateRows[0].private_data.PrivateRemarks).toBe('Seller is motivated')
  })

  it('result with no ListNumber is skipped (no upsert conflict key)', () => {
    const plan = computeDeltaPlan([mkResult({ ListNumber: '' })], mapOf(), { nowIso: NOW })
    expect(plan.rowsToUpsert).toHaveLength(0)
    expect(plan.counters.fetched).toBe(1)
  })

  it('no price/status change on an unchanged existing row: row upserted, no events', () => {
    const plan = computeDeltaPlan([mkResult()], mapOf(existing()), { nowIso: NOW })
    expect(plan.activityEvents).toHaveLength(0)
    expect(plan.rowsToUpsert).toHaveLength(1)
    expect(plan.finalizeTargets).toHaveLength(0)
  })

  it('finalize dedupes: a listing seen twice queues finalize once', () => {
    const plan = computeDeltaPlan(
      [mkResult({ StandardStatus: 'Closed' }), mkResult({ StandardStatus: 'Closed' })],
      mapOf(),
      { nowIso: NOW },
    )
    expect(plan.finalizeTargets).toHaveLength(1)
  })
})
