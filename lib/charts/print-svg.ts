/**
 * Print / document SVG for the shared plot. Navy marks on cream, hairline
 * baselines, lollipops for magnitudes, dots on a line. Colors are passed in
 * so this file never invents a palette. The caller already formatted labels.
 *
 * Fat columns were the default and they read as a spreadsheet. The house
 * form (TASTE.md, DATA_GRAPHICS.md) is thin stems, circular marks, and
 * small multiples that share an axis — the same instrument as V3Chart,
 * drawn for paper.
 */
import type { AnyPlot, BarPlot, LinePlot } from './plot'

export type PrintChartColors = {
  ink: string
  muted: string
  edge: string
}

export type PrintPairSeries = {
  kicker: string
  values: readonly (number | null)[]
  labels: readonly string[]
  yMinLabel: string
  yMaxLabel: string
  /** Magnitudes from zero (counts, days). Prices use a padded min–max. */
  fromZero: boolean
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fillFor(index: number, highlight: boolean, colors: PrintChartColors): string {
  if (highlight) return colors.ink
  if (index === 0) return colors.ink
  if (index === 1) return colors.muted
  return colors.edge
}

const TEXT = `font-family="Geist, ui-sans-serif, system-ui, sans-serif" style="font-variant-numeric:tabular-nums"`
const HAIR = 'vector-effect="non-scaling-stroke"'

function yOf(value: number, lo: number, hi: number, top: number, bottom: number): number {
  const span = hi - lo || 1
  return bottom - ((value - lo) / span) * (bottom - top)
}

function domain(values: readonly (number | null)[], fromZero: boolean): { lo: number; hi: number } | null {
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (nums.length === 0) return null
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  if (fromZero) return { lo: 0, hi: max === 0 ? 1 : max }
  const span = max - min || Math.abs(max) || 1
  return { lo: min - span * 0.06, hi: max + span * 0.06 }
}

function lollipops(input: {
  values: readonly (number | null)[]
  labels: readonly string[]
  xs: readonly number[]
  lo: number
  hi: number
  top: number
  bottom: number
  colors: PrintChartColors
  filled: (index: number) => boolean
  showValues: boolean
}): string {
  const { values, labels, xs, lo, hi, top, bottom, colors, filled, showValues } = input
  const parts: string[] = []
  parts.push(
    `<line x1="${xs[0]!.toFixed(2)}" y1="${bottom.toFixed(2)}" x2="${xs[xs.length - 1]!.toFixed(2)}" y2="${bottom.toFixed(2)}" stroke="${colors.edge}" stroke-width="0.75" ${HAIR}/>`,
  )
  values.forEach((v, i) => {
    const x = xs[i]!
    if (v == null || !Number.isFinite(v) || v <= 0) {
      parts.push(
        `<line x1="${(x - 2.2).toFixed(2)}" y1="${bottom.toFixed(2)}" x2="${(x + 2.2).toFixed(2)}" y2="${bottom.toFixed(2)}" stroke="${colors.muted}" stroke-width="1.1" stroke-linecap="round" ${HAIR}/>`,
      )
      return
    }
    const cy = yOf(v, lo, hi, top, bottom)
    const isFilled = filled(i)
    parts.push(
      `<line x1="${x.toFixed(2)}" y1="${bottom.toFixed(2)}" x2="${x.toFixed(2)}" y2="${cy.toFixed(2)}" stroke="${colors.ink}" stroke-width="1.15" stroke-linecap="round" opacity="${isFilled ? '1' : '0.4'}" ${HAIR}/>`,
    )
    if (isFilled) {
      parts.push(`<circle cx="${x.toFixed(2)}" cy="${cy.toFixed(2)}" r="3" fill="${colors.ink}"/>`)
    } else {
      parts.push(
        `<circle cx="${x.toFixed(2)}" cy="${cy.toFixed(2)}" r="3" fill="none" stroke="${colors.ink}" stroke-width="1.15" ${HAIR}/>`,
      )
    }
    if (showValues && labels[i]) {
      parts.push(
        `<text x="${x.toFixed(2)}" y="${(cy - 7).toFixed(2)}" text-anchor="middle" font-size="8" fill="${colors.ink}" ${TEXT}>${esc(labels[i]!)}</text>`,
      )
    }
  })
  return parts.join('')
}

function lineMarks(input: {
  values: readonly (number | null)[]
  xs: readonly number[]
  lo: number
  hi: number
  top: number
  bottom: number
  colors: PrintChartColors
}): string {
  const { values, xs, lo, hi, top, bottom, colors } = input
  const pts = values.map((v, i) => ({
    x: xs[i]!,
    y: v != null && Number.isFinite(v) && v > 0 ? yOf(v, lo, hi, top, bottom) : 0,
    plot: v != null && Number.isFinite(v) && v > 0,
  }))
  let d = ''
  let drawing = false
  for (const p of pts) {
    if (!p.plot) {
      drawing = false
      continue
    }
    d += `${drawing ? 'L' : 'M'}${p.x.toFixed(2)},${p.y.toFixed(2)} `
    drawing = true
  }
  const dAttr = d.trim()
  const pathEl = dAttr
    ? `<path d="${dAttr}" fill="none" stroke="${colors.ink}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" ${HAIR}/>`
    : ''
  const dots = pts
    .filter((p) => p.plot)
    .map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="2.8" fill="${colors.ink}"/>`)
    .join('')
  const base = `<line x1="${xs[0]!.toFixed(2)}" y1="${bottom.toFixed(2)}" x2="${xs[xs.length - 1]!.toFixed(2)}" y2="${bottom.toFixed(2)}" stroke="${colors.edge}" stroke-width="0.75" ${HAIR}/>`
  return `${base}${pathEl}${dots}`
}

function yRail(gutterL: number, top: number, bottom: number, maxLabel: string, minLabel: string, colors: PrintChartColors): string {
  return `<text x="${gutterL - 6}" y="${(top + 3).toFixed(2)}" text-anchor="end" font-size="9" fill="${colors.muted}" ${TEXT}>${esc(maxLabel)}</text><text x="${gutterL - 6}" y="${bottom.toFixed(2)}" text-anchor="end" font-size="9" fill="${colors.muted}" ${TEXT}>${esc(minLabel)}</text>`
}

function kickerText(label: string, x: number, y: number, colors: PrintChartColors): string {
  return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="8" letter-spacing="1.5" fill="${colors.muted}" ${TEXT}>${esc(label.toUpperCase())}</text>`
}

function xLabels(ticks: readonly string[], xs: readonly number[], y: number, colors: PrintChartColors): string {
  return ticks
    .map((tick, i) => {
      if (!tick) return ''
      if (ticks.length > 12 && i !== 0 && i !== ticks.length - 1 && i % 2 === 1) return ''
      return `<text x="${xs[i]!.toFixed(2)}" y="${y.toFixed(2)}" text-anchor="middle" font-size="8" fill="${colors.muted}" ${TEXT}>${esc(tick)}</text>`
    })
    .join('')
}

function xsFor(n: number, left: number, width: number): number[] {
  if (n <= 0) return []
  const step = width / n
  return Array.from({ length: n }, (_, i) => left + (i + 0.5) * step)
}

/**
 * Two panels, one calendar. Count (from zero) over a price slope.
 * Shared x. Separate y. Never one axis for both units.
 */
export function renderPrintPairedSvg(input: {
  top: PrintPairSeries
  bottom: PrintPairSeries
  ticks: readonly string[]
  caption: string
  colors: PrintChartColors
}): string {
  const { top, bottom, ticks, caption, colors } = input
  const n = ticks.length
  if (n < 2) return ''
  const topDom = domain(top.values, top.fromZero)
  const botDom = domain(bottom.values, bottom.fromZero)
  if (!topDom && !botDom) return ''

  const gutterL = 56
  const plotW = 320
  const kickerH = 18
  const countH = 88
  const gap = 18
  const askH = 108
  const xH = 16
  const vbW = gutterL + plotW + 10
  const vbH = kickerH + countH + gap + kickerH + askH + xH
  const xs = xsFor(n, gutterL, plotW)
  const aria = esc(caption)

  const topY0 = 0
  const topTop = kickerH + 14
  const topBot = kickerH + countH - 4
  const botY0 = kickerH + countH + gap
  const botTop = botY0 + kickerH + 12
  const botBot = botY0 + kickerH + askH - 6

  const rules = xs
    .map(
      (x) =>
        `<line x1="${x.toFixed(2)}" y1="${topTop.toFixed(2)}" x2="${x.toFixed(2)}" y2="${botBot.toFixed(2)}" stroke="${colors.edge}" stroke-width="0.4" ${HAIR}/>`,
    )
    .join('')

  const parts: string[] = [rules]
  if (topDom) {
    parts.push(kickerText(top.kicker, gutterL, 12, colors))
    parts.push(yRail(gutterL, topTop, topBot, top.yMaxLabel, top.yMinLabel, colors))
    parts.push(
      lollipops({
        values: top.values,
        labels: top.labels,
        xs,
        lo: topDom.lo,
        hi: topDom.hi,
        top: topTop,
        bottom: topBot,
        colors,
        filled: () => true,
        showValues: true,
      }),
    )
  }
  if (botDom) {
    parts.push(kickerText(bottom.kicker, gutterL, botY0 + 12, colors))
    parts.push(yRail(gutterL, botTop, botBot, bottom.yMaxLabel, bottom.yMinLabel, colors))
    parts.push(
      lineMarks({
        values: bottom.values,
        xs,
        lo: botDom.lo,
        hi: botDom.hi,
        top: botTop,
        bottom: botBot,
        colors,
      }),
    )
    parts.push(xLabels(ticks, xs, botBot + 13, colors))
  }

  return `<svg viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}" overflow="visible" style="width:100%;height:auto;display:block;">${parts.join('')}</svg>`
}

function renderLinePlot(plot: LinePlot, caption: string, colors: PrintChartColors, kicker?: string): string {
  const gutterL = 56
  const gutterB = 16
  const gutterT = kicker ? 14 : 0
  const vbW = plot.vbW + gutterL
  const vbH = plot.vbH + gutterB + gutterT
  const aria = esc(caption)
  const kick = kicker ? kickerText(kicker, gutterL, 10, colors) : ''
  const baseY = plot.scale.t + plot.scale.h
  const baseline = `<line x1="${plot.scale.l.toFixed(2)}" y1="${baseY.toFixed(2)}" x2="${(plot.scale.l + plot.scale.w).toFixed(2)}" y2="${baseY.toFixed(2)}" stroke="${colors.edge}" stroke-width="0.75" ${HAIR}/>`
  const paths = plot.lines
    .map((line, i) => {
      const stroke = i === 0 ? colors.ink : colors.muted
      const dash = i === 0 ? '' : ' stroke-dasharray="5 4"'
      return `<path d="${esc(line.d)}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"${dash} ${HAIR}/>`
    })
    .join('')
  const ticks = plot.lines[0]?.points ?? []
  const labels = xLabels(
    ticks.map((p) => p.tick),
    ticks.map((p) => p.x + gutterL),
    plot.vbH + 12 + gutterT,
    colors,
  )
  const dots = plot.lines
    .map((line, i) => {
      const fill = i === 0 ? colors.ink : colors.muted
      return line.points
        .filter((p) => p.plot)
        .map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="2.8" fill="${fill}"/>`)
        .join('')
    })
    .join('')
  const yMaxY = plot.scale.t + 3 + gutterT
  const yMinY = baseY + gutterT
  const yLabels = yRail(gutterL, yMaxY, yMinY, plot.yMaxLabel, plot.yMinLabel, colors)
  return `<svg viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}" overflow="visible" style="width:100%;height:auto;display:block;">${kick}<g transform="translate(${gutterL},${gutterT})">${baseline}${paths}${dots}</g>${yLabels}${labels}</svg><p class="small">${aria}.</p>`
}

function renderBarPlot(plot: BarPlot, caption: string, colors: PrintChartColors, kicker?: string): string {
  const aria = esc(caption)
  const anyHighlight = plot.bars.some((b) => b.highlight)

  if (plot.layout === 'horizontal') {
    const rects = plot.bars
      .map((b) => {
        const opacity = b.highlight || (!anyHighlight && b.index === 0) ? '1' : '0.35'
        return `<rect x="${b.x.toFixed(2)}" y="${b.y.toFixed(2)}" width="${b.w.toFixed(2)}" height="${b.h.toFixed(2)}" rx="2" fill="${colors.ink}" opacity="${opacity}"/>`
      })
      .join('')
    const labels = plot.bars
      .map(
        (b) =>
          `<text x="${(b.x + 4).toFixed(2)}" y="${(b.y + 8).toFixed(2)}" font-size="9" fill="${colors.ink}" ${TEXT}>${esc(b.tick)} ${esc(b.label)}</text>`,
      )
      .join('')
    return `<svg viewBox="0 0 ${plot.vbW} ${plot.vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}" overflow="visible" style="width:100%;height:auto;display:block;">${rects}${labels}</svg>`
  }

  const gutterL = 56
  const gutterT = kicker ? 26 : 14
  const vbW = plot.vbW + gutterL
  const vbH = plot.vbH + gutterT
  const kick = kicker ? kickerText(kicker, gutterL, 12, colors) : ''
  const baseline = Math.max(...plot.bars.map((b) => b.y + b.h))
  const top = Math.min(...plot.bars.map((b) => b.y))
  const xs = plot.bars.map((b) => b.x + b.w / 2)
  const values = plot.bars.map((b) => (b.h <= 2 ? 0 : b.h))
  const lo = 0
  const hi = Math.max(...values, 1)
  const marks = lollipops({
    values,
    labels: plot.bars.map((b) => b.label),
    xs,
    lo,
    hi,
    top,
    bottom: baseline,
    colors,
    filled: (i) => (anyHighlight ? plot.bars[i]!.highlight : true),
    showValues: true,
  })
  const months = xLabels(
    plot.bars.map((b) => b.tick),
    xs,
    plot.vbH - 6,
    colors,
  )
  const yLabels = yRail(gutterL, top + gutterT, baseline + gutterT, plot.yMaxLabel, plot.yMinLabel, colors)
  return `<svg viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}" overflow="visible" style="width:100%;height:auto;display:block;">${kick}<g transform="translate(${gutterL},${gutterT})">${marks}${months}</g>${yLabels}</svg>`
}

/** Dots on a price axis. Magnitudes like list price must not grow from zero. */
export function renderPrintStripSvg(input: {
  marks: readonly { value: number; label: string; tick: string; filled: boolean }[]
  caption: string
  colors: PrintChartColors
}): string {
  const usable = input.marks.filter((m) => Number.isFinite(m.value) && m.value > 0)
  if (usable.length < 2) return ''
  const { colors, caption } = input
  const nums = usable.map((m) => m.value)
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || max * 0.04
  const lo = min - span * 0.08
  const hi = max + span * 0.08
  const gutterL = 56
  const plotW = 320
  const vbW = gutterL + plotW + 10
  const vbH = 72
  const y = 36
  const xOf = (v: number) => gutterL + ((v - lo) / (hi - lo || 1)) * plotW
  const aria = esc(caption)
  const axis = `<line x1="${gutterL.toFixed(2)}" y1="${y}" x2="${(gutterL + plotW).toFixed(2)}" y2="${y}" stroke="${colors.edge}" stroke-width="0.75" ${HAIR}/>`
  const ordered = [...usable].sort((a, b) => a.value - b.value)
  let lastX = -Infinity
  let high = false
  const marks = ordered
    .map((m) => {
      const x = xOf(m.value)
      if (x - lastX < 36) high = !high
      else high = false
      lastX = x
      const labelY = high ? y - 22 : y - 10
      const dot = m.filled
        ? `<circle cx="${x.toFixed(2)}" cy="${y}" r="3.2" fill="${colors.ink}"/>`
        : `<circle cx="${x.toFixed(2)}" cy="${y}" r="3.2" fill="none" stroke="${colors.ink}" stroke-width="1.15" ${HAIR}/>`
      const tick = m.tick
        ? `<text x="${x.toFixed(2)}" y="${y + 14}" text-anchor="middle" font-size="8" fill="${colors.muted}" ${TEXT}>${esc(m.tick)}</text>`
        : ''
      return `${dot}<text x="${x.toFixed(2)}" y="${labelY}" text-anchor="middle" font-size="8" fill="${colors.ink}" ${TEXT}>${esc(m.label)}</text>${tick}`
    })
    .join('')
  return `<svg viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}" overflow="visible" style="width:100%;height:auto;display:block;">${axis}${marks}</svg>`
}

/**
 * Two rails on one price axis: closed sales (close) above, listings that
 * came off without a sale (last ask) below. This list is a vertical rule.
 */
export function renderPrintOutcomeStripSvg(input: {
  sold: readonly number[]
  unsold: readonly number[]
  list: number
  lastAsk: number | null
  xMinLabel: string
  xMaxLabel: string
  listLabel: string
  lastAskLabel: string | null
  caption: string
  colors: PrintChartColors
}): string {
  const { colors, caption } = input
  const nums = [...input.sold, ...input.unsold, input.list, input.lastAsk].filter(
    (n): n is number => n != null && Number.isFinite(n) && n > 0,
  )
  if (input.sold.length < 3 || input.unsold.length < 1 || nums.length < 4) return ''
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || max * 0.04
  const lo = min - span * 0.06
  const hi = max + span * 0.06
  const gutterL = 72
  const plotW = 320
  const vbW = gutterL + plotW + 12
  const vbH = 108
  const soldY = 34
  const unsoldY = 70
  const xOf = (v: number) => gutterL + ((v - lo) / (hi - lo || 1)) * plotW
  const aria = esc(caption)
  const jitter = (i: number) => ((i * 5) % 7) - 3

  const soldDots = input.sold
    .map((v, i) => {
      const x = xOf(v)
      const y = soldY + jitter(i)
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="2.6" fill="none" stroke="${colors.ink}" stroke-width="1.15" ${HAIR}/>`
    })
    .join('')
  const unsoldDots = input.unsold
    .map((v, i) => {
      const x = xOf(v)
      const y = unsoldY + jitter(i + 3)
      return `<line x1="${x.toFixed(2)}" y1="${(y - 5).toFixed(2)}" x2="${x.toFixed(2)}" y2="${(y + 5).toFixed(2)}" stroke="${colors.muted}" stroke-width="1.35" stroke-linecap="round" ${HAIR}/>`
    })
    .join('')
  const listX = xOf(input.list)
  const listRule = `<line x1="${listX.toFixed(2)}" y1="18" x2="${listX.toFixed(2)}" y2="86" stroke="${colors.ink}" stroke-width="1.35" ${HAIR}/><text x="${listX.toFixed(2)}" y="14" text-anchor="middle" font-size="8" fill="${colors.ink}" ${TEXT}>${esc(input.listLabel)}</text>`
  const last =
    input.lastAsk != null &&
    input.lastAskLabel &&
    Math.abs(input.lastAsk - input.list) > 1000
      ? `<line x1="${xOf(input.lastAsk).toFixed(2)}" y1="18" x2="${xOf(input.lastAsk).toFixed(2)}" y2="86" stroke="${colors.muted}" stroke-width="1.15" stroke-dasharray="3 3" ${HAIR}/><text x="${xOf(input.lastAsk).toFixed(2)}" y="14" text-anchor="middle" font-size="8" fill="${colors.muted}" ${TEXT}>${esc(input.lastAskLabel)}</text>`
      : ''
  const soldRail = `<line x1="${gutterL}" y1="${soldY}" x2="${gutterL + plotW}" y2="${soldY}" stroke="${colors.edge}" stroke-width="0.6" ${HAIR}/>`
  const unsoldRail = `<line x1="${gutterL}" y1="${unsoldY}" x2="${gutterL + plotW}" y2="${unsoldY}" stroke="${colors.edge}" stroke-width="0.6" ${HAIR}/>`
  const rails = `<text x="4" y="${soldY + 3}" font-size="8" fill="${colors.muted}" ${TEXT}>Sold</text><text x="4" y="${unsoldY + 3}" font-size="8" fill="${colors.muted}" ${TEXT}>${esc("Didn't sell")}</text>`
  const ends = `<text x="${gutterL}" y="100" font-size="9" fill="${colors.muted}" ${TEXT}>${esc(input.xMinLabel)}</text><text x="${gutterL + plotW}" y="100" text-anchor="end" font-size="9" fill="${colors.muted}" ${TEXT}>${esc(input.xMaxLabel)}</text>`
  return `<svg viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}" overflow="visible" style="width:100%;height:auto;display:block;">${soldRail}${unsoldRail}${soldDots}${unsoldDots}${listRule}${last}${rails}${ends}</svg>`
}

export function renderPrintChartSvg(
  plot: AnyPlot,
  opts: { caption: string; colors: PrintChartColors; kicker?: string },
): string {
  const { caption, colors, kicker } = opts

  if (plot.kind === 'line') return renderLinePlot(plot, caption, colors, kicker)

  if (plot.kind === 'mix') {
    const segs = plot.segments
      .map(
        (s) =>
          `<rect x="${s.x.toFixed(2)}" y="8" width="${s.w.toFixed(2)}" height="20" fill="${fillFor(s.index, false, colors)}" opacity="${s.index === 0 ? '1' : s.index === 1 ? '0.55' : '0.3'}"/>`,
      )
      .join('')
    return `<svg viewBox="0 0 ${plot.vbW} ${plot.vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(caption)}" style="width:100%;height:auto;display:block;">${segs}</svg>`
  }

  if (plot.kind === 'range') {
    throw new Error(
      'printChartSvg: range plots are not print-rendered. Use bars or a line for print documents.',
    )
  }

  return renderBarPlot(plot, caption, colors, kicker)
}

/** Client-facing packets. Matches CLAUDE.md §3 navy / cream. */
export const PRINT_NAVY_CREAM: PrintChartColors = {
  ink: '#102742',
  muted: 'rgba(16,39,66,0.55)',
  edge: 'rgba(16,39,66,0.22)',
}
