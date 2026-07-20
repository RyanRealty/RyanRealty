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

  it('finalized existing row: skipped entirely — no upsert, no events', () => {
    const plan = computeDeltaPlan(
      [mkResult({ ListPrice: 450000, StandardStatus: 'Pending' })],
      mapOf(existing({ is_finalized: true })),
      { nowIso: NOW },
    )
    expect(plan.rowsToUpsert).toHaveLength(0)
    expect(plan.activityEvents).toHaveLength(0)
    expect(plan.priceHistoryRows).toHaveLength(0)
    expect(plan.counters.skippedFinalized).toBe(1)
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
