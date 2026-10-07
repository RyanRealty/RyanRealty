/**
 * lib/studio/motion/chart.ts — a verified monthly series, drawn on in time.
 *
 * The trend film's one picture: a line of what homes sold for, month by
 * month, revealed left to right while a navy dot rides its tip. Time on the
 * x axis is time in the film, so the reveal moves by calendar position, not
 * by arc length: a steep month does not take longer to draw than a flat one,
 * and a month with no published value is a gap the dot steps over, never a
 * line drawn across it (dataviz anti-patterns: "Empty months dropped so a line
 * can connect").
 *
 * Geometry comes from lib/charts/plot.ts (the dataviz skill: "Geometry stays
 * in lib/charts/plot.ts"), scaled from its viewBox into the film's chart box.
 *
 * Honest scale (the critic pass of 2026-10-07). The line starts near the
 * data, which a line chart may; so nothing under it may read as a floor. No
 * baseline rule: an unlabelled rule under a near-data line reads as $0 and
 * turned a 6.9% dip into a picture of a 31% fall. Instead two or three
 * hairline gridlines at round values carry the scale, labelled in a gutter.
 * They are a ruler, not a claim about the market, so they are authored text.
 *
 * Labels that point at one value. The latest month, the one the film is
 * about, is labelled at its own height, right of its dot, where the line has
 * ended and nothing else can be read as its point (the end-of-line label). The
 * first month sits above the plot, over the line's own start, with a full-ink
 * leader down to its ring: the left edge is the one place the line touches
 * only at its first point. Only those two values print, each as written in
 * its §0 trace.
 */
import { buildLinePlot, lineTicks } from '@/lib/charts/plot'
import { cubicBezier, progress } from './ease'

/** A monthly series as a trend film receives it, oldest first, calendar kept. */
export type MotionSeries = {
  /** What the line is, in words: "Median sale price". */
  title: string
  /** The grain in plain words: "Single-family homes sold, by month". */
  scope: string
  /** One per calendar month. value null = no published figure that month. */
  points: Array<{ tick: string; value: number | null }>
  /** Figure keys whose values label the first and the last plotted month. */
  firstKey: string
  lastKey: string
}

/**
 * The plot box at 1080 x 1920. Left: a gutter for the scale labels inside
 * the safe area (x >= 90), clear of the first month's leader at the plot's
 * left edge. Right: room for the latest month's label beside its dot before
 * x = 990.
 */
export const CHART_BOX = { left: 184, top: 690, width: 542, height: 600 }
/** The scale labels' right edge: 14px short of the plot and its leader. */
export const SCALE_LABEL_X = CHART_BOX.left - 14
/** The heading's and the footer's left edge. */
export const TEXT_LEFT = 90

/** The first month's label sits above the plot: month, then value, then the leader down. */
export const LABEL_MONTH_Y = CHART_BOX.top - 104
export const LABEL_VALUE_Y = CHART_BOX.top - 52
export const LEADER_TOP = CHART_BOX.top - 34

/** The latest month's label: this far right of its dot, month above value. */
export const END_LABEL_DX = 26

/** How long the line takes to cross the box. */
export const CHART_DRAW_SECONDS = 2.4

/**
 * Air above and below the line, as a share of the data's span. A monthly
 * median at Bend's volume moves several percent month to month on sample
 * noise alone; drawn edge to edge, that noise reads as a crash. Form only:
 * the points and their values are unchanged, and the gridlines say the scale.
 */
const HEADROOM = 0.5

/**
 * The reveal curve: cubic-bezier(.65,0,.35,1), slow in, slow out. The dot
 * leaves the first month gently and settles on the latest, so the eye has
 * arrived before the label lands.
 */
const DRAW_EASE = [0.65, 0, 0.35, 1] as const

export type ChartPoint = { x: number; y: number; plot: boolean; tick: string }

export type ChartGeometry = {
  points: ChartPoint[]
  /** SVG path, straight segments, lifting across gaps. */
  d: string
  /** x of the first and the last plotted month. */
  x0: number
  x1: number
  first: ChartPoint
  last: ChartPoint
  /** Hairline gridlines at round values: the chart's scale. */
  gridlines: Array<{ y: number; label: string }>
}

/** "$700K", "$1.2M": a ruler's label, never a figure. */
export function scaleLabel(value: number): string {
  if (value >= 1_000_000) return `$${Number((value / 1_000_000).toFixed(2))}M`
  return `$${Math.round(value / 1000)}K`
}

/** Round values inside [lo, hi]: the smallest step that gives three or fewer. */
function roundTicks(lo: number, hi: number): number[] {
  const steps = [10_000, 20_000, 25_000, 50_000, 100_000, 200_000, 250_000, 500_000, 1_000_000]
  for (const step of steps) {
    const ticks: number[] = []
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v)
    if (ticks.length >= 1 && ticks.length <= 3) return ticks
  }
  return []
}

/** Pixel geometry for a series, or null when fewer than two months plot. */
export function chartGeometry(series: MotionSeries): ChartGeometry | null {
  const plot = buildLinePlot(
    [
      {
        name: series.title,
        points: series.points.map((p, i) => ({
          value: p.value ?? Number.NaN,
          label: '',
          tick: p.tick,
          at: i,
        })),
      },
    ],
    { headroom: { top: HEADROOM, bottom: HEADROOM } },
  )
  const line = plot?.lines[0]
  if (!plot || !line) return null
  const { l, t, w, h, y0, y1 } = plot.scale
  const px = (x: number) => Math.round((CHART_BOX.left + ((x - l) / w) * CHART_BOX.width) * 100) / 100
  const py = (y: number) => Math.round((CHART_BOX.top + ((y - t) / h) * CHART_BOX.height) * 100) / 100
  const points: ChartPoint[] = line.points.map((p) => ({ x: px(p.x), y: py(p.y), plot: p.plot, tick: p.tick }))
  const plotted = points.filter((p) => p.plot)
  if (plotted.length < 2) return null

  let d = ''
  let drawing = false
  for (const p of points) {
    if (!p.plot) {
      drawing = false
      continue
    }
    d += `${drawing ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)} `
    drawing = true
  }
  // Round values inside the drawn scale, kept clear of the box edges.
  const span = y1 - y0
  const values = roundTicks(y0 + span * 0.06, y1 - span * 0.06)
  const gridlines = lineTicks(
    plot,
    values.map((value) => ({ value, label: scaleLabel(value) })),
    undefined,
  ).y.map((tick) => ({ y: py(tick.y), label: tick.label }))
  const first = plotted[0]
  const last = plotted[plotted.length - 1]
  return { points, d: d.trim(), x0: first.x, x1: last.x, first, last, gridlines }
}

/** Eased draw progress at film time t for a draw over [start, start + seconds]. */
export function drawProgress(t: number, start: number, seconds = CHART_DRAW_SECONDS): number {
  const [x1, y1, x2, y2] = DRAW_EASE
  return cubicBezier(x1, y1, x2, y2, progress(t, start, seconds))
}

/**
 * Where the dot is when the reveal has reached x: on the line between the
 * plotted months either side, or null across a gap (the dot steps over it).
 */
export function dotAt(pts: readonly ChartPoint[], x: number): { x: number; y: number } | null {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    if (x < a.x || x > b.x) continue
    if (!a.plot || !b.plot) {
      if (a.plot && x === a.x) return { x: a.x, y: a.y }
      if (b.plot && x === b.x) return { x: b.x, y: b.y }
      return null
    }
    const f = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x)
    return { x: Math.round(x * 100) / 100, y: Math.round((a.y + (b.y - a.y) * f) * 100) / 100 }
  }
  const lastPoint = pts[pts.length - 1]
  return lastPoint?.plot && x >= lastPoint.x ? { x: lastPoint.x, y: lastPoint.y } : null
}

/**
 * The film time at which the reveal reaches each plotted month: the computed
 * sync point for that month's note (lib/studio/score 'datum'). Read off the
 * same eased curve the picture uses, so the sound lands on the frame the dot
 * passes the month, not on a typed timestamp.
 */
export function monthTimes(
  geometry: Pick<ChartGeometry, 'points' | 'x0' | 'x1'>,
  start: number,
  seconds = CHART_DRAW_SECONDS,
): Array<{ index: number; t: number }> {
  const span = geometry.x1 - geometry.x0 || 1
  const out: Array<{ index: number; t: number }> = []
  geometry.points.forEach((p, index) => {
    if (!p.plot) return
    const target = (p.x - geometry.x0) / span
    // drawProgress is monotone, so bisection finds its inverse exactly.
    let lo = 0
    let hi = 1
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2
      if (drawProgress(start + mid * seconds, start, seconds) < target) lo = mid
      else hi = mid
    }
    out.push({ index, t: Math.round((start + hi * seconds) * 1000) / 1000 })
  })
  return out
}
