/**
 * Client CMA charts. A real path through priced months, not a dead bar.
 * Count and dollars never share an axis.
 */

import { escapeHtml } from '@/lib/cma/render-blocks'

const esc = escapeHtml

export type TrendPoint = {
  periodStart: string
  medianSalePrice: number | null
  soldCount: number | null
  endOfPeriodInventory?: number | null
}

export type ListingTrendPoint = {
  month: string
  newListings: number
  medianAsk: number | null
}

function monthLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 7)}-01T00:00:00Z`)
  return d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
}

function chartUsd(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 || n % 1_000_000 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  return `$${Math.round(n / 1000)}K`
}

function linePath(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${ys[i]!.toFixed(1)}`).join(' ')
}

function scaleY(vals: number[], top: number, bottom: number): (v: number) => number {
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = Math.max(max - min, 1)
  return (v: number) => bottom - ((bottom - top) * (v - min)) / span
}

/** Median close over completed months. Needs six priced months. */
export function medianCloseLineSvg(points: TrendPoint[]): string {
  const priced = [...points]
    .filter((p) => p.medianSalePrice != null && p.medianSalePrice > 0)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  if (priced.length < 6) return ''
  const W = 720
  const H = 220
  // The y-value labels sit in a gutter to the LEFT of the plot. Drawn at the
  // plot's own left edge they shared ink with September's mark.
  const left = 68
  const right = W - 24
  const top = 28
  const bottom = 168
  const vals = priced.map((p) => p.medianSalePrice!)
  const y = scaleY(vals, top, bottom)
  const xs = priced.map((_, i) => left + ((right - left) * i) / Math.max(priced.length - 1, 1))
  const ys = vals.map(y)
  const path = linePath(xs, ys)
  const area = `${path} L${xs[xs.length - 1]!.toFixed(1)},${bottom} L${xs[0]!.toFixed(1)},${bottom} Z`
  const dots = xs
    .map(
      (x, i) =>
        `<circle cx="${x.toFixed(1)}" cy="${ys[i]!.toFixed(1)}" r="4" fill="#102742"/><text x="${x.toFixed(1)}" y="${bottom + 22}" text-anchor="middle" font-size="11" fill="#102742" opacity="0.75">${monthLabel(priced[i]!.periodStart)}</text>`,
    )
    .join('')
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Median close by month" class="trend-svg">
    <text x="0" y="14" font-size="11" fill="#102742" opacity="0.7">Median close</text>
    <text x="${left - 10}" y="${(y(max) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#102742" opacity="0.7">${chartUsd(max)}</text>
    <text x="${left - 10}" y="${(y(min) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#102742" opacity="0.7">${chartUsd(min)}</text>
    <path d="${area}" fill="#102742" fill-opacity="0.08"/>
    <path d="${path}" fill="none" stroke="#102742" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#102742" stroke-opacity="0.25" stroke-width="1"/>
    ${dots}
  </svg>
  <p class="small">Median close by month. Range ${chartUsd(min)} to ${chartUsd(max)}.</p>`
}

// ── The price ruler ─────────────────────────────────────────────────────────
// One horizontal price axis. Every closed sale in the band is a filled dot at
// its close price, every listing that came off without a sale is a hollow dot
// at its last ask, and exactly two marks carry a label: the recommend and the
// seller's own last ask.
//
// What it replaces: a lollipop-rows strip that printed each value twice (once
// as the row tick, once as the end label), sorted "Didn't sell $360K" to the
// top where it read as the headline, and stated no reading at all. Matt
// 2026-09-07: one ruler, sold vs unsold, so the seller sees where their band
// is and what happens when it is overpriced.

const RULER_INK = '#102742'
const RULER_MUTED = 'rgba(16,39,66,0.55)'
const RULER_EDGE = 'rgba(16,39,66,0.22)'

export type PriceRulerInput = {
  /** Close prices. Filled dots. */
  sold: readonly number[]
  /** Last asks of listings that came off without a sale. Hollow dots. */
  unsold: readonly number[]
  /** The recommended list. The one emphasized tick. */
  list: number
  listLabel: string
  /** The seller's own failed ask, when there is one. */
  lastAsk: number | null
  lastAskLabel: string | null
  caption: string
}

function rulerLabel(n: number): string {
  return chartUsd(n)
}

/**
 * Spread coincident dots away from the lane line so a cluster reads as a
 * cluster instead of one dot. Direction is away from the axis, never across
 * it — a sold dot never drifts into the unsold lane.
 */
function dodgeLane(
  values: readonly number[],
  x: (v: number) => number,
  r: number,
  dir: -1 | 1,
): Array<{ cx: number; cy: number }> {
  const sorted = [...values].sort((a, b) => a - b)
  const out: Array<{ cx: number; cy: number }> = []
  let clusterX = Number.NEGATIVE_INFINITY
  let depth = 0
  for (const v of sorted) {
    const cx = x(v)
    if (cx - clusterX < r * 2) {
      depth += 1
    } else {
      clusterX = cx
      depth = 0
    }
    out.push({ cx, cy: depth * (r * 2 + 2) * dir })
  }
  return out
}

export function priceRulerSvg(input: PriceRulerInput): string {
  const sold = input.sold.filter((n) => Number.isFinite(n) && n > 0)
  const unsold = input.unsold.filter((n) => Number.isFinite(n) && n > 0)
  if (sold.length === 0 || !Number.isFinite(input.list) || input.list <= 0) return ''
  const lastAsk =
    input.lastAsk != null && Number.isFinite(input.lastAsk) && input.lastAsk > 0 ? input.lastAsk : null

  const all = [...sold, ...unsold, input.list, ...(lastAsk != null ? [lastAsk] : [])]
  const dataMin = Math.min(...all)
  const dataMax = Math.max(...all)
  // Domain is the plotted data, never a theoretical band floor.
  const pad = Math.max((dataMax - dataMin) * 0.06, 1)
  const lo = dataMin - pad
  const hi = dataMax + pad

  const W = 720
  const H = 200
  const gutter = 104
  const plotL = gutter
  const plotR = W - 30
  const axisY = 104
  const soldY = 66
  const unsoldY = 148
  const r = 4.5
  const x = (v: number) => plotL + ((plotR - plotL) * (v - lo)) / (hi - lo)

  const soldDots = dodgeLane(sold, x, r, -1)
    .map((d) => `<circle cx="${d.cx.toFixed(1)}" cy="${(soldY + d.cy).toFixed(1)}" r="${r}" fill="${RULER_INK}"/>`)
    .join('')
  const unsoldDots = dodgeLane(unsold, x, r, 1)
    .map(
      (d) =>
        `<circle cx="${d.cx.toFixed(1)}" cy="${(unsoldY + d.cy).toFixed(1)}" r="${r}" fill="none" stroke="${RULER_INK}" stroke-width="1.4"/>`,
    )
    .join('')

  // Keep a direct label inside the frame at either end of the axis.
  const clamp = (v: number) => Math.min(Math.max(v, plotL + 4), plotR - 4)
  const anchorFor = (cx: number) => (cx < plotL + 70 ? 'start' : cx > plotR - 70 ? 'end' : 'middle')
  const listX = x(input.list)
  const askX = lastAsk != null ? x(lastAsk) : null

  // An end label that repeats a tick is the duplicate labelling P1 removed.
  const ticked = (v: number) =>
    Math.abs(v - input.list) < 500 || (lastAsk != null && Math.abs(v - lastAsk) < 500)
  const endLabel = (v: number, atX: number, anchor: 'start' | 'end') =>
    ticked(v)
      ? ''
      : `<text x="${atX}" y="${axisY + 20}" text-anchor="${anchor}" font-size="11.5" fill="${RULER_MUTED}">${esc(rulerLabel(v))}</text>`

  const listTick = `<line x1="${listX.toFixed(1)}" y1="30" x2="${listX.toFixed(1)}" y2="172" stroke="${RULER_INK}" stroke-width="1.75"/>
    <text x="${clamp(listX).toFixed(1)}" y="22" text-anchor="${anchorFor(listX)}" font-size="12.5" font-weight="600" fill="${RULER_INK}">${esc(input.listLabel)}</text>`
  const askTick =
    askX != null && input.lastAskLabel
      ? `<line x1="${askX.toFixed(1)}" y1="30" x2="${askX.toFixed(1)}" y2="172" stroke="${RULER_MUTED}" stroke-width="1.2"/>
    <text x="${clamp(askX).toFixed(1)}" y="188" text-anchor="${anchorFor(askX)}" font-size="12.5" font-weight="600" fill="${RULER_INK}">${esc(input.lastAskLabel)}</text>`
      : ''

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(input.caption)}" class="trend-svg">
    ${askTick}
    ${listTick}
    <line x1="${plotL}" y1="${axisY}" x2="${plotR}" y2="${axisY}" stroke="${RULER_EDGE}" stroke-width="0.75"/>
    ${endLabel(dataMin, plotL, 'start')}
    ${endLabel(dataMax, plotR, 'end')}
    <text x="${gutter - 16}" y="${soldY + 4}" text-anchor="end" font-size="12" font-weight="600" fill="${RULER_INK}">Sold</text>
    <text x="${gutter - 16}" y="${unsoldY + 4}" text-anchor="end" font-size="12" font-weight="600" fill="${RULER_MUTED}">Did not sell</text>
    ${soldDots}
    ${unsoldDots}
  </svg>`
}

// ── How fast homes like yours went ──────────────────────────────────────────
// Named rows on one days axis. Each kept sale is the days it waited for an
// offer; the subject is the days it waited and never got one. It replaces a
// month ledger of one-to-three listings and a row of dashes, which answered
// no question a seller has.

export type DaysRow = {
  label: string
  days: number
  /** The subject's own row. Full navy, and the bar says no offer arrived. */
  subject: boolean
  /** Printed at the bar end. */
  valueLabel: string
}

export function daysToOfferSvg(rows: readonly DaysRow[], caption: string): string {
  const kept = rows.filter((r) => Number.isFinite(r.days) && r.days >= 0)
  if (kept.length < 3) return ''
  const max = Math.max(...kept.map((r) => r.days))
  if (!(max > 0)) return ''

  const W = 720
  const rowH = 30
  const top = 16
  const H = top + kept.length * rowH + 14
  const gutter = 150
  const plotL = gutter
  // Reserve the right margin for the longest value label. The subject's reads
  // "192 days, no offer" and used to run off the frame.
  const longest = Math.max(...kept.map((r) => r.valueLabel.length))
  const plotR = W - Math.min(Math.max(longest * 6.7 + 16, 70), 190)
  const x = (v: number) => plotL + ((plotR - plotL) * v) / max

  const bars = kept
    .map((row, i) => {
      const y = top + i * rowH
      const mid = y + rowH / 2 - 4
      const end = x(row.days)
      const stroke = row.subject ? RULER_INK : RULER_MUTED
      const width = row.subject ? 7 : 5
      return `<text x="${gutter - 14}" y="${(mid + 4).toFixed(1)}" text-anchor="end" font-size="12" ${row.subject ? `font-weight="600" ` : ''}fill="${RULER_INK}">${esc(row.label)}</text>
    <line x1="${plotL}" y1="${(mid).toFixed(1)}" x2="${Math.max(end, plotL + 1).toFixed(1)}" y2="${(mid).toFixed(1)}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="butt"/>
    <text x="${(Math.max(end, plotL + 1) + 10).toFixed(1)}" y="${(mid + 4).toFixed(1)}" font-size="12" ${row.subject ? `font-weight="600" ` : ''}fill="${RULER_INK}">${esc(row.valueLabel)}</text>`
    })
    .join('\n    ')

  // Every bar carries its own value, so an axis tick would only repeat one.
  // The zero baseline is the whole axis: days are a count and start at zero.
  const baseY = top + kept.length * rowH - 6
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(caption)}" class="trend-svg">
    <line x1="${plotL}" y1="6" x2="${plotL}" y2="${baseY.toFixed(1)}" stroke="${RULER_EDGE}" stroke-width="0.75"/>
    ${bars}
  </svg>`
}

// The twelve-month new-listing ledger was deleted 2026-09-07 (P4). It printed
// one to three listings a month and a row of dashes, answered no question a
// seller has, and the days-to-offer strip above replaced it on both documents.
