import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The §0 Spark gate the sender runs before every send (review 2026-09-30).
 * The rule is §0's, strict: any |delta| > 1% is a STOP, with no tolerance for
 * small counts; a figure that cannot be rebuilt, or a check that cannot run,
 * never passes.
 */

const h = vi.hoisted(() => ({
  fetchPage: vi.fn(),
  boundary: vi.fn(),
  options: vi.fn(),
  aliases: vi.fn(),
  serviceArea: vi.fn(),
}))

vi.mock('@/lib/spark', () => ({ fetchSparkListingsPage: (...a: unknown[]) => h.fetchPage(...a) }))
vi.mock('@/lib/data/geo/getBoundaryGeoJSON', () => ({ getBoundaryGeoJSON: (...a: unknown[]) => h.boundary(...a) }))
vi.mock('@/lib/data/crm/getCrmNeighborhoodOptions', () => ({ getCrmNeighborhoodOptions: (...a: unknown[]) => h.options(...a) }))
vi.mock('@/lib/data/geo/getNeighborhoodAliasRows', () => ({ getNeighborhoodAliasRows: (...a: unknown[]) => h.aliases(...a) }))
vi.mock('@/lib/data/market-report/reconcile', () => ({ getServiceAreaCities: (...a: unknown[]) => h.serviceArea(...a) }))

import {
  createSparkGateMemo,
  describeSparkGate,
  runSparkGate,
  SPARK_GATE_RULE,
  sparkGateVerdict,
  sparkPull,
  sparkPullFilters,
} from './market-report-spark-gate'
import { deltaPct, deltaStatus, type SparkCheck } from './market-report-spark-check'
import type { MarketReportAreaBlock } from '@/lib/data/crm/getMarketReportData'
import type { ReportFigure } from './market-report-figures'

function check(over: Partial<SparkCheck>): SparkCheck {
  return { area: 'bend', figure: 'homes for sale', supabase: 727, spark: 727, deltaPct: 0, population: 'p', status: 'ok', ...over }
}

describe('the strict §0 rule (no tolerance for small counts)', () => {
  it('a count one off under 100 is still a STOP when it is more than 1%', () => {
    // Larkspur-sized: 29 printed against Spark's 30 is 3.33%.
    expect(deltaPct(29, 30)).toBe(-3.33)
    expect(deltaStatus(deltaPct(29, 30))).toBe('STOP')
    // Exactly 1% passes; anything over it stops.
    expect(deltaStatus(deltaPct(101, 100))).toBe('ok')
    expect(deltaStatus(deltaPct(102, 100))).toBe('STOP')
    // A figure with no Spark value is never a pass.
    expect(deltaStatus(deltaPct(29, null))).toBe('STOP')
  })

  it('names the rule it applied, for the stored trace', () => {
    expect(SPARK_GATE_RULE).toContain('|delta| > 1% is a STOP')
    expect(SPARK_GATE_RULE).toContain('no tolerance for small counts')
  })
})

describe('sparkGateVerdict and describeSparkGate', () => {
  it('STOP beats not-reconciled beats ok; a derived headline is fine', () => {
    expect(sparkGateVerdict([check({}), check({ status: 'derived' })])).toBe('ok')
    expect(sparkGateVerdict([check({}), check({ status: 'not-reconciled' })])).toBe('not-reconciled')
    expect(sparkGateVerdict([check({ status: 'not-reconciled' }), check({ status: 'STOP' })])).toBe('STOP')
  })

  it('a STOP names each figure with both values, the delta and the population', () => {
    const text = describeSparkGate({
      verdict: 'STOP',
      error: null,
      checks: [check({}), check({ area: 'bend-larkspur', supabase: 29, spark: 30, deltaPct: -3.33, status: 'STOP', population: 'Market Truth neighborhood' })],
    })
    expect(text).toContain('1 figure over the 1% limit')
    expect(text).toContain('bend-larkspur homes for sale: printed 29, Spark 30, delta -3.33% [Market Truth neighborhood]')
    expect(text).not.toContain('bend homes for sale')
  })

  it('an unreconciled figure and a check that could not run say why', () => {
    expect(
      describeSparkGate({ verdict: 'not-reconciled', error: null, checks: [check({ status: 'not-reconciled', note: 'polygon did not load' })] }),
    ).toContain('could not verify 1 figure')
    expect(describeSparkGate({ verdict: 'not-reconciled', error: 'Spark API error 503', checks: [] })).toContain('Spark API error 503')
    expect(describeSparkGate({ verdict: 'ok', error: null, checks: [] })).toContain('passed')
  })
})

describe('sparkPullFilters', () => {
  const square = { type: 'Polygon' as const, coordinates: [[[-121.4, 44], [-121.2, 44], [-121.2, 44.1], [-121.4, 44.1], [-121.4, 44]]] }
  it('pulls a city by City text and by its polygon box, a neighborhood by box and alias labels, closes back to `since` only', () => {
    const blocks = [
      { slug: 'bend', areaLabel: 'Bend', geoType: 'city' },
      { slug: 'bend-larkspur', areaLabel: 'Larkspur', geoType: 'neighborhood' },
    ] as MarketReportAreaBlock[]
    const pulls = sparkPullFilters({
      blocks,
      since: '2025-09-01',
      cityPolygons: new Map([['bend', square]]),
      neighborhoods: [{ slug: 'bend-larkspur', geometry: square, acres: 1 }],
      aliases: [{ neighborhoodSlug: 'bend-larkspur', subdivisionLabel: "Fitzsimmon's Addition" }],
    })
    const keys = [...pulls.keys()]
    expect(keys).toContain("StandardStatus Eq 'Active' And PropertyType Eq 'A' And PropertySubType Eq 'Single Family Residence' And City Eq 'Bend'")
    expect(keys).toContain("StandardStatus Eq 'Closed' And CloseDate Ge 2025-09-01 And City Eq 'Bend'")
    expect(keys.some((k) => k.includes('Latitude Bt 44,44.1 And Longitude Bt -121.4,-121.2'))).toBe(true)
    expect(keys.some((k) => k.includes("SubdivisionName Eq 'Fitzsimmon\\'s Addition'"))).toBe(true)
    // Actives are detached only; closes are every property type.
    for (const [k, kind] of pulls) {
      if (kind === 'closed') expect(k).not.toContain('PropertySubType')
      else expect(k).toContain("PropertySubType Eq 'Single Family Residence'")
    }
    // With no printed window, no closes are pulled.
    const none = sparkPullFilters({ blocks, since: null, cityPolygons: new Map(), neighborhoods: [], aliases: [] })
    expect([...none.values()].every((k) => k === 'active')).toBe(true)
  })
})

describe('sparkPull (complete or not at all)', () => {
  const page = (rows: number, total: number, pages: number) => ({
    D: {
      Success: true,
      Pagination: { TotalRows: total, TotalPages: pages },
      Results: Array.from({ length: rows }, (_, i) => ({ StandardFields: { ListingKey: `k${i}-${rows}-${Math.random()}` } })),
    },
  })

  it('returns every row when the unique count equals TotalRows', async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce(page(2, 3, 2)).mockResolvedValueOnce(page(1, 3, 2))
    const out = await sparkPull("City Eq 'Bend'", 'tok', fetchPage as never)
    expect(out.rows).toHaveLength(3)
    expect(out.totalRows).toBe(3)
    expect(out.attempts).toBe(1)
  })

  it('throws after three pulls that never add up (a partial pull never reaches a check)', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page(1, 2, 1))
    await expect(sparkPull("City Eq 'Bend'", 'tok', fetchPage as never)).rejects.toThrow('incomplete after 3 attempts')
  })
})

describe('runSparkGate never passes a check it could not run', () => {
  const saved = { spark: process.env.SPARK_API_KEY, url: process.env.NEXT_PUBLIC_SUPABASE_URL, anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
  beforeEach(() => {
    for (const fn of Object.values(h)) fn.mockReset()
  })
  afterEach(() => {
    if (saved.spark === undefined) delete process.env.SPARK_API_KEY
    else process.env.SPARK_API_KEY = saved.spark
    if (saved.url === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url
    if (saved.anon === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.anon
  })

  const blocks = [] as MarketReportAreaBlock[]
  const figures = [] as ReportFigure[]

  it('no Spark key: not reconciled, with the reason', async () => {
    delete process.env.SPARK_API_KEY
    const out = await runSparkGate({ blocks, figures })
    expect(out).toMatchObject({ verdict: 'not-reconciled', error: 'SPARK_API_KEY is not set', checks: [] })
    expect(out.rule).toBe(SPARK_GATE_RULE)
  })

  it('a neighborhood list that reads empty is refused, never treated as "no neighborhoods"', async () => {
    process.env.SPARK_API_KEY = 'test-key-not-real'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.invalid'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
    h.options.mockResolvedValue([])
    const memo = createSparkGateMemo()
    const out = await runSparkGate({ blocks, figures, memo })
    expect(out.verdict).toBe('not-reconciled')
    expect(out.error).toContain('no neighborhood slugs were read')
    expect(h.fetchPage).not.toHaveBeenCalled()
    // A failed read is not memoized for the next subscriber of the run.
    await Promise.resolve()
    expect(memo.context).toBeNull()
  })
})
