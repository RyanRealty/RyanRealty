/**
 * V3 CHART. The series atom. Not a seventh pattern.
 *
 * Visual language: design_system/public/PUBLIC_UI.md (locked 2026-08-11).
 * D9 (Broker OS, 2026-08-12): a trend lives under the Instrument answer. The
 * six patterns stay closed. This file is the small piece Instrument mounts
 * when the caller has a series. Flattening that series to a figure is a
 * defect. A singleton status does not belong here. It stays type.
 *
 * Geometry, stolen from the honest KB chart and stripped of that register:
 * straight segments, the line lifts across a gap, no spline. A cubic would
 * invent values between the points the caller traced. Color is navy on cream
 * through ./tokens.css. A second series is a dashed muted stroke, never a
 * second hue. No chart library. Admin `--a-*` charts are a different plane.
 *
 * Data contract, from CLAUDE.md section 0: `value` is for Y geometry only and
 * is never written on screen. Every tick, every reading, the caption, and the
 * empty reason arrive already formatted by the caller through lib/format.
 * This primitive never fetches, never rounds, never parses a date, and never
 * builds a label from a number.
 *
 * Barrel law honored here:
 *  - Imports only ./atoms, @/lib/utils, and the local stylesheet. Nothing from
 *    components/site/kb, components/site (flat), components/site/primitives,
 *    components/site/explore, or components/ui.
 *  - Every name-bearing string is `V3Text`. `caption=""` is a compile error.
 *  - No 'use client'. Nothing here holds state. Hover readouts that format a
 *    number would both break that and risk inventing a figure.
 *  - No raw color. Every value comes from ./tokens.css through ./V3Chart.css.
 *  - Fewer than two finite points is not a line. The empty reason states why,
 *    or the atom renders nothing rather than a confident blank plot.
 */
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, type V3Text } from './atoms'
import './tokens.css'
import './V3Chart.css'

/* -------------------------------------------------------------------------- */
/* Points and series                                                           */
/* -------------------------------------------------------------------------- */

export type V3ChartPoint = {
  /**
   * Numeric Y for geometry only. Never rendered. Non-finite values lift the
   * line (a gap in the series, not a zero).
   */
  value: number
  /**
   * The reading as it should appear, already formatted by the caller
   * (formatPrice, a percent, a count). Axis labels and the hidden list use
   * this string, so the number on screen is the one the source trace covers.
   */
  label: V3Text
  /** The X reading as it should appear ("Jan 2024", "2022"). */
  tick: V3Text
  /**
   * Optional X geometry, same unit across every point that sets it (unix ms,
   * a month index). When any point in the chart sets `at`, placement uses
   * that domain. When none do, points are evenly spaced in the order given.
   */
  at?: number
}

export type V3ChartSeries = {
  /** The series name, and therefore the legend key and the hidden-list prefix. */
  name: V3Text
  /** In time order. This atom does not sort by tick text. */
  points: readonly V3ChartPoint[]
}

export type V3ChartProps = {
  /**
   * What the line is. The accessible name of the figure, distinct from the
   * Instrument verdict above it ("Median close, monthly" under "a balanced
   * market").
   */
  caption: V3Text
  /** One or more series. A series with fewer than two finite points is not drawn. */
  series: readonly V3ChartSeries[]
  /**
   * Why there is no line. Required for the empty visual. Omit only when the
   * caller is sure the series will plot. If the series cannot plot and this
   * is missing, the atom renders nothing rather than a blank plot.
   */
  emptyReason?: V3Text
  /**
   * The figure id. The caption id is this plus -caption. Pass one when the
   * page links here, or when two charts share a page.
   */
  id?: string
  className?: string
}

/* -------------------------------------------------------------------------- */
/* Geometry                                                                    */
/* -------------------------------------------------------------------------- */

const VB_W = 320
const VB_H = 140
const PAD = { l: 2, r: 2, t: 8, b: 8 }

type Plotted = {
  x: number
  y: number
  plot: boolean
  label: V3Text
  tick: V3Text
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value)
}

function linePath(points: readonly Plotted[]): string {
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

function buildPlot(series: readonly V3ChartSeries[]): {
  lines: { name: V3Text; d: string; points: Plotted[] }[]
  yMinLabel: V3Text
  yMaxLabel: V3Text
  xStart: V3Text
  xEnd: V3Text
} | null {
  const useAt = series.some((s) => s.points.some((p) => p.at != null && isFiniteNumber(p.at)))

  const finite: { point: V3ChartPoint; order: number }[] = []
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
  let yMinLabel: V3Text | null = null
  let yMaxLabel: V3Text | null = null
  let xStart: V3Text | null = null
  let xEnd: V3Text | null = null
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

  const lines: { name: V3Text; d: string; points: Plotted[] }[] = []
  series.forEach((s) => {
    const plotted: Plotted[] = s.points.map((point, order) => {
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

  return { lines, yMinLabel, yMaxLabel, xStart, xEnd }
}

/* -------------------------------------------------------------------------- */
/* Render                                                                      */
/* -------------------------------------------------------------------------- */

export function V3Chart({ caption, series, emptyReason, id, className }: V3ChartProps) {
  if (caption.trim().length === 0) {
    throw new Error(
      'V3Chart: caption is empty. The caption is the accessible name of the ' +
        'figure. An empty one leaves the chart unnamed.',
    )
  }

  const plot = buildPlot(series)
  const captionId = id ? `${id}-caption` : undefined

  if (!plot) {
    if (!emptyReason || emptyReason.trim().length === 0) return null
    return (
      <figure
        id={id}
        className={cn(V3_ROOT_CLASS, 'v3-chart', className)}
        aria-labelledby={captionId}
        aria-label={captionId ? undefined : caption}
      >
        <figcaption id={captionId} className="v3-chart__caption">
          {caption}
        </figcaption>
        <p className="v3-chart__empty">{emptyReason}</p>
      </figure>
    )
  }

  return (
    <figure
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-chart', className)}
      aria-labelledby={captionId}
      aria-label={captionId ? undefined : caption}
    >
      <figcaption id={captionId} className="v3-chart__caption">
        {caption}
      </figcaption>

      {plot.lines.length > 1 ? (
        <ul className="v3-chart__legend">
          {plot.lines.map((line, i) => (
            <li
              key={`${i}-${line.name}`}
              className={cn('v3-chart__key', `v3-chart__key--${Math.min(i, 2)}`)}
            >
              <span className="v3-chart__swatch" aria-hidden="true" />
              {line.name}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="v3-chart__frame">
        <div className="v3-chart__y" aria-hidden="true">
          <span>{plot.yMaxLabel}</span>
          <span>{plot.yMinLabel}</span>
        </div>
        <div className="v3-chart__plot">
          <svg
            className="v3-chart__svg"
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            preserveAspectRatio="none"
            role="presentation"
            aria-hidden="true"
          >
            <line className="v3-chart__axis-line" x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={VB_H - PAD.b} />
            <line
              className="v3-chart__axis-line"
              x1={PAD.l}
              y1={VB_H - PAD.b}
              x2={VB_W - PAD.r}
              y2={VB_H - PAD.b}
            />
            {plot.lines.map((line, i) => (
              <path
                key={`${i}-${line.name}`}
                className={cn('v3-chart__line', `v3-chart__line--${Math.min(i, 2)}`)}
                d={line.d}
              />
            ))}
          </svg>
        </div>
        <div className="v3-chart__x" aria-hidden="true">
          <span>{plot.xStart}</span>
          <span>{plot.xEnd}</span>
        </div>
      </div>

      <ol className="v3-chart__data">
        {plot.lines.flatMap((line, i) =>
          line.points
            .filter((p) => p.plot)
            .map((p, j) => (
              <li key={`${i}-${j}-${p.tick}`}>
                {line.name}: {p.tick}, {p.label}
              </li>
            )),
        )}
      </ol>
    </figure>
  )
}
