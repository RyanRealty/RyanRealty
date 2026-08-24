import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFINITION_ID,
  STATS,
  STAT_BY_ID,
  marketVerdict,
  pickWindow,
} from '@/lib/data/market-truth/registry'

const { fromImpl } = vi.hoisted(() => ({ fromImpl: vi.fn() }))
vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => ({ from: fromImpl }),
}))

import {
  UnknownStatError,
  getMetric,
  getMetrics,
  staleReason,
} from '@/lib/data/market-truth/getMetric'

describe('Market Truth registry', () => {
  it('registers every REGISTRY.md §3 stat_id once', () => {
    const ids = STATS.map((s) => s.statId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain('median_days_to_contract')
    expect(ids).toContain('months_of_supply')
    expect(ids).toContain('market_verdict')
    expect(ids).toContain('active_count')
    expect(STAT_BY_ID.get('median_days_to_contract')?.earliestYear).toBe(2006)
    expect(STAT_BY_ID.get('median_close')?.minN).toBe(10)
    expect(DEFINITION_ID).toBe('mt-v1')
  })

  it('uses house 4/6 verdict bins', () => {
    expect(marketVerdict(3.54)).toBe('seller')
    expect(marketVerdict(4)).toBe('seller')
    expect(marketVerdict(4.42)).toBe('balanced')
    expect(marketVerdict(6)).toBe('buyer')
    expect(marketVerdict(8)).toBe('buyer')
  })

  it('ladders 12 → 24 → 36 then refuses', () => {
    expect(pickWindow(10, 0, 0, 10)).toBe(12)
    expect(pickWindow(4, 12, 40, 10)).toBe(24)
    expect(pickWindow(4, 8, 12, 10)).toBe(36)
    expect(pickWindow(3, 4, 9, 10)).toBeNull()
  })

  it('refuses a closed window whose complete_through lags period_end', () => {
    expect(
      staleReason({ completeThrough: '2026-04-30', periodEnd: '2026-08-22', windowMonths: 12 }),
    ).toBe('stale_complete_through')
    expect(
      staleReason({ completeThrough: '2026-08-21', periodEnd: '2026-08-22', windowMonths: 12 }),
    ).toBeNull()
    expect(
      staleReason({ completeThrough: '2026-04-30', periodEnd: '2026-08-22', windowMonths: 0 }),
    ).toBeNull()
  })
})

function metricRow(partial: Record<string, unknown>): Record<string, unknown> {
  return {
    geo_type: 'city',
    geo_slug: 'bend',
    segment: 'detached',
    period_end: '2026-08-23',
    window_months: 0,
    definition_id: DEFINITION_ID,
    value_text: null,
    sample_n: 774,
    method: 'count',
    excluded_n: 0,
    complete_through: '2026-08-22',
    is_publishable: true,
    withheld_reason: null,
    is_floor: false,
    computed_at: '2026-08-23T01:00:00Z',
    ...partial,
  }
}

function mockMetricRows(rows: Record<string, unknown>[]) {
  const builder: Record<string, unknown> = {}
  const self = () => builder
  builder.select = vi.fn(self)
  builder.eq = vi.fn(self)
  builder.in = vi.fn(self)
  builder.order = vi.fn(self)
  builder.limit = vi.fn(self)
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: rows, error: null })
  fromImpl.mockReturnValue(builder)
}

describe('getMetric / getMetrics', () => {
  beforeEach(() => {
    fromImpl.mockReset()
  })

  it('rejects unknown stat ids before a store read', async () => {
    await expect(
      getMetric({ stat: 'median_dom', geoType: 'city', geoSlug: 'bend', segment: 'detached' }),
    ).rejects.toThrow(UnknownStatError)
    await expect(
      getMetrics([
        { stat: 'active_count', geoType: 'city', geoSlug: 'bend', segment: 'detached' },
        { stat: 'median_dom', geoType: 'city', geoSlug: 'bend', segment: 'detached' },
      ]),
    ).rejects.toThrow(/not in the registry/)
    expect(fromImpl).not.toHaveBeenCalled()
  })

  it('getMetric equals getMetrics for the same Bend detached active_count input', async () => {
    mockMetricRows([
      metricRow({
        stat_id: 'active_count',
        value: 700,
        period_end: '2026-08-22',
        computed_at: '2026-08-22T01:00:00Z',
      }),
      metricRow({
        stat_id: 'active_count',
        value: 774,
        period_end: '2026-08-23',
      }),
      metricRow({
        stat_id: 'months_of_supply',
        value: 99,
        window_months: 12,
        sample_n: 40,
        method: 'derived',
      }),
      metricRow({
        stat_id: 'months_of_supply',
        value: 12.8,
        window_months: 6,
        sample_n: 40,
        method: 'derived',
      }),
    ])
    const input = {
      stat: 'active_count',
      geoType: 'city',
      geoSlug: 'bend',
      segment: 'detached',
    }
    const single = await getMetric(input)
    const batched = await getMetrics([input])
    expect(single).toEqual(batched[0])
    expect(single?.value).toBe(774)
    expect(single?.isPublishable).toBe(true)
    expect(single?.statId).toBe('active_count')
    expect(fromImpl).toHaveBeenCalledWith('market_metric')
  })

  it('omits a miss instead of fabricating 0', async () => {
    mockMetricRows([
      metricRow({ stat_id: 'active_count', geo_slug: 'bend', value: 774 }),
    ])
    const missed = await getMetric({
      stat: 'active_count',
      geoType: 'city',
      geoSlug: 'madras',
      segment: 'detached',
    })
    expect(missed).toBeNull()
  })

  it('returns a mix cell whose payload is value_text with a null value', async () => {
    mockMetricRows([
      metricRow({
        stat_id: 'financing_mix',
        value: null,
        value_text: '{"conventional":0.61,"cash":0.22}',
        window_months: 12,
        sample_n: 1800,
        method: 'multi_label_share_of_known_financing',
      }),
    ])
    const row = await getMetric({
      stat: 'financing_mix',
      geoType: 'city',
      geoSlug: 'bend',
      segment: 'detached',
      windowMonths: 12,
    })
    expect(row?.isPublishable).toBe(true)
    expect(row?.value).toBeNull()
    expect(row?.valueText).toContain('conventional')
  })

  it('matches period_end on the calendar date even when the store returns a timestamp', async () => {
    mockMetricRows([
      metricRow({
        stat_id: 'median_close',
        value: 750000,
        window_months: 1,
        period_end: '2026-07-31T00:00:00+00:00',
        sample_n: 80,
      }),
    ])
    const row = await getMetric({
      stat: 'median_close',
      geoType: 'city',
      geoSlug: 'bend',
      segment: 'detached',
      windowMonths: 1,
      periodEnd: '2026-07-31',
    })
    expect(row?.value).toBe(750000)
  })
})
