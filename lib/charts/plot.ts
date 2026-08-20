/**
 * Shared chart geometry. No color, no React, no formatting.
 *
 * Public (V3Chart), admin (AChart), and print documents (CMA / packets)
 * draw from this file so a series is the same line, bar, or mix everywhere.
 * value is Y geometry only. Every label and tick is a string the caller
 * already formatted. A cubic would invent values between the points.
 */

export const VB_W = 320
export const VB_H = 140
export const MIX_H = 36
export const PAD = { l: 2, r: 2, t: 8, b: 8 }

export type ChartKind = 'line' | 'bars' | 'mix'

export type PlotPointIn = {
  value: number
  label: string
  tick: string
  at?: number
}

export type PlotSeriesIn = {
  name: string
  points: readonly PlotPointIn[]
}

export type PlottedPoint = {
  x: number
  y: number
  plot: boolean
  label: string
  tick: string
}

export type LinePlot = {
  kind: 'line'
  lines: { name: string; d: string; points: PlottedPoint[] }[]
  /** Threshold zones behind the lines, clamped to the data's y-domain. */
  bands: { y: number; h: number; label: string }[]
  yMinLabel: string
  yMaxLabel: string
  xStart: string
  xEnd: string
  vbW: number
  vbH: number
}

export type BarRect = {
  name: string
  tick: string
  label: string
  x: number
  y: number
  w: number
  h: number
  index: number
  highlight: boolean
}

export type BarPlot = {
  kind: 'bars'
  layout: 'vertical' | 'horizontal'
  bars: BarRect[]
  yMinLabel: string
  yMaxLabel: string
  ticks: { tick: string; x: number; y: number }[]
  vbW: number
  vbH: number
}

export type MixSegment = {
  name: string
  tick: string
  label: string
  x: number
  w: number
  index: number
}

export type MixPlot = {
  kind: 'mix'
  segments: MixSegment[]
  totalLabel: string
  vbW: number
  vbH: number
}

/** A horizontal value band (threshold zone) mapped into the line frame. */
export type LineBand = {
  y: number
  h: number
  label: string
}

/** One row of a range plot: a lollipop dot, or a dumbbell pair. Percent geometry. */
export type RangeRowIn = {
  /** Row name (a town, a segment). */
  tick: string
  /** The primary value — the filled dot. */
  value: number
  /** The primary value as the caller formatted it. */
  label: string
  /** Optional prior/context value — makes the row a dumbbell. */
  baseValue?: number
  /** The prior value as the caller formatted it. */
  baseLabel?: string
  /** Context for the reading (population, sample size). Pass-through, no geometry. */
  note?: string
  /**
   * Rows the primary figure was computed over. Pass-through, no geometry —
   * the atom formats and draws it. See V3ChartRangeRow.sample for the rule
   * governing when a caller may supply this at all.
   */
  sampleN?: number
  /** Rows the BASE (prior) figure was computed over, on a dumbbell row. */
  sampleBaseN?: number
}

export type RangeBandIn = {
  from: number
  to: number
  label: string
}

export type RangePlotRow = {
  tick: string
  /** Primary dot position, percent of the track (0–100). */
  xPct: number
  label: string
  /** Dumbbell tail position, percent; null on a lollipop row. */
  baseXPct: number | null
  baseLabel: string | null
  /** Stem span, percent. Lollipop stems rise from the domain floor. */
  stemStartPct: number
  stemEndPct: number
  /** Context for the reading, as the caller passed it. */
  note: string | null
  /** Rows the primary figure was computed over; null when unpublished. */
  sampleN: number | null
  /** Rows the base figure was computed over; null on a lollipop row. */
  sampleBaseN: number | null
  /**
   * True when the row's value sits beyond opts.clampMax and is drawn AT the
   * clamp instead of at scale (the chart-room broken-bar rule: one 36-month
   * outlier must not compress every other row into the left tenth of the
   * track). The label still carries the true reading.
   */
  clamped: boolean
  index: number
}

export type RangePlot = {
  kind: 'range'
  rows: RangePlotRow[]
  bands: { xPct: number; wPct: number; label: string }[]
  /** Vertical reference rule (e.g. the region figure); null when out of domain. */
  ref: { xPct: number; label: string } | null
  xMinLabel: string
  xMaxLabel: string
}

export type AnyPlot = LinePlot | BarPlot | MixPlot | RangePlot

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
}

/**
 * A sample size, or null. A negative or fractional count is not a count of
 * rows, and drawing one would put a number on the page that no query returned.
 */
function countOrNull(value: number | undefined): number | null {
  return value != null && Number.isInteger(value) && value >= 0 ? value : null
}

export function linePath(points: readonly PlottedPoint[]): string {
  let d = ''
  let drawing = false
  for (const p of points) {
    if (!p.plot) {
      drawing = false
      continue
    }
    const cmd = drawing ? 'L' : 'M'
    d += `${cmd}${p.x.toFixed(2)},${p.y.toFixed(2)} `
    drawing = true
  }
  return d.trim()
}

/** Straight segments. The line lifts across a gap. No spline. */
export function buildLinePlot(
  series: readonly PlotSeriesIn[],
  opts?: { bands?: readonly RangeBandIn[] },
): LinePlot | null {
  const useAt = series.some((s) => s.points.some((p) => p.at != null && isFiniteNumber(p.at)))

  const finite: { point: PlotPointIn; order: number }[] = []
  series.forEach((s) => {
    s.points.forEach((point, order) => {
      if (!isFiniteNumber(point.value)) return
      if (useAt && (point.at == null || !isFiniteNumber(point.at))) return
      finite.push({ point, order })
    })
  })
  if (finite.length < 2) return null

  let xMin = Infinity
  let xMax = -Infinity
  let yMin = Infinity
  let yMax = -Infinity
  let yMinLabel: string | null = null
  let yMaxLabel: string | null = null
  let xStart: string | null = null
  let xEnd: string | null = null
  let xStartAt = Infinity
  let xEndAt = -Infinity

  for (const row of finite) {
    const xKey = useAt ? (row.point.at as number) : row.order
    if (row.point.value < yMin) {
      yMin = row.point.value
      yMinLabel = row.point.label
    }
    if (row.point.value > yMax) {
      yMax = row.point.value
      yMaxLabel = row.point.label
    }
    if (xKey < xMin) xMin = xKey
    if (xKey > xMax) xMax = xKey
    if (xKey < xStartAt) {
      xStartAt = xKey
      xStart = row.point.tick
    }
    if (xKey > xEndAt) {
      xEndAt = xKey
      xEnd = row.point.tick
    }
  }
  if (yMinLabel == null || yMaxLabel == null || xStart == null || xEnd == null) return null

  const ySpan = yMax - yMin || 1
  const yPad = ySpan * 0.06
  const y0 = yMin - yPad
  const y1 = yMax + yPad
  const yRange = y1 - y0 || 1
  const xSpan = xMax - xMin || 1
  const plotW = VB_W - PAD.l - PAD.r
  const plotH = VB_H - PAD.t - PAD.b

  const xOf = (xKey: number) => PAD.l + ((xKey - xMin) / xSpan) * plotW
  const yOf = (value: number) => PAD.t + (1 - (value - y0) / yRange) * plotH

  const lines: LinePlot['lines'] = []
  series.forEach((s) => {
    const plotted: PlottedPoint[] = s.points.map((point, order) => {
      const plot =
        isFiniteNumber(point.value) &&
        (!useAt || (point.at != null && isFiniteNumber(point.at)))
      const xKey = useAt && point.at != null ? point.at : order
      return {
        x: plot ? xOf(xKey) : 0,
        y: plot ? yOf(point.value) : 0,
        plot,
        label: point.label,
        tick: point.tick,
      }
    })
    const plotCount = plotted.filter((p) => p.plot).length
    if (plotCount < 2) return
    const d = linePath(plotted)
    if (!d) return
    lines.push({ name: s.name, d, points: plotted })
  })
  if (lines.length === 0) return null

  // Threshold zones, clamped to the data's y-domain. A band is context for
  // values that exist; it never widens the domain, and one that falls wholly
  // outside the plotted range is dropped rather than distorting the scale.
  const bands: LinePlot['bands'] = []
  for (const band of opts?.bands ?? []) {
    if (!isFiniteNumber(band.from) || !isFiniteNumber(band.to)) continue
    const lo = Math.max(Math.min(band.from, band.to), y0)
    const hi = Math.min(Math.max(band.from, band.to), y1)
    if (!(hi > lo)) continue
    const top = yOf(hi)
    const bottom = yOf(lo)
    bands.push({ y: top, h: bottom - top, label: band.label })
  }

  return {
    kind: 'line',
    lines,
    bands,
    yMinLabel,
    yMaxLabel,
    xStart,
    xEnd,
    vbW: VB_W,
    vbH: VB_H,
  }
}

/**
 * Lollipop / dumbbell rows: categories on Y, one value (dot) or a pair
 * (prior -> current) on X. Geometry is PERCENT of the track so the renderer
 * lays rows out in HTML and circles stay circles at any width — a stretched
 * SVG viewBox would draw them as ellipses.
 *
 * Domain: with any dumbbell pair present, the padded extent of all values;
 * lollipop-only rows with a non-negative floor anchor at zero so stem length
 * is magnitude, not an artifact of the minimum.
 */
export function buildRangePlot(
  rows: readonly RangeRowIn[],
  opts?: {
    bands?: readonly RangeBandIn[]
    /**
     * Domain ceiling. A value beyond it is drawn AT the ceiling with
     * `clamped: true` instead of stretching the scale (one degenerate
     * outlier — a 36-month supply on 6 actives — must not flatten every
     * honest row). The row's label still states the true value.
     */
    clampMax?: number
    /** Vertical reference rule (a region figure, full ask). Dropped when it falls outside the domain. */
    refValue?: number
    refLabel?: string
  },
): RangePlot | null {
  const usable = rows.filter((r) => isFiniteNumber(r.value))
  if (usable.length < 1) return null

  const clampMax =
    opts?.clampMax != null && isFiniteNumber(opts.clampMax) ? opts.clampMax : null
  const clampOf = (value: number) => (clampMax != null ? Math.min(value, clampMax) : value)

  const hasBase = usable.some((r) => r.baseValue != null && isFiniteNumber(r.baseValue))
  let min = Infinity
  let max = -Infinity
  let minLabel = usable[0]!.label
  let maxLabel = usable[0]!.label
  const consider = (value: number, label: string) => {
    if (value < min) {
      min = value
      minLabel = label
    }
    if (value > max) {
      max = value
      maxLabel = label
    }
  }
  for (const r of usable) {
    consider(clampOf(r.value), r.label)
    if (r.baseValue != null && isFiniteNumber(r.baseValue)) {
      consider(clampOf(r.baseValue), r.baseLabel ?? r.label)
    }
  }

  let lo: number
  let hi: number
  if (!hasBase && min >= 0) {
    lo = 0
    hi = max === 0 ? 1 : max * 1.06
  } else {
    const span = max - min || Math.abs(max) || 1
    lo = min - span * 0.08
    hi = max + span * 0.08
  }
  const range = hi - lo || 1
  const pct = (value: number) => ((value - lo) / range) * 100

  const plotted: RangePlotRow[] = usable.map((r, index) => {
    const x = pct(clampOf(r.value))
    const base =
      r.baseValue != null && isFiniteNumber(r.baseValue) ? pct(clampOf(r.baseValue)) : null
    return {
      tick: r.tick,
      xPct: x,
      label: r.label,
      baseXPct: base,
      baseLabel: base != null ? (r.baseLabel ?? null) : null,
      stemStartPct: base != null ? Math.min(base, x) : 0,
      stemEndPct: base != null ? Math.max(base, x) : x,
      note: r.note ?? null,
      sampleN: countOrNull(r.sampleN),
      // A base sample only means something on a row that HAS a base value; on
      // a lollipop it would render a parenthetical against nothing.
      sampleBaseN: base != null ? countOrNull(r.sampleBaseN) : null,
      clamped: clampMax != null && r.value > clampMax,
      index,
    }
  })

  const bands: RangePlot['bands'] = []
  for (const band of opts?.bands ?? []) {
    if (!isFiniteNumber(band.from) || !isFiniteNumber(band.to)) continue
    const bLo = Math.max(Math.min(band.from, band.to), lo)
    const bHi = Math.min(Math.max(band.from, band.to), hi)
    if (!(bHi > bLo)) continue
    bands.push({ xPct: pct(bLo), wPct: pct(bHi) - pct(bLo), label: band.label })
  }

  // Reference rule. Only drawn inside the domain: a reference the scale cannot
  // place would render at a false position, so it is dropped (the caller's
  // source note still carries the number).
  let ref: RangePlot['ref'] = null
  if (
    opts?.refValue != null &&
    isFiniteNumber(opts.refValue) &&
    opts.refLabel != null &&
    opts.refValue >= lo &&
    opts.refValue <= hi
  ) {
    ref = { xPct: pct(opts.refValue), label: opts.refLabel }
  }

  return {
    kind: 'range',
    rows: plotted,
    bands,
    ref,
    xMinLabel: minLabel,
    xMaxLabel: maxLabel,
  }
}

export function buildBarPlot(
  series: readonly PlotSeriesIn[],
  opts?: {
    layout?: 'vertical' | 'horizontal'
    highlightTicks?: readonly string[]
    baselineLabel?: string
  },
): BarPlot | null {
  const layout = opts?.layout ?? 'vertical'
  const highlight = new Set(opts?.highlightTicks ?? [])
  const source = series[0]
  if (!source) return null
  const points = source.points.filter((p) => isFiniteNumber(p.value) && p.value > 0)
  if (points.length < 1) return null

  let yMax = 0
  let yMaxLabel = points[0]!.label
  for (const p of points) {
    if (p.value > yMax) {
      yMax = p.value
      yMaxLabel = p.label
    }
  }
  if (!(yMax > 0)) return null
  const yMinLabel = opts?.baselineLabel ?? points[points.length - 1]!.label

  const bars: BarRect[] = []
  const ticks: BarPlot['ticks'] = []

  if (layout === 'horizontal') {
    const rowH = 16
    const vbH = Math.max(VB_H, PAD.t + PAD.b + points.length * rowH)
    const plotW = VB_W - PAD.l - PAD.r
    const plotLeft = PAD.l
    points.forEach((p, i) => {
      const w = (p.value / yMax) * plotW
      const y = PAD.t + i * rowH
      bars.push({
        name: source.name,
        tick: p.tick,
        label: p.label,
        x: plotLeft,
        y,
        w: Math.max(w, 1),
        h: 10,
        index: i,
        highlight: highlight.has(p.tick),
      })
      ticks.push({ tick: p.tick, x: plotLeft, y: y + 8 })
    })
    return {
      kind: 'bars',
      layout,
      bars,
      yMinLabel,
      yMaxLabel,
      ticks,
      vbW: VB_W,
      vbH,
    }
  }

  const n = points.length
  const padL = 16
  const padR = 16
  const padB = 18
  const plotW = VB_W - padL - padR
  const plotH = VB_H - PAD.t - padB
  const gap = plotW / n
  const barW = Math.max(4, gap * 0.62)
  points.forEach((p, i) => {
    const h = (p.value / yMax) * plotH
    const x = padL + i * gap + (gap - barW) / 2
    const y = PAD.t + plotH - h
    bars.push({
      name: source.name,
      tick: p.tick,
      label: p.label,
      x,
      y,
      w: barW,
      h: Math.max(h, 1),
      index: i,
      highlight: highlight.has(p.tick),
    })
    ticks.push({ tick: p.tick, x: x + barW / 2, y: VB_H - 6 })
  })

  return {
    kind: 'bars',
    layout,
    bars,
    yMinLabel,
    yMaxLabel,
    ticks,
    vbW: VB_W,
    vbH: VB_H,
  }
}

export function buildMixPlot(
  series: readonly PlotSeriesIn[],
  opts?: { totalLabel?: string },
): MixPlot | null {
  const source = series[0]
  if (!source) return null
  const points = source.points.filter((p) => isFiniteNumber(p.value) && p.value > 0)
  if (points.length < 1) return null
  const total = points.reduce((sum, p) => sum + p.value, 0)
  if (!(total > 0)) return null

  const plotW = VB_W - PAD.l - PAD.r
  let x = PAD.l
  const segments: MixSegment[] = points.map((p, i) => {
    const w = (p.value / total) * plotW
    const seg = {
      name: source.name,
      tick: p.tick,
      label: p.label,
      x,
      w: Math.max(w, 1),
      index: i,
    }
    x += w
    return seg
  })

  return {
    kind: 'mix',
    segments,
    totalLabel: opts?.totalLabel ?? source.name,
    vbW: VB_W,
    vbH: MIX_H,
  }
}
