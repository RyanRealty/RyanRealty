/**
 * The Spark × Supabase reconciliation gate for a monthly edition (CLAUDE.md §0).
 *
 * §0: before an edition renders, every figure it prints that Spark can also
 * produce is recomputed from Spark, both values are printed with the delta,
 * and the edition stops (held as a draft, the owner alerted) when any delta is
 * over 1%.
 *
 * What Spark can produce: closed-sale counts and median close prices for a
 * market drawn by MLS city text (the region, the cities, the towns), per
 * segment, for any run of months, and the same counts per price band. Every
 * such figure the edition prints is checked: each market's headline window,
 * the same window a year earlier (the base of every year-over-year change),
 * the six months behind months of supply, the chart points the daily refresh
 * can still move (the last 13 months, the last four quarters), and the
 * supply-by-price-band counts. What Spark cannot produce: homes for sale on a
 * past day (it keeps a listing's current status, not its status history) and
 * the polygon geographies (quadrants, districts, communities), which it has no
 * boundary for. Those rest on the same sales and on-market episodes this gate
 * checks at the city level.
 *
 * A failure is diagnosed by listing key against the sales the edition counts
 * (`market_report_sale`): a closing Spark holds that we lack, one we count
 * that Spark places in another city, month or segment, and a sale whose close
 * price differs. Each of those is held to the same 1%.
 *
 * Spark's side takes the method's documented exclusions and nothing else: a
 * closing our sale facts mark unpublishable (a duplicate parcel entry, a price
 * typo) leaves Spark's count too, and the number left out is reported.
 */
import {
  getFactSaleStatus,
  getReportSalesInWindow,
  getServiceAreaCities,
  type ReportSaleRow,
} from '@/lib/data/market-report/reconcile'
import { fetchSparkListingsPage } from '@/lib/spark'
import { dateOnly, factsFromSparkFields } from '@/lib/sync/listingDrift'
import { bandIdx, PRICE_BANDS } from './bands'
import { addMonths, lastDayOf } from './format'
import { REGION, geoKey, type ReportGeo } from './geos'
import type { Citation, EditionPayload, Kpis, MonthlySeries, Pt, SegmentKey } from './types'

export const RECONCILE_TOLERANCE = 0.01

/** A detached home on this many acres or more is read as acreage (compute_market_report_period p_acreage_min). */
export const ACREAGE_MIN_ACRES = 1

/** Chart points re-checked each edition: the months the daily refresh recomputes. */
export const SERIES_RECHECK_MONTHS = 13
export const SERIES_RECHECK_QUARTERS = 4

/** Pages of 1,000 one month of residential closings may take before the pull refuses to guess. */
const MAX_PAGES_PER_MONTH = 20

const SPARK_SELECT = 'ListingKey,City,PropertyType,PropertySubType,StandardStatus,CloseDate,ClosePrice,LotSizeAcres'

/** One closed sale, as the gate compares it: which report segments and geographies it falls in. */
export type GateSale = {
  key: string
  date: string
  price: number | null
  segs: readonly SegmentKey[]
  geos: readonly string[]
}

/** A figure the edition prints that Spark can also produce. */
export type PrintedFigure = {
  label: string
  geo: string
  segment: SegmentKey
  from: string
  to: string
  /** Price band index (bands.ts); the figure counts only sales in the band. */
  band: number | null
  /** Printed sale count; null when this entry prints no count. */
  sales: number | null
  /** Printed median close price; null when withheld under the floor or not printed. */
  median: number | null
}

export type FigureCheck = PrintedFigure & {
  spark: { sales: number; median: number | null }
  salesDelta: number | null
  medianDelta: number | null
  missingFromUs: string[]
  extraInOurs: string[]
  priceMismatches: string[]
  excludedByMethod: number
  ok: boolean
}

export type EditionReconciliation = {
  month: string
  checkedAt: string
  window: { from: string; to: string }
  /** Residential closings Spark holds in the region across the checked window. */
  sparkSales: number
  checks: FigureCheck[]
  /** Printed twice in the edition with two different values (a build defect, always a failure). */
  inconsistencies: string[]
  ok: boolean
}

const SEGMENT_LABEL: Record<SegmentKey, string> = {
  sfr: 'single-family under 1 acre',
  detached: 'single-family, any lot size',
  acreage: 'single-family on 1+ acre',
  condo_townhome: 'condos and townhomes',
}

// ---------------------------------------------------------------------------
// Classification: the same rules the report store applies.
// ---------------------------------------------------------------------------

function toNum(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/** Report segments for a residential sale: market_fact_sale_segment, then the lot-size split. */
export function segmentsFor(subType: string | null, lotAcres: number | null): SegmentKey[] {
  if (subType === 'Single Family Residence') {
    return (lotAcres ?? 0) >= ACREAGE_MIN_ACRES ? ['acreage', 'detached'] : ['sfr', 'detached']
  }
  if (subType === 'Condominium' || subType === 'Townhouse') return ['condo_townhome']
  return []
}

/** Lower-cased MLS city → the city slug place membership gives it, for the service area. */
export type ServiceAreaIndex = ReadonlyMap<string, string>

export function serviceAreaIndex(rows: readonly { city: string; slug: string }[]): ServiceAreaIndex {
  return new Map(rows.map((r) => [r.city.trim().toLowerCase(), r.slug]))
}

/**
 * A Spark closing as the gate reads it, or null when it is outside what the
 * report counts (not residential detached, condo or townhome; not closed;
 * outside the service area).
 */
export function sparkSale(fields: Record<string, unknown>, serviceArea: ServiceAreaIndex): GateSale | null {
  const key = typeof fields.ListingKey === 'string' ? fields.ListingKey : null
  if (!key || fields.PropertyType !== 'A') return null
  const facts = factsFromSparkFields(fields)
  if (facts.status !== 'Closed' || !facts.closeDate) return null
  const segs = segmentsFor(facts.subType, toNum(fields.LotSizeAcres))
  if (segs.length === 0) return null
  const slug = facts.city ? serviceArea.get(facts.city.toLowerCase()) : undefined
  if (!slug) return null
  return { key, date: facts.closeDate, price: facts.closePrice, segs, geos: [geoKey(REGION), `city:${slug}`] }
}

/** A report sale row as the gate reads it. */
export function reportSale(row: ReportSaleRow): GateSale {
  const segs: SegmentKey[] =
    row.base_segment === 'detached'
      ? segmentsFor('Single Family Residence', row.lot_acres)
      : row.base_segment === 'condo' || row.base_segment === 'townhome'
        ? ['condo_townhome']
        : []
  return { key: row.listing_key, date: dateOnly(row.close_date) ?? row.close_date, price: row.close_price, segs, geos: row.geos }
}

// ---------------------------------------------------------------------------
// The figures an edition prints that Spark can reproduce.
// ---------------------------------------------------------------------------

function cityLevel(geo: ReportGeo): boolean {
  return geo.type === 'region' || geo.type === 'city'
}

function monthStart(key: string): string {
  return `${key.slice(0, 7)}-01`
}

function windowLabel(from: string, to: string): string {
  const a = from.slice(0, 7)
  const b = to.slice(0, 7)
  return a === b ? b : `${a} to ${b}`
}

function kpiFigures(geo: ReportGeo, segment: SegmentKey, k: Kpis): PrintedFigure[] {
  const g = geoKey(geo)
  const name = `${geo.label}, ${SEGMENT_LABEL[segment]}`
  const endMonth = k.period.end.slice(0, 7)
  const startMonth = k.period.start.slice(0, 7)
  const priorFrom = monthStart(addMonths(startMonth, -12))
  const priorTo = lastDayOf(addMonths(endMonth, -12))
  const sixFrom = monthStart(addMonths(endMonth, -5))
  return [
    {
      label: `${name}, ${windowLabel(k.period.start, k.period.end)}`,
      geo: g, segment, band: null,
      from: k.period.start, to: k.period.end,
      sales: k.sales, median: k.median.v,
    },
    {
      label: `${name}, ${windowLabel(priorFrom, priorTo)} (a year earlier)`,
      geo: g, segment, band: null,
      from: priorFrom, to: priorTo,
      sales: k.salesPrior, median: k.medianPrior.v,
    },
    {
      label: `${name}, ${windowLabel(sixFrom, k.period.end)} (months-of-supply base)`,
      geo: g, segment, band: null,
      from: sixFrom, to: k.period.end,
      sales: k.closed6, median: null,
    },
  ]
}

function monthlySeriesFigures(geo: ReportGeo, segment: SegmentKey, s: MonthlySeries): PrintedFigure[] {
  const out: PrintedFigure[] = []
  const g = geoKey(geo)
  const at = (pts: Pt[], k: string) => pts.find((p) => p.k === k)
  for (const k of s.months.slice(-SERIES_RECHECK_MONTHS)) {
    const sales = at(s.sales, k)
    const median = at(s.median, k)
    // A month with no stored row prints as a gap, not a figure.
    if (sales?.v == null) continue
    out.push({
      label: `${geo.label}, ${SEGMENT_LABEL[segment]}, ${k} (chart)`,
      geo: g, segment, band: null,
      from: monthStart(k), to: lastDayOf(k),
      sales: sales.v, median: median?.v ?? null,
    })
  }
  return out
}

/** Every figure the edition prints that Spark can reproduce, deduplicated by population. */
export function printedFigures(p: EditionPayload): { figures: PrintedFigure[]; inconsistencies: string[] } {
  const raw: PrintedFigure[] = []
  const sections = [p.region, ...p.monthly, ...p.towns]
  for (const s of sections) {
    if (!cityLevel(s.geo)) continue
    raw.push(...kpiFigures(s.geo, s.segment, s.kpis), ...kpiFigures(s.geo, s.segment, s.kpis12))
    if (s.series) raw.push(...monthlySeriesFigures(s.geo, s.segment, s.series))
    if (s.quarterly) {
      const q = s.quarterly
      for (const end of q.quarters.slice(-SERIES_RECHECK_QUARTERS)) {
        const endMonth = end.slice(0, 7)
        const sales = q.sales.find((x) => x.k === end)
        const median = q.median.find((x) => x.k === end)
        if (sales?.v != null) {
          raw.push({
            label: `${s.geo.label}, ${SEGMENT_LABEL[s.segment]}, quarter to ${endMonth} (chart)`,
            geo: geoKey(s.geo), segment: s.segment, band: null,
            from: monthStart(addMonths(endMonth, -2)), to: lastDayOf(endMonth),
            sales: sales.v, median: median?.v ?? null,
          })
        }
        const m12 = q.median12.find((x) => x.k === end)
        if (m12?.v != null) {
          raw.push({
            label: `${s.geo.label}, ${SEGMENT_LABEL[s.segment]}, 12 months to ${endMonth} (chart)`,
            geo: geoKey(s.geo), segment: s.segment, band: null,
            from: monthStart(addMonths(endMonth, -11)), to: lastDayOf(endMonth),
            sales: null, median: m12.v,
          })
        }
      }
    }
    if (s.bands) {
      const end = s.kpis.period.end
      const endMonth = end.slice(0, 7)
      for (const b of s.bands) {
        const band = PRICE_BANDS[b.idx]
        const name = `${s.geo.label}, ${SEGMENT_LABEL[s.segment]}, ${band?.label ?? `band ${b.idx}`}`
        const windows: [string, number][] = [
          [monthStart(endMonth), b.salesMonth],
          [monthStart(addMonths(endMonth, -5)), b.sales6],
          [monthStart(addMonths(endMonth, -11)), b.sales12],
        ]
        for (const [from, sales] of windows) {
          raw.push({
            label: `${name}, ${windowLabel(from, end)}`,
            geo: geoKey(s.geo), segment: s.segment, band: b.idx,
            from, to: end, sales, median: null,
          })
        }
      }
    }
  }
  for (const r of [...p.overview, ...p.condoTownhome, ...p.acreage]) {
    if (cityLevel(r.geo)) raw.push(...kpiFigures(r.geo, r.segment, r.kpis))
  }
  if (p.condoSeries && cityLevel(p.condoSeries.geo)) {
    raw.push(...monthlySeriesFigures(p.condoSeries.geo, 'condo_townhome', p.condoSeries.series))
  }

  // One check per population. The same window printed twice must print the
  // same numbers; if it does not, that is a build defect and fails the gate.
  const byKey = new Map<string, PrintedFigure>()
  const inconsistencies: string[] = []
  for (const f of raw) {
    const key = `${f.geo}|${f.segment}|${f.from}|${f.to}|${f.band ?? ''}`
    const seen = byKey.get(key)
    if (!seen) {
      byKey.set(key, { ...f })
      continue
    }
    if (f.sales != null && seen.sales != null && f.sales !== seen.sales) {
      inconsistencies.push(`${f.label}: sales printed as ${seen.sales} and ${f.sales}`)
    }
    if (f.median != null && seen.median != null && f.median !== seen.median) {
      inconsistencies.push(`${f.label}: median printed as ${seen.median} and ${f.median}`)
    }
    seen.sales ??= f.sales
    seen.median ??= f.median
  }
  return { figures: [...byKey.values()], inconsistencies }
}

// ---------------------------------------------------------------------------
// The comparison.
// ---------------------------------------------------------------------------

/** Median as SQL percentile_cont(0.5): the mean of the two middle values when the count is even. */
export function medianOf(values: readonly number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (v.length === 0) return null
  const pos = (v.length - 1) / 2
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return v[lo]! + (v[hi]! - v[lo]!) * (pos - lo)
}

/** |spark − ours| / spark; a figure present on one side only is a full miss. */
export function relDelta(spark: number | null, ours: number | null): number {
  if (spark == null || ours == null) return spark == null && ours == null ? 0 : 1
  if (spark === 0) return ours === 0 ? 0 : 1
  return Math.abs(spark - ours) / Math.abs(spark)
}

function inPopulation(s: GateSale, f: PrintedFigure): boolean {
  return (
    s.date >= f.from &&
    s.date <= f.to &&
    s.geos.includes(f.geo) &&
    s.segs.includes(f.segment) &&
    (f.band == null || bandIdx(s.price) === f.band)
  )
}

/**
 * Check each printed figure against Spark. `excluded` holds the Spark keys our
 * sale facts mark unpublishable (the method's own exclusions).
 */
/** Sales bucketed by close month, so a figure scans only the months it covers. */
function byMonth(sales: readonly GateSale[]): Map<string, GateSale[]> {
  const out = new Map<string, GateSale[]>()
  for (const s of sales) {
    const k = s.date.slice(0, 7)
    const list = out.get(k)
    if (list) list.push(s)
    else out.set(k, [s])
  }
  return out
}

function inWindow(index: Map<string, GateSale[]>, f: PrintedFigure): GateSale[] {
  const out: GateSale[] = []
  for (let k = f.from.slice(0, 7); k <= f.to.slice(0, 7); k = addMonths(k, 1)) {
    for (const s of index.get(k) ?? []) if (inPopulation(s, f)) out.push(s)
  }
  return out
}

export function checkFigures(
  figures: readonly PrintedFigure[],
  spark: readonly GateSale[],
  ours: readonly GateSale[],
  excluded: ReadonlySet<string>,
  tolerance = RECONCILE_TOLERANCE,
): FigureCheck[] {
  const sparkIndex = byMonth(spark)
  const ourIndex = byMonth(ours)
  return figures.map((f) => {
    const sparkAll = inWindow(sparkIndex, f)
    const sp = sparkAll.filter((s) => !excluded.has(s.key))
    const ou = inWindow(ourIndex, f)
    const ourByKey = new Map(ou.map((s) => [s.key, s]))
    const sparkKeys = new Set(sp.map((s) => s.key))
    const missingFromUs = sp.filter((s) => !ourByKey.has(s.key)).map((s) => s.key)
    const extraInOurs = ou.filter((s) => !sparkKeys.has(s.key)).map((s) => s.key)
    let matched = 0
    const priceMismatches: string[] = []
    for (const s of sp) {
      const o = ourByKey.get(s.key)
      if (!o) continue
      matched++
      if (s.price != null && o.price != null && Math.abs(s.price - o.price) >= 1) priceMismatches.push(s.key)
    }
    const sparkMedian = medianOf(sp.flatMap((s) => (s.price == null ? [] : [s.price])))
    const salesDelta = f.sales == null ? null : relDelta(sp.length, f.sales)
    const medianDelta = f.median == null ? null : relDelta(sparkMedian, f.median)
    const share = (n: number, of: number) => (of === 0 ? (n === 0 ? 0 : 1) : n / of)
    const ok =
      (salesDelta == null || salesDelta <= tolerance) &&
      (medianDelta == null || medianDelta <= tolerance) &&
      share(missingFromUs.length, sp.length) <= tolerance &&
      share(extraInOurs.length, sp.length) <= tolerance &&
      share(priceMismatches.length, matched) <= tolerance
    return {
      ...f,
      spark: { sales: sp.length, median: sparkMedian },
      salesDelta,
      medianDelta,
      missingFromUs,
      extraInOurs,
      priceMismatches,
      excludedByMethod: sparkAll.length - sp.length,
      ok,
    }
  })
}

// ---------------------------------------------------------------------------
// Sources: Spark and the report store, one month at a time, memoized so a
// backfill that gates every edition pulls each month once.
// ---------------------------------------------------------------------------

export type ReconcileSources = {
  sparkMonth: (month: string) => Promise<GateSale[]>
  oursMonth: (month: string) => Promise<GateSale[]>
  /** Of these keys, the ones our sale facts hold as unpublishable. */
  unpublishable: (keys: string[]) => Promise<Set<string>>
}

function sparkToken(): string {
  const t = (process.env.SPARK_API_KEY ?? '').trim()
  if (!t) throw new Error('[reconcileEdition] SPARK_API_KEY is not set')
  return t
}

async function fetchSparkMonth(month: string, serviceArea: ServiceAreaIndex): Promise<GateSale[]> {
  const filter = [
    "PropertyType Eq 'A'",
    "StandardStatus Eq 'Closed'",
    `CloseDate Ge ${monthStart(month)}`,
    `CloseDate Le ${lastDayOf(month)}`,
  ].join(' And ')
  const out: GateSale[] = []
  for (let page = 1; ; page++) {
    const res = await fetchSparkListingsPage(sparkToken(), { page, limit: 1000, filter, select: SPARK_SELECT, orderby: '+ListingKey' })
    for (const r of res.D?.Results ?? []) {
      const sale = sparkSale((r.StandardFields ?? {}) as unknown as Record<string, unknown>, serviceArea)
      if (sale) out.push(sale)
    }
    const pages = res.D?.Pagination?.TotalPages ?? 1
    if (page >= pages) break
    if (page >= MAX_PAGES_PER_MONTH) {
      throw new Error(`[reconcileEdition] ${month} runs past ${MAX_PAGES_PER_MONTH} pages of closings`)
    }
  }
  return out
}

/** Live sources. Pass one instance to every edition of a backfill so each month is pulled once. */
export function liveReconcileSources(): ReconcileSources {
  let serviceArea: Promise<ServiceAreaIndex> | null = null
  const sparkMonths = new Map<string, Promise<GateSale[]>>()
  const ourMonths = new Map<string, Promise<GateSale[]>>()
  const memo = (cache: Map<string, Promise<GateSale[]>>, month: string, load: () => Promise<GateSale[]>) => {
    let p = cache.get(month)
    if (!p) {
      p = load()
      // A failed pull is not cached: the next edition tries again.
      p.catch(() => cache.delete(month))
      cache.set(month, p)
    }
    return p
  }
  const area = (): Promise<ServiceAreaIndex> => {
    if (!serviceArea) {
      const p = getServiceAreaCities().then(serviceAreaIndex)
      p.catch(() => {
        serviceArea = null
      })
      serviceArea = p
    }
    return serviceArea
  }
  return {
    sparkMonth: (month) => memo(sparkMonths, month, async () => fetchSparkMonth(month, await area())),
    oursMonth: (month) =>
      memo(ourMonths, month, async () => (await getReportSalesInWindow(monthStart(month), lastDayOf(month))).map(reportSale)),
    unpublishable: async (keys) => {
      const status = await getFactSaleStatus(keys)
      return new Set([...status.values()].filter((s) => !s.is_publishable).map((s) => s.listing_key))
    },
  }
}

/** Run the gate over one edition's payload. */
export async function reconcileEdition(
  payload: EditionPayload,
  sources: ReconcileSources = liveReconcileSources(),
): Promise<EditionReconciliation> {
  const { figures, inconsistencies } = printedFigures(payload)
  const from = figures.reduce((m, f) => (f.from < m ? f.from : m), monthStart(payload.editionMonth))
  const to = figures.reduce((m, f) => (f.to > m ? f.to : m), lastDayOf(payload.editionMonth))
  const months: string[] = []
  for (let k = from.slice(0, 7); k <= to.slice(0, 7); k = addMonths(k, 1)) months.push(k)

  const spark: GateSale[] = []
  const ours: GateSale[] = []
  // Months run in small groups: a two-year window is 24 Spark pages, and the
  // delta sync shares this key.
  for (let i = 0; i < months.length; i += 4) {
    const group = months.slice(i, i + 4)
    const [s, o] = await Promise.all([
      Promise.all(group.map((m) => sources.sparkMonth(m))),
      Promise.all(group.map((m) => sources.oursMonth(m))),
    ])
    for (const x of s) spark.push(...x)
    for (const x of o) ours.push(...x)
  }

  const ourKeys = new Set(ours.map((s) => s.key))
  const absent = [...new Set(spark.filter((s) => !ourKeys.has(s.key)).map((s) => s.key))]
  const excluded = absent.length > 0 ? await sources.unpublishable(absent) : new Set<string>()

  const checks = checkFigures(figures, spark, ours, excluded)
  return {
    month: payload.editionMonth,
    checkedAt: new Date().toISOString(),
    window: { from, to },
    sparkSales: new Set(spark.map((s) => s.key)).size,
    checks,
    inconsistencies,
    ok: inconsistencies.length === 0 && checks.every((c) => c.ok),
  }
}

// ---------------------------------------------------------------------------
// Reporting.
// ---------------------------------------------------------------------------

function pctText(d: number | null): string {
  return d == null ? 'n/a' : `${(d * 100).toFixed(1)}%`
}

function moneyText(v: number | null): string {
  return v == null ? 'withheld' : `$${Math.round(v).toLocaleString('en-US')}`
}

/** One line per check: both values and the delta for each figure, the key-level differences, PASS or FAIL. */
export function checkLine(c: FigureCheck): string {
  const parts: string[] = []
  if (c.sales != null) parts.push(`sales Spark ${c.spark.sales}, printed ${c.sales} (${pctText(c.salesDelta)})`)
  if (c.median != null) parts.push(`median Spark ${moneyText(c.spark.median)}, printed ${moneyText(c.median)} (${pctText(c.medianDelta)})`)
  const keys = `missing ${c.missingFromUs.length}, extra ${c.extraInOurs.length}, price differs ${c.priceMismatches.length}, excluded by method ${c.excludedByMethod}`
  return `${c.ok ? 'PASS' : 'FAIL'} ${c.label}: ${parts.join('; ')}; ${keys}`
}

/** A short summary: how many figures, how many over the tolerance, the largest delta. */
export function reconciliationSummary(r: EditionReconciliation): string {
  const failed = r.checks.filter((c) => !c.ok).length
  const deltas = r.checks.flatMap((c) => [c.salesDelta, c.medianDelta]).filter((d): d is number => d != null)
  const largest = deltas.length ? Math.max(...deltas) : 0
  const figures = r.checks.reduce((n, c) => n + (c.sales != null ? 1 : 0) + (c.median != null ? 1 : 0), 0)
  return (
    `Spark cross-check ${r.month}: ${figures} figures in ${r.checks.length} populations, ` +
    `${failed} over ${pctText(RECONCILE_TOLERANCE)}, largest delta ${pctText(largest)}` +
    (r.inconsistencies.length ? `, ${r.inconsistencies.length} printed twice with different values` : '') +
    ` (Spark ${r.sparkSales} residential closings ${r.window.from} to ${r.window.to}). ${r.ok ? 'PASS' : 'FAIL'}`
  )
}

function geoName(geo: string): string {
  const slug = geo.slice(geo.indexOf(':') + 1)
  if (geo === geoKey(REGION)) return REGION.label
  return slug
    .split('-')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ')
}

/**
 * The cross-check as citations (§0: documented beside the figures): one per
 * market and segment, listing each window with Spark's value, the printed
 * value and the delta, and one per market for its price-band counts.
 */
export function crossCheckCitations(r: EditionReconciliation): Citation[] {
  const groups = new Map<string, FigureCheck[]>()
  for (const c of r.checks) {
    const key = `${c.geo}|${c.segment}|${c.band == null ? 'figures' : 'bands'}`
    const list = groups.get(key)
    if (list) list.push(c)
    else groups.set(key, [c])
  }
  const out: Citation[] = []
  for (const [key, checks] of groups) {
    const [geo, segment, kind] = key.split('|') as [string, SegmentKey, 'figures' | 'bands']
    const failed = checks.filter((c) => !c.ok).length
    const name = `${geoName(geo)}, ${SEGMENT_LABEL[segment]}`
    const value =
      kind === 'bands'
        ? `${checks.length} price-band counts (month, six months, 12 months): ${failed} over ${pctText(RECONCILE_TOLERANCE)}, ` +
          `largest delta ${pctText(Math.max(0, ...checks.map((c) => c.salesDelta ?? 0)))}`
        : checks
            .map((c) => {
              const w = windowLabel(c.from, c.to)
              const parts: string[] = []
              if (c.sales != null) parts.push(`sales ${c.spark.sales}/${c.sales} (${pctText(c.salesDelta)})`)
              if (c.median != null) parts.push(`median ${moneyText(c.spark.median)}/${moneyText(c.median)} (${pctText(c.medianDelta)})`)
              return `${w}: ${parts.join(', ')}${c.ok ? '' : ' FAIL'}`
            })
            .join('; ')
    out.push({
      figure: `${name}: Spark cross-check${kind === 'bands' ? ' of price-band sale counts' : ' (Spark/printed, delta)'}`,
      value,
      source:
        'Spark API listings (Oregon Data Share), PropertyType A, Closed, by listing key; against the edition payload and Supabase market_report_sale',
      filter: `MLS city in the service area (market_service_area), ${SEGMENT_LABEL[segment]}, close dates ${r.window.from} to ${r.window.to}; method exclusions from market_fact_sale.is_publishable`,
      rows: Math.max(...checks.map((c) => c.spark.sales)),
      computedAt: r.checkedAt,
    })
  }
  return out
}
