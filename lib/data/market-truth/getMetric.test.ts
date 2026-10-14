import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  METRIC_PRIMARY_KEY,
  UnknownStatError,
  getMetric,
  getMetrics,
  orderByPrimaryKey,
  segmentStatPairsFilter,
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
  builder.gte = vi.fn(self)
  builder.or = vi.fn(self)
  builder.order = vi.fn(self)
  builder.limit = vi.fn(self)
  builder.range = vi.fn(self)
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

describe('getMetrics reads every page, newest first (2026-10-01)', () => {
  beforeEach(() => {
    fromImpl.mockReset()
  })

  it('pages past the 1,000-row cap so the newest cell is never cut off', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) =>
      metricRow({
        stat_id: 'median_close',
        window_months: 12,
        value: 500000 + i,
        computed_at: `2026-09-${String(10 + (i % 15)).padStart(2, '0')}T06:40:00Z`,
        period_end: `2026-09-${String(10 + (i % 15)).padStart(2, '0')}`,
        complete_through: `2026-09-${String(9 + (i % 15)).padStart(2, '0')}`,
      }),
    )
    const page2 = [
      metricRow({
        stat_id: 'new_listings_30d',
        geo_type: 'neighborhood',
        geo_slug: 'tetherow',
        value: 5,
        period_end: '2026-09-30',
        complete_through: '2026-09-30',
        computed_at: '2026-10-01T18:23:08Z',
      }),
    ]
    const pages = [page1, page2]
    const ranges: Array<[number, number]> = []
    fromImpl.mockImplementation(() => {
      const builder: Record<string, unknown> = {}
      let pageIndex = 0
      const self = () => builder
      builder.select = vi.fn(self)
      builder.eq = vi.fn(self)
      builder.in = vi.fn(self)
      builder.gte = vi.fn(self)
      builder.or = vi.fn(self)
      builder.order = vi.fn(self)
      builder.range = vi.fn((from: number, to: number) => {
        ranges.push([from, to])
        pageIndex = from / 1000
        return builder
      })
      builder.then = (resolve: (v: unknown) => void) => resolve({ data: pages[pageIndex] ?? [], error: null })
      return builder
    })
    const [cell] = await getMetrics([
      { stat: 'new_listings_30d', geoType: 'neighborhood', geoSlug: 'tetherow', segment: 'detached', windowMonths: 0 },
    ])
    expect(ranges).toEqual([
      [0, 999],
      [1000, 1999],
    ])
    expect(cell?.value).toBe(5)
  })
})

describe('orderByPrimaryKey (stable pages over a shared computed_at)', () => {
  it('appends the whole primary key, in key order, after the caller\'s order', () => {
    const calls: Array<[string, { ascending?: boolean } | undefined]> = []
    const query = {
      order(column: string, options?: { ascending?: boolean }) {
        calls.push([column, options])
        return query
      },
    }
    orderByPrimaryKey(query.order('computed_at', { ascending: false }))
    expect(calls.map(([c]) => c)).toEqual(['computed_at', ...METRIC_PRIMARY_KEY])
    expect(METRIC_PRIMARY_KEY).toEqual(['stat_id', 'geo_type', 'geo_slug', 'segment', 'period_end', 'window_months', 'definition_id'])
  })
})


/**
 * A market_metric store that answers the filters getMetrics sends, the way
 * PostgREST would. `fullRead` ignores the two narrowing filters (the
 * publishable flag and the period_end cut), so every read sees every row:
 * that is the read getMetrics made before 2026-10-14, the reference the
 * recent-first read must agree with.
 */
function serveStore(rows: Record<string, unknown>[], opts: { fullRead: boolean }) {
  const requests: string[][] = []
  fromImpl.mockImplementation(() => {
    const tests: Array<(row: Record<string, unknown>) => boolean> = []
    const notes: string[] = []
    let range: [number, number] = [0, 999]
    const builder: Record<string, unknown> = {}
    const self = () => builder
    builder.select = vi.fn(self)
    builder.order = vi.fn(self)
    builder.in = vi.fn((column: string, values: unknown[]) => {
      const wanted = new Set(values.map(String))
      tests.push((row) =>
        wanted.has(column === 'period_end' ? String(row[column]).slice(0, 10) : String(row[column])),
      )
      return builder
    })
    builder.eq = vi.fn((column: string, value: unknown) => {
      notes.push(`${column}=${String(value)}`)
      if (!opts.fullRead) tests.push((row) => row[column] === value)
      return builder
    })
    builder.gte = vi.fn((column: string, value: string) => {
      notes.push(`${column}>=${value}`)
      if (!opts.fullRead) tests.push((row) => String(row[column]).slice(0, 10) >= value)
      return builder
    })
    builder.or = vi.fn((expr: string) => {
      // The one shape getMetrics sends: and(segment.eq."S",stat_id.in.("a","b")),...
      const groups = [...expr.matchAll(/and\(segment\.eq\."([^"]+)",stat_id\.in\.\(([^)]*)\)\)/g)].map((m) => ({
        segment: m[1],
        stats: new Set([...m[2]!.matchAll(/"([^"]+)"/g)].map((q) => q[1])),
      }))
      notes.push(`pairs=${groups.map((g) => `${g.segment}:${[...g.stats].join('+')}`).join(';')}`)
      if (!opts.fullRead) tests.push((row) => groups.some((g) => row.segment === g.segment && g.stats.has(String(row.stat_id))))
      return builder
    })
    builder.range = vi.fn((from: number, to: number) => {
      range = [from, to]
      return builder
    })
    builder.then = (resolve: (v: unknown) => void) => {
      requests.push(notes)
      const pk = (row: Record<string, unknown>) => METRIC_PRIMARY_KEY.map((c) => String(row[c])).join('|')
      const matched = rows
        .filter((row) => tests.every((t) => t(row)))
        .sort((a, b) =>
          String(a.computed_at) === String(b.computed_at)
            ? pk(a).localeCompare(pk(b))
            : String(b.computed_at).localeCompare(String(a.computed_at)),
        )
      resolve({ data: matched.slice(range[0], range[1] + 1), error: null })
    }
    return builder
  })
  return requests
}

/** Deterministic generator (mulberry32), so a failing store can be replayed by seed. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dayOffset(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
}

const STORE_STATS = ['active_count', 'median_list_active', 'months_of_supply', 'median_days_to_contract'] as const
const STORE_SEGMENTS = ['condo', 'land'] as const

function generatedStore(seed: number): Record<string, unknown>[] {
  const next = rng(seed)
  const rows: Record<string, unknown>[] = []
  for (const stat_id of STORE_STATS) {
    for (const segment of STORE_SEGMENTS) {
      for (const window_months of [0, 12, 24, 36]) {
        for (let d = 0; d <= 43; d++) {
          if (next() < 0.45) continue
          const period_end = dayOffset('2026-09-01', d)
          rows.push(
            metricRow({
              stat_id,
              segment,
              window_months,
              period_end,
              // Some windows lag their period end (staleReason refuses those).
              complete_through: dayOffset(period_end, next() < 0.1 ? -9 : -1),
              computed_at: `${dayOffset(period_end, 1)}T06:2${Math.floor(next() * 10)}:00Z`,
              is_publishable: next() < 0.55,
              value: next() < 0.1 ? null : Math.round(next() * 1000),
              sample_n: 40,
            }),
          )
        }
      }
    }
  }
  return rows
}

function storeInputs(): Parameters<typeof getMetrics>[0] {
  const inputs: Parameters<typeof getMetrics>[0] = []
  for (const stat of STORE_STATS) {
    for (const segment of STORE_SEGMENTS) {
      inputs.push({ stat, geoType: 'city', geoSlug: 'bend', segment })
      inputs.push({ stat, geoType: 'city', geoSlug: 'bend', segment, windowMonths: 12 })
    }
  }
  inputs.push({ stat: 'active_count', geoType: 'city', geoSlug: 'bend', segment: 'condo', windowMonths: 0, periodEnd: '2026-09-15' })
  inputs.push({ stat: 'months_of_supply', geoType: 'city', geoSlug: 'madras', segment: 'condo' })
  return inputs
}

describe('getMetrics reads the recent days first, then history only for what they leave open (2026-10-14)', () => {
  beforeEach(() => {
    fromImpl.mockReset()
    vi.useFakeTimers({ toFake: ['Date'] })
    // The cut is three period_end days back: 2026-10-11.
    vi.setSystemTime(new Date('2026-10-14T20:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('answers every input exactly as the full read does, over 60 generated stores', async () => {
    for (let seed = 1; seed <= 60; seed++) {
      const store = generatedStore(seed)
      const inputs = storeInputs()
      serveStore(store, { fullRead: true })
      const reference = await getMetrics(inputs)
      serveStore(store, { fullRead: false })
      const recentFirst = await getMetrics(inputs)
      expect(recentFirst, `seed ${seed}`).toEqual(reference)
    }
  })

  it('makes one read when the recent days answer every input, and never reads past the cut', async () => {
    const store = [
      metricRow({ stat_id: 'active_count', segment: 'condo', period_end: '2026-10-14', complete_through: '2026-10-13', computed_at: '2026-10-14T18:21:58Z', value: 214 }),
      metricRow({ stat_id: 'active_count', segment: 'condo', period_end: '2026-10-13', complete_through: '2026-10-12', computed_at: '2026-10-14T06:22:47Z', value: 210 }),
      metricRow({ stat_id: 'active_count', segment: 'condo', period_end: '2026-08-23', complete_through: '2026-08-22', computed_at: '2026-08-23T06:20:00Z', value: 150 }),
    ]
    const requests = serveStore(store, { fullRead: false })
    const [cell] = await getMetrics([{ stat: 'active_count', geoType: 'city', geoSlug: 'bend', segment: 'condo' }])
    expect(cell?.value).toBe(214)
    expect(requests).toEqual([['is_publishable=true', 'period_end>=2026-10-11']])
  })

  it('reads history for an input whose recent rows are all withheld, and answers with its last publishable row', async () => {
    // A segment whose sample fell under the floor this week: the newest
    // publishable row is the one the full read has always returned.
    const store = [
      metricRow({ stat_id: 'median_list_active', segment: 'land', period_end: '2026-10-14', complete_through: '2026-10-13', computed_at: '2026-10-14T18:21:58Z', is_publishable: false, withheld_reason: 'below_min_n', value: 410000 }),
      metricRow({ stat_id: 'median_list_active', segment: 'land', period_end: '2026-10-02', complete_through: '2026-10-01', computed_at: '2026-10-02T06:21:00Z', value: 389000 }),
      metricRow({ stat_id: 'median_list_active', segment: 'land', period_end: '2026-09-20', complete_through: '2026-09-19', computed_at: '2026-09-20T06:21:00Z', value: 375000 }),
    ]
    const requests = serveStore(store, { fullRead: false })
    const [cell] = await getMetrics([{ stat: 'median_list_active', geoType: 'city', geoSlug: 'bend', segment: 'land' }])
    expect(cell?.value).toBe(389000)
    expect(requests).toEqual([
      ['is_publishable=true', 'period_end>=2026-10-11'],
      ['is_publishable=true', 'pairs=land:median_list_active'],
    ])
  })
})

describe('segmentStatPairsFilter', () => {
  it('asks each segment for its own stats only, quoted', () => {
    expect(
      segmentStatPairsFilter([
        { stat: 'active_count', geoType: 'zip', geoSlug: '97702', segment: 'condo' },
        { stat: 'months_of_supply', geoType: 'zip', geoSlug: '97702', segment: 'condo' },
        { stat: 'active_count', geoType: 'zip', geoSlug: '97702', segment: 'multifamily_2_4' },
      ]),
    ).toBe(
      'and(segment.eq."condo",stat_id.in.("active_count","months_of_supply")),' +
        'and(segment.eq."multifamily_2_4",stat_id.in.("active_count"))',
    )
  })
})
