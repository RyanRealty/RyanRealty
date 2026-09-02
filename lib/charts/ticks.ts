/**
 * CHART TICKS AND CLAIMS. The arithmetic every public chart shares.
 *
 * WHY THIS FILE EXISTS. TASTE.md: "a chart with no point is decoration", and
 * "a chart the reader cannot interrogate is a picture of a chart". V3Chart
 * grew the props that fix both — `claim`, `yTicks`, `xTicks`, `emphasize` —
 * and exactly one caller filled them. The arithmetic behind them was written
 * inside that one caller (app/cities/[slug]/_v3/city-sections.ts), so every
 * other chart builder would have had to re-derive round gridlines and a
 * comparison sentence by hand, which is how two pages end up saying two
 * different things about the same series.
 *
 * THE §0 RULE THIS MODULE ENCODES. Every number in a claim, and every
 * gridline, is computed FROM THE SERIES BEING PLOTTED and from nothing else.
 * Nothing here fetches, reads the clock, or accepts a figure from a second
 * query. A caller that wants a sentence about a number that is not on the
 * chart has to write and source that sentence itself.
 *
 * Formatting: a point's own `label` is the caller's already-sourced string and
 * always wins. `formatUnit` is the fallback and the tick formatter, so a
 * gridline can never be written in a unit the reader did not ask for.
 */
import { formatPriceCompact } from '@/lib/format/money'
import { v3Text, type V3Text } from '@/components/site/v3'

/** The four units public charts plot. Anything else needs its own formatter. */
export type ChartUnit = 'money' | 'count' | 'percent' | 'days'

/**
 * A plotted point, structurally satisfied by V3ChartPoint. `label` is the
 * caller's formatted reading; `tick` names the period; `at` is the x key
 * (buildLinePlot uses it when ANY point in ANY series carries one, and the
 * point's order within its series otherwise).
 */
export type ClaimPoint = {
  value: number
  label?: string
  tick?: string
  at?: number
}

/** A plotted series, structurally satisfied by V3ChartSeries. */
export type ClaimSeries = {
  name: string
  points: readonly ClaimPoint[]
}

export type YTick = { value: number; label: V3Text }
export type XTick = { at: number; label: V3Text }

const YEAR_NAME = /^(?:19|20)\d{2}$/

/** "Aug 2026" — a month abbreviation and a four-digit year. */
const MONTH_YEAR_TICK = /^([A-Za-z]{3,9})\s+((?:19|20)\d{2})$/

/** "Aug 13" — a month abbreviation and a day, with the year on the series. */
const MONTH_DAY_TICK = /^[A-Za-z]{3,9}\s+\d{1,2}$/

/** The month abbreviations every monthly public chart ticks with. */
export const MONTH_TICKS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** Odd months. Twelve labels under a 320-unit plot collide at 375px. */
const DEFAULT_MONTH_STOPS = [1, 3, 5, 7, 9, 11] as const

/**
 * A clean step for a value range: 1, 2, or 5 × 10^n, so the gridlines read as
 * round numbers instead of as the data's own arbitrary extremes.
 */
export function niceStep(span: number, target = 3): number {
  if (!(span > 0)) return 1
  const raw = span / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = norm >= 5 ? 5 : norm >= 2 ? 2 : 1
  return step * mag
}

/** Every finite value the series actually plot. The tick domain, and nothing else. */
function plottedValues(series: readonly ClaimSeries[]): number[] {
  const values: number[] = []
  for (const s of series) {
    for (const p of s.points) {
      if (Number.isFinite(p.value)) values.push(p.value)
    }
  }
  return values
}

/**
 * One value in one unit, the way the public site writes it: `$666K`, `1,654`,
 * `27 days`, `97%`. Returns '' when the value cannot be written, and the
 * caller then omits the tick rather than printing a placeholder.
 */
export function formatUnit(value: number, unit: ChartUnit): string {
  if (!Number.isFinite(value)) return ''
  if (unit === 'money') {
    const label = formatPriceCompact(value)
    return label === '—' ? '' : label
  }
  if (unit === 'count') return Math.round(value).toLocaleString('en-US')
  if (unit === 'days') {
    const days = Math.round(value * 10) / 10
    return `${days.toLocaleString('en-US')} ${days === 1 ? 'day' : 'days'}`
  }
  const pct = Math.round(value * 10) / 10
  return `${pct.toLocaleString('en-US')}%`
}

/**
 * Round gridlines across the plotted range, at most six, formatted in `unit`.
 *
 * Every tick sits inside [min, max] of the plotted values, which is strictly
 * inside the plot's padded y-domain, so lineTicks keeps all of them. Fewer
 * than `min` usable ticks returns [] — two gridlines are the floor for a grid
 * to read as a scale, and V3Chart falls back to its min/max pair below that.
 */
export function unitTicks(
  series: readonly ClaimSeries[],
  unit: ChartUnit,
  min = 2,
): YTick[] {
  // A count is written whole, so a sub-unit step would print the same label
  // twice ("2", "2", "3").
  return customTicks(series, (v) => formatUnit(v, unit), min, unit === 'count')
}

/**
 * Round gridlines in a unit this module does not own — an index (`110`), a
 * spread in percentage points (`2.04pp`), a multiple. The formatter is the
 * caller's, which is the same rule the atom itself follows: figures arrive
 * already written by whoever holds their source.
 */
export function customTicks(
  series: readonly ClaimSeries[],
  format: (value: number) => string,
  min = 2,
  whole = false,
): YTick[] {
  const values = plottedValues(series)
  if (values.length === 0) return []
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  let step = niceStep(hi - lo)
  if (whole && step < 1) step = 1
  const ticks: YTick[] = []
  let previous = ''
  for (let v = Math.ceil(lo / step) * step; v <= hi && ticks.length < 6; v += step) {
    const label = format(v).trim()
    if (!label || label === previous) continue
    previous = label
    ticks.push({ value: v, label: v3Text(label) })
  }
  return ticks.length >= min ? ticks : []
}

/** Round-money gridlines over the plotted series. */
export function moneyTicks(series: readonly ClaimSeries[], min = 2): YTick[] {
  return unitTicks(series, 'money', min)
}

/** Round-count gridlines over the plotted series. */
export function countTicks(series: readonly ClaimSeries[], min = 2): YTick[] {
  return unitTicks(series, 'count', min)
}

/** Day gridlines over the plotted series. */
export function dayTicks(series: readonly ClaimSeries[], min = 2): YTick[] {
  return unitTicks(series, 'days', min)
}

/** Percent gridlines over the plotted series. */
export function percentTicks(series: readonly ClaimSeries[], min = 2): YTick[] {
  return unitTicks(series, 'percent', min)
}

/**
 * Month labels for a Jan–Dec axis, at the odd months by default. `at` is the
 * month number, which is what a year-overlay series keys its points by.
 */
export function monthTicks(
  labels: readonly string[] = MONTH_TICKS,
  months: readonly number[] = DEFAULT_MONTH_STOPS,
): XTick[] {
  return months.flatMap((m) => {
    const label = labels[m - 1]
    return label && label.trim().length > 0 ? [{ at: m, label: v3Text(label) }] : []
  })
}

function isYear(value: number | undefined): value is number {
  return value != null && Number.isInteger(value) && value >= 1900 && value <= 2100
}

/**
 * Year labels for an annual series: every year, or every other year (or every
 * third) once the run is long enough that the labels would collide. Counted
 * back from the newest year so the latest year is always labelled.
 */
export function yearTicks(series: readonly ClaimSeries[], maxTicks = 6): XTick[] {
  const years = [
    ...new Set(
      series.flatMap((s) => s.points.filter((p) => Number.isFinite(p.value)).map((p) => p.at)).filter(isYear),
    ),
  ].sort((a, b) => a - b)
  if (years.length < 2 || maxTicks < 2) return []
  const stride = Math.max(1, Math.ceil(years.length / maxTicks))
  const picked: XTick[] = []
  for (let i = years.length - 1; i >= 0; i -= stride) {
    const year = years[i]
    if (year == null) continue
    picked.unshift({ at: year, label: v3Text(String(year)) })
  }
  return picked.length >= 2 ? picked : []
}

/** True when buildLinePlot will key x off `at` rather than point order. */
function usesAt(series: readonly ClaimSeries[]): boolean {
  return series.some((s) => s.points.some((p) => p.at != null && Number.isFinite(p.at)))
}

/**
 * Evenly spaced x labels taken from the points themselves, for an axis whose
 * x key is neither a month number nor a year (a chronological run keyed by
 * timestamp, a category run keyed by order). Every label is a tick that is
 * actually on the chart, at the x where it actually sits.
 *
 * THREE, not four. These labels carry a year ("Aug 2026"), which the tick row
 * sets uppercase and tracked at roughly sixty pixels each. Four of them across
 * a 375px plot touch. Short month ticks use monthTicks and can take six.
 */
export function spacedTicks(series: readonly ClaimSeries[], count = 3): XTick[] {
  if (count < 2) return []
  const useAt = usesAt(series)
  const seen = new Set<number>()
  const rows: { at: number; label: string }[] = []
  for (const s of series) {
    s.points.forEach((p, order) => {
      if (!Number.isFinite(p.value)) return
      const at = useAt ? (p.at ?? Number.NaN) : order
      if (!Number.isFinite(at) || seen.has(at)) return
      const tick = p.tick?.trim()
      if (!tick) return
      seen.add(at)
      rows.push({ at, label: tick })
    })
  }
  rows.sort((a, b) => a.at - b.at)
  if (rows.length < 2) return []
  const n = Math.min(count, rows.length)
  const picked: XTick[] = []
  for (let i = 0; i < n; i += 1) {
    const row = rows[Math.round((i * (rows.length - 1)) / (n - 1))]
    if (!row || picked.some((t) => t.at === row.at)) continue
    picked.push({ at: row.at, label: v3Text(row.label) })
  }
  return picked.length >= 2 ? picked : []
}

/** The last series that has a finite point, and that point. */
function latestOf(series: readonly ClaimSeries[]): { series: ClaimSeries; point: ClaimPoint; index: number } | null {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const s = series[i]
    if (!s) continue
    for (let j = s.points.length - 1; j >= 0; j -= 1) {
      const p = s.points[j]
      if (p && Number.isFinite(p.value)) return { series: s, point: p, index: i }
    }
  }
  return null
}

/**
 * How a point's period reads. On a year overlay the series is named by its
 * year and the tick names the month, so the two compose into "Aug 2026". On a
 * single chronological series the tick already carries both.
 */
function periodLabel(series: ClaimSeries, point: ClaimPoint): string {
  const tick = point.tick?.trim() ?? ''
  const name = series.name?.trim() ?? ''
  if (YEAR_NAME.test(name) && tick.length > 0 && !/\d{4}/.test(tick)) {
    // "Aug" + "2026" is "Aug 2026"; "Aug 13" + "2026" is "Aug 13, 2026". A
    // day already sits in the tick on a weekly overlay, and English puts a
    // comma between the day and the year.
    return MONTH_DAY_TICK.test(tick) ? `${tick}, ${name}` : `${tick} ${name}`
  }
  return tick || name
}

/**
 * The same x one series earlier — the year-overlay comparison.
 *
 * `matchWithin` exists for one shape: a weekly series overlaid by calendar
 * year. Freddie Mac publishes on a Thursday, so the same week lands on a
 * different day of the year each time and an exact x match never fires. The
 * matched point is still a REAL plotted point and the sentence names that
 * point's own tick, so the reader is told which week was compared.
 */
function priorInPreviousSeries(
  series: readonly ClaimSeries[],
  latestIndex: number,
  point: ClaimPoint,
  matchWithin = 0,
): { series: ClaimSeries; point: ClaimPoint } | null {
  for (let i = latestIndex - 1; i >= 0; i -= 1) {
    const s = series[i]
    if (!s) continue
    const usable = s.points.filter((p) => Number.isFinite(p.value))
    if (matchWithin > 0 && point.at != null) {
      let best: ClaimPoint | null = null
      let bestGap = Number.POSITIVE_INFINITY
      for (const p of usable) {
        if (p.at == null) continue
        const gap = Math.abs(p.at - point.at)
        if (gap < bestGap) {
          bestGap = gap
          best = p
        }
      }
      if (best && bestGap <= matchWithin) return { series: s, point: best }
      continue
    }
    const match = usable.find((p) =>
      point.at != null ? p.at === point.at : (p.tick ?? '') === (point.tick ?? ''),
    )
    if (match) return { series: s, point: match }
  }
  return null
}

/**
 * The same period one year earlier INSIDE one series: the point whose tick is
 * the same month of the previous year ("Aug 2025" under "Aug 2026"), or the
 * point one year back when the x key is a calendar year. No match, no
 * comparison — the sentence shrinks rather than reaching for a nearby month.
 */
function priorInSameSeries(s: ClaimSeries, point: ClaimPoint): ClaimPoint | null {
  const monthYear = MONTH_YEAR_TICK.exec(point.tick?.trim() ?? '')
  if (monthYear) {
    const want = `${monthYear[1]} ${Number(monthYear[2]) - 1}`
    const match = s.points.find((p) => (p.tick?.trim() ?? '') === want)
    if (match && Number.isFinite(match.value)) return match
  }
  if (isYear(point.at)) {
    const match = s.points.find((p) => p.at === (point.at as number) - 1)
    if (match && Number.isFinite(match.value)) return match
  }
  return null
}

/**
 * The comparison half of a claim.
 *
 * A PERCENT SERIES MOVES IN POINTS, NOT IN PERCENT. "A 6.5% rate, down 3.4%
 * from last year" is unreadable — 3.4 points, or 3.4 percent of 6.5? Every
 * percent metric here (mortgage rate, sale-to-list, concession share) states
 * its change in points, which is also how the trade writes it. Every other
 * unit states a percent change.
 */
function comparison(latest: number, prior: number, unit: ChartUnit, priorWhen: string): string {
  if (unit === 'percent') {
    const points = Math.round((latest - prior) * 10) / 10
    if (points === 0) return `flat against ${priorWhen}`
    const size = Math.abs(points)
    return `${points > 0 ? 'up' : 'down'} ${size} ${size === 1 ? 'point' : 'points'} from ${priorWhen}`
  }
  const pct = Math.round(((latest - prior) / prior) * 1000) / 10
  if (pct === 0) return `flat against ${priorWhen}`
  return `${pct > 0 ? 'up' : 'down'} ${Math.abs(pct)}% from ${priorWhen}`
}

/**
 * THE CLAIM. One sentence, formed only from the series being plotted:
 *
 *   "Median sale price $666K in Aug 2026, down 3.4% from Aug 2025."
 *   "Homes sold 1,654 in 2025, flat against 2024."
 *   "Median sale price $666K in Aug 2026."   ← no prior-year point at that x
 *
 * The compared point is the same x one series earlier (a year overlay), or —
 * when there is one series — the same month a year back, or the previous
 * calendar year. When no such point exists the sentence carries no comparison
 * rather than comparing against a period nobody asked for.
 *
 * Returns undefined when the latest point has no writable reading, so the
 * caller mounts no claim instead of an empty one.
 *
 * Three forms share one engine: yoyClaim (same period last year), windowClaim
 * (the window's own span), and seriesClaim (yoy when the window holds it, the
 * span when it does not).
 */
export type ClaimInput = {
  /** "Median sale price". Written first, so it arrives sentence-cased. */
  metric: string
  unit: ChartUnit
  series: readonly ClaimSeries[]
  /**
   * Override for how the latest VALUE reads. Defaults to that point's own
   * label. Set it when the point label carries a noun the metric name already
   * says — "Homes sold 75 sold" and "Median price per square foot $930 per sq
   * ft" are the two this exists for. The number must still be the plotted
   * point's number, only written differently.
   */
  value?: string
  /** Override for how the latest period reads. Defaults to the point's own tick. */
  latestLabel?: string
  /** Override for how the compared period reads. */
  priorLabel?: string
  /**
   * Largest x distance the prior series' point may sit from the latest x and
   * still be the comparison. 0 (the default) means exact. Only raise it for a
   * series whose x cannot land on the same key twice — see priorInPreviousSeries.
   */
  matchWithin?: number
}

export function yoyClaim(input: ClaimInput): string | undefined {
  return writeClaim(input, yoyPrior)
}

/**
 * The claim for a chart that IS a window — "last three years", "since 1998",
 * a quarterly run. The comparison is the window's own first plotted point, so
 * the sentence says what the reader is looking at end to end:
 *
 *   "30-year fixed rate 6.35% in Aug 2026, down 0.6 points from Aug 2023."
 *   "Median close $712K in 2025, up 408.6% from 1998."
 *
 * Same rule as yoyClaim: both numbers come off the plotted series, and a
 * window with one plottable point carries no comparison.
 */
export function windowClaim(input: ClaimInput): string | undefined {
  return writeClaim(input, windowPrior)
}

/**
 * The year-over-year comparison when the plotted window contains one, the
 * window's own span when it does not.
 *
 * A trailing-twelve-month chart ending in August does not hold last August, so
 * yoyClaim alone would leave it a bare figure. Both comparisons are honest and
 * both are drawn on the chart, so the sentence takes the more informative one
 * that the data supports.
 */
export function seriesClaim(input: ClaimInput): string | undefined {
  return writeClaim(input, (i, latest) => yoyPrior(i, latest) ?? windowPrior(i, latest))
}

type Latest = NonNullable<ReturnType<typeof latestOf>>
type PriorPick = { series: ClaimSeries; point: ClaimPoint } | null

/** The same x one series back, else the same period one year back in this series. */
function yoyPrior(input: ClaimInput, latest: Latest): PriorPick {
  const previous = priorInPreviousSeries(input.series, latest.index, latest.point, input.matchWithin ?? 0)
  if (previous) return previous
  const same = priorInSameSeries(latest.series, latest.point)
  return same ? { series: latest.series, point: same } : null
}

/** The first plotted point of the latest series — the window's own start. */
function windowPrior(_input: ClaimInput, latest: Latest): PriorPick {
  const first = latest.series.points.find((p) => Number.isFinite(p.value))
  return first && first !== latest.point ? { series: latest.series, point: first } : null
}

function writeClaim(
  input: ClaimInput,
  pickPrior: (input: ClaimInput, latest: Latest) => PriorPick,
): string | undefined {
  const metric = input.metric.trim()
  if (metric.length === 0) return undefined
  const latest = latestOf(input.series)
  if (!latest) return undefined
  const value =
    input.value?.trim() || latest.point.label?.trim() || formatUnit(latest.point.value, input.unit)
  if (!value) return undefined
  const when = input.latestLabel?.trim() || periodLabel(latest.series, latest.point)
  const head = when ? `${metric} ${value} in ${when}` : `${metric} ${value}`

  const prior = pickPrior(input, latest)
  if (!prior || !(prior.point.value > 0)) return `${head}.`
  const priorWhen = input.priorLabel?.trim() || periodLabel(prior.series, prior.point)
  if (!priorWhen) return `${head}.`
  return `${head}, ${comparison(latest.point.value, prior.point.value, input.unit, priorWhen)}.`
}
