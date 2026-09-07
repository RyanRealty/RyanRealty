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
 * The plotted domain, shared by both layouts so the two can never disagree
 * about where a dot sits relative to a tick.
 */
function rulerDomain(input: PriceRulerInput): {
  sold: number[]
  unsold: number[]
  lastAsk: number | null
  lo: number
  hi: number
  dataMin: number
  dataMax: number
} | null {
  const sold = input.sold.filter((n) => Number.isFinite(n) && n > 0)
  const unsold = input.unsold.filter((n) => Number.isFinite(n) && n > 0)
  if (sold.length === 0 || !Number.isFinite(input.list) || input.list <= 0) return null
  const lastAsk =
    input.lastAsk != null && Number.isFinite(input.lastAsk) && input.lastAsk > 0 ? input.lastAsk : null
  const all = [...sold, ...unsold, input.list, ...(lastAsk != null ? [lastAsk] : [])]
  const dataMin = Math.min(...all)
  const dataMax = Math.max(...all)
  // Domain is the plotted data, never a theoretical band floor.
  const pad = Math.max((dataMax - dataMin) * 0.06, 1)
  return { sold, unsold, lastAsk, lo: dataMin - pad, hi: dataMax + pad, dataMin, dataMax }
}

/**
 * Keep a label's own box inside the frame. Geist runs about 0.58em per
 * character at these sizes; the estimate is deliberately generous, because a
 * label that ends 3 units early is invisible and one that ends 3 units late is
 * a clipped word.
 */
function fitText(
  cx: number,
  label: string,
  fontSize: number,
  W: number,
): { x: string; anchor: 'start' | 'middle' | 'end' } {
  const half = (label.length * fontSize * 0.58) / 2
  if (cx - half < 1) return { x: '1', anchor: 'start' }
  if (cx + half > W - 1) return { x: (W - 1).toFixed(1), anchor: 'end' }
  return { x: cx.toFixed(1), anchor: 'middle' }
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
  const domain = rulerDomain(input)
  if (!domain) return ''
  const { sold, unsold, lastAsk, lo, hi, dataMin, dataMax } = domain

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

/**
 * The same ruler, laid out for a phone.
 *
 * F6, 2026-09-07: the 720-unit ruler was held at `min-width` inside a pan box
 * below 700px, so a seller opening the document on a phone saw the "$360K"
 * unsold dot and the recommend tick and nothing else — the nine closed sales
 * and their own failed ask were off the right edge of a box nobody scrolls.
 * A wide chart panning is right for a twelve-row days strip; it is wrong for
 * the one graphic whose whole reading is where two marks sit relative to a
 * band, because the reading is destroyed by cropping either end.
 *
 * So this layout is drawn to fit: a 360-unit frame that scales to the phone
 * with no cropping, lane names in a left gutter, and the two ticks labelled
 * above and below the plot where a long label has the full frame to sit in
 * rather than a half-width of it.
 */
export function priceRulerPhoneSvg(input: PriceRulerInput): string {
  const domain = rulerDomain(input)
  if (!domain) return ''
  const { sold, unsold, lastAsk, lo, hi, dataMin, dataMax } = domain

  const W = 360
  const r = 4
  const gutter = 58
  const plotL = gutter
  const plotR = W - 10
  const x = (v: number) => plotL + ((plotR - plotL) * (v - lo)) / (hi - lo)

  const soldPts = dodgeLane(sold, x, r, -1)
  const unsoldPts = dodgeLane(unsold, x, r, 1)
  const soldSpan = Math.max(0, ...soldPts.map((p) => -p.cy))
  const unsoldSpan = Math.max(0, ...unsoldPts.map((p) => p.cy))

  // Every band below is measured off the one above it, so a deep cluster grows
  // the frame instead of colliding with the label over it.
  const tickTop = 22
  const soldY = tickTop + 12 + r + soldSpan
  const axisY = soldY + 22
  const unsoldY = axisY + 30
  const tickBottom = unsoldY + unsoldSpan + r + 10
  const askLabelY = lastAsk != null && input.lastAskLabel ? tickBottom + 16 : null
  const H = Math.ceil((askLabelY ?? tickBottom) + 8)

  const soldDots = soldPts
    .map(
      (d) =>
        `<circle cx="${d.cx.toFixed(1)}" cy="${(soldY + d.cy).toFixed(1)}" r="${r}" fill="${RULER_INK}"/>`,
    )
    .join('')
  const unsoldDots = unsoldPts
    .map(
      (d) =>
        `<circle cx="${d.cx.toFixed(1)}" cy="${(unsoldY + d.cy).toFixed(1)}" r="${r}" fill="none" stroke="${RULER_INK}" stroke-width="1.3"/>`,
    )
    .join('')

  // An end label that repeats a tick is the duplicate labelling P1 removed.
  const ticked = (v: number) =>
    Math.abs(v - input.list) < 500 || (lastAsk != null && Math.abs(v - lastAsk) < 500)
  const endLabel = (v: number, atX: number, anchor: 'start' | 'end') =>
    ticked(v)
      ? ''
      : `<text x="${atX}" y="${(axisY + 15).toFixed(1)}" text-anchor="${anchor}" font-size="11" fill="${RULER_MUTED}">${esc(rulerLabel(v))}</text>`

  const listFit = fitText(x(input.list), input.listLabel, 12.5, W)
  const listTick = `<line x1="${x(input.list).toFixed(1)}" y1="${tickTop}" x2="${x(input.list).toFixed(1)}" y2="${tickBottom.toFixed(1)}" stroke="${RULER_INK}" stroke-width="1.6"/>
    <text x="${listFit.x}" y="14" text-anchor="${listFit.anchor}" font-size="12.5" font-weight="600" fill="${RULER_INK}">${esc(input.listLabel)}</text>`

  let askTick = ''
  if (lastAsk != null && input.lastAskLabel && askLabelY != null) {
    const askFit = fitText(x(lastAsk), input.lastAskLabel, 12.5, W)
    askTick = `<line x1="${x(lastAsk).toFixed(1)}" y1="${tickTop}" x2="${x(lastAsk).toFixed(1)}" y2="${tickBottom.toFixed(1)}" stroke="${RULER_MUTED}" stroke-width="1.1"/>
    <text x="${askFit.x}" y="${askLabelY.toFixed(1)}" text-anchor="${askFit.anchor}" font-size="12.5" font-weight="600" fill="${RULER_INK}">${esc(input.lastAskLabel)}</text>`
  }

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(input.caption)}" class="trend-svg">
    ${askTick}
    ${listTick}
    <line x1="${plotL}" y1="${axisY.toFixed(1)}" x2="${plotR}" y2="${axisY.toFixed(1)}" stroke="${RULER_EDGE}" stroke-width="0.75"/>
    ${endLabel(dataMin, plotL, 'start')}
    ${endLabel(dataMax, plotR, 'end')}
    <text x="${gutter - 10}" y="${(soldY + 4).toFixed(1)}" text-anchor="end" font-size="11" font-weight="600" fill="${RULER_INK}">Sold</text>
    <text x="${gutter - 10}" y="${(unsoldY - 1).toFixed(1)}" text-anchor="end" font-size="11" font-weight="600" fill="${RULER_MUTED}">Did not</text>
    <text x="${gutter - 10}" y="${(unsoldY + 11).toFixed(1)}" text-anchor="end" font-size="11" font-weight="600" fill="${RULER_MUTED}">sell</text>
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

/**
 * Row labels are right-anchored in a fixed gutter, so a long address grows
 * LEFT and off the sheet. At twelve comps that put eight paragraphs 4pt into
 * the left margin and failed the page-safety contract. Twenty-four characters
 * is what the 136-unit gutter holds at 12px.
 */
const DAYS_LABEL_MAX = 24

function fitLabel(text: string): string {
  const t = text.trim()
  if (t.length <= DAYS_LABEL_MAX) return t
  return `${t.slice(0, DAYS_LABEL_MAX - 1).trimEnd()}…`
}

/**
 * The market's own median, drawn across the bars as one hairline.
 *
 * It sat off this chart until 2026-09-07 on a stated reason that was false:
 * that the market figure is list-to-close and two measures never share an
 * axis. `market_stats_cache.median_dom` medians `listings.days_to_pending`,
 * and a comp's `daysToOffer` reads that same column (lib/cma/comps.ts:131).
 * They are one measure, so the tick is commensurate with every bar beside it.
 */
export type DaysMedianTick = {
  days: number
  /** Printed above the tick, e.g. "Redmond median 21 days". */
  label: string
}

export function daysToOfferSvg(
  rows: readonly DaysRow[],
  caption: string,
  median?: DaysMedianTick | null,
): string {
  const kept = rows.filter((r) => Number.isFinite(r.days) && r.days >= 0)
  if (kept.length < 3) return ''
  const tick =
    median != null && Number.isFinite(median.days) && median.days > 0 && median.label.trim()
      ? median
      : null
  // The tick shares the bars' domain, so a median slower than every kept sale
  // still lands inside the frame rather than off the right edge.
  const max = Math.max(...kept.map((r) => r.days), tick?.days ?? 0)
  if (!(max > 0)) return ''

  const W = 720
  const rowH = 30
  // The tick's label lives above the plot; without one the bars start higher.
  const top = tick ? 34 : 16
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
      return `<text x="${gutter - 14}" y="${(mid + 4).toFixed(1)}" text-anchor="end" font-size="12" ${row.subject ? `font-weight="600" ` : ''}fill="${RULER_INK}">${esc(fitLabel(row.label))}</text>
    <line x1="${plotL}" y1="${(mid).toFixed(1)}" x2="${Math.max(end, plotL + 1).toFixed(1)}" y2="${(mid).toFixed(1)}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="butt"/>
    <text x="${(Math.max(end, plotL + 1) + 10).toFixed(1)}" y="${(mid + 4).toFixed(1)}" font-size="12" ${row.subject ? `font-weight="600" ` : ''}fill="${RULER_INK}">${esc(row.valueLabel)}</text>`
    })
    .join('\n    ')

  // Every bar carries its own value, so an axis tick would only repeat one.
  // The zero baseline is the whole axis: days are a count and start at zero.
  const baseY = top + kept.length * rowH - 6
  const medianMark = (() => {
    if (!tick) return ''
    const tx = x(tick.days)
    const text = tick.label.trim()
    // 11px Geist runs ~0.56em per character. The label flips to the left of
    // the tick rather than off the frame.
    const w = text.length * 6.2
    const flip = tx + 6 + w > W
    return `<line class="days-median" x1="${tx.toFixed(1)}" y1="${(top - 14).toFixed(1)}" x2="${tx.toFixed(1)}" y2="${baseY.toFixed(1)}" stroke="${RULER_MUTED}" stroke-width="1"/>
    <text x="${(flip ? tx - 6 : tx + 6).toFixed(1)}" y="${(top - 18).toFixed(1)}"${flip ? ' text-anchor="end"' : ''} font-size="11" font-weight="600" fill="${RULER_MUTED}">${esc(text)}</text>`
  })()
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(caption)}" class="trend-svg">
    <line x1="${plotL}" y1="${tick ? (top - 14).toFixed(1) : '6'}" x2="${plotL}" y2="${baseY.toFixed(1)}" stroke="${RULER_EDGE}" stroke-width="0.75"/>
    ${medianMark}
    ${bars}
  </svg>`
}

// The twelve-month new-listing ledger was deleted 2026-09-07 (P4). It printed
// one to three listings a month and a row of dashes, answered no question a
// seller has, and the days-to-offer strip above replaced it on both documents.
