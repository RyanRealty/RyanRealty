/**
 * Print / document SVG for the shared plot. Colors are passed in so this
 * file never invents a palette. Client packets use navy/cream. The caller
 * already formatted every label.
 */
import { PAD, type AnyPlot, type LinePlot, type PlottedPoint } from './plot'

export type PrintChartColors = {
  ink: string
  muted: string
  edge: string
}

/** Room for a left Y-axis and bottom X ticks. Public/admin plots keep PAD. */
export const PRINT_LINE_PAD = { l: 52, r: 8, t: 10, b: 22 }

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

function figure(caption: string, svg: string): string {
  return `<figure class="rr-chart" style="margin:8px 0;padding:0">
    <figcaption class="rr-chart-cap" style="font-size:12px;font-weight:600;margin:0 0 4px;white-space:normal">${esc(caption)}</figcaption>
    ${svg}
  </figure>`
}

function pickXTicks(points: readonly PlottedPoint[]): PlottedPoint[] {
  const plotted = points.filter((p) => p.plot)
  if (plotted.length <= 3) return plotted
  const first = plotted[0]!
  const mid = plotted[Math.floor(plotted.length / 2)]!
  const last = plotted[plotted.length - 1]!
  const picked = [first, mid, last]
  return picked.filter((p, i) => picked.findIndex((q) => q.tick === p.tick) === i)
}

function lineAxes(plot: LinePlot, colors: PrintChartColors): string {
  const pad = plot.pad ?? PAD
  const x0 = pad.l
  const y0 = pad.t
  const x1 = plot.vbW - pad.r
  const y1 = plot.vbH - pad.b
  const yMax = `<text x="${(x0 - 4).toFixed(1)}" y="${(y0 + 3).toFixed(1)}" text-anchor="end" font-size="8" fill="${colors.muted}">${esc(plot.yMaxLabel)}</text>`
  const yMin = `<text x="${(x0 - 4).toFixed(1)}" y="${y1.toFixed(1)}" text-anchor="end" font-size="8" fill="${colors.muted}">${esc(plot.yMinLabel)}</text>`
  const xLabels = pickXTicks(plot.lines[0]?.points ?? [])
    .map(
      (p) =>
        `<text x="${p.x.toFixed(1)}" y="${(plot.vbH - 4).toFixed(1)}" text-anchor="middle" font-size="8" fill="${colors.muted}">${esc(p.tick)}</text>`,
    )
    .join('')
  return `<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1}" stroke="${colors.edge}" stroke-width="1"/>
    <line x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}" stroke="${colors.edge}" stroke-width="1"/>
    ${yMax}${yMin}${xLabels}`
}

export function renderPrintChartSvg(
  plot: AnyPlot,
  opts: { caption: string; colors: PrintChartColors },
): string {
  const { caption, colors } = opts
  const aria = esc(caption)

  if (plot.kind === 'line') {
    const paths = plot.lines
      .map((line, i) => {
        const stroke = i === 0 ? colors.ink : colors.muted
        const dash = i === 0 ? '' : ' stroke-dasharray="5 4"'
        return `<path d="${esc(line.d)}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${dash}/>`
      })
      .join('')
    const legend = plot.lines
      .map((line, i) => `${i === 0 ? 'Solid' : 'Dashed'}: ${line.name}`)
      .join(' · ')
    const svg = `<svg viewBox="0 0 ${plot.vbW} ${plot.vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}" style="width:100%;height:auto;display:block;max-height:200px;">${lineAxes(plot, colors)}${paths}</svg>`
    return `${figure(caption, svg)}${legend ? `<p class="small" style="margin:0">${esc(legend)}</p>` : ''}`
  }

  if (plot.kind === 'mix') {
    const segs = plot.segments
      .map(
        (s) =>
          `<rect x="${s.x.toFixed(2)}" y="8" width="${s.w.toFixed(2)}" height="20" fill="${fillFor(s.index, false, colors)}" opacity="${s.index === 0 ? '1' : s.index === 1 ? '0.55' : '0.3'}"/>`,
      )
      .join('')
    const svg = `<svg viewBox="0 0 ${plot.vbW} ${plot.vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}" style="width:100%;height:auto;display:block;">${segs}</svg>`
    return figure(caption, svg)
  }

  const rects = plot.bars
    .map((b) => {
      if (b.highlight) {
        return `<rect x="${b.x.toFixed(2)}" y="${b.y.toFixed(2)}" width="${b.w.toFixed(2)}" height="${b.h.toFixed(2)}" rx="2" fill="${colors.ink}" fill-opacity="0.12" stroke="${colors.ink}" stroke-width="1.5"/>`
      }
      const opacity = b.index === 0 ? '1' : '0.35'
      return `<rect x="${b.x.toFixed(2)}" y="${b.y.toFixed(2)}" width="${b.w.toFixed(2)}" height="${b.h.toFixed(2)}" rx="2" fill="${colors.ink}" opacity="${opacity}"/>`
    })
    .join('')
  const labels = plot.bars
    .map((b) => {
      if (plot.layout === 'horizontal') {
        return `<text x="${(b.x + 4).toFixed(2)}" y="${(b.y + 8).toFixed(2)}" font-size="9" fill="${colors.ink}">${esc(b.tick)} ${esc(b.label)}</text>`
      }
      return `<text x="${(b.x + b.w / 2).toFixed(2)}" y="${(plot.vbH - 2).toFixed(2)}" text-anchor="middle" font-size="9" fill="${colors.muted}">${esc(b.tick)}</text>`
    })
    .join('')
  const yMax = `<text x="4" y="10" font-size="8" fill="${colors.muted}">${esc(plot.yMaxLabel)}</text>`
  const svg = `<svg viewBox="0 0 ${plot.vbW} ${plot.vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}" style="width:100%;height:auto;display:block;max-height:200px;">${yMax}${rects}${labels}</svg>`
  return figure(caption, svg)
}

/** Client-facing packets. Matches CLAUDE.md §3 navy / cream. */
export const PRINT_NAVY_CREAM: PrintChartColors = {
  ink: '#102742',
  muted: 'rgba(16,39,66,0.55)',
  edge: 'rgba(16,39,66,0.25)',
}
