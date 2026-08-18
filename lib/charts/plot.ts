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
  yMinLabel: string
  yMaxLabel: string
  xStart: string
  xEnd: string
  vbW: number
  vbH: number
  pad: { l: number; r: number; t: number; b: number }
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

export type AnyPlot = LinePlot | BarPlot | MixPlot

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
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
  opts?: { pad?: Partial<typeof PAD> },
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
  const pad = { ...PAD, ...opts?.pad }
  const plotW = VB_W - pad.l - pad.r
  const plotH = VB_H - pad.t - pad.b

  const xOf = (xKey: number) => pad.l + ((xKey - xMin) / xSpan) * plotW
  const yOf = (value: number) => pad.t + (1 - (value - y0) / yRange) * plotH

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

  return {
    kind: 'line',
    lines,
    yMinLabel,
    yMaxLabel,
    xStart,
    xEnd,
    vbW: VB_W,
    vbH: VB_H,
    pad,
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
  const plotW = VB_W - PAD.l - PAD.r
  const plotH = VB_H - PAD.t - PAD.b
  const gap = plotW / n
  const barW = Math.max(4, gap * 0.62)
  points.forEach((p, i) => {
    const h = (p.value / yMax) * plotH
    const x = PAD.l + i * gap + (gap - barW) / 2
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
    ticks.push({ tick: p.tick, x: x + barW / 2, y: VB_H - 2 })
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
