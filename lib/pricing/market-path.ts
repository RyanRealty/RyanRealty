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
 *
 * TWO RULES DECIDE WHICH NUMBER A MONTH READS (R2d, evaluator round two,
 * 2026-09-08). Both exist because the endpoint used to be whatever month the
 * as-of date fell in, which on any day but the last of the month is a PARTIAL
 * month: Redmond's September 2026 held ten sales at $294.44 against August's
 * seventy-eight at $325.70, and every sale in a document built on 2026-09-07
 * was moved down 8.5 to 11.5 percent against that ten-sale figure while the
 * document's own printed basis recorded the year's whole move as −5.25%.
 *
 *   1. THE ENDPOINT IS NEVER A PARTIAL MONTH. Only months that had fully
 *      closed before the as-of date enter the series at all.
 *   2. EVERY MONTH READS AS A MEDIAN OF THREE. The level at a month is the
 *      median of the three-month window centred on it — the trailing three at
 *      the end of the series, the leading three at the start. A median of
 *      three cannot be moved by one month's noise and leaves a monotone run
 *      exactly where it was, so the last complete month's level is by
 *      construction the median of the last three complete months, and that is
 *      the one endpoint every sale is moved to.
 *
 * The cost is honest and stated in the document: the reference sits at the
 * middle of the last three complete months, so a fast market is adjusted for
 * about two months late. The alternative was a ten-sale month rewriting a
 * quarter-million-dollar opinion.
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
  /** The complete months the endpoint is the median of. Never the running one. */
  referenceMonths: string[]
  /** The index turned around inside this span, so an older sale can move less. */
  reversedWithinSpan: boolean
}

export const INDEX_MIN_N = 8
export const PATH_FACTOR_CAP = 0.25
/** ~1% per month is a real run, not noise on a 20-sale month. */
export const REGIME_MONTHLY_CUT = 0.01
/** Months behind the reference level, and the width of the smoothing window. */
export const REFERENCE_MONTHS = 3
/**
 * How far a printed date adjustment may sit from the move the index records
 * over that sale's own span, in percentage points, before it is a defect.
 * Covers rounding to whole dollars and to two decimals, nothing more.
 */
export const DATE_ADJUSTMENT_TOLERANCE_PCT = 0.05

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

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b)
  if (s.length === 0) return Number.NaN
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/** Rule 1. A month is complete only once the whole of it has closed by `asOf`. */
export function isCompleteMonth(month: string, asOf: string): boolean {
  return monthIndex(month) < monthIndex(asOf)
}

/** The usable months that had fully closed by `asOf`, oldest first. */
export function completeSeries(points: MarketIndexPoint[], asOf: string): MarketIndexPoint[] {
  return usable(points).filter((p) => isCompleteMonth(p.month, asOf))
}

/**
 * Rule 2. Every complete month re-read as the median of the three-month window
 * centred on it. Trailing three at the end of the series (there is no month
 * after the last complete one), leading three at the start.
 */
export function indexLevels(series: MarketIndexPoint[]): MarketIndexPoint[] {
  const n = series.length
  if (n === 0) return []
  return series.map((p, i) => {
    const window =
      n < REFERENCE_MONTHS
        ? series
        : i === 0
          ? series.slice(0, REFERENCE_MONTHS)
          : i === n - 1
            ? series.slice(n - REFERENCE_MONTHS)
            : series.slice(i - 1, i + 2)
    return { ...p, ppsf: +median(window.map((w) => w.ppsf)).toFixed(2) }
  })
}

/** The complete months, each read as its level. One call, both rules. */
export function indexLevelsAsOf(points: MarketIndexPoint[], asOf: string): MarketIndexPoint[] {
  return indexLevels(completeSeries(points, asOf))
}

export type ReferenceLevel = {
  ppsf: number
  /** The complete months the reference is the median of, oldest first. */
  months: string[]
}

/**
 * Where "today" sits on the index: the median $/sqft of the last three
 * complete months. Every sale is moved to THIS, never to the running month.
 */
export function referenceLevel(points: MarketIndexPoint[], asOf: string): ReferenceLevel | null {
  const series = completeSeries(points, asOf)
  if (series.length === 0) return null
  const levels = indexLevels(series)
  return {
    ppsf: levels[levels.length - 1]!.ppsf,
    months: series.slice(-REFERENCE_MONTHS).map((p) => p.month),
  }
}

/** The level the index reads on the date `iso`, both rules applied. */
export function indexLevelAt(
  points: MarketIndexPoint[],
  iso: string,
  asOf: string,
): number | null {
  return ppsfAt(indexLevelsAsOf(points, asOf), iso)
}

/**
 * Did the index turn around between `from` and the reference? A sale whose
 * span contains a reversal can legitimately be adjusted less than a newer one,
 * and that is the only thing that excuses a non-monotone column.
 */
export function indexReversedWithin(
  points: MarketIndexPoint[],
  from: string,
  asOf: string,
): boolean {
  const levels = indexLevelsAsOf(points, asOf).filter(
    (p) => monthIndex(p.month) >= monthIndex(from),
  )
  let up = false
  let down = false
  for (let i = 1; i < levels.length; i++) {
    const prev = levels[i - 1]!.ppsf
    const step = (levels[i]!.ppsf - prev) / (prev || 1)
    if (step > 0.0005) up = true
    if (step < -0.0005) down = true
  }
  return up && down
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

/**
 * The move the index records between `fromDate` and `toDate`, under both rules
 * at the head of this file: `toDate` is the as-of, the series it walks holds
 * only months that had fully closed by then, and each month reads as the median
 * of three. The endpoint is therefore always the median of the last three
 * complete months, never the running one.
 */
export function marketPath(opts: {
  points: MarketIndexPoint[]
  fromDate: string
  toDate: string
}): MarketPath {
  const months = Math.max(0, (new Date(opts.toDate).getTime() - new Date(opts.fromDate).getTime()) / (30.44 * 86_400_000))
  const levels = indexLevelsAsOf(opts.points, opts.toDate)
  const reference = levels.length > 0 ? levels[levels.length - 1]! : null
  const fromPpsf = ppsfAt(levels, opts.fromDate)
  const toPpsf = reference?.ppsf ?? null
  const referenceMonths = completeSeries(opts.points, opts.toDate)
    .slice(-REFERENCE_MONTHS)
    .map((p) => p.month)
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
      referenceMonths,
      reversedWithinSpan: false,
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
    referenceMonths,
    reversedWithinSpan: indexReversedWithin(opts.points, opts.fromDate, opts.toDate),
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
  const ref = path.referenceMonths.length
    ? ` Endpoint is the median of the last ${path.referenceMonths.length} complete month(s), ${path.referenceMonths.join(', ')}.`
    : ''
  return `Market path ${path.fromPpsf} → ${path.toPpsf} $/sqft over ${path.months} months (${dir}, ${rate}). Time factor ${path.factor} (${pct}%)${path.capped ? ', capped at 25%' : ''}.${ref}`
}

/**
 * The time-adjustment BASIS, stated as one rate a document can print.
 *
 * Fannie Mae B4-1.3-09 (effective 2025-06-04, fetched 2026-09-07) requires a
 * time adjustment where the market moved AND requires the report to describe
 * "the data sources, tool(s), and technique(s) used". Ours walks the monthly
 * median price per square foot for the city between each sale's close and
 * today, and no chapter showed the reader the index it walks. This is that
 * index in one number: the move between the level `windowMonths` ago and the
 * reference level, over the complete months that carry enough sales to count.
 *
 * The TOTAL move over the window is the figure a document should print. The
 * compound monthly rate is kept because a reader asks "how fast", but it is
 * not what any sale is moved by: a reader who multiplies it by the months
 * since a sale closed gets a different answer from the grid, which is exactly
 * the contradiction round two caught (R2d).
 *
 * `n` is the number of SALES behind the months in the window, not the number
 * of months — it is the weight a reader should give the rate.
 */
export type MarketIndexTrend = {
  /** Compound monthly change, in percent, one decimal. Null when the index cannot say. */
  pctPerMonth: number | null
  /** Total move across the whole window, in percent, one decimal. */
  pctOverWindow: number | null
  windowMonths: number
  /** Sales behind the usable COMPLETE months inside the window. */
  n: number
  /** Usable complete months (n >= INDEX_MIN_N) inside the window. */
  months: number
  fromPpsf: number | null
  toPpsf: number | null
  /** The complete months the endpoint is the median of. */
  referenceMonths: string[]
  /** True when the ±25% path cap bound the factor over this window. */
  capped: boolean
}

export function marketIndexTrend(opts: {
  points: MarketIndexPoint[]
  asOf: string
  windowMonths: number
}): MarketIndexTrend {
  const asOf = opts.asOf.slice(0, 10)
  const from = new Date(asOf + 'T00:00:00Z')
  from.setUTCMonth(from.getUTCMonth() - opts.windowMonths)
  const fromIso = from.toISOString().slice(0, 10)
  // Complete months only, so the sales count behind the printed rate is the
  // sales count behind the path every sale was actually moved along.
  const inWindow = completeSeries(opts.points, asOf).filter(
    (p) => p.month >= monthKey(fromIso) && p.month <= monthKey(asOf),
  )
  const path = marketPath({ points: opts.points, fromDate: fromIso, toDate: asOf })
  return {
    pctPerMonth:
      path.source === 'index' && path.monthlyRate != null
        ? Math.round(path.monthlyRate * 1000) / 10
        : null,
    pctOverWindow: path.source === 'index' ? Math.round((path.factor - 1) * 1000) / 10 : null,
    windowMonths: opts.windowMonths,
    n: inWindow.reduce((sum, p) => sum + p.n, 0),
    months: inWindow.length,
    referenceMonths: path.referenceMonths,
    fromPpsf: path.fromPpsf,
    toPpsf: path.toPpsf,
    capped: path.capped,
  }
}

/**
 * THE GUARD on the "Adjusted for date" column (R2d, 2026-09-08).
 *
 * A printed date adjustment is only honest if it is the move the named index
 * records over that sale's own span. Two things must hold across the whole
 * grid, and the round-two document failed both:
 *
 *   1. No sale may be moved further than the index moved between its month and
 *      the reference. A 2-month-old sale moved 8.58 percent against an index
 *      that had moved 0.0 percent over those two months is not an adjustment,
 *      it is a partial month leaking into the price.
 *   2. In one city, an older sale moves at least as far as a newer one, and in
 *      the same direction — UNLESS the index itself turned around inside the
 *      older sale's span, which is a fact about the market and has to be said
 *      rather than smoothed away. `reason` carries it.
 */
export type DateAdjustmentRow = {
  label: string
  closeDate: string
  monthsOld: number
  /** What the grid prints: the adjustment over the close price, percent. */
  printedPct: number
  /** What the index records between that sale's month and the reference. */
  indexImpliedPct: number | null
  reversedWithinSpan: boolean
  ok: boolean
  reason: string | null
}

export type DateAdjustmentCheck = {
  ok: boolean
  rows: DateAdjustmentRow[]
  failures: string[]
}

export function checkDateAdjustments(opts: {
  points: MarketIndexPoint[]
  asOf: string
  sales: Array<{ label: string; closeDate: string; closePrice: number; timeAdjustment: number }>
  tolerancePct?: number
}): DateAdjustmentCheck {
  const tol = opts.tolerancePct ?? DATE_ADJUSTMENT_TOLERANCE_PCT
  const failures: string[] = []
  const ref = referenceLevel(opts.points, opts.asOf)
  const rows: DateAdjustmentRow[] = opts.sales.map((s) => {
    const path = marketPath({ points: opts.points, fromDate: s.closeDate, toDate: opts.asOf })
    const from = indexLevelAt(opts.points, s.closeDate, opts.asOf)
    const implied =
      ref != null && from != null && from > 0 ? +(((ref.ppsf / from) - 1) * 100).toFixed(2) : null
    const printed = s.closePrice > 0 ? +((s.timeAdjustment / s.closePrice) * 100).toFixed(2) : 0
    return {
      label: s.label,
      closeDate: s.closeDate.slice(0, 10),
      monthsOld: path.months,
      printedPct: printed,
      indexImpliedPct: implied,
      reversedWithinSpan: indexReversedWithin(opts.points, s.closeDate, opts.asOf),
      ok: true,
      reason: null,
    }
  })

  for (const r of rows) {
    if (r.indexImpliedPct == null) continue
    if (Math.abs(r.printedPct) > Math.abs(r.indexImpliedPct) + tol) {
      r.ok = false
      failures.push(
        `${r.label}: moved ${r.printedPct.toFixed(2)}% for its date while the index moved ${r.indexImpliedPct.toFixed(2)}% between ${r.closeDate.slice(0, 7)} and the last three complete months`,
      )
    }
  }

  // Monotone in age. Newest first, each older sale compared with the one before it.
  const byAge = [...rows].sort((a, b) => a.monthsOld - b.monthsOld)
  for (let i = 1; i < byAge.length; i++) {
    const newer = byAge[i - 1]!
    const older = byAge[i]!
    const shrank = Math.abs(older.printedPct) + tol < Math.abs(newer.printedPct)
    const flipped =
      Math.sign(older.printedPct) !== 0 &&
      Math.sign(newer.printedPct) !== 0 &&
      Math.sign(older.printedPct) !== Math.sign(newer.printedPct)
    if (!shrank && !flipped) continue
    if (older.reversedWithinSpan) {
      older.reason =
        `the index turned around between ${older.closeDate.slice(0, 7)} and the last three complete months, so this older sale moves less than ${newer.label}`
      continue
    }
    older.ok = false
    failures.push(
      `${older.label} closed ${older.monthsOld} months ago and moves ${older.printedPct.toFixed(2)}%, ${newer.label} closed ${newer.monthsOld} months ago and moves ${newer.printedPct.toFixed(2)}% — an older sale cannot move less than a newer one unless the index reversed inside its span, and it did not`,
    )
  }

  return { ok: failures.length === 0, rows, failures }
}
