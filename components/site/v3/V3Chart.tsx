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
  lineTicks,
  type AnyPlot,
  type PlotSeriesIn,
  type RangeBandIn,
} from '@/lib/charts/plot'
import { V3ChartHover, type V3ChartHoverColumn } from './V3ChartHover.client'
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

/**
 * How many rows a range row's figure was computed over.
 *
 * THE RULE, and it is the whole point of the field: `n` may only be the
 * population THAT figure was computed over — same rows, same window, same
 * filters. A count off any other window is worse than no count, because it
 * tells a reader a cross-row comparison is safe when it is not.
 *
 * Two live pairings that look right and are not (verified against the shipped
 * refresh_market_pulse definition, 2026-08-19):
 *   - median_days_to_pending is the median over closings in the last NINETY
 *     days that carry a list-to-pending measurement. `sold_count_30d` is a
 *     thirty-day count — Bend 163 against a real 490, Culver 1 against 5.
 *   - price_reduction_share divides by actives PLUS active-under-contract.
 *     `active_count` excludes active-under-contract — Bend 471 against the
 *     481 the published share actually divided by.
 *
 * When the true population is not published, pass nothing. The card's trace
 * states the window and the floor instead: CLAUDE.md section 0 rule 7 — a
 * figure that cannot be verified is cut, and a page with fewer numbers is the
 * correct outcome.
 */
export type V3ChartSample = {
  /** Rows the row's primary figure was computed over. */
  n: number
  /** Rows the row's BASE (prior) figure was computed over, on a dumbbell. */
  baseN?: number
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
   * ("475 active single-family · small sample"). Carried in the native title
   * and the hidden reading list, never drawn on the track. A count named here
   * is under the same rule as `sample`: it must be the population the figure
   * was computed over, because a screen reader reads this out as fact.
   */
  note?: V3Text
  /** The sample size, DRAWN on the row. Read V3ChartSample before setting it. */
  sample?: V3ChartSample
}

export type V3ChartKind = 'line' | 'bars' | 'mix' | 'range'

/** The categorical slots tokens.css defines. More series than this cannot keep identity. */
export const V3_CHART_CATEGORY_SLOTS = 5
/** Mix/segment ink ladder depth — 8 monochrome stops (2026-08-27: the all-type
 * composition strip has 8 real categories; capping at 3 rendered 6 of them as
 * one identical wash and the legend could not name a segment). */
export const V3_CHART_SEGMENT_SLOTS = 8

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
  /**
   * The claim: one formatted sentence the chart exists to show, under the
   * caption ("Median sale price $666K in Aug, up 3% from Aug 2025"). The
   * headline is the hypothesis; the reader knows what to look for first.
   */
  claim?: V3Text
  /** Y gridlines and their formatted labels. Lines only; out-of-domain ticks are dropped. */
  yTicks?: readonly { value: number; label: V3Text }[]
  /** X tick labels keyed like the points (`at`, or order). Lines only. */
  xTicks?: readonly { at: number; label: V3Text }[]
  /**
   * Emphasis over categorical (TASTE.md): the first or last series in full
   * ink with marks, the rest in navy tints. On a yoy overlay this replaces
   * the five-hue run.
   */
  emphasize?: 'first' | 'last'
  /** The crosshair-and-reading layer. On for lines unless turned off. */
  hover?: boolean
  /**
   * Range rows only. Names what every row's `sample` counted, drawn ONCE
   * above the rows ("detached closes in the quarter"). A bare n is not a
   * reading until the chart says what it counted, so the atom refuses a
   * sample without this key. Keep it a noun phrase; the atom writes the "n =".
   */
  sampleKey?: V3Text
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
        sampleN: r.sample?.n,
        sampleBaseN: r.sample?.baseN,
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

/**
 * The one way a sample size is written on a chart, so a reader meets the same
 * form on the city page, the district page, and the plat page. Deliberately
 * module-private: callers hand the atom NUMBERS and the atom does the writing,
 * which is what keeps every surface on one answer.
 */
function v3ChartSampleReading(n: number, baseN?: number | null): string {
  const one = (v: number) => v.toLocaleString('en-US')
  return baseN != null ? `n ${one(n)} (${one(baseN)})` : `n ${one(n)}`
}

/** A range row's full reading: value, sample, note — the title and the list. */
function rangeReading(r: RangePlotRowLike): string {
  const core = r.baseLabel != null ? `${r.label} (${r.baseLabel})` : r.label
  const sample = r.sampleN != null ? ` — ${v3ChartSampleReading(r.sampleN, r.sampleBaseN)}` : ''
  return core + sample + (r.note ? ` — ${r.note}` : '')
}

type RangePlotRowLike = {
  label: string
  baseLabel: string | null
  note: string | null
  sampleN: number | null
  sampleBaseN: number | null
}

/**
 * The hidden reading list. One entry per drawn value, already formatted.
 *
 * A series name only earns a prefix when it is not the tick: on a range or bar
 * chart the row name IS the tick, and prefixing it made every reading say the
 * town twice ("River Village: River Village, $1.0M"), which is what a screen
 * reader then announced.
 */
function readings(plot: AnyPlot): { key: string; text: string }[] {
  if (plot.kind === 'line') {
    return plot.lines.flatMap((line, i) =>
      line.points
        .filter((p) => p.plot)
        .map((p, j) => ({ key: `${i}-${j}-${p.tick}`, text: `${line.name}: ${p.tick}, ${p.label}` })),
    )
  }
  if (plot.kind === 'mix') {
    return plot.segments.map((s, i) => ({ key: `${i}-${s.tick}`, text: `${s.tick}, ${s.label}` }))
  }
  if (plot.kind === 'range') {
    return plot.rows.map((r, i) => ({ key: `${i}-${r.tick}`, text: `${r.tick}, ${rangeReading(r)}` }))
  }
  return plot.bars.map((b, i) => ({ key: `${i}-${b.tick}`, text: `${b.tick}, ${b.label}` }))
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
  claim,
  yTicks,
  xTicks,
  emphasize,
  hover,
  sampleKey,
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

  const sampled = (rows ?? []).some((r) => r.sample != null)
  if (sampled && (sampleKey == null || sampleKey.trim().length === 0)) {
    throw new Error(
      'V3Chart: a row carries `sample` but the chart has no `sampleKey`. A bare ' +
        'n beside a figure is not a reading until the chart names what it counted, ' +
        'and an unnamed count invites the reader to assume the wrong window.',
    )
  }
  if (sampled && kind !== 'range') {
    throw new Error('V3Chart: `sample` is a range-row field. Use kind="range".')
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
  const lineCount = plot && plot.kind === 'line' ? plot.lines.length : 0
  const emphasisIndex =
    emphasize == null || lineCount === 0 ? null : emphasize === 'last' ? lineCount - 1 : 0
  /* Which class a line (and its legend key) wears. Emphasis: full ink for
     one series, tints by distance for the rest. Otherwise the yoy hue run or
     the two-context ladder. */
  const rankFrom = (i: number) => (emphasisIndex == null ? 0 : Math.min(Math.abs(i - emphasisIndex), 4))
  const lineClass = (i: number) =>
    emphasisIndex != null
      ? i === emphasisIndex
        ? 'v3-chart__line--em'
        : `v3-chart__line--ctx${rankFrom(i)}`
      : yoy
        ? `v3-chart__line--cat${Math.min(i, V3_CHART_CATEGORY_SLOTS - 1)}`
        : `v3-chart__line--${Math.min(i, 2)}`
  const markClass = (i: number) =>
    emphasisIndex != null
      ? i === emphasisIndex
        ? 'v3-chart__mark--em'
        : `v3-chart__mark--ctx${rankFrom(i)}`
      : yoy
        ? `v3-chart__line--cat${Math.min(i, V3_CHART_CATEGORY_SLOTS - 1)}`
        : `v3-chart__mark--${Math.min(i, 2)}`
  const keyClass = (i: number) =>
    emphasisIndex != null
      ? i === emphasisIndex
        ? 'v3-chart__key--em'
        : `v3-chart__key--ctx${rankFrom(i)}`
      : yoy
        ? `v3-chart__key--cat${Math.min(i, V3_CHART_CATEGORY_SLOTS - 1)}`
        : `v3-chart__key--${Math.min(i, V3_CHART_SEGMENT_SLOTS - 1)}`
  const ticks =
    plot && plot.kind === 'line'
      ? lineTicks(
          plot,
          yTicks?.map((t) => ({ value: t.value, label: t.label })),
          xTicks?.map((t) => ({ at: t.at, label: t.label })),
        )
      : { y: [], x: [] }
  /* Hover columns: every series' reading at each plotted x, as fractions of
     the plot box, in x order. */
  const hoverColumns: V3ChartHoverColumn[] =
    plot && plot.kind === 'line' && hover !== false
      ? (() => {
          const { l, t, w, h } = plot.scale
          const byX = new Map<string, V3ChartHoverColumn>()
          plot.lines.forEach((line, i) => {
            for (const p of line.points) {
              if (!p.plot) continue
              const frac = (p.x - l) / (w || 1)
              const key = frac.toFixed(3)
              const col = byX.get(key) ?? { frac, tick: p.tick, readings: [] }
              col.readings.push({ name: line.name, label: p.label, frac: (p.y - t) / (h || 1), emphasis: i === emphasisIndex })
              byX.set(key, col)
            }
          })
          return [...byX.values()].sort((a, b) => a.frac - b.frac)
        })()
      : []

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
  // Drawn rows, not input rows: buildRangePlot drops a row with no finite
  // value, so a chart whose only sampled row was dropped must not keep the
  // "n = …" key line naming a column that is no longer there.
  const rangeSampled = plot.kind === 'range' && plot.rows.some((r) => r.sampleN != null)

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
      {claim ? <p className="v3-chart__claim">{claim}</p> : null}

      {keys.length > 1 ? (
        <ul className="v3-chart__legend">
          {keys.map((name, i) => (
            <li
              key={`${i}-${name}`}
              className={cn('v3-chart__key', keyClass(i))}
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

      {plot.kind === 'range' && rangeSampled && sampleKey ? (
        <p className="v3-chart__samplekey">n = {sampleKey}</p>
      ) : null}

      {plot.kind === 'line' ? (
        <div className="v3-chart__frame">
          {ticks.y.length >= 2 ? (
            <div className="v3-chart__y v3-chart__y--ticks" aria-hidden="true">
              {ticks.y.map((tk) => (
                <span key={tk.label} className="v3-chart__ytick" style={{ top: `${tk.frac * 100}%` }}>
                  {tk.label}
                </span>
              ))}
            </div>
          ) : (
            <div className="v3-chart__y" aria-hidden="true">
              <span>{plot.yMaxLabel}</span>
              <span>{plot.yMinLabel}</span>
            </div>
          )}
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
              {ticks.y.map((tk) => (
                <line key={`g-${tk.label}`} className="v3-chart__grid" x1={2} y1={tk.y} x2={318} y2={tk.y} />
              ))}
              <line className="v3-chart__axis-line" x1={2} y1={8} x2={2} y2={132} />
              <line className="v3-chart__axis-line" x1={2} y1={132} x2={318} y2={132} />
              {plot.lines.map((line, i) => (
                <path
                  key={`${i}-${line.name}`}
                  className={cn('v3-chart__line', lineClass(i))}
                  d={line.d}
                />
              ))}
              {marks || emphasisIndex != null
                ? plot.lines.map((line, i) =>
                    // The emphasized series wears marks only when they can be
                    // told apart: past sixty points (a weekly year) the beads
                    // bury the line they were meant to lift.
                    (marks || (i === emphasisIndex && line.points.length <= 60) ? line.points : [])
                      .filter((p) => p.plot)
                      .map((p, j) => (
                        // A zero-length round-capped stroke with
                        // vector-effect: non-scaling-stroke renders as a true
                        // circle even though the viewBox stretches; a <circle>
                        // here would draw as an ellipse.
                        <path
                          key={`m-${i}-${j}`}
                          className={cn('v3-chart__mark', markClass(i))}
                          d={`M${p.x.toFixed(2)},${p.y.toFixed(2)} l0.01,0`}
                        >
                          <title>{`${line.name} — ${p.tick}: ${p.label}`}</title>
                        </path>
                      )),
                  )
                : null}
            </svg>
            {hoverColumns.length > 0 ? <V3ChartHover columns={hoverColumns} label={caption} /> : null}
          </div>
          {ticks.x.length >= 2 ? (
            <div className="v3-chart__x v3-chart__x--ticks" aria-hidden="true">
              {ticks.x.map((tk) => (
                <span key={`${tk.label}-${tk.frac.toFixed(3)}`} className="v3-chart__xtick" style={{ left: `${tk.frac * 100}%` }}>
                  {tk.label}
                </span>
              ))}
            </div>
          ) : (
            <div className="v3-chart__x" aria-hidden="true">
              <span>{plot.xStart}</span>
              <span>{plot.xEnd}</span>
            </div>
          )}
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
          {plot.bars.length > 2 ? (
            // A run of bars prints its ticks the way a line prints its months:
            // at most six labels, the first and the last always among them,
            // each under the bar it names (pass six, S6: 29 bars, no year).
            <div className="v3-chart__x v3-chart__x--ticks" aria-hidden="true">
              {plot.bars
                .filter((b, i, all) => {
                  const step = Math.max(1, Math.ceil(all.length / 6))
                  return i === all.length - 1 || (i % step === 0 && i < all.length - 1 - step / 2)
                })
                .map((b) => (
                  <span
                    key={`bx-${b.index}-${b.tick}`}
                    className="v3-chart__xtick"
                    style={{ left: `${((b.x + b.w / 2) / plot.vbW) * 100}%` }}
                  >
                    {b.tick}
                  </span>
                ))}
            </div>
          ) : (
            <div className="v3-chart__x" aria-hidden="true">
              <span>{plot.bars[0]?.tick}</span>
              <span>{plot.bars[plot.bars.length - 1]?.tick}</span>
            </div>
          )}
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
                className={cn('v3-chart__bar', `v3-chart__bar--${Math.min(s.index, V3_CHART_SEGMENT_SLOTS - 1)}`)}
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
            rangeSampled && 'v3-chart__range--sampled',
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
            const reading = `${r.tick}: ${rangeReading(r)}`
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
                {rangeSampled ? (
                  <span className="v3-chart__rangesample">
                    {r.sampleN != null
                      ? v3ChartSampleReading(r.sampleN, r.sampleBaseN)
                      : null}
                  </span>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}

      <ol className="v3-chart__data">
        {readings(plot).map((row) => (
          <li key={row.key}>{row.text}</li>
        ))}
      </ol>
    </figure>
  )
}
