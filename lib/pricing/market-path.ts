/**
 * Market-path time adjustment.
 *
 * A single current YoY rate applied as a straight line is the thing that
 * makes a 2021 sale and a 2023 sale look like the same market. They are not.
 * This module walks the actual monthly median $/sqft between the comp's close
 * and the as-of date — +3% a month for four months is (1.03)^4, a flat year
 * is 1.00, a drop then a stall is the product of those months.
 *
 * Index source of truth is `pricing_market_index` (built from sale_pricing_facts,
 * the same SFR / Central Oregon corpus). market_stats_cache monthly is a
 * recent-only cross-check, not the long series — it only goes back ~14 months.
 *
 * Thin months (n < MIN_N) do not set the path by themselves; we look through
 * them to the nearest months that have enough sales. Missing months interpolate.
 * The factor is capped at ±25% so one thin-month spike cannot rewrite a sale.
 */

export type MarketIndexPoint = {
  /** First day of the month, YYYY-MM-01 */
  month: string
  ppsf: number
  n: number
  saleToOriginal?: number | null
  daysToOffer?: number | null
}

export type MarketRegime = 'rising' | 'flat' | 'falling'

export type MarketPath = {
  factor: number
  fromPpsf: number | null
  toPpsf: number | null
  monthlyRate: number | null
  months: number
  regime: MarketRegime
  capped: boolean
  source: 'index' | 'none'
}

export const INDEX_MIN_N = 8
export const PATH_FACTOR_CAP = 0.25
/** ~1% per month is a real run, not noise on a 20-sale month. */
export const REGIME_MONTHLY_CUT = 0.01

function monthKey(iso: string): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z')
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 7) + '-01'
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

function monthIndex(iso: string): number {
  const [y, m] = monthKey(iso).split('-').map(Number)
  return (y ?? 0) * 12 + ((m ?? 1) - 1)
}

function usable(points: MarketIndexPoint[]): MarketIndexPoint[] {
  return points
    .filter((p) => p.ppsf > 0 && p.n >= INDEX_MIN_N)
    .slice()
    .sort((a, b) => a.month.localeCompare(b.month))
}

/** Linear interpolate $/sqft at `iso` from the usable monthly series. */
export function ppsfAt(points: MarketIndexPoint[], iso: string): number | null {
  const series = usable(points)
  if (series.length === 0) return null
  const t = monthIndex(iso)
  const first = series[0]!
  const last = series[series.length - 1]!
  if (t <= monthIndex(first.month)) return first.ppsf
  if (t >= monthIndex(last.month)) return last.ppsf
  let lo = first
  let hi = last
  for (let i = 0; i < series.length; i++) {
    const p = series[i]!
    if (monthIndex(p.month) === t) return p.ppsf
    if (monthIndex(p.month) < t) lo = p
    if (monthIndex(p.month) > t) {
      hi = p
      break
    }
  }
  const span = monthIndex(hi.month) - monthIndex(lo.month)
  if (span <= 0) return lo.ppsf
  const w = (t - monthIndex(lo.month)) / span
  return lo.ppsf + (hi.ppsf - lo.ppsf) * w
}

function regimeFromMonthly(rate: number | null): MarketRegime {
  if (rate == null) return 'flat'
  if (rate > REGIME_MONTHLY_CUT) return 'rising'
  if (rate < -REGIME_MONTHLY_CUT) return 'falling'
  return 'flat'
}

export function marketPath(opts: {
  points: MarketIndexPoint[]
  fromDate: string
  toDate: string
}): MarketPath {
  const months = Math.max(0, (new Date(opts.toDate).getTime() - new Date(opts.fromDate).getTime()) / (30.44 * 86_400_000))
  const fromPpsf = ppsfAt(opts.points, opts.fromDate)
  const toPpsf = ppsfAt(opts.points, opts.toDate)
  if (fromPpsf == null || toPpsf == null || fromPpsf <= 0) {
    return {
      factor: 1,
      fromPpsf,
      toPpsf,
      monthlyRate: null,
      months: +months.toFixed(2),
      regime: 'flat',
      capped: false,
      source: 'none',
    }
  }
  let factor = toPpsf / fromPpsf
  const lo = 1 - PATH_FACTOR_CAP
  const hi = 1 + PATH_FACTOR_CAP
  const capped = factor < lo || factor > hi
  factor = Math.min(hi, Math.max(lo, factor))
  const monthlyRate = months > 0.25 ? factor ** (1 / months) - 1 : 0
  return {
    factor: +factor.toFixed(4),
    fromPpsf: +fromPpsf.toFixed(2),
    toPpsf: +toPpsf.toFixed(2),
    monthlyRate: +monthlyRate.toFixed(4),
    months: +months.toFixed(2),
    regime: regimeFromMonthly(monthlyRate),
    capped,
    source: 'index',
  }
}

/** Bring a closed price from its close month to the as-of month along the index. */
export function timeAdjustAlongPath(closePrice: number, path: MarketPath): number {
  return Math.round(closePrice * path.factor)
}

export function describePath(path: MarketPath): string {
  if (path.source === 'none') {
    return 'No monthly market index for this geo, so the sale was not time-adjusted.'
  }
  const pct = ((path.factor - 1) * 100).toFixed(1)
  const rate = path.monthlyRate != null ? `${(path.monthlyRate * 100).toFixed(1)}% a month` : 'n/a'
  const dir =
    path.regime === 'rising' ? 'rising' : path.regime === 'falling' ? 'falling' : 'flat'
  return `Market path ${path.fromPpsf} → ${path.toPpsf} $/sqft over ${path.months} months (${dir}, ${rate}). Time factor ${path.factor} (${pct}%)${path.capped ? ', capped at 25%' : ''}.`
}
