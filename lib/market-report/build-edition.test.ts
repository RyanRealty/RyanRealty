import { describe, expect, it } from 'vitest'
import type { ReportBandRow, ReportSeriesRow } from '@/lib/data/market-report/series'
import { buildBands, buildEdition, buildKpis, BandIndex, quarterEnds, SeriesIndex } from './build-edition'
import { addMonths, lastDayOf } from './format'

function row(over: Partial<ReportSeriesRow> & Pick<ReportSeriesRow, 'period_kind' | 'period_end' | 'geo_type' | 'geo_slug'>): ReportSeriesRow {
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

/** 48 months of Bend and region rows ending July 2026, 150 sales a month, 600 for sale. */
function fixture(): ReportSeriesRow[] {
  const rows: ReportSeriesRow[] = []
  for (const [geo_type, geo_slug] of [['region', 'central-oregon'], ['city', 'bend']] as const) {
    for (let i = 0; i < 60; i++) {
      const k = addMonths('2026-07', -i)
      const end = lastDayOf(k)
      rows.push(
        row({
          period_kind: 'month', period_end: end, geo_type, geo_slug,
          closed_n: 150, median_close: 700_000 + (i === 0 ? 80_000 : 0) + (i === 12 ? 50_000 : 0),
          dtc_n: 150, median_dtc: 25, ppsf_n: 150, median_ppsf: 390, stl_n: 150, median_stl: 0.985,
          stol_n: 150, median_stol: 0.96, price_cut_n: 60, fin_known_n: 150, fin_cash_n: 45,
          fin_conventional_n: 90, fin_government_n: 15, active_end_n: 600, new_listings_n: 250, pendings_n: 160,
        }),
      )
    }
    for (const k of ['2026-07', '2025-07']) {
      rows.push(row({ period_kind: 'trailing12', period_end: lastDayOf(k), geo_type, geo_slug, closed_n: 1800, median_close: 725_000, dtc_n: 1800, median_dtc: 29, active_end_n: 600 }))
      rows.push(row({ period_kind: 'trailing3', period_end: lastDayOf(k), geo_type, geo_slug, closed_n: 450, median_close: 740_000, dtc_n: 450, median_dtc: 22, active_end_n: 600 }))
    }
  }
  return rows
}

describe('buildKpis', () => {
  const idx = new SeriesIndex(fixture())

  it('computes months of supply with the house formula and a verdict that matches it', () => {
    const k = buildKpis(idx, 'month', '2026-07', 'city:bend', 'sfr')!
    // 600 for sale / (900 sales in six months / 6) = 4.0 → seller's (4 or less)
    expect(k.closed6).toBe(900)
    expect(k.mos).toBe(4)
    expect(k.verdict).toBe('seller')
  })

  it('reports year-over-year change only when both sides clear the floor', () => {
    const k = buildKpis(idx, 'month', '2026-07', 'city:bend', 'sfr')!
    expect(k.median.v).toBe(780_000)
    expect(k.medianPrior.v).toBe(750_000)
    expect(k.medianYoY).toBeCloseTo(0.04, 5)

    const thin = new SeriesIndex([
      row({ period_kind: 'month', period_end: '2026-07-31', geo_type: 'city', geo_slug: 'culver', closed_n: 12, median_close: 400_000 }),
      row({ period_kind: 'month', period_end: '2025-07-31', geo_type: 'city', geo_slug: 'culver', closed_n: 20, median_close: 380_000 }),
    ])
    const t = buildKpis(thin, 'month', '2026-07', 'city:culver', 'sfr')!
    expect(t.median.v).toBe(400_000)
    expect(t.medianYoY).toBeNull()
    expect(t.salesYoY).toBeNull()
  })

  it('withholds a median under ten sales and a verdict under thirty six-month sales', () => {
    const idx2 = new SeriesIndex([
      row({ period_kind: 'month', period_end: '2026-07-31', geo_type: 'city', geo_slug: 'metolius', closed_n: 4, median_close: 330_000, active_end_n: 8 }),
    ])
    const k = buildKpis(idx2, 'month', '2026-07', 'city:metolius', 'sfr')!
    expect(k.median.v).toBeNull()
    expect(k.median.n).toBe(4)
    expect(k.mos).toBeNull()
    expect(k.verdict).toBeNull()
  })

  it('never publishes days to contract before 2006', () => {
    const idx3 = new SeriesIndex([
      row({ period_kind: 'month', period_end: '2004-07-31', geo_type: 'city', geo_slug: 'bend', closed_n: 200, median_close: 300_000, dtc_n: 200, median_dtc: 30 }),
    ])
    expect(buildKpis(idx3, 'month', '2004-07', 'city:bend', 'sfr')!.dtc.v).toBeNull()
  })
})

describe('buildBands', () => {
  it('trims empty ends, sums tiers from whole bands, and judges a band only past the floor', () => {
    const rows: ReportBandRow[] = []
    for (let i = 0; i < 12; i++) {
      const end = lastDayOf(addMonths('2026-07', -i))
      rows.push({ period_end: end, geo_type: 'city', geo_slug: 'bend', segment: 'sfr', band_idx: 10, closed_n: 10, active_end_n: i === 0 ? 20 : 0 })
      rows.push({ period_end: end, geo_type: 'city', geo_slug: 'bend', segment: 'sfr', band_idx: 12, closed_n: 2, active_end_n: i === 0 ? 30 : 0 })
    }
    const out = buildBands(new BandIndex(rows), '2026-07', 'city:bend', 'sfr')!
    expect(out.rows[0]!.idx).toBe(10)
    expect(out.rows.at(-1)!.idx).toBe(12)
    const b10 = out.rows.find((r) => r.idx === 10)!
    expect(b10.sales12).toBe(120)
    expect(b10.sales6).toBe(60)
    expect(b10.mos).toBe(2) // 20 / (60 / 6)
    expect(b10.verdict).toBe('seller')
    const b12 = out.rows.find((r) => r.idx === 12)!
    expect(b12.sales6).toBe(12)
    expect(b12.mos).toBeNull() // 12 six-month sales is under the floor of 30
    const tier = out.tiers.find((t) => t.key === '500k-600k')!
    expect(tier.sales6).toBe(60)
    expect(tier.active).toBe(20)
  })
})

describe('quarterEnds', () => {
  it('ends at the last complete quarter', () => {
    expect(quarterEnds('2026-07', 2)).toEqual(['2026-03-31', '2026-06-30'])
    expect(quarterEnds('2026-06', 1)).toEqual(['2026-06-30'])
    expect(quarterEnds('2026-02', 1)).toEqual(['2025-12-31'])
  })
})

describe('buildEdition', () => {
  const payload = buildEdition({
    editionMonth: '2026-07',
    series: fixture(),
    bands: [],
    generatedAt: '2026-08-05T15:00:00.000Z',
    definitionId: 'mr-v1',
  })

  it('writes summaries whose numbers are the numbers in the payload', () => {
    const bend = payload.monthly.find((s) => s.geo.slug === 'bend')!
    const text = bend.summary.join(' ')
    expect(text).toContain('$780,000')
    expect(text).toContain('up 4% from July 2025')
    expect(text).toContain('4.0 months of supply')
    expect(text).toContain("a seller's market by our measure (4 months or less is a seller's market)")
  })

  it('uses no em dashes in any sentence', () => {
    const all = [...payload.headline, ...payload.region.summary, ...payload.monthly.flatMap((s) => s.summary)]
    for (const s of all) expect(s).not.toMatch(/—| -- /)
  })

  it('carries a citation for every headline figure it prints', () => {
    const figures = payload.citations.map((c) => c.figure)
    expect(figures).toContain('Bend single-family (under 1 acre), July 2026: median sale price')
    expect(figures).toContain('Bend single-family (under 1 acre), July 2026: months of supply')
    expect(payload.citations.every((c) => c.rows >= 0 && c.filter.includes('definition mr-v1'))).toBe(true)
  })

  it('names the edition by its data month', () => {
    expect(payload.title).toBe('Central Oregon Market Report: July 2026')
    expect(payload.editionMonth).toBe('2026-07')
  })
})
