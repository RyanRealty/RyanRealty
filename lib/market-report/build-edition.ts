/**
 * Build one monthly edition's frozen payload from the computed series.
 *
 * Pure: rows in, payload out. No I/O, no clock (the caller passes generatedAt),
 * so a given set of rows always yields the same edition and the whole builder
 * is testable without a database.
 *
 * Floors come from the Market Truth registry (docs/plans/MARKET_TRUTH/
 * REGISTRY.md §2.3): a median needs 10 sales, a share, a year-over-year change
 * or a market verdict needs 30. Under the floor the figure is withheld, never
 * estimated. Months of supply is the house formula (lib/market/classify.ts).
 */
import { STAT_BY_ID, marketVerdict as registryVerdict } from '@/lib/data/market-truth/registry'
import type { ReportBandRow, ReportSeriesRow } from '@/lib/data/market-report/series'
import { monthsOfSupply } from '@/lib/market/classify'
import { PRICE_BANDS, SUPPLY_TIERS } from './bands'
import { addMonths, lastDayOf, monthLabel, money, count, days, months1, pct, pctChange } from './format'
import {
  BEND_DISTRICTS,
  BEND_QUADRANTS,
  COMMUNITIES,
  MONTHLY_CITIES,
  QUARTERLY_TOWNS,
  REGION,
  geoKey,
  type ReportGeo,
} from './geos'
import {
  NOUN_ACREAGE,
  NOUN_CONDO,
  NOUN_DETACHED,
  NOUN_SFR,
  marketSummary,
  tierSentence,
  type HomesNoun,
} from './narrative'
import type {
  BandRowOut,
  Citation,
  EditionPayload,
  Fig,
  Kpis,
  MarketSection,
  MonthlySeries,
  Pt,
  QuarterlySeries,
  SegmentKey,
  TableRow,
  TierRowOut,
  Verdict,
} from './types'

function floor(statId: string, fallback: number): number {
  return STAT_BY_ID.get(statId)?.minN ?? fallback
}

export const FLOORS = {
  median: floor('median_close', 10),
  ppsf: floor('median_ppsf', 10),
  dtc: floor('median_days_to_contract', 10),
  stl: floor('median_sale_to_final_list', 10),
  stol: floor('median_sale_to_original_list', 10),
  priceCut: floor('pct_with_price_cut', 30),
  concession: floor('median_concession_reported', 10),
  share: floor('cash_share', 30),
  yoy: floor('yoy_median_price', 30),
  yoyCount: floor('yoy_sold_count', 30),
  mos: floor('months_of_supply', 30),
  activeList: floor('median_list_active', 10),
} as const

/** Chart lookbacks. Months: three years. Quarters: twelve years, like the region's appraiser report. */
export const MONTHLY_POINTS = 36
export const QUARTERLY_POINTS = 48
/** Days to contract is only recorded reliably from 2006 (REGISTRY: median_days_to_contract). */
export const DTC_EARLIEST = '2006-01-01'

/** Which homes each town is read by. Rural towns are mostly acreage, so all single-family homes. */
const TOWN_SEGMENT: Record<string, SegmentKey> = {
  sisters: 'sfr',
  sunriver: 'sfr',
  'la-pine': 'sfr',
  prineville: 'sfr',
  madras: 'sfr',
  terrebonne: 'detached',
  culver: 'detached',
  'powell-butte': 'detached',
  'camp-sherman': 'detached',
}

export const SEGMENT_NOUN: Record<SegmentKey, HomesNoun> = {
  sfr: NOUN_SFR,
  detached: NOUN_DETACHED,
  condo_townhome: NOUN_CONDO,
  acreage: NOUN_ACREAGE,
}

export class SeriesIndex {
  private readonly map = new Map<string, ReportSeriesRow>()
  constructor(rows: readonly ReportSeriesRow[]) {
    for (const r of rows) this.map.set(SeriesIndex.key(r.period_kind, r.period_end, `${r.geo_type}:${r.geo_slug}`, r.segment), r)
  }
  static key(kind: string, periodEnd: string, geo: string, segment: string): string {
    return `${kind}|${periodEnd}|${geo}|${segment}`
  }
  get(kind: string, periodEnd: string, geo: string, segment: string): ReportSeriesRow | undefined {
    return this.map.get(SeriesIndex.key(kind, periodEnd, geo, segment))
  }
}

export class BandIndex {
  private readonly map = new Map<string, Map<number, { closed: number; active: number }>>()
  constructor(rows: readonly ReportBandRow[]) {
    for (const r of rows) {
      const k = BandIndex.key(r.period_end, `${r.geo_type}:${r.geo_slug}`, r.segment)
      let m = this.map.get(k)
      if (!m) {
        m = new Map()
        this.map.set(k, m)
      }
      m.set(r.band_idx, { closed: r.closed_n, active: r.active_end_n })
    }
  }
  static key(periodEnd: string, geo: string, segment: string): string {
    return `${periodEnd}|${geo}|${segment}`
  }
  get(periodEnd: string, geo: string, segment: string): Map<number, { closed: number; active: number }> | undefined {
    return this.map.get(BandIndex.key(periodEnd, geo, segment))
  }
}

function fig(value: number | null | undefined, n: number, min: number): Fig {
  const ok = value != null && Number.isFinite(value) && n >= min
  return { v: ok ? Number(value) : null, n }
}

function share(numerator: number, denominator: number, min: number): Fig {
  return { v: denominator >= min ? numerator / denominator : null, n: denominator }
}

function verdictOf(mos: number | null): Verdict | null {
  return mos == null ? null : registryVerdict(mos)
}

/** Sales in the six calendar months ending with `endKey`, or null when any month is missing. */
function closedSix(idx: SeriesIndex, endKey: string, geo: string, segment: string): number | null {
  let total = 0
  for (let i = 0; i < 6; i++) {
    const row = idx.get('month', lastDayOf(addMonths(endKey, -i)), geo, segment)
    if (!row) return null
    total += row.closed_n
  }
  return total
}

function mosFor(active: number, closed6: number | null): number | null {
  if (closed6 == null || closed6 < FLOORS.mos) return null
  const m = monthsOfSupply(active, closed6)
  return m == null ? null : Math.round(m * 10) / 10
}

export function buildKpis(
  idx: SeriesIndex,
  kind: 'month' | 'trailing3' | 'trailing12',
  endKey: string,
  geo: string,
  segment: SegmentKey,
): Kpis | null {
  const end = lastDayOf(endKey)
  const row = idx.get(kind, end, geo, segment)
  if (!row) return null
  const prior = idx.get(kind, lastDayOf(addMonths(endKey, -12)), geo, segment)
  const median = fig(row.median_close, row.closed_n, FLOORS.median)
  const medianPrior = prior ? fig(prior.median_close, prior.closed_n, FLOORS.median) : { v: null, n: 0 }
  const medianYoY =
    median.v != null && medianPrior.v != null && row.closed_n >= FLOORS.yoy && (prior?.closed_n ?? 0) >= FLOORS.yoy
      ? median.v / medianPrior.v - 1
      : null
  const salesPrior = prior?.closed_n ?? 0
  const salesYoY =
    prior && row.closed_n >= FLOORS.yoyCount && salesPrior >= FLOORS.yoyCount ? row.closed_n / salesPrior - 1 : null
  const closed6 = closedSix(idx, endKey, geo, segment)
  const mos = mosFor(row.active_end_n, closed6)
  const dtcAllowed = end >= DTC_EARLIEST
  return {
    period: { kind, start: row.period_start, end },
    median,
    medianPrior,
    medianYoY,
    sales: row.closed_n,
    salesPrior,
    salesYoY,
    dtc: dtcAllowed ? fig(row.median_dtc, row.dtc_n, FLOORS.dtc) : { v: null, n: 0 },
    dtcPrior: prior && lastDayOf(addMonths(endKey, -12)) >= DTC_EARLIEST ? fig(prior.median_dtc, prior.dtc_n, FLOORS.dtc) : { v: null, n: 0 },
    ppsf: fig(row.median_ppsf, row.ppsf_n, FLOORS.ppsf),
    stl: fig(row.median_stl, row.stl_n, FLOORS.stl),
    stol: fig(row.median_stol, row.stol_n, FLOORS.stol),
    priceCutShare: share(row.price_cut_n, row.stol_n, FLOORS.priceCut),
    concessionShare: share(row.concession_with_n, row.concession_reported_n, FLOORS.share),
    concessionMedian: fig(row.median_concession, row.concession_with_n, FLOORS.concession),
    cashShare: share(row.fin_cash_n, row.fin_known_n, FLOORS.share),
    active: row.active_end_n,
    activeAssumed: row.active_end_assumed_n,
    closed6: closed6 ?? 0,
    mos,
    verdict: verdictOf(mos),
    newListings: row.new_listings_n,
    pendings: row.pendings_n,
    medianActiveList: fig(row.median_active_list, row.active_end_n, FLOORS.activeList),
  }
}

export function buildMonthlySeries(idx: SeriesIndex, endKey: string, geo: string, segment: SegmentKey): MonthlySeries {
  const months: string[] = []
  for (let i = MONTHLY_POINTS - 1; i >= 0; i--) months.push(addMonths(endKey, -i))
  const out: MonthlySeries = {
    months,
    median: [], sales: [], dtc: [], ppsf: [], mos: [], active: [], newListings: [], pendings: [],
    cash: [], conventional: [], government: [], stl: [], priceCutShare: [], concessionShare: [],
  }
  for (const k of months) {
    const end = lastDayOf(k)
    const row = idx.get('month', end, geo, segment)
    if (!row) {
      const empty: Pt = { k, v: null, n: 0 }
      for (const key of Object.keys(out) as (keyof MonthlySeries)[]) {
        if (key !== 'months') (out[key] as Pt[]).push({ ...empty })
      }
      continue
    }
    const push = (key: Exclude<keyof MonthlySeries, 'months'>, f: Fig) => out[key].push({ k, v: f.v, n: f.n })
    push('median', fig(row.median_close, row.closed_n, FLOORS.median))
    push('sales', { v: row.closed_n, n: row.closed_n })
    push('dtc', end >= DTC_EARLIEST ? fig(row.median_dtc, row.dtc_n, FLOORS.dtc) : { v: null, n: 0 })
    push('ppsf', fig(row.median_ppsf, row.ppsf_n, FLOORS.ppsf))
    const c6 = closedSix(idx, k, geo, segment)
    push('mos', { v: mosFor(row.active_end_n, c6), n: c6 ?? 0 })
    push('active', { v: row.active_end_n, n: row.active_end_n })
    push('newListings', { v: row.new_listings_n, n: row.new_listings_n })
    push('pendings', { v: row.pendings_n, n: row.pendings_n })
    push('cash', share(row.fin_cash_n, row.fin_known_n, FLOORS.share))
    push('conventional', share(row.fin_conventional_n, row.fin_known_n, FLOORS.share))
    push('government', share(row.fin_government_n, row.fin_known_n, FLOORS.share))
    push('stl', fig(row.median_stl, row.stl_n, FLOORS.stl))
    push('priceCutShare', share(row.price_cut_n, row.stol_n, FLOORS.priceCut))
    push('concessionShare', share(row.concession_with_n, row.concession_reported_n, FLOORS.share))
  }
  return out
}

/** Quarter ends up to and including the last complete quarter at or before endKey. */
export function quarterEnds(endKey: string, count: number): string[] {
  const y = Number(endKey.slice(0, 4))
  const m = Number(endKey.slice(5, 7))
  const lastQuarterMonth = m - (m % 3)
  let key = lastQuarterMonth === 0 ? `${y - 1}-12` : `${y}-${String(lastQuarterMonth).padStart(2, '0')}`
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(lastDayOf(key))
    key = addMonths(key, -3)
  }
  return out.reverse()
}

export function buildQuarterlySeries(idx: SeriesIndex, endKey: string, geo: string, segment: SegmentKey): QuarterlySeries {
  const quarters = quarterEnds(endKey, QUARTERLY_POINTS).filter((q) => q >= '1997-03-31')
  const out: QuarterlySeries = { quarters, median: [], sales: [], dtc: [], median12: [], dtc12: [] }
  for (const q of quarters) {
    const row = idx.get('quarter', q, geo, segment)
    const row12 = idx.get('trailing12', q, geo, segment)
    if (row12) {
      out.median12.push({ k: q, ...fig(row12.median_close, row12.closed_n, FLOORS.median) })
      out.dtc12.push({ k: q, ...(q >= DTC_EARLIEST ? fig(row12.median_dtc, row12.dtc_n, FLOORS.dtc) : { v: null, n: 0 }) })
    } else {
      out.median12.push({ k: q, v: null, n: 0 })
      out.dtc12.push({ k: q, v: null, n: 0 })
    }
    if (!row) {
      out.median.push({ k: q, v: null, n: 0 })
      out.sales.push({ k: q, v: null, n: 0 })
      out.dtc.push({ k: q, v: null, n: 0 })
      continue
    }
    out.median.push({ k: q, ...fig(row.median_close, row.closed_n, FLOORS.median) })
    out.sales.push({ k: q, v: row.closed_n, n: row.closed_n })
    out.dtc.push({ k: q, ...(q >= DTC_EARLIEST ? fig(row.median_dtc, row.dtc_n, FLOORS.dtc) : { v: null, n: 0 }) })
  }
  return out
}

export function buildBands(
  bands: BandIndex,
  endKey: string,
  geo: string,
  segment: SegmentKey,
): { rows: BandRowOut[]; tiers: TierRowOut[] } | null {
  const monthMap = bands.get(lastDayOf(endKey), geo, segment)
  if (!monthMap) return null
  const sum = (months: number, idxBand: number) => {
    let total = 0
    for (let i = 0; i < months; i++) {
      total += bands.get(lastDayOf(addMonths(endKey, -i)), geo, segment)?.get(idxBand)?.closed ?? 0
    }
    return total
  }
  const all: BandRowOut[] = PRICE_BANDS.map((b) => {
    const cur = monthMap.get(b.idx)
    const sales6 = sum(6, b.idx)
    const active = cur?.active ?? 0
    const mos = mosFor(active, sales6)
    return {
      idx: b.idx,
      label: b.label,
      short: b.short,
      salesMonth: cur?.closed ?? 0,
      sales12: sum(12, b.idx),
      sales6,
      active,
      mos,
      verdict: verdictOf(mos),
    }
  })
  const live = all.filter((r) => r.sales12 > 0 || r.active > 0)
  if (live.length === 0) return null
  const first = live[0]!.idx
  const last = live[live.length - 1]!.idx
  const rows = all.filter((r) => r.idx >= first && r.idx <= last)
  const tiers: TierRowOut[] = SUPPLY_TIERS.map((t) => {
    let sales6 = 0
    let active = 0
    for (const r of all) {
      if (r.idx >= t.from && r.idx <= t.to) {
        sales6 += r.sales6
        active += r.active
      }
    }
    const mos = mosFor(active, sales6)
    return { key: t.key, label: t.label, sales6, active, mos, verdict: verdictOf(mos) }
  }).filter((t) => t.sales6 > 0 || t.active > 0)
  return { rows, tiers }
}

function cite(
  out: Citation[],
  figure: string,
  value: string,
  row: ReportSeriesRow | undefined,
  column: string,
  definitionId: string,
) {
  if (!row || value === '–') return
  out.push({
    figure,
    value,
    source: 'Supabase public.market_report_series (Market Truth facts: market_fact_sale, market_fact_listing_span, place_membership)',
    filter: `definition ${definitionId} · ${row.geo_type} ${row.geo_slug} · segment ${row.segment} · ${row.period_kind} ${row.period_start}..${row.period_end} · column ${column}`,
    rows: column.startsWith('active') ? row.active_end_n : row.closed_n,
    computedAt: row.computed_at,
  })
}

function citeKpis(
  out: Citation[],
  place: string,
  segLabel: string,
  k: Kpis,
  idx: SeriesIndex,
  geo: string,
  segment: SegmentKey,
  definitionId: string,
) {
  const row = idx.get(k.period.kind, k.period.end, geo, segment)
  const when = monthLabel(k.period.end.slice(0, 7))
  const window = k.period.kind === 'month' ? when : k.period.kind === 'trailing3' ? `3 months to ${when}` : `12 months to ${when}`
  const tag = `${place} ${segLabel}, ${window}`
  cite(out, `${tag}: median sale price`, money(k.median.v), row, 'median_close', definitionId)
  cite(out, `${tag}: homes sold`, count(k.sales), row, 'closed_n', definitionId)
  cite(out, `${tag}: median days to contract`, k.dtc.v == null ? '–' : days(k.dtc.v), row, 'median_dtc', definitionId)
  cite(out, `${tag}: homes for sale at period end`, count(k.active), row, 'active_end_n', definitionId)
  if (k.medianYoY != null) cite(out, `${tag}: median change from a year earlier`, pctChange(k.medianYoY), row, 'median_close (vs same window prior year)', definitionId)
  if (k.mos != null) {
    cite(out, `${tag}: months of supply`, months1(k.mos), row, `active_end_n / (six-month sales ${k.closed6} / 6)`, definitionId)
  }
  if (k.stl.v != null) cite(out, `${tag}: median sale-to-list`, pct(k.stl.v, 1), row, 'median_stl', definitionId)
}

export type BuildEditionInput = {
  editionMonth: string
  series: readonly ReportSeriesRow[]
  bands: readonly ReportBandRow[]
  generatedAt: string
  definitionId: string
}

/** The series rows an edition reads: the window to fetch before calling buildEdition. */
export function editionFetchWindow(editionMonth: string): { fromEnd: string; toEnd: string } {
  // 36 chart months, six more for the first point's months of supply, twelve
  // more for year-over-year, and the quarterly lookback for the towns.
  const monthsBack = Math.max(MONTHLY_POINTS + 6 + 12, QUARTERLY_POINTS * 3 + 12)
  return { fromEnd: lastDayOf(addMonths(editionMonth, -monthsBack)), toEnd: lastDayOf(editionMonth) }
}

export function editionSlug(editionMonth: string): string {
  return `central-oregon-${editionMonth}`
}

export function editionTitle(editionMonth: string): string {
  return `Central Oregon Market Report: ${monthLabel(editionMonth)}`
}

function row(geo: ReportGeo, segment: SegmentKey, k: Kpis | null): TableRow | null {
  return k ? { geo, segment, kpis: k } : null
}

export function buildEdition(input: BuildEditionInput): EditionPayload {
  const { editionMonth, definitionId } = input
  const idx = new SeriesIndex(input.series)
  const bandIdx = new BandIndex(input.bands)
  const citations: Citation[] = []
  const end = lastDayOf(editionMonth)

  const regionKey = geoKey(REGION)
  const regionKpis = buildKpis(idx, 'month', editionMonth, regionKey, 'sfr')
  const regionKpis12 = buildKpis(idx, 'trailing12', editionMonth, regionKey, 'sfr')
  if (!regionKpis || !regionKpis12) {
    throw new Error(`[buildEdition ${editionMonth}] the region's series is missing for ${end}; compute the period first`)
  }
  const region: MarketSection = {
    geo: REGION,
    segment: 'sfr',
    cadence: 'monthly',
    kpis: regionKpis,
    kpis12: regionKpis12,
    series: buildMonthlySeries(idx, editionMonth, regionKey, 'sfr'),
    summary: marketSummary('Central Oregon', NOUN_SFR, regionKpis),
  }
  citeKpis(citations, 'Central Oregon', 'single-family (under 1 acre)', regionKpis, idx, regionKey, 'sfr', definitionId)

  const monthly: MarketSection[] = []
  for (const geo of MONTHLY_CITIES) {
    const key = geoKey(geo)
    const kpis = buildKpis(idx, 'month', editionMonth, key, 'sfr')
    const kpis12 = buildKpis(idx, 'trailing12', editionMonth, key, 'sfr')
    if (!kpis || !kpis12) continue
    const b = buildBands(bandIdx, editionMonth, key, 'sfr')
    const summary = marketSummary(geo.label, NOUN_SFR, kpis)
    const split = b ? tierSentence(b.tiers) : null
    if (split) summary.push(split)
    monthly.push({
      geo,
      segment: 'sfr',
      cadence: 'monthly',
      kpis,
      kpis12,
      series: buildMonthlySeries(idx, editionMonth, key, 'sfr'),
      bands: b?.rows,
      tiers: b?.tiers,
      summary,
    })
    citeKpis(citations, geo.label, 'single-family (under 1 acre)', kpis, idx, key, 'sfr', definitionId)
    citeKpis(citations, geo.label, 'single-family (under 1 acre)', kpis12, idx, key, 'sfr', definitionId)
  }

  const towns: MarketSection[] = []
  for (const geo of QUARTERLY_TOWNS) {
    const key = geoKey(geo)
    const seg = TOWN_SEGMENT[geo.slug] ?? 'sfr'
    const kpis = buildKpis(idx, 'trailing3', editionMonth, key, seg)
    const kpis12 = buildKpis(idx, 'trailing12', editionMonth, key, seg)
    if (!kpis || !kpis12) continue
    towns.push({
      geo,
      segment: seg,
      cadence: 'quarterly',
      kpis,
      kpis12,
      quarterly: buildQuarterlySeries(idx, editionMonth, key, seg),
      summary: marketSummary(geo.label, SEGMENT_NOUN[seg], kpis),
    })
    const segLabel = seg === 'sfr' ? 'single-family (under 1 acre)' : 'single-family (any lot size)'
    citeKpis(citations, geo.label, segLabel, kpis, idx, key, seg, definitionId)
    citeKpis(citations, geo.label, segLabel, kpis12, idx, key, seg, definitionId)
  }

  const overview: TableRow[] = [
    { geo: REGION, segment: 'sfr', kpis: regionKpis },
    ...monthly.map((s) => ({ geo: s.geo, segment: s.segment, kpis: s.kpis })),
    ...towns.map((s) => ({ geo: s.geo, segment: s.segment, kpis: s.kpis })),
  ]

  const table12 = (geos: readonly ReportGeo[], seg: SegmentKey, place: string, segLabel: string): TableRow[] => {
    const out: TableRow[] = []
    for (const geo of geos) {
      const key = geoKey(geo)
      const k = buildKpis(idx, 'trailing12', editionMonth, key, seg)
      const r = row(geo, seg, k)
      if (!r) continue
      out.push(r)
      citeKpis(citations, `${place}${geo.label}`, segLabel, r.kpis, idx, key, seg, definitionId)
    }
    return out
  }

  const quadrants = table12(BEND_QUADRANTS, 'sfr', '', 'single-family (under 1 acre)')
  const districts = BEND_DISTRICTS.flatMap((d) => {
    const r = table12([d], 'sfr', 'Bend, ', 'single-family (under 1 acre)')[0]
    return r ? [{ ...r, quadrant: d.quadrant }] : []
  })
  const communities = COMMUNITIES.flatMap((c) => {
    const r = table12([c], 'detached', '', 'single-family (any lot size)')[0]
    return r ? [{ ...r, near: c.near }] : []
  })

  const bigMarkets: ReportGeo[] = [REGION, ...MONTHLY_CITIES, ...QUARTERLY_TOWNS.filter((t) => TOWN_SEGMENT[t.slug] === 'sfr')]
  const condoTownhome = table12(bigMarkets, 'condo_townhome', '', 'condos and townhomes')
  const acreageGeos: ReportGeo[] = [REGION, ...MONTHLY_CITIES, ...QUARTERLY_TOWNS.filter((t) => t.slug !== 'sunriver')]
  const acreage = table12(acreageGeos, 'acreage', '', 'homes on 1+ acre')

  const bendKey = geoKey(MONTHLY_CITIES[0]!)
  const condoSeries = idx.get('month', end, bendKey, 'condo_townhome')
    ? { geo: MONTHLY_CITIES[0]!, series: buildMonthlySeries(idx, editionMonth, bendKey, 'condo_townhome') }
    : null

  const completeThrough = [...input.series]
    .filter((r) => r.period_end === end)
    .map((r) => r.complete_through)
    .sort()
    .at(-1) ?? end

  const headline = buildHeadline(region, monthly)

  return {
    version: 1,
    definitionId,
    editionMonth,
    title: editionTitle(editionMonth),
    generatedAt: input.generatedAt,
    dataCompleteThrough: completeThrough,
    region,
    headline,
    overview,
    monthly,
    towns,
    quadrants,
    districts,
    communities,
    condoTownhome,
    acreage,
    condoSeries,
    citations,
  }
}

/** The cover's three sentences: the region, then Bend and Redmond in one line each. */
function buildHeadline(region: MarketSection, monthly: readonly MarketSection[]): string[] {
  const out = [...region.summary.slice(0, 2)]
  for (const s of monthly) {
    const k = s.kpis
    if (k.median.v == null) continue
    const change = k.medianYoY != null ? ` (${pctChange(k.medianYoY)} from a year earlier)` : ''
    const speed = k.dtc.v != null ? `, and the typical home went under contract in ${days(k.dtc.v)}` : ''
    out.push(`${s.geo.label}: ${count(k.sales)} sales at a median of ${money(k.median.v)}${change}${speed}.`)
  }
  return out
}

