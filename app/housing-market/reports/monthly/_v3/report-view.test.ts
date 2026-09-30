import { describe, expect, it } from 'vitest'
import type { EditionListItem } from '@/lib/data/market-report/editions'
import type { ReportSeriesRow } from '@/lib/data/market-report/series'
import { FLOORS, buildEdition } from '@/lib/market-report/build-edition'
import { addMonths, count, days, lastDayOf, money, mosText, pctChange } from '@/lib/market-report/format'
import type { EditionPayload } from '@/lib/market-report/types'
import {
  archiveDescription,
  archiveSentence,
  archiveYears,
  datasetVariables,
  downloadLabel,
  editionDescription,
  editionKey,
  editionNeighbors,
  editionPdfHref,
  firstSentence,
  floorsSentence,
  marketDetail,
  marketFigures,
  marketHref,
  marketLedgerRows,
  medianSpark,
  medianTrendChart,
  overviewSource,
  parseEditionMonth,
  pdfFacts,
  pdfSize,
  publishedVerdict,
  supplyPattern,
  supplySeasons,
  supplyValue,
  supplyVerdict,
  withheldClause,
} from './report-view'
import { marketVerdict as registryVerdict } from '@/lib/data/market-truth/registry'

/* -------------------------------------------------------------------------- */
/* A real payload, built by the same builder the monthly cron runs            */
/* -------------------------------------------------------------------------- */

function row(
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
    complete_through: '2026-09-03',
    computed_at: '2026-09-05T00:00:00Z',
    ...over,
  }
}

const EDITION = '2026-08'

/**
 * Region, Bend and Redmond read by month (150 sales a month, 600 for sale:
 * 4.0 months of supply, a seller's market); Sisters over three months with a
 * buyer's supply; Camp Sherman too small for a median or a supply reading.
 */
function fixture(): ReportSeriesRow[] {
  const rows: ReportSeriesRow[] = []
  const monthly: Array<['region' | 'city', string, number]> = [
    ['region', 'central-oregon', 700_000],
    ['city', 'bend', 800_000],
    ['city', 'redmond', 500_000],
  ]
  for (const [geo_type, geo_slug, base] of monthly) {
    for (let i = 0; i < 60; i++) {
      const end = lastDayOf(addMonths(EDITION, -i))
      rows.push(
        row({
          period_kind: 'month', period_end: end, geo_type, geo_slug,
          closed_n: 150, median_close: base + (i === 0 ? 30_000 : 0) - i * 1_000,
          dtc_n: 150, median_dtc: 21, active_end_n: 600, new_listings_n: 240, pendings_n: 160,
        }),
      )
    }
    for (const k of [EDITION, addMonths(EDITION, -12)]) {
      rows.push(row({ period_kind: 'trailing12', period_end: lastDayOf(k), geo_type, geo_slug, closed_n: 1_800, median_close: base, dtc_n: 1_800, median_dtc: 25, active_end_n: 600 }))
    }
  }
  // Sisters: 45 sales in three months, 15 a month, 90 for sale: 6.0 months, a buyer's market.
  for (let i = 0; i < 18; i++) {
    const end = lastDayOf(addMonths(EDITION, -i))
    rows.push(row({ period_kind: 'month', period_end: end, geo_type: 'city', geo_slug: 'sisters', closed_n: 15, median_close: 910_000, dtc_n: 15, median_dtc: 40, active_end_n: 90 }))
  }
  for (const k of [EDITION, addMonths(EDITION, -12)]) {
    rows.push(row({ period_kind: 'trailing3', period_end: lastDayOf(k), geo_type: 'city', geo_slug: 'sisters', closed_n: 45, median_close: 925_000, dtc_n: 45, median_dtc: 38, active_end_n: 90 }))
    rows.push(row({ period_kind: 'trailing12', period_end: lastDayOf(k), geo_type: 'city', geo_slug: 'sisters', closed_n: 180, median_close: 900_000, dtc_n: 180, median_dtc: 41, active_end_n: 90 }))
  }
  // Camp Sherman: two sales in three months, any lot size.
  rows.push(row({ period_kind: 'trailing3', period_end: lastDayOf(EDITION), geo_type: 'city', geo_slug: 'camp-sherman', segment: 'detached', closed_n: 2, median_close: 1_100_000, dtc_n: 2, median_dtc: 60, active_end_n: 5 }))
  rows.push(row({ period_kind: 'trailing12', period_end: lastDayOf(EDITION), geo_type: 'city', geo_slug: 'camp-sherman', segment: 'detached', closed_n: 8, median_close: 1_050_000, dtc_n: 8, median_dtc: 55, active_end_n: 5 }))
  return rows
}

const payload: EditionPayload = buildEdition({
  editionMonth: EDITION,
  series: fixture(),
  bands: [],
  generatedAt: '2026-09-08T15:23:00Z',
  definitionId: 'test-definition',
})

function item(month: string, over: Partial<EditionListItem> = {}): EditionListItem {
  return {
    edition_month: `${month}-01`,
    slug: `central-oregon-${month}`,
    title: `Central Oregon Market Report: ${month}`,
    summary: `The median single-family home in Central Oregon sold for $700,000 in ${month}, up 2% from a year earlier. 400 single-family homes sold.`,
    pdf_path: `central-oregon/${month.slice(0, 4)}/ryan-realty-central-oregon-market-report-${month}.pdf`,
    pdf_bytes: 1_048_576,
    page_count: 19,
    published_at: '2026-09-08T15:30:00Z',
    data_complete_through: '2026-09-03',
    figures: null,
    ...over,
  }
}

/** Every string a builder hands the page, flattened, for the voice checks. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(strings)
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings)
  return []
}

/* -------------------------------------------------------------------------- */

describe('parseEditionMonth', () => {
  it('accepts a real YYYY-MM and nothing else', () => {
    expect(parseEditionMonth('2026-08')).toBe('2026-08')
    expect(parseEditionMonth('2006-01')).toBe('2006-01')
    for (const bad of ['2026-8', '2026-13', '2026-00', '2026-08-01', ' 2026-08', '202608', 'latest', '', undefined, null]) {
      expect(parseEditionMonth(bad as string)).toBeNull()
    }
  })
})

describe('the PDF, described', () => {
  it('names the file type, the page count and the size, and leaves out what the row lacks', () => {
    expect(pdfFacts(item('2026-08'))).toBe('PDF, 19 pages, 1.0 MB')
    expect(pdfFacts(item('2026-08', { page_count: null, pdf_bytes: 300_000 }))).toBe('PDF, 293 KB')
    expect(pdfFacts(item('2026-08', { page_count: 1, pdf_bytes: null }))).toBe('PDF, 1 page')
    expect(downloadLabel('2026-08', item('2026-08'))).toBe('Download the August 2026 report (PDF, 19 pages, 1.0 MB)')
    expect(editionPdfHref('2026-08')).toBe('/housing-market/reports/monthly/2026-08/pdf')
  })
})

describe('pdfSize', () => {
  it('prints a report just under a megabyte as megabytes, never as four-digit kilobytes', () => {
    expect(pdfSize(1_032_165)).toBe('1.0 MB') // August 2026 as stored
    expect(pdfSize(1_023_488)).toBe('1.0 MB') // the first size that would round to 1000 KB
    expect(pdfSize(1_023_487)).toBe('999 KB')
    expect(pdfSize(300_000)).toBe('293 KB')
    expect(pdfSize(2_500_000)).toBe('2.4 MB')
    expect(pdfSize(null)).toBe('')
    expect(pdfSize(0)).toBe('')
  })
})

describe('marketFigures', () => {
  it('prints the region figures exactly as the payload stores them', () => {
    const k = payload.region.kpis
    const figures = marketFigures(k, { href: '#markets', supplyHref: '/months-of-supply' })
    expect(figures.map((f) => f.value)).toEqual([money(k.median.v), count(k.sales), days(k.dtc.v), mosText(k.mos)])
    // 600 for sale over 900 six-month sales: 4.0 months, which is a seller's market (4 or less).
    expect(k.mos).toBe(4)
    expect(figures[3]!.label).toBe("months of supply, a seller's market")
    expect(figures[3]!.href).toBe('/months-of-supply')
    expect(figures[0]!.label).toBe(`median sale price in August (${pctChange(k.medianYoY)} from August 2025)`)
    expect(figures[1]!.label).toBe('homes sold in August')
  })

  it('keeps a withheld figure in place as a dash with its reason', () => {
    const camp = payload.overview.find((r) => r.geo.slug === 'camp-sherman')!.kpis
    const figures = marketFigures(camp)
    expect(camp.median.v).toBeNull()
    expect(figures[0]!.value).toBe('–')
    expect(figures[0]!.label).toContain('2 sales, under the 10 a median needs')
    expect(figures[3]!.value).toBe('–')
    expect(figures[3]!.label).toContain('under the 30 a reading needs')
  })
})

describe('publishedVerdict', () => {
  it('prints a stored verdict only when it matches the number beside it', () => {
    expect(publishedVerdict({ mos: 4, verdict: 'seller' })).toBe('seller')
    expect(publishedVerdict({ mos: 5.2, verdict: 'balanced' })).toBe('balanced')
    expect(publishedVerdict({ mos: 6, verdict: 'buyer' })).toBe('buyer')
    expect(publishedVerdict({ mos: 4.3, verdict: 'seller' })).toBeNull()
    expect(publishedVerdict({ mos: null, verdict: 'seller' })).toBeNull()
  })

  it('never prints a call for a supply figure that is not a number', () => {
    expect(publishedVerdict({ mos: Number.NaN, verdict: 'balanced' })).toBeNull()
    expect(publishedVerdict({ mos: Number.POSITIVE_INFINITY, verdict: 'buyer' })).toBeNull()
  })
})

describe('supplyVerdict', () => {
  it('is the call the edition builder stored, on every boundary (the Market Truth registry)', () => {
    for (const mos of [0, 2.3, 3.99, 4, 4.01, 5, 5.99, 6, 6.01, 11]) {
      expect(supplyVerdict(mos), String(mos)).toBe(registryVerdict(mos))
    }
    expect(supplyVerdict(4)).toBe('seller')
    expect(supplyVerdict(4.01)).toBe('balanced')
    expect(supplyVerdict(6)).toBe('buyer')
  })

  it('makes no call on a missing or non-finite figure', () => {
    expect(supplyVerdict(null)).toBeNull()
    expect(supplyVerdict(undefined)).toBeNull()
    expect(supplyVerdict(Number.NaN)).toBeNull()
    expect(supplyVerdict(Number.NEGATIVE_INFINITY)).toBeNull()
  })
})

describe('market by market', () => {
  const rows = marketLedgerRows(payload)

  it('has one row per overview market, in the report order, each a door to a live page', () => {
    expect(rows.map((r) => r.what)).toEqual(payload.overview.map((r) => r.geo.label))
    expect(rows[0]!.href).toBe('/housing-market')
    expect(rows.find((r) => r.what === 'Bend')!.href).toBe('/cities/bend')
    expect(rows.find((r) => r.what === 'Sisters')!.href).toBe('/cities/sisters')
    expect(rows.find((r) => r.what === 'Camp Sherman')!.href).toBe('/homes-for-sale/camp-sherman')
    expect(marketHref({ type: 'city', slug: 'redmond', label: 'Redmond' })).toBe('/cities/redmond')
  })

  it('draws the median on one scale, the largest at full length, and no bar for a withheld median', () => {
    const weights = rows.map((r) => r.weight).filter((w): w is number => typeof w === 'number')
    expect(Math.max(...weights)).toBe(1)
    const camp = rows.find((r) => r.what === 'Camp Sherman')!
    expect(camp.value).toBe('–')
    expect(camp.weight).toBeUndefined()
    expect(camp.detail).toContain('withheld: too few sales to publish')
  })

  it('prints each row from its own kpis, with the period it covers', () => {
    const bend = payload.overview.find((r) => r.geo.slug === 'bend')!.kpis
    const bendRow = rows.find((r) => r.what === 'Bend')!
    expect(bendRow.value).toBe(money(bend.median.v))
    expect(bendRow.detail).toBe(marketDetail(bend))
    expect(bendRow.detail?.startsWith('August: ')).toBe(true)
    expect(bendRow.detail).toContain(`${count(bend.sales)}\u00a0sold`)
    expect(bendRow.detail).toContain("4.0\u00a0months\u00a0of\u00a0supply, a seller's market")
    const sisters = rows.find((r) => r.what === 'Sisters')!
    expect(sisters.detail?.startsWith('Jun to Aug: ')).toBe(true)
    expect(sisters.detail).toContain("6.0\u00a0months\u00a0of\u00a0supply, a buyer's market")
  })

  it('never lets a line break fall between a figure and its unit', () => {
    const bend = payload.overview.find((r) => r.geo.slug === 'bend')!.kpis
    const detail = marketDetail(bend)
    // Every number is followed by a no-break space and its unit, never a plain space.
    for (const m of detail.matchAll(/(\d[\d,.]*)( |\u00a0)(sold|days|for|months)/g)) {
      expect(m[2], m[0]).toBe('\u00a0')
    }
    // The line still breaks between figures, at the separators.
    expect(detail).toContain(' · ')
  })

  it('reveals the last twelve months and, for a monthly market, its 36-month run', () => {
    const region = rows[0]!
    expect(region.reveal?.line).toMatch(/^Last 12 months: 1,800 homes sold at a median of \$700,000/)
    expect(region.reveal?.series).toHaveLength(36)
    const sisters = rows.find((r) => r.what === 'Sisters')!
    expect(sisters.reveal?.series).toBeUndefined()
  })

  it('names the any-lot towns in the trace', () => {
    expect(overviewSource(payload, 'Sep 3, 2026')).toContain('except Camp Sherman (any lot size)')
  })
})

describe('withheldClause', () => {
  it('says nothing when every figure is published', () => {
    expect(withheldClause(payload.region.kpis)).toBeNull()
  })
})

describe('charts', () => {
  it('draws the stored median series and claims only what the line shows', () => {
    const chart = medianTrendChart(payload.region.series, 'Central Oregon')!
    const points = chart.series![0]!.points
    expect(points).toHaveLength(36)
    expect(points.at(-1)!.label).toBe(money(730_000))
    expect(chart.claim).toBe(
      'The median home sold for $730,000 in August 2026, against a range of $665,000 to $730,000 since September 2023.',
    )
    expect(chart.caption).toBe('Central Oregon median sale price by month, September 2023 to August 2026')
    // The reading prints on the band above the plot, never a card on the line.
    expect(chart.reading).toBe('band')
    // The high and the low the claim names are marked on the line, keyed like its points.
    const at = (tick: string) => points.find((p) => p.tick === tick)!.at
    expect(chart.callouts).toEqual([
      { at: at('Aug 2026'), label: 'High $730,000', place: 'above' },
      { at: at('Sep 2023'), label: 'Low $665,000', place: 'below' },
    ])
  })

  it('draws months of supply against the balanced zone and claims the pattern, not the figure', () => {
    const strips = supplySeasons(payload.region.series, 'Central Oregon')!
    expect(strips.caption).toBe('Central Oregon months of supply by month, September 2023 to August 2026')
    expect(strips.bands).toEqual([{ from: 4, to: 6, label: 'Balanced: above 4 and under 6 months' }])
    expect(strips.threshold).toBe(4)
    // Every stored month is 4.0, on the line and never past it.
    expect(strips.claim).toBe('Supply stayed at 4 months or under in 2026 through August and in all of 2025.')
    // The newest month is the edition month, printed the way the line printed it.
    const newest = strips.rows[0]!.cells[7]!
    expect(newest.tick).toBe('Aug 2026')
    expect(newest.label).toBe('4.0 months')
    expect(newest.note).toBe("a seller's market")
  })

  it('keeps every stored month, one strip per calendar year, newest first, January in the first column', () => {
    const strips = supplySeasons(payload.region.series, 'Central Oregon')!
    expect(strips.rows.map((r) => String(r.name))).toEqual(['2026', '2025', '2024', '2023'])
    for (const row of strips.rows) expect(row.cells).toHaveLength(12)
    const readings = strips.rows.flatMap((r) => r.cells.filter((c) => c != null))
    expect(readings).toHaveLength(36)
    // 2023 starts in September; 2026 stops in August. The gaps stay gaps.
    expect(strips.rows[3]!.cells.slice(0, 8).every((c) => c == null)).toBe(true)
    expect(strips.rows[3]!.cells[8]!.tick).toBe('Sep 2023')
    expect(strips.rows[0]!.cells.slice(8).every((c) => c == null)).toBe(true)
    expect(strips.columns.map(String)).toEqual(['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'])
  })

  it('prints each month as the stored figure and calls it the way the thresholds do', () => {
    const months = Array.from({ length: 12 }, (_, i) => addMonths('2025-09', i))
    const mos = [2.1, 3.96, 4.0, 4.04, 5.97, 6.0, 6.8, 4.4, 3.9, 3.1, 2.6, 2.2]
    const series = { ...payload.region.series!, months, mos: months.map((k, i) => ({ k, v: mos[i]!, n: 300 })) }
    const strips = supplySeasons(series, 'Central Oregon')!
    const byTick = new Map(
      strips.rows.flatMap((r) => r.cells.flatMap((c) => (c ? [[String(c.tick), c] as const] : []))),
    )
    expect(byTick.get('Oct 2025')!.label).toBe(`${mosText(3.96)} months`)
    expect(byTick.get('Oct 2025')!.note).toBe("a seller's market")
    expect(byTick.get('Nov 2025')!.note).toBe("a seller's market")
    // 4.04 prints 4.1, never a 4.0 beside a balanced call.
    expect(byTick.get('Dec 2025')!.label).toBe('4.1 months')
    expect(byTick.get('Dec 2025')!.note).toBe('a balanced market')
    expect(byTick.get('Jan 2026')!.label).toBe('5.9 months')
    expect(byTick.get('Jan 2026')!.note).toBe('a balanced market')
    expect(byTick.get('Feb 2026')!.note).toBe("a buyer's market")
    // The domain holds the whole balanced zone and the run's own top.
    expect(strips.max).toBe(7)
    expect(supplySeasons(payload.region.series, 'Central Oregon')!.max).toBe(6)
    // The claim names the months past the line, read off the same readings:
    // 4.0 is on the line, 4.04 and 5.97 are past it, 3.9 is back under.
    expect(strips.claim).toBe('In 2026 supply passed 4 months from January to April; in 2025, in December.')
  })

  it('says which months passed the line, in each of the two newest years, from the readings alone', () => {
    const year = (y: number, v: readonly (number | null)[]) => ({ year: y, readings: v })
    const full = (v: number) => Array.from({ length: 12 }, () => v)
    const some = (base: number, past: Record<number, number>) =>
      Array.from({ length: 12 }, (_, i) => (i in past ? past[i]! : base))
    // Both years crossed, one run each.
    expect(supplyPattern([year(2026, some(3, { 3: 4.2, 4: 4.5, 5: 4.6, 6: 4.3, 7: 4.1 })), year(2025, some(3, { 4: 4.4, 5: 4.5, 6: 4.2 }))], 4)).toBe(
      'In 2026 supply passed 4 months from April to August; in 2025, from May to July.',
    )
    // Several runs read as a list; a lone month reads as "in".
    expect(supplyPattern([year(2026, some(3, { 0: 4.3, 3: 4.2, 4: 4.5, 5: 4.1, 9: 4.4 })), year(2025, full(3))], 4)).toBe(
      'In 2026 supply passed 4 months in January, April to June and October, after staying at 4 or under in all of 2025.',
    )
    // Only last year crossed; this year stops at the edition month.
    const through = [...full(3.5).slice(0, 8), null, null, null, null]
    expect(supplyPattern([year(2026, through), year(2025, some(3, { 5: 4.4 }))], 4)).toBe(
      'Supply stayed at 4 months or under in 2026 through August; in 2025 it passed 4 in June.',
    )
    // Exactly 4 is on the line, not past it; a year the window shows in part says so.
    const partial = [null, null, null, null, null, null, null, null, 4, 4, 3.9, 3.8]
    expect(supplyPattern([year(2026, through), year(2025, partial)], 4)).toBe(
      'Supply stayed at 4 months or under in 2026 through August and in the months of 2025 shown.',
    )
    // One year only.
    expect(supplyPattern([year(2026, some(3, { 2: 4.2 }))], 4)).toBe('In 2026 supply passed 4 months in March.')
    expect(supplyPattern([], 4)).toBeNull()
  })

  it('draws no strips from a missing or one-month series', () => {
    expect(supplySeasons(undefined, 'Central Oregon')).toBeUndefined()
    const one = { ...payload.region.series!, mos: [{ k: '2026-08', v: 4, n: 300 }] }
    expect(supplySeasons(one, 'Central Oregon')).toBeUndefined()
  })

  it('labels the x axis with the year at each January, not a month name at the edge', () => {
    const chart = medianTrendChart(payload.region.series, 'Central Oregon')!
    expect(chart.xTicks?.map((t) => t.label)).toEqual(['2024', '2025', '2026'])
  })

  it('draws nothing from a missing series', () => {
    expect(medianTrendChart(undefined, 'Central Oregon')).toBeUndefined()
  })

  it('gives the archive tile the stored medians as one line, and the range the edition chart names', () => {
    const spark = medianSpark(payload.region.series)!
    const stored = payload.region.series!.median.map((p) => p.v)
    expect(spark.values).toEqual(stored)
    expect(spark.label).toBe('Median sale price by month, Sep 2023 to Aug 2026: low $665,000, high $730,000')
    // The same low and high the chart's claim names, off the same points.
    expect(medianTrendChart(payload.region.series, 'Central Oregon')!.claim).toContain('$665,000 to $730,000')
  })

  it('keeps a withheld month as a gap in the tile line, and starts and ends on a published month', () => {
    const base = payload.region.series!
    const median = base.median.map((p, i) => (i === 0 || i === 5 || i === base.median.length - 1 ? { ...p, v: null } : p))
    const spark = medianSpark({ ...base, median })!
    expect(spark.values).toHaveLength(base.median.length - 2)
    expect(spark.values[0]).toBe(base.median[1]!.v)
    expect(spark.values[4]).toBeNull()
    expect(spark.label).toMatch(/^Median sale price by month, Oct 2023 to Jul 2026: /)
    expect(medianSpark(undefined)).toBeNull()
    expect(medianSpark({ ...base, median: base.median.map((p) => ({ ...p, v: null })) })).toBeNull()
  })
})

describe('descriptions and structured data', () => {
  it('quotes the payload and fits the snippet budget', () => {
    const d = editionDescription(EDITION, payload.region.kpis)
    expect(d.length).toBeLessThanOrEqual(155)
    expect(d).toContain(money(payload.region.kpis.median.v))
  })

  it('gives the archive snippet the latest figures when they fit, and none it cannot fit', () => {
    const k = payload.region.kpis
    const d = archiveDescription('2006-01', EDITION, k)
    expect(d.length).toBeLessThanOrEqual(155)
    expect(d).toContain('since January 2006')
    expect(d).toContain(`August 2026: median sale price ${money(k.median.v)}, ${count(k.sales)} homes sold.`)
    expect(archiveDescription('2006-01', EDITION, null)).toBe(
      'Every monthly Central Oregon market report since January 2006, free to read here or download as a PDF.',
    )
  })

  it('publishes the numbers the page prints', () => {
    const vars = datasetVariables(payload.region.kpis, EDITION)
    expect(vars.find((v) => v.name.startsWith('Median sale price'))!.value).toBe(730_000)
    expect(vars.find((v) => v.name.startsWith('Months of supply'))!.value).toBe(4)
  })

  it('carries months of supply as the stored value to two decimals, never a float and never across a line', () => {
    // The stored value the edition page shows as 4.1 (one decimal kept off the line).
    const vars = datasetVariables({ ...payload.region.kpis, mos: 4.020191285866099 }, EDITION)
    expect(vars.find((v) => v.name.startsWith('Months of supply'))!.value).toBe(4.02)
    expect(supplyValue(3.3456)).toBe(3.35)
    expect(supplyValue(4)).toBe(4)
    expect(supplyValue(6)).toBe(6)
    // Two decimals would print a threshold the value did not reach: step off it.
    expect(supplyValue(4.001)).toBe(4.01)
    expect(supplyValue(5.996)).toBe(5.99)
    for (const mos of [4.001, 4.004, 5.995, 5.996, 5.999]) {
      expect(supplyVerdict(supplyValue(mos)), String(mos)).toBe(supplyVerdict(mos))
    }
  })
})

describe('floorsSentence', () => {
  it('states the floors the builder enforces, the median, the change and the call each on its own terms', () => {
    const s = floorsSentence()
    expect(s).toBe(
      `A dash means too few sales to publish. A median needs ${FLOORS.median} sales; a change from a year ago needs ${FLOORS.yoy} sales in each year; a market call needs ${FLOORS.mos} sales in the last six months.`,
    )
    // One floor governs both year-ago changes (median and homes sold), so one number can say both.
    expect(FLOORS.yoyCount).toBe(FLOORS.yoy)
    expect(s).not.toMatch(/—/)
  })
})

describe('the archive', () => {
  const list = [item('2026-08'), item('2026-07'), item('2025-12', { pdf_path: null }), item('2006-01')]

  it('groups by year, newest first, with January always in the first slot', () => {
    const years = archiveYears(list)
    expect(years.map((y) => y.year)).toEqual([2026, 2025, 2006])
    expect(years[0]!.slots).toHaveLength(12)
    expect(years[0]!.slots[7]!.key).toBe('2026-08')
    expect(years[0]!.slots[7]!.latest).toBe(true)
    expect(years[0]!.slots[6]!.latest).toBe(false)
    expect(years[0]!.slots[8]).toBeNull()
    expect(years[0]!.count).toBe(2)
    expect(years[2]!.slots[0]!.short).toBe('Jan')
  })

  it('gives a month with no file a page and no download', () => {
    const dec = archiveYears(list)[1]!.slots[11]!
    expect(dec.href).toBe('/housing-market/reports/monthly/2025-12')
    expect(dec.pdfHref).toBeNull()
  })

  it('reveals the first headline sentence of each edition', () => {
    expect(firstSentence(item('2026-08').summary)).toBe(
      'The median single-family home in Central Oregon sold for $700,000 in 2026-08, up 2% from a year earlier.',
    )
    expect(firstSentence(null)).toBeNull()
  })

  it('prints each month\'s stored median and shades it between the archive\'s lowest and highest', () => {
    const fig = (median: number | null) => ({ median, medianYoY: null, sales: 300, mos: 4.2, verdict: 'balanced' as const })
    const years = archiveYears([
      item('2026-08', { figures: fig(640_000) }),
      item('2011-03', { figures: fig(240_000) }),
      item('2006-01', { figures: fig(440_000) }),
      item('2006-02', { figures: fig(null) }),
      item('2006-03'),
    ])
    const aug = years[0]!.slots[7]!
    expect(aug.median).toBe('$640K')
    expect(aug.shade).toBe(1)
    expect(years[1]!.slots[2]!.shade).toBe(0)
    expect(years[2]!.slots[0]!.shade).toBeCloseTo(0.5)
    // A withheld median and a row stored before figures existed stay plain.
    expect(years[2]!.slots[1]!.median).toBeNull()
    expect(years[2]!.slots[1]!.shade).toBeNull()
    expect(years[2]!.slots[2]!.shade).toBeNull()
  })

  it('finds the months either side of an edition', () => {
    const { older, newer } = editionNeighbors(list, '2026-07')
    expect(older && editionKey(older)).toBe('2025-12')
    expect(newer && editionKey(newer)).toBe('2026-08')
    expect(editionNeighbors(list, '2026-08').newer).toBeNull()
  })

  it('says what the archive holds, and calls a month a PDF only when it has a file', () => {
    // One of the four is web only, so "each one ... as a PDF" would be false.
    expect(archiveSentence(list)).toBe(
      "Every monthly report on Central Oregon's housing market since January 2006, 4 in all, each one to read here and 3 to download as a PDF.",
    )
    const all = [item('2026-08'), item('2026-07')]
    expect(archiveSentence(all)).toBe(
      "Every monthly report on Central Oregon's housing market since July 2026, 2 in all, each one to read here or download as a PDF.",
    )
    expect(archiveSentence([item('2026-08', { pdf_path: null })])).toBe(
      "Every monthly report on Central Oregon's housing market since August 2026, one in all, to read here.",
    )
    expect(archiveSentence([])).toBe('')
  })
})

describe('voice', () => {
  it('puts no em dash in anything a visitor reads', () => {
    const out = strings([
      marketFigures(payload.region.kpis),
      marketLedgerRows(payload),
      medianTrendChart(payload.region.series, 'Central Oregon'),
      supplySeasons(payload.region.series, 'Central Oregon'),
      editionDescription(EDITION, payload.region.kpis),
      archiveYears([item('2026-08')]),
      medianSpark(payload.region.series),
      archiveSentence([item('2026-08'), item('2026-07', { pdf_path: null })]),
    ])
    expect(out.length).toBeGreaterThan(20)
    for (const s of out) expect(s).not.toContain('—')
  })
})
