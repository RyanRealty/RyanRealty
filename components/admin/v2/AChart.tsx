/**
 * Admin chart skin. Same geometry as V3Chart (lib/charts/plot.ts).
 * Color is --a-* only. No recharts. No public brand tokens.
 */
import { cn } from '@/lib/utils'
import {
  buildBarPlot,
  buildLinePlot,
  buildMixPlot,
  type AnyPlot,
  type ChartKind,
  type PlotSeriesIn,
} from '@/lib/charts/plot'
import './tokens.css'
import './AChart.css'

export type AChartPoint = {
  value: number
  label: string
  tick: string
  at?: number
}

export type AChartSeries = {
  name: string
  points: readonly AChartPoint[]
}

export type AChartProps = {
  caption: string
  series: readonly AChartSeries[]
  kind?: ChartKind
  layout?: 'vertical' | 'horizontal'
  baselineLabel?: string
  emptyReason?: string
  id?: string
  className?: string
}

function buildAnyPlot(props: AChartProps): AnyPlot | null {
  const series: PlotSeriesIn[] = props.series.map((s) => ({
    name: s.name,
    points: s.points.map((p) => ({
      value: p.value,
      label: p.label,
      tick: p.tick,
      at: p.at,
    })),
  }))
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

export function AChart({
  caption,
  series,
  kind = 'line',
  layout,
  baselineLabel,
  emptyReason,
  id,
  className,
}: AChartProps) {
  if (!caption.trim()) {
    throw new Error('AChart: caption is empty.')
  }

  const plot = buildAnyPlot({ caption, series, kind, layout, baselineLabel })
  const captionId = id ? `${id}-caption` : undefined

  if (!plot) {
    if (!emptyReason?.trim()) return null
    return (
      <figure
        id={id}
        className={cn('a-chart', className)}
        aria-labelledby={captionId}
        aria-label={captionId ? undefined : caption}
      >
        <figcaption id={captionId} className="a-chart__caption">
          {caption}
        </figcaption>
        <p className="a-chart__empty">{emptyReason}</p>
      </figure>
    )
  }

  return (
    <figure
      id={id}
      className={cn('a-chart', `a-chart--${plot.kind}`, className)}
      aria-labelledby={captionId}
      aria-label={captionId ? undefined : caption}
    >
      <figcaption id={captionId} className="a-chart__caption">
        {caption}
      </figcaption>

      {plot.kind === 'line' ? (
        <div className="a-chart__plot">
          <svg className="a-chart__svg" viewBox={`0 0 ${plot.vbW} ${plot.vbH}`} role="presentation" aria-hidden="true">
            {plot.lines.map((line, i) => (
              <path
                key={`${i}-${line.name}`}
                className={cn('a-chart__line', `a-chart__line--${Math.min(i, 2)}`)}
                d={line.d}
              />
            ))}
          </svg>
          <div className="a-chart__x">
            <span>{plot.xStart}</span>
            <span>{plot.xEnd}</span>
          </div>
        </div>
      ) : null}

      {plot.kind === 'bars' ? (
        <div className="a-chart__plot">
          <svg className="a-chart__svg" viewBox={`0 0 ${plot.vbW} ${plot.vbH}`} role="presentation" aria-hidden="true">
            {plot.bars.map((b) => (
              <rect
                key={`${b.index}-${b.tick}`}
                className={cn('a-chart__bar', `a-chart__bar--${Math.min(b.index, 2)}`)}
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={2}
              />
            ))}
          </svg>
        </div>
      ) : null}

      {plot.kind === 'mix' ? (
        <div className="a-chart__plot a-chart__plot--mix">
          <svg className="a-chart__svg" viewBox={`0 0 ${plot.vbW} ${plot.vbH}`} role="presentation" aria-hidden="true">
            {plot.segments.map((s) => (
              <rect
                key={`${s.index}-${s.tick}`}
                className={cn('a-chart__bar', `a-chart__bar--${Math.min(s.index, 2)}`)}
                x={s.x}
                y={8}
                width={s.w}
                height={20}
              />
            ))}
          </svg>
        </div>
      ) : null}

      <ol className="a-chart__data">
        {plot.kind === 'line'
          ? plot.lines.flatMap((line, i) =>
              line.points
                .filter((p) => p.plot)
                .map((p, j) => (
                  <li key={`${i}-${j}-${p.tick}`}>
                    {line.name}: {p.tick}, {p.label}
                  </li>
                )),
            )
          : plot.kind === 'mix'
            ? plot.segments.map((s) => (
                <li key={`${s.index}-${s.tick}`}>
                  {s.tick}, {s.label}
                </li>
              ))
            : plot.bars.map((b) => (
                <li key={`${b.index}-${b.tick}`}>
                  {b.tick}, {b.label}
                </li>
              ))}
      </ol>
    </figure>
  )
}
