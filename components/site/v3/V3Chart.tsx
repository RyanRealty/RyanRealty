/**
 * V3 CHART. The series atom. Not a seventh pattern.
 *
 * Geometry lives in lib/charts/plot.ts so admin charts and print documents
 * draw the same line, bar, or mix. This file is the public skin: navy on
 * cream through ./tokens.css. A second series is a dashed muted stroke,
 * never a second hue — EXCEPT the year-over-year overlay (`overlay="yoy"`),
 * where up to five series take the validated categorical run in tokens.css
 * (chart-room lock 2026-08-19; every line also carries its name in the
 * legend, so hue is never the only encoding).
 *
 * Chart-room forms this atom covers beyond line/bars/mix:
 *   - kind="range": lollipop (one dot per row) and dumbbell (prior → current
 *     pair) rows, laid out in HTML so dots stay circular at any width.
 *   - bands: threshold zones (e.g. seller's / balanced / buyer's) behind a
 *     line or across range rows, clamped to the data's domain.
 *   - marks: per-point dots on a line with a native <title> reading, so every
 *     mark answers on hover and in the accessibility tree.
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
  buildRangePlot,
  type AnyPlot,
  type PlotSeriesIn,
  type RangeBandIn,
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

/**
 * A threshold zone. `label` names the zone as the caller formatted it. On
 * range rows the name draws INSIDE the band, so keep it short ("Seller's",
 * "4–6") — a name wider than its band clips.
 */
export type V3ChartBand = {
  from: number
  to: number
  label: V3Text
}

/** One range row: a lollipop dot, or a dumbbell when baseValue is present. */
export type V3ChartRangeRow = {
  tick: V3Text
  value: number
  label: V3Text
  baseValue?: number
  baseLabel?: V3Text
  /**
   * Context for the row's reading — the population behind the figure
   * ("475 active single-family · 167 closed in 30 days · small sample").
   * Carried in the native title and the hidden reading list, never drawn
   * on the track.
   */
  note?: V3Text
}

export type V3ChartKind = 'line' | 'bars' | 'mix' | 'range'

/** The categorical slots tokens.css defines. More series than this cannot keep identity. */
export const V3_CHART_CATEGORY_SLOTS = 5

export type V3ChartProps = {
  caption: V3Text
  /** Line / bars / mix input. Ignored when kind="range". */
  series?: readonly V3ChartSeries[]
  /** Range rows. Required when kind="range". */
  rows?: readonly V3ChartRangeRow[]
  kind?: V3ChartKind
  /**
   * Year-over-year coloring: each line keeps one categorical hue instead of
   * the dashed context ladder. Lines only, at most V3_CHART_CATEGORY_SLOTS
   * series — the caller curates which years are on.
   */
  overlay?: 'yoy'
  /** Threshold zones behind a line or across range rows. */
  bands?: readonly V3ChartBand[]
  /**
   * Range rows only: domain ceiling. A row's value beyond it draws AT the
   * ceiling in the exception ink with its true reading — the chart-room
   * broken-bar rule, so one degenerate outlier cannot flatten every honest
   * row into the left edge of the track.
   */
  clampMax?: number
  /** Range rows only: a vertical reference rule (the region figure, full ask). */
  refValue?: number
  /** Names the reference rule. Required for refValue to draw. */
  refLabel?: V3Text
  /** Per-point dots with a native <title> reading. Lines only. */
  marks?: boolean
  /** Legend name for the primary dot of a dumbbell row set. */
  rangeKeyLabel?: V3Text
  /** Legend name for the base (prior) dot of a dumbbell row set. */
  rangeBaseKeyLabel?: V3Text
  /** Bars only. Horizontal for long category names (admin share). */
  layout?: 'vertical' | 'horizontal'
  /**
   * Bars only. The ticks are consecutive periods of ONE population (quarters,
   * years), not categories: every bar draws in the primary tone and the
   * per-bar key legend is omitted — the x axis already names the run's ends,
   * and a legend repeating every period is noise. Category bars keep the
   * default keyed rendering.
   */
  run?: boolean
  /** Bars only. The zero baseline as the caller already formatted it. */
  baselineLabel?: V3Text
  emptyReason?: V3Text
  id?: string
  className?: string
}

function toPlotSeries(series: readonly V3ChartSeries[] | undefined): PlotSeriesIn[] {
  return (series ?? []).map((s) => ({
    name: s.name,
    points: s.points.map((p) => ({
      value: p.value,
      label: p.label,
      tick: p.tick,
      at: p.at,
    })),
  }))
}

function toPlotBands(bands: readonly V3ChartBand[] | undefined): RangeBandIn[] {
  return (bands ?? []).map((b) => ({ from: b.from, to: b.to, label: b.label }))
}

function buildAnyPlot(props: V3ChartProps): AnyPlot | null {
  const kind = props.kind ?? 'line'
  if (kind === 'range') {
    return buildRangePlot(
      (props.rows ?? []).map((r) => ({
        tick: r.tick,
        value: r.value,
        label: r.label,
        baseValue: r.baseValue,
        baseLabel: r.baseLabel,
        note: r.note,
      })),
      {
        bands: toPlotBands(props.bands),
        clampMax: props.clampMax,
        refValue: props.refValue,
        refLabel: props.refLabel,
      },
    )
  }
  const series = toPlotSeries(props.series)
  if (kind === 'bars') {
    return buildBarPlot(series, {
      layout: props.layout ?? 'vertical',
      baselineLabel: props.baselineLabel,
    })
  }
  if (kind === 'mix') return buildMixPlot(series)
  return buildLinePlot(series, { bands: toPlotBands(props.bands) })
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
  if (plot.kind === 'range') {
    return plot.rows.map((r) => ({
      name: r.tick,
      tick: r.tick,
      label:
        (r.baseLabel != null ? `${r.label} (${r.baseLabel})` : r.label) +
        (r.note ? ` — ${r.note}` : ''),
    }))
  }
  return plot.bars.map((b) => ({ name: b.tick, tick: b.tick, label: b.label }))
}

export function V3Chart({
  caption,
  series,
  rows,
  kind = 'line',
  overlay,
  bands,
  clampMax,
  refValue,
  refLabel,
  marks,
  rangeKeyLabel,
  rangeBaseKeyLabel,
  layout,
  run,
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
  if (overlay === 'yoy' && kind !== 'line') {
    throw new Error('V3Chart: overlay="yoy" colors lines. Use kind="line".')
  }
  if (overlay === 'yoy' && (series?.length ?? 0) > V3_CHART_CATEGORY_SLOTS) {
    throw new Error(
      `V3Chart: overlay="yoy" takes at most ${V3_CHART_CATEGORY_SLOTS} series — ` +
        'the caller curates which years are on. More lines than the validated ' +
        'categorical run cannot keep their identity.',
    )
  }

  const plot = buildAnyPlot({
    caption,
    series,
    rows,
    kind,
    overlay,
    bands,
    clampMax,
    refValue,
    refLabel,
    layout,
    baselineLabel,
  })
  const captionId = id ? `${id}-caption` : undefined
  const yoy = overlay === 'yoy'

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
        : plot.kind === 'range' || (plot.kind === 'bars' && run)
          ? []
          : plot.bars.map((b) => b.tick)

  const rangeHasBase = plot.kind === 'range' && plot.rows.some((r) => r.baseXPct != null)

  return (
    <figure
      id={id}
      className={cn(
        V3_ROOT_CLASS,
        'v3-chart',
        `v3-chart--${plot.kind}`,
        yoy && 'v3-chart--yoy',
        className,
      )}
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
              className={cn(
                'v3-chart__key',
                yoy
                  ? `v3-chart__key--cat${Math.min(i, V3_CHART_CATEGORY_SLOTS - 1)}`
                  : `v3-chart__key--${Math.min(i, 2)}`,
              )}
            >
              <span className="v3-chart__swatch" aria-hidden="true" />
              {name}
            </li>
          ))}
        </ul>
      ) : null}

      {rangeHasBase && rangeKeyLabel && rangeBaseKeyLabel ? (
        <ul className="v3-chart__legend">
          <li className="v3-chart__key v3-chart__key--dot">
            <span className="v3-chart__dotswatch" aria-hidden="true" />
            {rangeKeyLabel}
          </li>
          <li className="v3-chart__key v3-chart__key--dotbase">
            <span className="v3-chart__dotswatch" aria-hidden="true" />
            {rangeBaseKeyLabel}
          </li>
        </ul>
      ) : null}

      {plot.kind === 'line' && plot.bands.length > 0 ? (
        <p className="v3-chart__bandkey" aria-hidden="true">
          {plot.bands.map((b) => b.label).join(' · ')}
        </p>
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
              {plot.bands.map((b, i) => (
                <rect
                  key={`band-${i}`}
                  className="v3-chart__band"
                  x={2}
                  y={b.y}
                  width={316}
                  height={b.h}
                />
              ))}
              <line className="v3-chart__axis-line" x1={2} y1={8} x2={2} y2={132} />
              <line className="v3-chart__axis-line" x1={2} y1={132} x2={318} y2={132} />
              {plot.lines.map((line, i) => (
                <path
                  key={`${i}-${line.name}`}
                  className={cn(
                    'v3-chart__line',
                    yoy
                      ? `v3-chart__line--cat${Math.min(i, V3_CHART_CATEGORY_SLOTS - 1)}`
                      : `v3-chart__line--${Math.min(i, 2)}`,
                  )}
                  d={line.d}
                />
              ))}
              {marks
                ? plot.lines.map((line, i) =>
                    line.points
                      .filter((p) => p.plot)
                      .map((p, j) => (
                        // A zero-length round-capped stroke with
                        // vector-effect: non-scaling-stroke renders as a true
                        // circle even though the viewBox stretches; a <circle>
                        // here would draw as an ellipse.
                        <path
                          key={`m-${i}-${j}`}
                          className={cn(
                            'v3-chart__mark',
                            yoy
                              ? `v3-chart__line--cat${Math.min(i, V3_CHART_CATEGORY_SLOTS - 1)}`
                              : `v3-chart__mark--${Math.min(i, 2)}`,
                          )}
                          d={`M${p.x.toFixed(2)},${p.y.toFixed(2)} l0.01,0`}
                        >
                          <title>{`${line.name} — ${p.tick}: ${p.label}`}</title>
                        </path>
                      )),
                  )
                : null}
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
                  className={cn(
                    'v3-chart__bar',
                    !run && `v3-chart__bar--${Math.min(b.index, 2)}`,
                  )}
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                  rx={2}
                >
                  <title>{`${b.tick}: ${b.label}`}</title>
                </rect>
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
              >
                <title>{`${s.tick}: ${s.label}`}</title>
              </rect>
            ))}
          </svg>
        </div>
      ) : null}

      {plot.kind === 'range' ? (
        <div
          className={cn(
            'v3-chart__range',
            (plot.bands.length > 0 || plot.ref != null) && 'v3-chart__range--banded',
          )}
          aria-hidden="true"
        >
          {plot.bands.length > 0 || plot.ref ? (
            <div className="v3-chart__rangebands">
              {plot.bands.map((b, i) => (
                <span
                  key={`rb-${i}`}
                  className="v3-chart__rangeband"
                  style={{ left: `${b.xPct}%`, width: `${b.wPct}%` }}
                >
                  <span className="v3-chart__rangeband-label">{b.label}</span>
                </span>
              ))}
              {plot.ref ? (
                <span className="v3-chart__rangeref" style={{ left: `${plot.ref.xPct}%` }}>
                  <span
                    className={cn(
                      'v3-chart__rangeref-label',
                      plot.ref.xPct > 78 && 'v3-chart__rangeref-label--before',
                    )}
                  >
                    {plot.ref.label}
                  </span>
                </span>
              ) : null}
            </div>
          ) : null}
          {plot.rows.map((r) => {
            // The reading sits on the value dot's outer side: right of the
            // stem when the value is the right end, left when it is the left
            // end (the chart-room dumbbell rule), flipped inward near an
            // edge. The label's surface chip keeps it legible when a stem or
            // band runs beneath it.
            let before = r.baseXPct != null && r.xPct < r.baseXPct
            if (!before && r.xPct > 78) before = true
            if (before && r.xPct < 12) before = false
            const core =
              r.baseLabel != null ? `${r.tick}: ${r.label} (${r.baseLabel})` : `${r.tick}: ${r.label}`
            const reading = r.note ? `${core} — ${r.note}` : core
            return (
              <div
                key={`${r.index}-${r.tick}`}
                className="v3-chart__rangerow"
                title={r.clamped ? `${reading} — beyond the scale shown` : reading}
              >
                <span className="v3-chart__rangetick">{r.tick}</span>
                <span className="v3-chart__rangetrack">
                  <span
                    className={cn(
                      'v3-chart__rangestem',
                      r.clamped && 'v3-chart__rangestem--clamped',
                    )}
                    style={{
                      left: `${r.stemStartPct}%`,
                      width: `${Math.max(r.stemEndPct - r.stemStartPct, 0)}%`,
                    }}
                  />
                  {r.baseXPct != null ? (
                    <span className="v3-chart__rangebase" style={{ left: `${r.baseXPct}%` }} />
                  ) : null}
                  <span
                    className={cn(
                      'v3-chart__rangedot',
                      r.clamped && 'v3-chart__rangedot--clamped',
                    )}
                    style={{ left: `${r.xPct}%` }}
                  />
                  <span
                    className={cn(
                      'v3-chart__rangelabel',
                      before && 'v3-chart__rangelabel--before',
                      r.clamped && 'v3-chart__rangelabel--clamped',
                    )}
                    style={{ left: `${r.xPct}%` }}
                  >
                    {r.label}
                  </span>
                </span>
              </div>
            )
          })}
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
