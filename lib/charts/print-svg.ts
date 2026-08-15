/**
 * Print / document SVG for the shared plot. Colors are passed in so this
 * file never invents a palette. Client packets use navy/cream. The caller
 * already formatted every label.
 */
import type { AnyPlot } from './plot'

export type PrintChartColors = {
  ink: string
  muted: string
  edge: string
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
    return `<svg viewBox="0 0 ${plot.vbW} ${plot.vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}" style="width:100%;height:auto;display:block;">${paths}</svg>`
  }

  if (plot.kind === 'mix') {
    const segs = plot.segments
      .map(
        (s) =>
          `<rect x="${s.x.toFixed(2)}" y="8" width="${s.w.toFixed(2)}" height="20" fill="${fillFor(s.index, false, colors)}" opacity="${s.index === 0 ? '1' : s.index === 1 ? '0.55' : '0.3'}"/>`,
      )
      .join('')
    return `<svg viewBox="0 0 ${plot.vbW} ${plot.vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}" style="width:100%;height:auto;display:block;">${segs}</svg>`
  }

  const rects = plot.bars
    .map((b) => {
      const opacity = b.highlight || b.index === 0 ? '1' : '0.35'
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
  return `<svg viewBox="0 0 ${plot.vbW} ${plot.vbH}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${aria}" style="width:100%;height:auto;display:block;">${rects}${labels}</svg>`
}

/** Client-facing packets. Matches CLAUDE.md §3 navy / cream. */
export const PRINT_NAVY_CREAM: PrintChartColors = {
  ink: '#102742',
  muted: 'rgba(16,39,66,0.55)',
  edge: 'rgba(16,39,66,0.25)',
}
