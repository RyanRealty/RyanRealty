/**
 * Print charts for the monthly report: HTML + inline SVG strings.
 *
 * Geometry comes from lib/charts/plot.ts (buildLinePlot, buildBarPlot,
 * buildRangePlot, lineTicks) so a series draws the same here as on the site.
 * This file is only the print skin: navy on cream, hairline solid axes, thin
 * lines, direct labels on the latest point and the extremes (never a number on
 * every point), names beside the lines instead of a colour legend, and no dual
 * axis. Print cannot hover, so every chart the reader needs a number from has
 * that number on the drawing or in the table beside it.
 */
import {
  BAR_PAD_B,
  PAD,
  VB_H,
  VB_W,
  buildBarPlot,
  buildLinePlot,
  buildRangePlot,
  lineTicks,
  type PlotSeriesIn,
  type RangeBandIn,
  type RangeRowIn,
} from '@/lib/charts/plot'
import { mosText } from '../format'
import type { Pt } from '../types'

export type ChartUnit = 'money' | 'count' | 'days' | 'percent' | 'months' | 'ppsf'

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function fmtUnit(v: number, unit: ChartUnit, compact = true, decimals = 0): string {
  if (!Number.isFinite(v)) return ''
  switch (unit) {
    case 'money': {
      if (!compact) return `$${Math.round(v).toLocaleString('en-US')}`
      if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(2).replace(/\.?0+$/, '')}M`
      return `$${Math.round(v / 1000).toLocaleString('en-US')}K`
    }
    case 'ppsf':
      return `$${Math.round(v).toLocaleString('en-US')}`
    case 'count':
      return Math.round(v).toLocaleString('en-US')
    case 'days':
      return `${Math.round(v)}`
    case 'percent':
      return `${(v * 100).toFixed(decimals)}%`
    case 'months':
      return v.toFixed(1)
  }
}

/**
 * A plotted value's own label. Months of supply prints the way its verdict
 * reads (mosText), so a line ending at 4.024 is labeled 4.1, not the 4.0 that
 * reads as a seller's market. Axis ticks stay on fmtUnit: they are round
 * gridline values.
 */
export function pointLabel(v: number, unit: ChartUnit): string {
  return unit === 'months' ? mosText(v) : fmtUnit(v, unit)
}

/**
 * A 1-2-5 step near span/target. Kept here rather than imported from
 * lib/charts/ticks.ts because that module imports the public-site component
 * barrel, which a server-only PDF render (and the cron that runs it) must not
 * load.
 */
function niceStep(span: number, target: number): number {
  if (!(span > 0)) return 1
  const raw = span / target
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  // Nearest 1-2-5 step, so a chart lands near `target` gridlines rather than
  // up to twice as many.
  return (norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10) * mag
}

/** Decimal places a percent axis needs so neighboring ticks never print the same. */
function pctDecimals(step: number): number {
  const points = step * 100
  return points >= 1 ? 0 : points >= 0.1 ? 1 : 2
}

/**
 * Where an x label sits against its tick. Centered, except within reach of
 * either edge, where it anchors inward so it never crosses the plot box (the
 * box edge is the page's content edge).
 */
function xAnchor(x: number): string {
  const f = x / VB_W
  return f > 0.93 ? ' class="r"' : f < 0.04 ? ' class="l"' : ''
}

/**
 * Spread label centers (in percent of the plot height) so no two sit closer
 * than `gap`, keeping them inside [0, 100]. Order is preserved.
 */
export function spreadLabels(ys: readonly number[], gap: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y)
  const out = order.map((o) => o.y)
  for (let j = 1; j < out.length; j++) out[j] = Math.max(out[j]!, out[j - 1]! + gap)
  const over = out.length > 0 ? out[out.length - 1]! - 100 : 0
  if (over > 0) {
    out[out.length - 1] = 100
    for (let j = out.length - 2; j >= 0; j--) out[j] = Math.min(out[j]!, out[j + 1]! - gap)
  }
  const result: number[] = new Array(ys.length)
  order.forEach((o, j) => {
    result[o.i] = Math.max(0, out[j]!)
  })
  return result
}

/** Round gridline values inside [lo, hi]. */
function niceTicks(lo: number, hi: number, unit: ChartUnit, target = 4): number[] {
  const span = hi - lo
  if (!(span > 0)) return [lo]
  let step = niceStep(span, target)
  if (unit === 'count' || unit === 'days') step = Math.max(1, Math.round(step))
  const out: number[] = []
  const start = Math.ceil(lo / step) * step
  for (let v = start; v <= hi + 1e-9; v += step) out.push(Number(v.toFixed(10)))
  return out
}

export type LineStyle = 'subject' | 'context' | 'soft'

export type LineSeriesSpec = {
  name: string
  points: readonly Pt[]
  style: LineStyle
  /** Print the series name at its right end (multi-series charts). */
  nameLabel?: boolean
}

export type XTickFn = (key: string, index: number) => string | null

export type LineChartSpec = {
  series: readonly LineSeriesSpec[]
  unit: ChartUnit
  xTick: XTickFn
  heightIn: number
  bands?: readonly RangeBandIn[]
  labelLast?: boolean
  labelExtremes?: boolean
  /** Text shown when there is too little data to draw. */
  emptyNote?: string
}

const STROKE: Record<LineStyle, string> = {
  subject: 'stroke:#102742;stroke-width:1.8px;',
  context: 'stroke:#102742;stroke-width:1.3px;stroke-dasharray:4 3;',
  soft: 'stroke:rgba(16,39,66,0.45);stroke-width:1.3px;',
}

function pctX(x: number): string {
  return `${((x / VB_W) * 100).toFixed(2)}%`
}
function pctY(y: number, vbH = VB_H): string {
  return `${((y / vbH) * 100).toFixed(2)}%`
}

function empty(heightIn: number, note: string): string {
  return `<div class="ch-empty" style="height:${heightIn}in">${esc(note)}</div>`
}

/** A line chart over a shared calendar. Gaps (withheld points) lift the line. */
export function lineChart(spec: LineChartSpec): string {
  const keys = spec.series[0]?.points.map((p) => p.k) ?? []
  const plotSeries: PlotSeriesIn[] = spec.series.map((s) => ({
    name: s.name,
    points: s.points.map((p, i) => ({
      value: p.v == null ? Number.NaN : p.v,
      label: p.v == null ? '' : pointLabel(p.v, spec.unit),
      tick: p.k,
      at: i,
    })),
  }))
  const plot = buildLinePlot(plotSeries, { bands: spec.bands })
  if (!plot) return empty(spec.heightIn, spec.emptyNote ?? 'Too few sales to chart.')

  const yVals = niceTicks(plot.scale.y0, plot.scale.y1, spec.unit)
  const step = yVals.length > 1 ? yVals[1]! - yVals[0]! : plot.scale.y1 - plot.scale.y0
  const decimals = spec.unit === 'percent' ? pctDecimals(step) : 0
  const fmt = (v: number) => fmtUnit(v, spec.unit, true, decimals)
  const valueAt = new Map<string, number>()
  for (const s of spec.series) for (const p of s.points) if (p.v != null) valueAt.set(`${s.name}|${p.k}`, p.v)
  const labelOf = (name: string, pt: { tick: string; label: string }) => {
    const v = valueAt.get(`${name}|${pt.tick}`)
    return v == null ? pt.label : fmt(v)
  }
  const xTicks = keys
    .map((k, i) => ({ at: i, label: spec.xTick(k, i) ?? '' }))
    .filter((t) => t.label)
  const ticks = lineTicks(
    plot,
    yVals.map((v) => ({ value: v, label: fmt(v) })),
    xTicks,
  )

  const grid = ticks.y
    .map((t) => `<line x1="${PAD.l}" x2="${VB_W - PAD.r}" y1="${t.y.toFixed(2)}" y2="${t.y.toFixed(2)}" class="grid"/>`)
    .join('')
  const bands = plot.bands
    .map(
      (b, i) =>
        `<rect x="${PAD.l}" y="${b.y.toFixed(2)}" width="${VB_W - PAD.l - PAD.r}" height="${b.h.toFixed(2)}" class="zone z${i}"/>`,
    )
    .join('')
  const lines = plot.lines
    .map((l) => {
      const style = spec.series.find((s) => s.name === l.name)?.style ?? 'subject'
      return `<path d="${l.d}" style="fill:none;${STROKE[style]}" vector-effect="non-scaling-stroke"/>`
    })
    .join('')

  const overlays: string[] = []
  // Zone names sit at the right edge inside their band.
  plot.bands.forEach((b) => {
    overlays.push(
      `<span class="zone-name" style="right:1%;top:${pctY(b.y + b.h / 2)}">${esc(b.label)}</span>`,
    )
  })

  const labelled = new Set<string>()
  const put = (x: number, y: number, text: string, cls: string) => {
    const key = `${Math.round(x)}:${Math.round(y)}`
    if (labelled.has(key)) return
    labelled.add(key)
    const anchorRight = x > VB_W * 0.82
    overlays.push(
      `<span class="pt-label ${cls}${anchorRight ? ' r' : ''}" style="left:${pctX(x)};top:${pctY(y)}">${esc(text)}</span>`,
    )
  }
  const names: { y: number; name: string; value: string; style: LineStyle }[] = []
  for (const l of plot.lines) {
    const spec1 = spec.series.find((s) => s.name === l.name)
    const pts = l.points.filter((p) => p.plot)
    if (pts.length === 0) continue
    const last = pts[pts.length - 1]!
    if (spec1?.style === 'subject') {
      overlays.push(`<span class="dot" style="left:${pctX(last.x)};top:${pctY(last.y)}"></span>`)
      if (spec.labelLast !== false && !spec1.nameLabel) put(last.x, last.y, labelOf(l.name, last), 'last')
      if (spec.labelExtremes) {
        // SVG y grows downward: the highest value has the smallest y.
        let hi = pts[0]!
        let lo = pts[0]!
        for (const p of pts) {
          if (p.y < hi.y) hi = p
          if (p.y > lo.y) lo = p
        }
        const far = (p: { x: number }) => Math.abs(p.x - last.x) > VB_W * 0.08
        if (far(hi)) put(hi.x, hi.y, labelOf(l.name, hi), 'hi')
        if (far(lo) && lo !== hi) put(lo.x, lo.y, labelOf(l.name, lo), 'lo')
      }
    }
    if (spec1?.nameLabel) {
      names.push({ y: (last.y / VB_H) * 100, name: spec1.name, value: labelOf(l.name, last), style: spec1.style })
    }
  }

  // Series names sit in a rail right of the plot, level with each line's last
  // point and spread apart so two lines ending close never print on each other.
  const named = names.length > 0
  const gapPct = (10 / (spec.heightIn * 72)) * 100
  const spread = spreadLabels(
    names.map((n) => n.y),
    gapPct,
  )
  const nameRail = named
    ? `<div class="nrail">${names
        .map(
          (n, i) =>
            `<span class="${n.style}" style="top:${spread[i]!.toFixed(2)}%">${esc(n.name)} <b>${esc(n.value)}</b></span>`,
        )
        .join('')}</div>`
    : ''

  const yRail = ticks.y.map((t) => `<span style="top:${pctY(t.y)}">${esc(t.label)}</span>`).join('')
  const xRail = ticks.x.map((t) => `<span${xAnchor(t.x)} style="left:${pctX(t.x)}">${esc(t.label)}</span>`).join('')

  return `<div class="plot${named ? ' named' : ''}" style="--h:${spec.heightIn}in">
  <div class="yrail">${yRail}</div>
  <div class="box">
    <svg viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="none" aria-hidden="true">${bands}${grid}<line x1="${PAD.l}" x2="${VB_W - PAD.r}" y1="${VB_H - PAD.b}" y2="${VB_H - PAD.b}" class="axis"/>${lines}</svg>
    ${overlays.join('')}
  </div>
  ${nameRail}
  <div></div>
  <div class="xrail">${xRail}</div>
  ${named ? '<div></div>' : ''}
</div>`
}

export type BarChartSpec = {
  points: readonly Pt[]
  unit: ChartUnit
  xTick: XTickFn
  heightIn: number
  /** Keys drawn in full navy; the rest in a tint. Defaults to the last point. */
  highlight?: readonly string[]
  emptyNote?: string
}

/** Vertical bars over a calendar. Bars start at zero; empty months keep their slot. */
export function barChart(spec: BarChartSpec): string {
  const pts = spec.points
  const lastKey = [...pts].reverse().find((p) => p.v != null)?.k
  const highlight = new Set(spec.highlight ?? (lastKey ? [lastKey] : []))
  const plot = buildBarPlot(
    [{ name: 'bars', points: pts.map((p) => ({ value: p.v ?? 0, label: p.v == null ? '' : pointLabel(p.v, spec.unit), tick: p.k })) }],
    { keepZeros: true, highlightTicks: [...highlight] },
  )
  if (!plot) return empty(spec.heightIn, spec.emptyNote ?? 'No sales to chart.')
  const yMax = Math.max(...pts.map((p) => p.v ?? 0))
  const plotH = VB_H - PAD.t - BAR_PAD_B
  // Headroom above the tallest bar so its label stays inside the plot box.
  const yTop = yMax * 1.16
  const yOf = (v: number) => PAD.t + plotH - (v / yTop) * plotH
  const yVals = niceTicks(0, yMax, spec.unit, 3).filter((v) => v <= yMax)
  const grid = yVals
    .map((v) => `<line x1="0" x2="${VB_W}" y1="${yOf(v).toFixed(2)}" y2="${yOf(v).toFixed(2)}" class="grid"/>`)
    .join('')
  // Bar heights follow the headroom scale, not the plot's own full-height one.
  const scaled = plot.bars.map((b) => {
    const v = pts[b.index]?.v ?? 0
    const top = yOf(v)
    return { ...b, y: top, h: PAD.t + plotH - top }
  })
  const rects = scaled
    .map(
      (b) =>
        `<rect x="${b.x.toFixed(2)}" y="${b.y.toFixed(2)}" width="${b.w.toFixed(2)}" height="${b.h.toFixed(2)}" class="${b.highlight ? 'bar hi' : 'bar'}"/>`,
    )
    .join('')
  const overlays: string[] = []
  const maxBar = scaled.reduce((m, b) => (b.h > m.h ? b : m), scaled[0]!)
  for (const b of scaled) {
    const isLast = b.tick === lastKey
    if (isLast || (b === maxBar && Math.abs(b.index - scaled.length + 1) > 2)) {
      overlays.push(
        `<span class="bar-label${isLast ? ' last' : ''}" style="left:${pctX(b.x + b.w / 2)};top:${pctY(b.y)}">${esc(b.label)}</span>`,
      )
    }
  }
  const yRail = yVals.map((v) => `<span style="top:${pctY(yOf(v))}">${esc(fmtUnit(v, spec.unit))}</span>`).join('')
  const xRail = scaled
    .map((b, i) => {
      const label = spec.xTick(b.tick, i)
      const x = b.x + b.w / 2
      return label ? `<span${xAnchor(x)} style="left:${pctX(x)}">${esc(label)}</span>` : ''
    })
    .join('')
  return `<div class="plot" style="--h:${spec.heightIn}in">
  <div class="yrail">${yRail}</div>
  <div class="box">
    <svg viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="none" aria-hidden="true">${grid}<line x1="0" x2="${VB_W}" y1="${(PAD.t + plotH).toFixed(2)}" y2="${(PAD.t + plotH).toFixed(2)}" class="axis"/>${rects}</svg>
    ${overlays.join('')}
  </div>
  <div></div>
  <div class="xrail">${xRail}</div>
</div>`
}

export type DotRow = RangeRowIn

/**
 * Rows of dots (lollipop) or prior-to-current pairs (dumbbell) on one shared
 * scale, laid out in HTML so dots stay round. Optional zones (months of supply
 * thresholds) sit behind the rows.
 */
export function dotRows(
  rows: readonly DotRow[],
  opts: { bands?: readonly RangeBandIn[]; clampMax?: number; minLabel?: string; maxLabel?: string } = {},
): string {
  const plot = buildRangePlot(rows, { bands: opts.bands, clampMax: opts.clampMax })
  if (!plot) return empty(1, 'Too few sales to compare.')
  const zones = plot.bands
    .map((b) => `<span class="dz" style="left:${b.xPct.toFixed(2)}%;width:${b.wPct.toFixed(2)}%"><em>${esc(b.label)}</em></span>`)
    .join('')
  const body = plot.rows
    .map((r) => {
      const stemL = Math.min(r.stemStartPct, r.stemEndPct)
      const stemW = Math.abs(r.stemEndPct - r.stemStartPct)
      const base =
        r.baseXPct != null
          ? `<span class="dd base" style="left:${r.baseXPct.toFixed(2)}%"></span>`
          : ''
      const note = r.note ? `<span class="dnote">${esc(r.note)}</span>` : ''
      return `<div class="drow">
  <span class="dtick">${esc(r.tick)}</span>
  <span class="dtrack">${zones}<span class="dstem" style="left:${stemL.toFixed(2)}%;width:${stemW.toFixed(2)}%"></span>${base}<span class="dd" style="left:${r.xPct.toFixed(2)}%"></span></span>
  <span class="dval">${esc(r.label)}${r.clamped ? '+' : ''}${note}</span>
</div>`
    })
    .join('')
  const axis = `<div class="drow axisrow"><span class="dtick"></span><span class="dtrack"><span class="dmin">${esc(opts.minLabel ?? plot.xMinLabel)}</span><span class="dmax">${esc(opts.maxLabel ?? plot.xMaxLabel)}</span></span><span class="dval"></span></div>`
  return `<div class="dots">${body}${axis}</div>`
}

/** Month ticks: January (year) and July. */
export function monthXTick(key: string): string | null {
  const m = key.slice(5, 7)
  if (m === '01') return key.slice(0, 4)
  if (m === '07') return 'Jul'
  return null
}

/** Quarter ticks: the first quarter of every other year. */
export function quarterXTick(periodEnd: string): string | null {
  const y = Number(periodEnd.slice(0, 4))
  return periodEnd.slice(5, 7) === '03' && y % 2 === 0 ? String(y) : null
}

/** Quarter ticks for a narrow chart: the first quarter of every fourth year. */
export function quarterXTickSparse(periodEnd: string): string | null {
  const y = Number(periodEnd.slice(0, 4))
  return periodEnd.slice(5, 7) === '03' && y % 4 === 0 ? String(y) : null
}
