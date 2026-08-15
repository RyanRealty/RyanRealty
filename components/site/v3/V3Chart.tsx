/**
 * V3 CHART. The series atom. Not a seventh pattern.
 *
 * Geometry lives in lib/charts/plot.ts so admin charts and print documents
 * draw the same line, bar, or mix. This file is the public skin: navy on
 * cream through ./tokens.css. A second series is a dashed muted stroke,
 * never a second hue. No chart library.
 *
 * Data contract, from CLAUDE.md section 0: `value` is for Y geometry only and
 * is never written on screen. Every tick, every reading, the caption, and the
 * empty reason arrive already formatted by the caller through lib/format.
 */
import { cn } from '@/lib/utils'
import {
  buildBarPlot,
  buildLinePlot,
  buildMixPlot,
  type AnyPlot,
  type PlotSeriesIn,
} from '@/lib/charts/plot'
import { V3_ROOT_CLASS, type V3Text } from './atoms'
import './tokens.css'
import './V3Chart.css'

export type V3ChartPoint = {
  value: number
  label: V3Text
  tick: V3Text
  at?: number
}

export type V3ChartSeries = {
  name: V3Text
  points: readonly V3ChartPoint[]
}

export type V3ChartKind = 'line' | 'bars' | 'mix'

export type V3ChartProps = {
  caption: V3Text
  series: readonly V3ChartSeries[]
  kind?: V3ChartKind
  /** Bars only. Horizontal for long category names (admin share). */
  layout?: 'vertical' | 'horizontal'
  /** Bars only. The zero baseline as the caller already formatted it. */
  baselineLabel?: V3Text
  emptyReason?: V3Text
  id?: string
  className?: string
}

function toPlotSeries(series: readonly V3ChartSeries[]): PlotSeriesIn[] {
  return series.map((s) => ({
    name: s.name,
    points: s.points.map((p) => ({
      value: p.value,
      label: p.label,
      tick: p.tick,
      at: p.at,
    })),
  }))
}

function buildAnyPlot(props: V3ChartProps): AnyPlot | null {
  const series = toPlotSeries(props.series)
  const kind = props.kind ?? 'line'
  if (kind === 'bars') {
    return buildBarPlot(series, {
      layout: props.layout ?? 'vertical',
      baselineLabel: props.baselineLabel,
    })
  }
  if (kind === 'mix') return buildMixPlot(series)
  return buildLinePlot(series)
}

function readings(plot: AnyPlot): { name: string; tick: string; label: string }[] {
  if (plot.kind === 'line') {
    return plot.lines.flatMap((line) =>
      line.points.filter((p) => p.plot).map((p) => ({ name: line.name, tick: p.tick, label: p.label })),
    )
  }
  if (plot.kind === 'mix') {
    return plot.segments.map((s) => ({ name: s.tick, tick: s.tick, label: s.label }))
  }
  return plot.bars.map((b) => ({ name: b.tick, tick: b.tick, label: b.label }))
}

export function V3Chart({
  caption,
  series,
  kind = 'line',
  layout,
  baselineLabel,
  emptyReason,
  id,
  className,
}: V3ChartProps) {
  if (caption.trim().length === 0) {
    throw new Error(
      'V3Chart: caption is empty. The caption is the accessible name of the ' +
        'figure. An empty one leaves the chart unnamed.',
    )
  }

  const plot = buildAnyPlot({ caption, series, kind, layout, baselineLabel })
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

  const keys =
    plot.kind === 'line'
      ? plot.lines.map((line) => line.name)
      : plot.kind === 'mix'
        ? plot.segments.map((s) => s.tick)
        : plot.bars.map((b) => b.tick)

  return (
    <figure
      id={id}
      className={cn(V3_ROOT_CLASS, 'v3-chart', `v3-chart--${plot.kind}`, className)}
      aria-labelledby={captionId}
      aria-label={captionId ? undefined : caption}
    >
      <figcaption id={captionId} className="v3-chart__caption">
        {caption}
      </figcaption>

      {keys.length > 1 ? (
        <ul className="v3-chart__legend">
          {keys.map((name, i) => (
            <li
              key={`${i}-${name}`}
              className={cn('v3-chart__key', `v3-chart__key--${Math.min(i, 2)}`)}
            >
              <span className="v3-chart__swatch" aria-hidden="true" />
              {name}
            </li>
          ))}
        </ul>
      ) : null}

      {plot.kind === 'line' ? (
        <div className="v3-chart__frame">
          <div className="v3-chart__y" aria-hidden="true">
            <span>{plot.yMaxLabel}</span>
            <span>{plot.yMinLabel}</span>
          </div>
          <div className="v3-chart__plot">
            <svg
              className="v3-chart__svg"
              viewBox={`0 0 ${plot.vbW} ${plot.vbH}`}
              preserveAspectRatio="none"
              role="presentation"
              aria-hidden="true"
            >
              <line className="v3-chart__axis-line" x1={2} y1={8} x2={2} y2={132} />
              <line className="v3-chart__axis-line" x1={2} y1={132} x2={318} y2={132} />
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
      ) : null}

      {plot.kind === 'bars' ? (
        <div className="v3-chart__frame">
          <div className="v3-chart__y" aria-hidden="true">
            <span>{plot.yMaxLabel}</span>
            <span>{plot.yMinLabel}</span>
          </div>
          <div className="v3-chart__plot">
            <svg
              className="v3-chart__svg"
              viewBox={`0 0 ${plot.vbW} ${plot.vbH}`}
              preserveAspectRatio="none"
              role="presentation"
              aria-hidden="true"
            >
              {plot.bars.map((b) => (
                <rect
                  key={`${b.index}-${b.tick}`}
                  className={cn('v3-chart__bar', `v3-chart__bar--${Math.min(b.index, 2)}`)}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx={2}
                />
              ))}
            </svg>
          </div>
          <div className="v3-chart__x" aria-hidden="true">
            <span>{plot.bars[0]?.tick}</span>
            <span>{plot.bars[plot.bars.length - 1]?.tick}</span>
          </div>
        </div>
      ) : null}

      {plot.kind === 'mix' ? (
        <div className="v3-chart__plot v3-chart__plot--mix">
          <svg
            className="v3-chart__svg"
            viewBox={`0 0 ${plot.vbW} ${plot.vbH}`}
            preserveAspectRatio="none"
            role="presentation"
            aria-hidden="true"
          >
            {plot.segments.map((s) => (
              <rect
                key={`${s.index}-${s.tick}`}
                className={cn('v3-chart__bar', `v3-chart__bar--${Math.min(s.index, 2)}`)}
                x={s.x}
                y={8}
                width={s.w}
                height={20}
              />
            ))}
          </svg>
        </div>
      ) : null}

      <ol className="v3-chart__data">
        {readings(plot).map((row, i) => (
          <li key={`${i}-${row.tick}`}>
            {row.name}: {row.tick}, {row.label}
          </li>
        ))}
      </ol>
    </figure>
  )
}
