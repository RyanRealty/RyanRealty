/**
 * The long-view chart cards for /housing-market — the six approved chart-room
 * forms (design_system/ryan-realty/ui_kits/chart-room, Matt 2026-08-19) wired
 * to live reads and translated to the page surface.
 *
 * Pure builders: nothing here fetches or reads the clock. Every card's title
 * is a finding COMPUTED from the same rows its chart draws, so the words
 * cannot go stale against the line (CLAUDE.md section 0). Every card carries
 * its own trace for the Source disclosure; no section borrows another's
 * figures or clock.
 *
 * Dates: FRED observation dates are calendar dates, not instants. They are
 * formatted here by string parts on purpose — parsing '2026-08-13' through a
 * Pacific-pinned formatter would render Aug 12.
 */

import type { StatPoint, StatSpreadPoint } from '@/lib/data/stats/statsReads'
import type { SpreadNorm } from '@/lib/data/stats/statsChartSeries'
import { INDEX_BASE_YEAR, RATE_WINDOW_FROM } from '@/lib/data/stats/statsChartSeries'
import type { CoMarketAnnualRow } from '@/lib/data/analytics/getCoMarketAnnual'
import type { ConcessionsQuarter } from '@/lib/data/pricing/getConcessionsQuarterly'
import { formatPrice, formatPriceCompact } from '@/lib/format/money'
import {
  customTicks,
  moneyTicks,
  spacedTicks,
  windowClaim,
  yearTicks,
  yoyClaim,
} from '@/lib/charts/ticks'
import {
  v3Text,
  type V3ChartCardProps,
  type V3ChartPoint,
  type V3ChartProps,
  type V3ChartSeries,
  type V3InstrumentFigure,
} from '@/components/site/v3'

/* ------------------------------------------------------------------ */
/* Calendar-date formatting by string parts (no timezone parsing)      */
/* ------------------------------------------------------------------ */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

function isoParts(iso: string): { y: number; m: number; d: number } | null {
  const [y, m, d] = [Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), Number(iso.slice(8, 10))]
  return Number.isInteger(y) && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? { y, m, d } : null
}

/** '2026-08-13' → 'Aug 13'. */
export function obsDay(iso: string): string {
  const p = isoParts(iso)
  return p ? `${MONTHS[p.m - 1]} ${p.d}` : iso
}

/** '2026-08-13' → 'Aug 13, 2026'. */
export function obsDayYear(iso: string): string {
  const p = isoParts(iso)
  return p ? `${MONTHS[p.m - 1]} ${p.d}, ${p.y}` : iso
}

/** '2026-08-13' → 'Aug 2026'. */
export function obsMonthYear(iso: string): string {
  const p = isoParts(iso)
  return p ? `${MONTHS[p.m - 1]} ${p.y}` : iso
}

function epochAt(iso: string): number | null {
  const p = isoParts(iso)
  return p ? Date.UTC(p.y, p.m - 1, p.d) : null
}

/**
 * Day of the year each month opens on, the x key the year overlay plots by.
 * A leap year shifts everything after February by one day out of 365, which
 * is below one pixel on the axis and is why these are constants rather than a
 * per-year computation. They are label positions, never data.
 */
const MONTH_START_DAY = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334] as const

function dayOfYear(iso: string): number | null {
  const p = isoParts(iso)
  if (!p) return null
  return Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(p.y, 0, 1)) / 86400000)
}

const fmtPct = (v: number) => `${v.toFixed(2)}%`

function continuousMedian(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid]!
  return (sorted[mid - 1]! + sorted[mid]!) / 2
}

const ORDINALS = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'] as const

/* ------------------------------------------------------------------ */
/* Card 1 — the YoY rate clock with its segmented range control         */
/* ------------------------------------------------------------------ */

function ratePoint(p: StatPoint, tick: string, at: number | null): V3ChartPoint | null {
  if (at == null || !Number.isFinite(p.value)) return null
  return { value: p.value, tick: v3Text(tick), label: v3Text(fmtPct(p.value)), at }
}

/**
 * A rate panel's gridlines, month labels, and claim.
 *
 * NO `emphasize` AND NO `marks` ON A WEEKLY SERIES. Emphasis draws a dot on
 * every point of the emphasized line, and a five-year weekly window is 260
 * points — the line disappears under its own beads. Emphasis is for the
 * monthly and annual series in this file.
 *
 * The claim is a WINDOW claim because the panel is a window: the latest week
 * against the first week the panel draws, both named by their own ticks. A
 * rate moves in percentage points, which is what `unit: 'percent'` writes.
 */
function ratePanel(caption: string, points: readonly V3ChartPoint[]): V3ChartProps | undefined {
  if (points.length < 2) return undefined
  const series = [{ name: v3Text('30-year fixed'), points }]
  const claim = windowClaim({ metric: '30-year fixed rate', unit: 'percent', series })
  const yTicks = customTicks(series, (v) => fmtPct(v))
  const xTicks = spacedTicks(series, 3)
  return {
    caption: v3Text(caption),
    ...(claim ? { claim: v3Text(claim) } : {}),
    series,
    ...(yTicks.length ? { yTicks } : {}),
    ...(xTicks.length ? { xTicks } : {}),
  }
}

function rateWindowPanel(m30: readonly StatPoint[], yearsBack: number, caption: string): V3ChartProps | undefined {
  const last = m30[m30.length - 1]
  if (!last) return undefined
  const lp = isoParts(last.observationDate)
  if (!lp) return undefined
  const from = `${lp.y - yearsBack}${last.observationDate.slice(4)}`
  const points: V3ChartPoint[] = []
  for (const p of m30) {
    if (p.observationDate < from) continue
    const point = ratePoint(p, obsMonthYear(p.observationDate), epochAt(p.observationDate))
    if (point) points.push(point)
  }
  return ratePanel(caption, points)
}

function rateAllPanel(m30: readonly StatPoint[]): V3ChartProps | undefined {
  const points: V3ChartPoint[] = []
  for (const p of m30) {
    const point = ratePoint(p, obsMonthYear(p.observationDate), epochAt(p.observationDate))
    if (point) points.push(point)
  }
  return ratePanel(`Weekly 30-year fixed rate since ${RATE_WINDOW_FROM.slice(0, 4)}`, points)
}

function rateYoyPanel(m30: readonly StatPoint[]): V3ChartProps | undefined {
  const byYear = new Map<number, StatPoint[]>()
  for (const p of m30) {
    const parts = isoParts(p.observationDate)
    if (!parts) continue
    const rows = byYear.get(parts.y) ?? []
    rows.push(p)
    byYear.set(parts.y, rows)
  }
  const years = [...byYear.keys()].sort((a, b) => a - b).slice(-5)
  const series: V3ChartSeries[] = []
  for (const year of years) {
    const points: V3ChartPoint[] = []
    for (const p of byYear.get(year) ?? []) {
      const point = ratePoint(p, obsDay(p.observationDate), dayOfYear(p.observationDate))
      if (point) points.push(point)
    }
    if (points.length >= 2) series.push({ name: v3Text(String(year)), points })
  }
  if (series.length === 0) return undefined
  // The claim compares the latest week to the NEAREST week in the previous
  // year's line, inside ten days. Freddie Mac publishes on a Thursday, so the
  // same calendar week lands on a different day of the year every year and an
  // exact match would never fire. The compared point is a plotted point and
  // the sentence names its own tick, so the reader is told which week it was.
  const claim = yoyClaim({
    metric: '30-year fixed rate',
    unit: 'percent',
    series,
    matchWithin: 10,
  })
  const yTicks = customTicks(series, (v) => fmtPct(v))
  return {
    caption: v3Text('Weekly 30-year fixed rate, each calendar year over one January to December axis'),
    ...(claim ? { claim: v3Text(claim) } : {}),
    series,
    overlay: 'yoy',
    ...(yTicks.length ? { yTicks } : {}),
    xTicks: MONTH_START_DAY.flatMap((day, i) =>
      i % 2 === 0 ? [{ at: day, label: v3Text(MONTHS[i]) }] : [],
    ),
  }
}

/** The finding: consecutive calendar years whose median rate shares one integer band. */
export function rateClockTitle(m30: readonly StatPoint[]): string | null {
  const last = m30[m30.length - 1]
  if (!last) return null
  const byYear = new Map<number, number[]>()
  for (const p of m30) {
    const parts = isoParts(p.observationDate)
    if (!parts) continue
    const rows = byYear.get(parts.y) ?? []
    rows.push(p.value)
    byYear.set(parts.y, rows)
  }
  const lastYear = isoParts(last.observationDate)?.y
  if (lastYear == null) return null
  const medianOf = (year: number) => continuousMedian(byYear.get(year) ?? [])
  const lastMedian = medianOf(lastYear)
  if (lastMedian == null) return `30-year rate at ${fmtPct(last.value)}`
  const band = Math.floor(lastMedian)
  let streak = 0
  for (let year = lastYear; ; year -= 1) {
    const m = medianOf(year)
    if (m == null || Math.floor(m) !== band) break
    streak += 1
  }
  if (streak >= 2 && streak <= ORDINALS.length) {
    return `${ORDINALS[streak - 1]} year in the ${band}s`
  }
  return `30-year rate at ${fmtPct(last.value)}`
}

export function buildRateClockCard(m30: readonly StatPoint[]): V3ChartCardProps | undefined {
  const title = rateClockTitle(m30)
  const last = m30[m30.length - 1]
  if (!title || !last) return undefined
  const yoy = rateYoyPanel(m30)
  const p1 = rateWindowPanel(m30, 1, 'Weekly 30-year fixed rate, last year')
  const p3 = rateWindowPanel(m30, 3, 'Weekly 30-year fixed rate, last three years')
  const p5 = rateWindowPanel(m30, 5, 'Weekly 30-year fixed rate, last five years')
  const pAll = rateAllPanel(m30)
  const items: { key: string; label: ReturnType<typeof v3Text>; panel: V3ChartProps }[] = []
  if (p1) items.push({ key: '1y', label: v3Text('1Y'), panel: p1 })
  if (p3) items.push({ key: '3y', label: v3Text('3Y'), panel: p3 })
  if (p5) items.push({ key: '5y', label: v3Text('5Y'), panel: p5 })
  if (pAll) items.push({ key: 'all', label: v3Text('ALL'), panel: pAll })
  if (yoy) items.push({ key: 'yoy', label: v3Text('YoY'), panel: yoy })
  if (items.length === 0) return undefined
  return {
    id: 'lv-rate-clock',
    title: v3Text(title),
    line: v3Text('Weekly 30-year fixed rate, each calendar year overlaid January through December.'),
    source: v3Text(
      `Freddie Mac 30-year fixed-rate mortgage average (FRED MORTGAGE30US) via stat_observations, weekly, ` +
        `${obsDayYear(m30[0]!.observationDate)} to ${obsDayYear(last.observationDate)}, ${m30.length} observations. ` +
        `Latest ${fmtPct(last.value)} for the week of ${obsDayYear(last.observationDate)}.`,
    ),
    wide: true,
    switcher: {
      label: v3Text('Range'),
      items: items.map((it) => ({ key: it.key, label: it.label })),
      panels: items.map((it) => it.panel),
      defaultKey: 'yoy',
    },
  }
}

/** The section KPI row the clock card sits under: latest, year ago, year low, window peak. */
export function buildRateFigures(m30: readonly StatPoint[]): V3InstrumentFigure[] {
  const last = m30[m30.length - 1]
  if (!last) return []
  const figures: V3InstrumentFigure[] = [
    { value: v3Text(fmtPct(last.value)), label: v3Text(`30-year fixed, week of ${obsDay(last.observationDate)}`) },
  ]
  const lastEpoch = epochAt(last.observationDate)
  if (lastEpoch != null) {
    const target = lastEpoch - 365 * 86400000
    let best: StatPoint | null = null
    let bestGap = Infinity
    for (const p of m30) {
      const e = epochAt(p.observationDate)
      if (e == null) continue
      const gap = Math.abs(e - target)
      if (gap < bestGap) {
        bestGap = gap
        best = p
      }
    }
    if (best && best !== last && bestGap <= 14 * 86400000) {
      figures.push({
        value: v3Text(fmtPct(best.value)),
        label: v3Text(`a year earlier, ${obsDay(best.observationDate)}`),
      })
    }
  }
  const lastYear = isoParts(last.observationDate)?.y
  if (lastYear != null) {
    const yearRows = m30.filter((p) => isoParts(p.observationDate)?.y === lastYear)
    const low = yearRows.reduce<StatPoint | null>((a, p) => (a == null || p.value < a.value ? p : a), null)
    if (low) figures.push({ value: v3Text(fmtPct(low.value)), label: v3Text(`${lastYear} low`) })
  }
  const peak = m30.reduce<StatPoint | null>((a, p) => (a == null || p.value > a.value ? p : a), null)
  if (peak) {
    figures.push({
      value: v3Text(fmtPct(peak.value)),
      label: v3Text(`peak since ${RATE_WINDOW_FROM.slice(0, 4)}, ${obsMonthYear(peak.observationDate)}`),
    })
  }
  return figures
}

/* ------------------------------------------------------------------ */
/* Card 2 — the mortgage spread against its full-history norm           */
/* ------------------------------------------------------------------ */

export function buildSpreadCard(
  spread: readonly StatSpreadPoint[],
  norm: SpreadNorm,
): V3ChartCardProps | undefined {
  const last = spread[spread.length - 1]
  const first = spread[0]
  if (!last || !first || spread.length < 2) return undefined
  const points: V3ChartPoint[] = []
  for (const s of spread) {
    const at = epochAt(s.observationDate)
    if (at == null || !Number.isFinite(s.spread)) continue
    points.push({
      value: s.spread,
      tick: v3Text(obsMonthYear(s.observationDate)),
      label: v3Text(`${s.spread.toFixed(2)}pp`),
      at,
    })
  }
  if (points.length < 2) return undefined
  const firstAt = epochAt(first.observationDate)
  const lastAt = epochAt(last.observationDate)
  if (firstAt == null || lastAt == null) return undefined
  const normLabel = v3Text(`${norm.mean.toFixed(2)}pp`)
  const normSeries: V3ChartSeries = {
    name: v3Text(`Norm since ${norm.from.slice(0, 4)}`),
    points: [
      { value: norm.mean, tick: v3Text(obsMonthYear(first.observationDate)), label: normLabel, at: firstAt },
      { value: norm.mean, tick: v3Text(obsMonthYear(last.observationDate)), label: normLabel, at: lastAt },
    ],
  }
  const spreadSeries: V3ChartSeries[] = [{ name: v3Text('Mortgage minus Treasury'), points }, normSeries]
  const delta = last.spread - norm.mean
  const title =
    Math.abs(delta) < 0.005
      ? 'Spread sits at its norm'
      : `Spread ${Math.abs(delta).toFixed(2)}pp ${delta > 0 ? 'above' : 'below'} norm`
  return {
    id: 'lv-spread',
    title: v3Text(title),
    line: v3Text('Weekly 30-year mortgage minus the same-week 10-year Treasury, 2015 to now.'),
    source: v3Text(
      `FRED MORTGAGE30US minus DGS10, each week's mortgage average against the standing Treasury yield within 7 days, ` +
        `${spread.length} weeks from ${obsDayYear(first.observationDate)} to ${obsDayYear(last.observationDate)}; now ${last.spread.toFixed(2)}pp. ` +
        `The norm ${norm.mean.toFixed(2)}pp is the mean weekly spread over the full history, ${obsDayYear(norm.from)} to ${obsDayYear(norm.to)}, ${norm.n} pairs.`,
    ),
    wide: true,
    chart: {
      caption: v3Text('30-year mortgage minus 10-year Treasury, weekly, in percentage points'),
      // NO CLAIM: the card's title is the claim ("Spread 0.28pp above norm"),
      // computed from these same points. A second sentence saying it again is
      // the thing section 2 forbids. NO `emphasize`: it would bead 600 weekly
      // points, and the atom's default ladder already draws the subject solid
      // and the norm as a muted dashed line.
      series: spreadSeries,
      yTicks: customTicks(spreadSeries, (v) => `${v.toFixed(2)}pp`),
      xTicks: spacedTicks(spreadSeries, 3),
    },
  }
}

/* ------------------------------------------------------------------ */
/* Cards 3-5 — the mart's 28-year region cube                           */
/* ------------------------------------------------------------------ */

type YearPrice = { year: number; medianClose: number }

function martYears(co: readonly CoMarketAnnualRow[]): YearPrice[] {
  return co
    .filter((r) => r.source === 'mart' && r.medianClose != null && r.medianClose > 0)
    .map((r) => ({ year: r.year, medianClose: r.medianClose! }))
    .sort((a, b) => a.year - b.year)
}

function pricePoint(value: number, tick: string, at: number): V3ChartPoint | null {
  const label = formatPriceCompact(value)
  if (!label || label === '—' || value <= 0) return null
  return { value, tick: v3Text(tick), label: v3Text(label), at }
}

const MART_TRACE =
  'MLS region cube (analytics_mart_market_annual, geo central-oregon, type_scope sfr)'

export function buildNationIndexCard(
  co: readonly CoMarketAnnualRow[],
  csAnnualAvg: ReadonlyMap<number, number>,
): V3ChartCardProps | undefined {
  const years = martYears(co)
  const base = years.find((r) => r.year === INDEX_BASE_YEAR)
  const csBase = csAnnualAvg.get(INDEX_BASE_YEAR)
  if (!base || csBase == null || csBase <= 0) return undefined
  const lastYear = years[years.length - 1]!.year
  const coPoints: V3ChartPoint[] = []
  for (const r of years) {
    const idx = (r.medianClose / base.medianClose) * 100
    coPoints.push({ value: idx, tick: v3Text(String(r.year)), label: v3Text(idx.toFixed(0)), at: r.year })
  }
  const csPoints: V3ChartPoint[] = []
  const csYears = [...csAnnualAvg.keys()].sort((a, b) => a - b)
  for (const year of csYears) {
    if (year < INDEX_BASE_YEAR || year > lastYear) continue
    const idx = (csAnnualAvg.get(year)! / csBase) * 100
    csPoints.push({ value: idx, tick: v3Text(String(year)), label: v3Text(idx.toFixed(0)), at: year })
  }
  if (coPoints.length < 2 || csPoints.length < 2) return undefined
  const indexSeries: V3ChartSeries[] = [
    { name: v3Text('Central Oregon'), points: coPoints },
    { name: v3Text('U.S. Case-Shiller'), points: csPoints },
  ]
  const coMult = coPoints[coPoints.length - 1]!.value / 100
  const csMult = csPoints[csPoints.length - 1]!.value / 100
  return {
    id: 'lv-index',
    title: v3Text(`${coMult.toFixed(1)}x here, ${csMult.toFixed(1)}x nationally`),
    line: v3Text(
      `Region single-family median close indexed to ${INDEX_BASE_YEAR}, beside the national Case-Shiller index.`,
    ),
    source: v3Text(
      `Central Oregon: ${MART_TRACE}, annual median close divided by the ${INDEX_BASE_YEAR} median ${formatPrice(base.medianClose)}, through ${lastYear}. ` +
        `Nation: S&P Case-Shiller U.S. National (FRED CSUSHPINSA), calendar-year averages divided by the ${INDEX_BASE_YEAR} average ${csBase.toFixed(1)}, complete years only. Both series read ${INDEX_BASE_YEAR} = 100.`,
    ),
    wide: true,
    chart: {
      caption: v3Text(`Region median close and Case-Shiller national index, ${INDEX_BASE_YEAR} = 100`),
      // NO CLAIM: the title already states both multiples off these points.
      // `emphasize: 'first'` is the TASTE emphasis pattern — Central Oregon is
      // the subject in full ink, the nation is context in a navy tint.
      series: indexSeries,
      marks: true,
      emphasize: 'first',
      yTicks: customTicks(indexSeries, (v) => v.toFixed(0)),
      xTicks: yearTicks(indexSeries),
    },
  }
}

export function buildPriceVolumeCard(co: readonly CoMarketAnnualRow[]): V3ChartCardProps | undefined {
  const years = martYears(co)
  const withCounts = co
    .filter((r) => r.source === 'mart' && r.soldCount > 0)
    .sort((a, b) => a.year - b.year)
  const first = years[0]
  const last = years[years.length - 1]
  const firstCount = withCounts[0]
  const lastCount = withCounts[withCounts.length - 1]
  if (!first || !last || !firstCount || !lastCount || years.length < 2 || withCounts.length < 2) {
    return undefined
  }
  const pricePoints: V3ChartPoint[] = []
  for (const r of years) {
    const point = pricePoint(r.medianClose, String(r.year), r.year)
    if (point) pricePoints.push(point)
  }
  const soldPoints: V3ChartPoint[] = withCounts.map((r) => ({
    value: r.soldCount,
    tick: v3Text(String(r.year)),
    label: v3Text(r.soldCount.toLocaleString('en-US')),
    at: r.year,
  }))
  if (pricePoints.length < 2 || soldPoints.length < 2) return undefined
  const priceSeries: V3ChartSeries[] = [{ name: v3Text('Median close'), points: pricePoints }]
  const soldSeries: V3ChartSeries[] = [{ name: v3Text('Homes sold'), points: soldPoints }]
  const priceClaim = windowClaim({ metric: 'Median close price', unit: 'money', series: priceSeries })
  const soldClaim = windowClaim({ metric: 'Homes sold', unit: 'count', series: soldSeries })
  const mult = last.medianClose / first.medianClose
  const soldPct = (lastCount.soldCount / firstCount.soldCount - 1) * 100
  const dir = soldPct >= 0 ? 'up' : 'down'
  return {
    id: 'lv-price-volume',
    title: v3Text(`Prices ${mult.toFixed(1)}x, sales ${dir} ${Math.abs(soldPct).toFixed(0)}%`),
    line: v3Text(
      `Median close price and homes sold, region single-family, ${first.year} to ${last.year}.`,
    ),
    source: v3Text(
      `${MART_TRACE}: annual median close ${formatPrice(first.medianClose)} (${first.year}) to ${formatPrice(last.medianClose)} (${last.year}); ` +
        `homes sold ${firstCount.soldCount.toLocaleString('en-US')} (${firstCount.year}) to ${lastCount.soldCount.toLocaleString('en-US')} (${lastCount.year}). ` +
        `Price and count are different units, so the control switches between them rather than sharing one axis.`,
    ),
    switcher: {
      label: v3Text('Measure'),
      items: [
        { key: 'price', label: v3Text('Price') },
        { key: 'sold', label: v3Text('Homes sold') },
      ],
      panels: [
        {
          // Every panel of a SWITCHER carries its own claim: one card title
          // cannot describe two measures, and the reader has to know which
          // one is on screen. A card with a single chart carries none — there
          // the title is the claim.
          caption: v3Text('Median close price by year, region single-family'),
          ...(priceClaim ? { claim: v3Text(priceClaim) } : {}),
          series: priceSeries,
          marks: true,
          yTicks: moneyTicks(priceSeries),
          xTicks: yearTicks(priceSeries),
        },
        {
          caption: v3Text('Homes sold by year, region single-family'),
          ...(soldClaim ? { claim: v3Text(soldClaim) } : {}),
          kind: 'bars',
          run: true,
          baselineLabel: v3Text('0'),
          series: soldSeries,
        },
      ],
      defaultKey: 'price',
    },
  }
}

export function buildRealNominalCard(
  co: readonly CoMarketAnnualRow[],
  cpiAnnualAvg: ReadonlyMap<number, number>,
): V3ChartCardProps | undefined {
  const years = martYears(co)
  const deflatable = years.filter((r) => {
    const cpi = cpiAnnualAvg.get(r.year)
    return cpi != null && cpi > 0
  })
  const refRow = deflatable[deflatable.length - 1]
  if (!refRow || deflatable.length < 2) return undefined
  const cpiRef = cpiAnnualAvg.get(refRow.year)!
  const nominalPoints: V3ChartPoint[] = []
  for (const r of years) {
    const point = pricePoint(r.medianClose, String(r.year), r.year)
    if (point) nominalPoints.push(point)
  }
  const realPoints: V3ChartPoint[] = []
  for (const r of deflatable) {
    const real = r.medianClose * (cpiRef / cpiAnnualAvg.get(r.year)!)
    const point = pricePoint(real, String(r.year), r.year)
    if (point) realPoints.push(point)
  }
  if (nominalPoints.length < 2 || realPoints.length < 2) return undefined
  const realNominalSeries: V3ChartSeries[] = [
    { name: v3Text('Actual dollars'), points: nominalPoints },
    { name: v3Text(`${refRow.year} dollars`), points: realPoints },
  ]
  const realFirst = realPoints[0]!.value
  const realLast = realPoints[realPoints.length - 1]!.value
  const realMult = realLast / realFirst
  return {
    id: 'lv-real-nominal',
    title: v3Text(`Up ${realMult.toFixed(1)}x after inflation`),
    line: v3Text(
      `Region median close in actual dollars beside ${refRow.year} dollars, CPI adjusted.`,
    ),
    source: v3Text(
      `${MART_TRACE}: annual median close, ${deflatable[0]!.year} to ${refRow.year}. ` +
        `Deflator: BLS CPI-U (FRED CPIAUCSL), calendar-year averages; each year's median is multiplied by the ${refRow.year} average over that year's average. ` +
        `In ${refRow.year} dollars the ${deflatable[0]!.year} median ${formatPrice(deflatable[0]!.medianClose)} reads ${formatPrice(Math.round(realFirst))}.`,
    ),
    chart: {
      caption: v3Text(`Median close by year, actual dollars and ${refRow.year} dollars`),
      // NO CLAIM: the title states the real multiple off these same points.
      // `emphasize: 'last'` puts the inflation-adjusted line — the one the
      // card is about — in full ink and the nominal line in a navy tint.
      series: realNominalSeries,
      marks: true,
      emphasize: 'last',
      yTicks: moneyTicks(realNominalSeries),
      xTicks: yearTicks(realNominalSeries),
    },
  }
}

/* ------------------------------------------------------------------ */
/* Card 6 — concessions by quarter                                      */
/* ------------------------------------------------------------------ */

function quarterTick(quarterStart: string): string | null {
  const p = isoParts(quarterStart)
  if (!p) return null
  return `Q${Math.floor((p.m - 1) / 3) + 1} ${p.y}`
}

export function buildConcessionsCard(
  quarters: readonly ConcessionsQuarter[],
): V3ChartCardProps | undefined {
  const rows = quarters.filter((q) => q.closings > 0)
  const last = rows[rows.length - 1]
  const first = rows[0]
  if (!first || !last || rows.length < 2) return undefined
  const points: V3ChartPoint[] = []
  for (const q of rows) {
    const tick = quarterTick(q.quarterStart)
    if (!tick) continue
    const pct = q.share * 100
    points.push({ value: pct, tick: v3Text(tick), label: v3Text(`${pct.toFixed(1)}%`) })
  }
  if (points.length < 2) return undefined
  const lastPct = Math.round(last.share * 100)
  const lastTick = quarterTick(last.quarterStart) ?? last.quarterStart
  const medianBit =
    last.medianConcession != null
      ? ` The median concession among those closings was ${formatPrice(Math.round(last.medianConcession))}.`
      : ''
  return {
    id: 'lv-concessions',
    title: v3Text(`Concessions on ${lastPct}% of sales`),
    line: v3Text('Share of detached closings with a seller concession, by quarter, region wide.'),
    source: v3Text(
      `Supabase sale_pricing_seller_net, detached closings with a close price, grouped by close quarter, ` +
        `${quarterTick(first.quarterStart) ?? first.quarterStart} to ${lastTick}. ` +
        `${lastTick}: ${last.withConcessions.toLocaleString('en-US')} of ${last.closings.toLocaleString('en-US')} closings (${(last.share * 100).toFixed(1)}%) recorded a seller concession.${medianBit} ` +
        `The in-progress quarter is not shown.`,
    ),
    chart: {
      caption: v3Text('Share of detached closings with a seller concession, quarterly'),
      kind: 'bars',
      run: true,
      baselineLabel: v3Text('0%'),
      series: [{ name: v3Text('With a concession'), points }],
    },
  }
}

/* ------------------------------------------------------------------ */
/* Section assembly                                                     */
/* ------------------------------------------------------------------ */

export type LongViewSection = {
  headline: string
  figures: V3InstrumentFigure[]
  source: string
  cards: V3ChartCardProps[]
}

/**
 * The whole long-view section, or null when the rate series is absent — the
 * KPI row is the section's figures, and a section whose figures did not
 * return is not rendered with borrowed ones.
 */
export function buildLongViewSection(input: {
  m30: readonly StatPoint[]
  spread: readonly StatSpreadPoint[]
  norm: SpreadNorm | null
  coAnnual: readonly CoMarketAnnualRow[]
  csAnnualAvg: ReadonlyMap<number, number>
  cpiAnnualAvg: ReadonlyMap<number, number>
  concessionQuarters: readonly ConcessionsQuarter[]
}): LongViewSection | null {
  const figures = buildRateFigures(input.m30)
  const last = input.m30[input.m30.length - 1]
  if (figures.length === 0 || !last) return null

  const cards: V3ChartCardProps[] = []
  const clock = buildRateClockCard(input.m30)
  if (clock) cards.push(clock)
  const priceVolume = buildPriceVolumeCard(input.coAnnual)
  if (priceVolume) cards.push(priceVolume)
  const realNominal = buildRealNominalCard(input.coAnnual, input.cpiAnnualAvg)
  if (realNominal) cards.push(realNominal)
  const index = buildNationIndexCard(input.coAnnual, input.csAnnualAvg)
  if (index) cards.push(index)
  const concessions = buildConcessionsCard(input.concessionQuarters)
  if (concessions) cards.push(concessions)
  const spread = input.norm ? buildSpreadCard(input.spread, input.norm) : undefined
  if (spread) cards.push(spread)
  if (cards.length === 0) return null

  return {
    headline: `The 30-year rate is ${fmtPct(last.value)}`,
    figures,
    source:
      `Freddie Mac 30-year fixed-rate mortgage average via FRED (series MORTGAGE30US), weekly, latest week ${obsDayYear(last.observationDate)}. ` +
      `Each card below carries its own source.`,
    cards,
  }
}
