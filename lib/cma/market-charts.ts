/**
 * Client CMA charts. A real path through priced months, not a dead bar.
 * Count and dollars never share an axis.
 */

import { escapeHtml, int } from '@/lib/cma/render-blocks'

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

/**
 * The same days strip, laid out for a phone.
 *
 * F8, 2026-09-07: the 720-unit strip was held at `min-width` inside a pan box
 * below 700px. That is the right call for a wide chart whose reading survives
 * a cropped tail — but this chart's punchline is the subject's own bar and its
 * label ("192 days, no offer"), and at 375 both that label and the market
 * median's label sat outside the visible width of a box no seller scrolls.
 *
 * So this layout is drawn to fit, the way `priceRulerPhoneSvg` is. The row
 * label moves out of the left gutter and sits ABOVE its bar, which frees the
 * whole frame for the bar and puts the value at the right edge where the eye
 * already is. The median rides the same domain as the bars, so it can never
 * disagree with the wide layout about where it sits, and its label flips to
 * the left of the hairline rather than off the frame.
 */
export function daysToOfferPhoneSvg(
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
  const max = Math.max(...kept.map((r) => r.days), tick?.days ?? 0)
  if (!(max > 0)) return ''

  const W = 360
  const FS = 11
  // Geist runs about 0.58em per character at this size. Deliberately generous:
  // a label three units short is invisible, three units long is a clipped word.
  const width = (s: string) => s.length * FS * 0.58
  const plotL = 6
  const plotR = W - 6
  const rowH = 32
  const top = tick ? 24 : 6
  const baseY = top + kept.length * rowH + 2
  const H = baseY + 4
  const x = (v: number) => plotL + ((plotR - plotL) * v) / max

  const bars = kept
    .map((row, i) => {
      const labelY = top + i * rowH + 11
      const barY = top + i * rowH + 20
      const end = Math.max(x(row.days), plotL + 1)
      const stroke = row.subject ? RULER_INK : RULER_MUTED
      const weight = row.subject ? 6 : 4
      // The value owns the right edge; the address takes what is left of the
      // frame, truncated by its own measured width rather than a fixed count.
      const room = plotR - width(row.valueLabel) - 8 - plotL
      const maxChars = Math.max(6, Math.floor(room / (FS * 0.58)))
      const label =
        row.label.trim().length <= maxChars
          ? row.label.trim()
          : `${row.label.trim().slice(0, maxChars - 1).trimEnd()}…`
      const bold = row.subject ? ' font-weight="600"' : ''
      return `<text x="${plotL}" y="${labelY}"${bold} font-size="${FS}" fill="${RULER_INK}">${esc(label)}</text>
    <text x="${plotR}" y="${labelY}" text-anchor="end"${bold} font-size="${FS}" fill="${RULER_INK}">${esc(row.valueLabel)}</text>
    <line x1="${plotL}" y1="${barY}" x2="${end.toFixed(1)}" y2="${barY}" stroke="${stroke}" stroke-width="${weight}" stroke-linecap="butt"/>`
    })
    .join('\n    ')

  // The row label owns the full width here, so the wide layout's one
  // continuous hairline would strike through six addresses. The median is a
  // comb instead: one short segment inside each bar's own band, which reads as
  // one vertical rule and touches no text. The label flips to the left of the
  // comb rather than off the frame.
  const medianMark = (() => {
    if (!tick) return ''
    const tx = x(tick.days)
    const text = tick.label.trim()
    const w = width(text)
    const flip = tx + 6 + w > W
    const lx = flip ? Math.max(tx - 6, w) : Math.min(tx + 6, W - w)
    const teeth = kept
      .map((_, i) => {
        const barY = top + i * rowH + 20
        return `<line class="days-median" x1="${tx.toFixed(1)}" y1="${barY - 7}" x2="${tx.toFixed(1)}" y2="${barY + 7}" stroke="${RULER_MUTED}" stroke-width="1"/>`
      })
      .join('\n    ')
    return `${teeth}
    <text x="${lx.toFixed(1)}" y="12"${flip ? ' text-anchor="end"' : ''} font-size="${FS}" font-weight="600" fill="${RULER_MUTED}">${esc(text)}</text>`
  })()

  // No zero axis: with the labels out of a gutter, a vertical rule at the
  // origin would run under the first character of every address. Six bars
  // starting flush on one edge already state where zero is.
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(caption)}" class="trend-svg">
    ${medianMark}
    ${bars}
  </svg>`
}

// ── Their listing, as a timeline ────────────────────────────────────────────
// Chapter 1 of docs/plans/CMA_REIMAGINED_2026-09-07.md. Matt 2026-09-07: "the
// chart means nothing, we need to illustrate that if homes are priced too high
// they sit and expire, period."
//
// One horizontal time axis from list date to off-market date. A shaded zone
// across the whole width at the value range, labelled with what it is. Their
// asking price drawn as a stepped line that starts at the original ask, drops
// at each cut, and stops at the day it came off. The line never enters the
// zone, and that gap IS the chapter.
//
// It replaces a price ruler whose whole reading was "here are some dots".

const TL_INK = RULER_INK
const TL_MUTED = RULER_MUTED
const TL_EDGE = RULER_EDGE

export type ListingTimelineStep = { date: string; ask: number }

export type ListingTimelineInput = {
  /** The day the final listing period opened. */
  listDate: string
  /** The day it came off. Null while it is still live. */
  offMarketDate: string | null
  /** Every ask on that period, in order. The first is the original. */
  steps: readonly ListingTimelineStep[]
  /** The value range homes like this one sold in. */
  rangeLow: number
  rangeHigh: number
  /** What the shaded zone is, in the seller's words. */
  rangeLabel: string
  /** "withdrawn" / "expired" / "canceled". Printed at the end of the line. */
  status: string | null
  /** Days the period ran. Printed beside the end. */
  days: number | null
  caption: string
}

type TimelineGeometry = {
  steps: Array<{ t: number; ask: number }>
  t0: number
  t1: number
  lo: number
  hi: number
  low: number
  high: number
}

function timelineDay(value: string | null | undefined): number | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const day = raw.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const t = Date.parse(`${day}T00:00:00.000Z`)
  return Number.isNaN(t) ? null : t
}

/**
 * The plotted domain, shared by both layouts so the wide drawing and the
 * phone drawing can never disagree about where the line sits inside the zone.
 */
function timelineGeometry(input: ListingTimelineInput): TimelineGeometry | null {
  const t0 = timelineDay(input.listDate)
  if (t0 == null) return null
  const steps = input.steps
    .map((s) => ({ t: timelineDay(s.date) ?? t0, ask: s.ask }))
    .filter((s) => Number.isFinite(s.ask) && s.ask > 0)
    .sort((a, b) => a.t - b.t)
  if (steps.length === 0) return null
  const low = Math.min(input.rangeLow, input.rangeHigh)
  const high = Math.max(input.rangeLow, input.rangeHigh)
  if (!(low > 0) || !(high > 0)) return null
  // A listing still on the market runs to today; one that came off stops the
  // day it came off. Never past it — the line would claim exposure it never had.
  const end = timelineDay(input.offMarketDate) ?? Date.now()
  const t1 = Math.max(end, steps[steps.length - 1]!.t + 86_400_000)
  const asks = steps.map((s) => s.ask)
  const dataMin = Math.min(low, ...asks)
  const dataMax = Math.max(high, ...asks)
  const pad = Math.max((dataMax - dataMin) * 0.14, 1)
  return { steps, t0, t1, lo: dataMin - pad, hi: dataMax + pad, low, high }
}

function timelineStepPath(
  g: TimelineGeometry,
  x: (t: number) => number,
  y: (v: number) => number,
): string {
  const parts: string[] = []
  for (let i = 0; i < g.steps.length; i++) {
    const s = g.steps[i]!
    const nextT = i + 1 < g.steps.length ? g.steps[i + 1]!.t : g.t1
    if (i === 0) parts.push(`M${x(s.t).toFixed(1)},${y(s.ask).toFixed(1)}`)
    else parts.push(`L${x(s.t).toFixed(1)},${y(s.ask).toFixed(1)}`)
    parts.push(`L${x(nextT).toFixed(1)},${y(s.ask).toFixed(1)}`)
  }
  return parts.join(' ')
}

function monthDay(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00.000Z`)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** The end of the line: "came off withdrawn · 187 days". */
export function timelineEndLabel(input: ListingTimelineInput): string {
  const status = (input.status ?? '').trim().toLowerCase()
  const days = input.days != null && input.days > 0 ? `${int(input.days)} days` : null
  const off = status ? `came off ${status}` : input.offMarketDate ? 'came off' : 'still listed'
  return days ? `${off} · ${days}` : off
}

export function listingTimelineSvg(input: ListingTimelineInput): string {
  const g = timelineGeometry(input)
  if (!g) return ''
  const W = 720
  const H = 250
  const plotL = 78
  const plotR = W - 14
  const top = 40
  const bottom = H - 40
  const x = (t: number) => plotL + ((plotR - plotL) * (t - g.t0)) / Math.max(g.t1 - g.t0, 1)
  const y = (v: number) => bottom - ((bottom - top) * (v - g.lo)) / Math.max(g.hi - g.lo, 1)
  return timelineBody({ input, g, W, H, plotL, plotR, top, bottom, x, y, fs: 12, endFs: 12.5 })
}

/**
 * The same timeline, drawn to fit a phone.
 *
 * Not the wide one in a pan box: this chart's whole reading is the gap between
 * a line and a zone, and a cropped right edge deletes the day it came off —
 * the punchline. 360 units, scaled to the screen, nothing outside the viewBox.
 */
export function listingTimelinePhoneSvg(input: ListingTimelineInput): string {
  const g = timelineGeometry(input)
  if (!g) return ''
  const W = 360
  const H = 210
  const plotL = 58
  const plotR = W - 8
  const top = 34
  const bottom = H - 34
  const x = (t: number) => plotL + ((plotR - plotL) * (t - g.t0)) / Math.max(g.t1 - g.t0, 1)
  const y = (v: number) => bottom - ((bottom - top) * (v - g.lo)) / Math.max(g.hi - g.lo, 1)
  return timelineBody({ input, g, W, H, plotL, plotR, top, bottom, x, y, fs: 10.5, endFs: 11 })
}

function timelineBody(o: {
  input: ListingTimelineInput
  g: TimelineGeometry
  W: number
  H: number
  plotL: number
  plotR: number
  top: number
  bottom: number
  x: (t: number) => number
  y: (v: number) => number
  fs: number
  endFs: number
}): string {
  const { input, g, W, H, plotL, plotR, top, bottom, x, y, fs, endFs } = o
  const zoneTop = y(g.high)
  const zoneBottom = y(g.low)
  const path = timelineStepPath(g, x, y)

  // Only the asks carry a number. A price on every point is unread chaos
  // (dataviz skill, step 4) — the zone is named, not numbered on both edges.
  const last = g.steps[g.steps.length - 1]!
  const marks = g.steps
    .map((s, i) => {
      const cx = x(s.t)
      const cy = y(s.ask)
      const label = chartUsd(s.ask)
      const fit = fitText(cx, label, fs, W)
      // The first ask labels above its own step; a cut labels above too, but
      // nudged right so it cannot collide with the ask it replaced.
      const lx = i === 0 ? Math.max(cx, plotL + label.length * fs * 0.3) : fit.x
      const anchor = i === 0 ? 'start' : fit.anchor
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5" fill="${TL_INK}"/>
    <text x="${typeof lx === 'string' ? lx : lx.toFixed(1)}" y="${(cy - 9).toFixed(1)}" text-anchor="${anchor}" font-size="${fs}" font-weight="600" fill="${TL_INK}">${esc(label)}</text>`
    })
    .join('\n    ')

  const endX = x(g.t1)
  const endY = y(last.ask)
  const endText = timelineEndLabel(input)
  const endFit = fitText(endX, endText, endFs, W)
  // The label belongs to the mark it names, so it sits with the end of the
  // line, not parked at the foot of the frame where the eye has to hunt for
  // what it refers to. Above the line when the line runs near the floor.
  const endBelow = endY < bottom - 34
  const endLabelY = endBelow ? endY + 20 : endY - 12
  const startDay = monthDay(input.listDate)
  const endDay = input.offMarketDate ? monthDay(input.offMarketDate) : ''
  const zoneLabelY = Math.max(zoneTop - 6, top - 12)

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(input.caption)}" class="trend-svg">
    <rect x="${plotL}" y="${zoneTop.toFixed(1)}" width="${(plotR - plotL).toFixed(1)}" height="${Math.max(zoneBottom - zoneTop, 2).toFixed(1)}" fill="${TL_INK}" fill-opacity="0.11"/>
    <line x1="${plotL}" y1="${zoneTop.toFixed(1)}" x2="${plotR}" y2="${zoneTop.toFixed(1)}" stroke="${TL_INK}" stroke-opacity="0.34" stroke-width="1"/>
    <line x1="${plotL}" y1="${zoneBottom.toFixed(1)}" x2="${plotR}" y2="${zoneBottom.toFixed(1)}" stroke="${TL_INK}" stroke-opacity="0.34" stroke-width="1"/>
    <text x="${plotL}" y="${zoneLabelY.toFixed(1)}" font-size="${fs}" fill="${TL_MUTED}">${esc(input.rangeLabel)}</text>
    <text x="${plotL - 8}" y="${(zoneTop + 4).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="${TL_MUTED}">${esc(chartUsd(g.high))}</text>
    <text x="${plotL - 8}" y="${(zoneBottom + 4).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="${TL_MUTED}">${esc(chartUsd(g.low))}</text>
    <line x1="${plotL}" y1="${bottom.toFixed(1)}" x2="${plotR}" y2="${bottom.toFixed(1)}" stroke="${TL_EDGE}" stroke-width="0.75"/>
    <path d="${path}" fill="none" stroke="${TL_INK}" stroke-width="2.5" stroke-linejoin="miter" stroke-linecap="butt"/>
    ${marks}
    <circle cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="3.5" fill="none" stroke="${TL_INK}" stroke-width="1.6"/>
    <text x="${endFit.x}" y="${endLabelY.toFixed(1)}" text-anchor="${endFit.anchor}" font-size="${endFs}" font-weight="600" fill="${TL_INK}">${esc(endText)}</text>
    <text x="${plotL}" y="${(bottom + 16).toFixed(1)}" font-size="${fs}" fill="${TL_MUTED}">${esc(startDay)}</text>
    ${endDay ? `<text x="${plotR}" y="${(bottom + 16).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="${TL_MUTED}">${esc(endDay)}</text>` : ''}
  </svg>`
}
