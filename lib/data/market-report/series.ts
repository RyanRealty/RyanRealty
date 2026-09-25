/**
 * Monthly market report: read the computed series and price bands.
 *
 * Source: public.market_report_series / public.market_report_band, written by
 * compute_market_report_period (lib/data/market-report/compute.ts). Service
 * role only; these rows carry raw medians with their sample sizes, and the
 * publish floors are applied by lib/market-report/build-edition.ts. Nothing on
 * a public page reads this module; pages read the frozen edition payload.
 */
import { createServiceClient } from '@/lib/data/client'
import { REPORT_DEFINITION_ID, type ReportPeriodKind } from '@/lib/data/market-report/compute'

export type ReportSegment = 'sfr' | 'acreage' | 'condo_townhome' | 'detached'

export type ReportSeriesRow = {
  period_kind: ReportPeriodKind
  period_start: string
  period_end: string
  geo_type: string
  geo_slug: string
  segment: ReportSegment
  closed_n: number
  median_close: number | null
  volume: number
  ppsf_n: number
  median_ppsf: number | null
  dtc_n: number
  median_dtc: number | null
  stl_n: number
  median_stl: number | null
  stol_n: number
  median_stol: number | null
  price_cut_n: number
  concession_reported_n: number
  concession_with_n: number
  median_concession: number | null
  fin_known_n: number
  fin_cash_n: number
  fin_conventional_n: number
  fin_government_n: number
  fin_other_n: number
  new_listings_n: number
  pendings_n: number
  active_end_n: number
  active_end_assumed_n: number
  median_active_list: number | null
  complete_through: string
  computed_at: string
}

export type ReportBandRow = {
  period_end: string
  geo_type: string
  geo_slug: string
  segment: ReportSegment
  band_idx: number
  closed_n: number
  active_end_n: number
}

const SERIES_COLUMNS =
  'period_kind, period_start, period_end, geo_type, geo_slug, segment, closed_n, median_close, volume, ppsf_n, median_ppsf, dtc_n, median_dtc, stl_n, median_stl, stol_n, median_stol, price_cut_n, concession_reported_n, concession_with_n, median_concession, fin_known_n, fin_cash_n, fin_conventional_n, fin_government_n, fin_other_n, new_listings_n, pendings_n, active_end_n, active_end_assumed_n, median_active_list, complete_through, computed_at'

const NUMERIC_SERIES_KEYS: readonly (keyof ReportSeriesRow)[] = [
  'closed_n', 'median_close', 'volume', 'ppsf_n', 'median_ppsf', 'dtc_n', 'median_dtc', 'stl_n', 'median_stl',
  'stol_n', 'median_stol', 'price_cut_n', 'concession_reported_n', 'concession_with_n', 'median_concession',
  'fin_known_n', 'fin_cash_n', 'fin_conventional_n', 'fin_government_n', 'fin_other_n', 'new_listings_n',
  'pendings_n', 'active_end_n', 'active_end_assumed_n', 'median_active_list',
]

function toNumberOrNull(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeSeries(raw: Record<string, unknown>): ReportSeriesRow {
  const row = { ...raw } as Record<string, unknown>
  for (const k of NUMERIC_SERIES_KEYS) row[k] = toNumberOrNull(row[k])
  return row as unknown as ReportSeriesRow
}

const PAGE = 1000

/**
 * Every series row for the given period kinds whose period ends inside
 * [fromEnd, toEnd], optionally narrowed to some geographies. Paged by the
 * table's primary key order so a page boundary never repeats or skips a row.
 */
export async function getReportSeries(opts: {
  kinds: readonly ReportPeriodKind[]
  fromEnd: string
  toEnd: string
  geoKeys?: readonly string[]
  segments?: readonly ReportSegment[]
  definitionId?: string
}): Promise<ReportSeriesRow[]> {
  const sb = createServiceClient()
  const out: ReportSeriesRow[] = []
  const geoTypes = opts.geoKeys ? [...new Set(opts.geoKeys.map((k) => k.split(':')[0]!))] : null
  const geoSlugs = opts.geoKeys ? [...new Set(opts.geoKeys.map((k) => k.slice(k.indexOf(':') + 1)))] : null
  const wanted = opts.geoKeys ? new Set(opts.geoKeys) : null
  for (let from = 0; ; from += PAGE) {
    let q = sb
      .from('market_report_series')
      .select(SERIES_COLUMNS)
      .eq('definition_id', opts.definitionId ?? REPORT_DEFINITION_ID)
      .in('period_kind', [...opts.kinds])
      .gte('period_end', opts.fromEnd)
      .lte('period_end', opts.toEnd)
    if (geoTypes) q = q.in('geo_type', geoTypes)
    if (geoSlugs) q = q.in('geo_slug', geoSlugs)
    if (opts.segments) q = q.in('segment', [...opts.segments])
    const { data, error } = await q
      .order('period_kind')
      .order('period_end')
      .order('geo_type')
      .order('geo_slug')
      .order('segment')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`[getReportSeries] ${error.message}`)
    const rows = (data ?? []) as Record<string, unknown>[]
    for (const r of rows) {
      const row = normalizeSeries(r)
      if (wanted && !wanted.has(`${row.geo_type}:${row.geo_slug}`)) continue
      out.push(row)
    }
    if (rows.length < PAGE) break
  }
  return out
}

export async function getReportBands(opts: {
  fromEnd: string
  toEnd: string
  geoKeys: readonly string[]
  segments: readonly ReportSegment[]
  definitionId?: string
}): Promise<ReportBandRow[]> {
  const sb = createServiceClient()
  const out: ReportBandRow[] = []
  const geoTypes = [...new Set(opts.geoKeys.map((k) => k.split(':')[0]!))]
  const geoSlugs = [...new Set(opts.geoKeys.map((k) => k.slice(k.indexOf(':') + 1)))]
  const wanted = new Set(opts.geoKeys)
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('market_report_band')
      .select('period_end, geo_type, geo_slug, segment, band_idx, closed_n, active_end_n')
      .eq('definition_id', opts.definitionId ?? REPORT_DEFINITION_ID)
      .gte('period_end', opts.fromEnd)
      .lte('period_end', opts.toEnd)
      .in('geo_type', geoTypes)
      .in('geo_slug', geoSlugs)
      .in('segment', [...opts.segments])
      .order('period_end')
      .order('geo_type')
      .order('geo_slug')
      .order('segment')
      .order('band_idx')
      .range(from, from + PAGE - 1)
    if (error) throw new Error(`[getReportBands] ${error.message}`)
    const rows = (data ?? []) as Record<string, unknown>[]
    for (const r of rows) {
      const row: ReportBandRow = {
        period_end: String(r.period_end),
        geo_type: String(r.geo_type),
        geo_slug: String(r.geo_slug),
        segment: r.segment as ReportSegment,
        band_idx: Number(r.band_idx),
        closed_n: Number(r.closed_n ?? 0),
        active_end_n: Number(r.active_end_n ?? 0),
      }
      if (!wanted.has(`${row.geo_type}:${row.geo_slug}`)) continue
      out.push(row)
    }
    if (rows.length < PAGE) break
  }
  return out
}
