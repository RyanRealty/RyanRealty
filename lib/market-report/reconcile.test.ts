import { describe, expect, it, vi } from 'vitest'

// The gate's IO (Spark and the report store) is injected; these tests cover the pure parts.
vi.mock('@/lib/data/market-report/reconcile', () => ({}))
vi.mock('@/lib/spark', () => ({}))

import type { ReportSeriesRow } from '@/lib/data/market-report/series'
import { buildEdition } from './build-edition'
import { addMonths, lastDayOf } from './format'
import {
  checkFigures,
  medianOf,
  printedFigures,
  reconcileEdition,
  relDelta,
  reportSale,
  segmentsFor,
  serviceAreaIndex,
  sparkSale,
  type GateSale,
  type PrintedFigure,
  type ReconcileSources,
} from './reconcile'

const AREA = serviceAreaIndex([
  { city: 'Bend', slug: 'bend' },
  { city: 'La Pine', slug: 'la-pine' },
])

describe('segmentsFor', () => {
  it('splits single-family homes at one acre, with no lot size read as under an acre', () => {
    expect(segmentsFor('Single Family Residence', 0.4)).toEqual(['sfr', 'detached'])
    expect(segmentsFor('Single Family Residence', null)).toEqual(['sfr', 'detached'])
    expect(segmentsFor('Single Family Residence', 1)).toEqual(['acreage', 'detached'])
  })

  it('reads condos and townhomes together and nothing else', () => {
    expect(segmentsFor('Condominium', null)).toEqual(['condo_townhome'])
    expect(segmentsFor('Townhouse', 2)).toEqual(['condo_townhome'])
    expect(segmentsFor('Manufactured On Land', 0.2)).toEqual([])
    expect(segmentsFor(null, null)).toEqual([])
  })
})

describe('sparkSale', () => {
  const base = {
    ListingKey: 'K1',
    PropertyType: 'A',
    PropertySubType: 'Single Family Residence',
    StandardStatus: 'Closed',
    CloseDate: '2026-08-14',
    ClosePrice: 700000,
    LotSizeAcres: 0.2,
    City: 'Bend',
  }

  it('places a closing in the region and its city the way place membership does', () => {
    expect(sparkSale({ ...base, City: '  la pine ' }, AREA)).toEqual({
      key: 'K1',
      date: '2026-08-14',
      price: 700000,
      segs: ['sfr', 'detached'],
      geos: ['region:central-oregon', 'city:la-pine'],
    })
  })

  it('drops what the report does not count', () => {
    expect(sparkSale({ ...base, City: 'Salem' }, AREA)).toBeNull()
    expect(sparkSale({ ...base, PropertyType: 'D' }, AREA)).toBeNull()
    expect(sparkSale({ ...base, StandardStatus: 'Pending' }, AREA)).toBeNull()
    expect(sparkSale({ ...base, PropertySubType: 'Manufactured On Land' }, AREA)).toBeNull()
    expect(sparkSale({ ...base, City: '********' }, AREA)).toBeNull()
  })

  it('reads a report sale row with the same segments', () => {
    expect(
      reportSale({
        listing_key: 'K2',
        close_date: '2026-08-02',
        close_price: 1_200_000,
        base_segment: 'detached',
        lot_acres: 2.5,
        geos: ['region:central-oregon', 'city:bend'],
      }).segs,
    ).toEqual(['acreage', 'detached'])
    expect(
      reportSale({ listing_key: 'K3', close_date: '2026-08-02', close_price: 1, base_segment: 'townhome', lot_acres: null, geos: [] })
        .segs,
    ).toEqual(['condo_townhome'])
  })
})

describe('medianOf and relDelta', () => {
  it('matches SQL percentile_cont(0.5)', () => {
    expect(medianOf([3, 1, 2])).toBe(2)
    expect(medianOf([400, 100, 300, 200])).toBe(250)
    expect(medianOf([])).toBeNull()
  })

  it('treats a figure on one side only as a full miss', () => {
    expect(relDelta(200, 198)).toBeCloseTo(0.01)
    expect(relDelta(0, 0)).toBe(0)
    expect(relDelta(0, 3)).toBe(1)
    expect(relDelta(null, 5)).toBe(1)
    expect(relDelta(null, null)).toBe(0)
  })
})

function sale(key: string, price: number, over: Partial<GateSale> = {}): GateSale {
  return {
    key,
    date: '2026-08-10',
    price,
    segs: ['sfr', 'detached'],
    geos: ['region:central-oregon', 'city:bend'],
    ...over,
  }
}

const FIGURE: PrintedFigure = {
  label: 'Bend, single-family under 1 acre, 2026-08',
  geo: 'city:bend',
  segment: 'sfr',
  from: '2026-08-01',
  to: '2026-08-31',
  band: null,
  sales: 0,
  median: null,
}

describe('checkFigures', () => {
  const spark = Array.from({ length: 200 }, (_, i) => sale(`S${i}`, 500_000 + i * 1000))

  it('passes when every key and price agrees', () => {
    const [c] = checkFigures([{ ...FIGURE, sales: 200, median: medianOf(spark.map((s) => s.price!)) }], spark, spark, new Set())
    expect(c!.ok).toBe(true)
    expect(c!.salesDelta).toBe(0)
    expect(c!.medianDelta).toBe(0)
  })

  it('drops the method exclusions from Spark and reports them', () => {
    const ours = spark.slice(0, 199)
    const [c] = checkFigures([{ ...FIGURE, sales: 199 }], spark, ours, new Set(['S199']))
    expect(c!.ok).toBe(true)
    expect(c!.spark.sales).toBe(199)
    expect(c!.excludedByMethod).toBe(1)
    expect(c!.missingFromUs).toEqual([])
  })

  it('fails a missing closing past the tolerance, and names it', () => {
    const ours = spark.slice(0, 197)
    const [c] = checkFigures([{ ...FIGURE, sales: 197 }], spark, ours, new Set())
    expect(c!.ok).toBe(false)
    expect(c!.missingFromUs).toEqual(['S197', 'S198', 'S199'])
    expect(c!.salesDelta).toBeCloseTo(0.015)
  })

  it('fails a swap the counts hide when the keys disagree past the tolerance', () => {
    const ours = [...spark.slice(0, 197), sale('X1', 1), sale('X2', 1), sale('X3', 1)]
    const [c] = checkFigures([{ ...FIGURE, sales: 200 }], spark, ours, new Set())
    expect(c!.salesDelta).toBe(0)
    expect(c!.extraInOurs).toEqual(['X1', 'X2', 'X3'])
    expect(c!.ok).toBe(false)
  })

  it('fails close prices that differ on the same listing', () => {
    const ours = spark.map((s, i) => (i < 3 ? { ...s, price: s.price! + 5000 } : s))
    const [c] = checkFigures([{ ...FIGURE, sales: 200 }], spark, ours, new Set())
    expect(c!.priceMismatches).toHaveLength(3)
    expect(c!.ok).toBe(false)
  })

  it('fails a printed median more than 1% from Spark', () => {
    const m = medianOf(spark.map((s) => s.price!))!
    const [c] = checkFigures([{ ...FIGURE, sales: 200, median: m * 1.02 }], spark, spark, new Set())
    expect(c!.medianDelta).toBeCloseTo(0.02 / 1, 2)
    expect(c!.ok).toBe(false)
  })

  it('counts a price band by close price, and keeps other cities and months out', () => {
    const pool = [
      sale('A', 720_000),
      sale('B', 749_999),
      sale('C', 750_000),
      sale('D', 720_000, { geos: ['region:central-oregon', 'city:redmond'] }),
      sale('E', 720_000, { date: '2026-07-31' }),
    ]
    // Band 13 is $700K to $750K (bands.ts).
    const [c] = checkFigures([{ ...FIGURE, band: 13, sales: 2 }], pool, pool, new Set())
    expect(c!.spark.sales).toBe(2)
    expect(c!.ok).toBe(true)
  })
})

function seriesRow(
  over: Partial<ReportSeriesRow> & Pick<ReportSeriesRow, 'period_kind' | 'period_end' | 'geo_type' | 'geo_slug'>,
): ReportSeriesRow {
  return {
    period_start: over.period_end.slice(0, 8) + '01',
    segment: 'sfr',
    closed_n: 0,
    median_close: null,
    volume: 0,
    ppsf_n: 0,
    median_ppsf: null,
    dtc_n: 0,
    median_dtc: null,
    stl_n: 0,
    median_stl: null,
    stol_n: 0,
    median_stol: null,
    price_cut_n: 0,
    concession_reported_n: 0,
    concession_with_n: 0,
    median_concession: null,
    fin_known_n: 0,
    fin_cash_n: 0,
    fin_conventional_n: 0,
    fin_government_n: 0,
    fin_other_n: 0,
    new_listings_n: 0,
    pendings_n: 0,
    active_end_n: 0,
    active_end_assumed_n: 0,
    median_active_list: null,
    complete_through: '2026-09-23',
    computed_at: '2026-09-25T00:00:00Z',
    ...over,
  }
}

/** Region and Bend: 150 sales a month for five years, and the two trailing windows ending July 2026 and July 2025. */
function series(): ReportSeriesRow[] {
  const rows: ReportSeriesRow[] = []
  for (const [geo_type, geo_slug] of [['region', 'central-oregon'], ['city', 'bend']] as const) {
    for (let i = 0; i < 60; i++) {
      const k = addMonths('2026-07', -i)
      rows.push(seriesRow({ period_kind: 'month', period_end: lastDayOf(k), geo_type, geo_slug, closed_n: 150, median_close: 700_000 + i, active_end_n: 600 }))
    }
    for (const k of ['2026-07', '2025-07']) {
      const start = `${addMonths(k, -11)}-01`
      rows.push(seriesRow({ period_kind: 'trailing12', period_start: start, period_end: lastDayOf(k), geo_type, geo_slug, closed_n: 1800, median_close: 725_000 }))
    }
  }
  return rows
}

describe('printedFigures', () => {
  const payload = buildEdition({ editionMonth: '2026-07', series: series(), bands: [], generatedAt: '2026-08-05T15:00:00Z', definitionId: 'mr-v1' })
  const { figures, inconsistencies } = printedFigures(payload)
  const find = (geo: string, from: string, to: string) => figures.filter((f) => f.geo === geo && f.from === from && f.to === to && f.band == null)

  it('checks the headline month, the same month a year earlier, and the six months behind supply', () => {
    expect(find('city:bend', '2026-07-01', '2026-07-31')[0]).toMatchObject({ sales: 150, median: 700_000 })
    expect(find('city:bend', '2025-07-01', '2025-07-31')[0]).toMatchObject({ sales: 150, median: 700_012 })
    expect(find('city:bend', '2026-02-01', '2026-07-31')[0]).toMatchObject({ sales: 900, median: null })
  })

  it('checks the twelve-month window and its prior year', () => {
    expect(find('region:central-oregon', '2025-08-01', '2026-07-31')[0]).toMatchObject({ sales: 1800, median: 725_000 })
    expect(find('region:central-oregon', '2024-08-01', '2025-07-31')[0]).toMatchObject({ sales: 1800, median: 725_000 })
  })

  it('checks the chart months the daily refresh can still move, once each', () => {
    const months = figures.filter((f) => f.geo === 'city:bend' && f.band == null && f.from.slice(0, 7) === f.to.slice(0, 7))
    const keys = months.map((f) => f.from.slice(0, 7)).sort()
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys[0]).toBe('2025-07')
    expect(keys.at(-1)).toBe('2026-07')
    expect(keys).toHaveLength(13)
  })

  it('finds no figure printed twice with two values', () => {
    expect(inconsistencies).toEqual([])
  })

  it('runs end to end on injected sources and fails a thin month', async () => {
    const month = (k: string, n: number, base: number): GateSale[] =>
      Array.from({ length: n }, (_, i) => sale(`${k}-${i}`, base, { date: `${k}-15` }))
    const sources: ReconcileSources = {
      sparkMonth: async (k) => month(k, 150, 700_000),
      // Our store lacks two July closings.
      oursMonth: async (k) => month(k, k === '2026-07' ? 148 : 150, 700_000),
      unpublishable: async () => new Set(),
    }
    const r = await reconcileEdition(payload, sources)
    expect(r.ok).toBe(false)
    const july = r.checks.find((c) => c.geo === 'city:bend' && c.from === '2026-07-01' && c.to === '2026-07-31')!
    expect(july.missingFromUs).toEqual(['2026-07-148', '2026-07-149'])
  })
})
