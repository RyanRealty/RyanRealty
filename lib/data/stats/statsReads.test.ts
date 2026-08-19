import { describe, expect, it } from 'vitest'
import { SPREAD_MAX_LAG_DAYS, alignStatSpread, gradeStatSeries, type StatPoint } from './statsReads'

function pt(observationDate: string, value: number): StatPoint {
  return { observationDate, value, realtimeStart: observationDate }
}

describe('alignStatSpread', () => {
  it('subtracts the newest other-side figure on or before the anchor period', () => {
    // Weekly mortgage (Thursday) against business-daily Treasury.
    const anchor = [pt('2026-08-06', 6.63), pt('2026-08-13', 6.58)]
    const other = [
      pt('2026-08-05', 4.2),
      pt('2026-08-06', 4.25),
      pt('2026-08-12', 4.3),
      pt('2026-08-14', 4.4), // after the second anchor — must NOT be used
    ]
    const out = alignStatSpread(anchor, other)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({
      observationDate: '2026-08-06',
      anchorValue: 6.63,
      otherValue: 4.25,
      otherObservationDate: '2026-08-06',
      spread: 6.63 - 4.25,
    })
    expect(out[1]!.otherObservationDate).toBe('2026-08-12')
    expect(out[1]!.spread).toBeCloseTo(6.58 - 4.3, 12)
  })

  it('drops an anchor point whose other leg is older than the lag budget', () => {
    const anchor = [pt('2026-08-13', 6.58)]
    const other = [pt('2026-08-01', 4.2)] // 12 days back, budget is 7
    expect(alignStatSpread(anchor, other)).toHaveLength(0)
    expect(alignStatSpread(anchor, other, 12)).toHaveLength(1)
  })

  it('drops anchor points before the other series begins', () => {
    const anchor = [pt('2026-01-01', 6.0), pt('2026-08-13', 6.58)]
    const other = [pt('2026-08-12', 4.3)]
    const out = alignStatSpread(anchor, other)
    expect(out).toHaveLength(1)
    expect(out[0]!.observationDate).toBe('2026-08-13')
  })

  it('refuses a pair it cannot date', () => {
    const anchor = [pt('not-a-date', 6.58)]
    const other = [pt('also-not-a-date', 4.3)]
    expect(alignStatSpread(anchor, other)).toHaveLength(0)
  })

  it('keeps the default lag budget at one week — the weekly-vs-daily case', () => {
    expect(SPREAD_MAX_LAG_DAYS).toBe(7)
  })
})

describe('gradeStatSeries', () => {
  const base = {
    seriesId: 'fred:MORTGAGE30US',
    latestObservationDate: '2026-08-13',
    latestPublishedObservationDate: '2026-08-13',
    publisherObservationEnd: '2026-08-13',
    lastCheckedAt: '2026-08-18T09:00:00Z',
    lastIngestedAt: '2026-08-18T09:00:00Z',
    today: '2026-08-19',
  }

  it('reports current when our cron ran and coverage matches the publisher', () => {
    expect(gradeStatSeries(base).status).toBe('current')
  })

  it('reports the ingest, not the publisher, when the check is stale', () => {
    expect(gradeStatSeries({ ...base, lastCheckedAt: '2026-08-10T09:00:00Z' }).status).toBe('ingest_stalled')
  })

  it('reports behind_publisher when the source holds a newer period', () => {
    expect(gradeStatSeries({ ...base, publisherObservationEnd: '2026-08-20' }).status).toBe('behind_publisher')
  })
})
