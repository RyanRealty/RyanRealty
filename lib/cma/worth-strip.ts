/**
 * Chapter 3's own conclusion, drawn.
 *
 * tasteReview 2026-09-07, item 2: "Chapter 3 is the point of the document and
 * it has no graphic of its own conclusion — it goes headline, four paragraphs
 * of method, then a twelve-row spreadsheet. Draw the five adjusted prices as a
 * dot strip with the range shaded and the recommended list marked, above the
 * grid, so one glance lands 'here is where five real sales put your house, and
 * here is where we would list it.'"
 *
 * ONE price axis. Every printed sale is a dot at its sale-price-today, the
 * worth range is the shaded strip under them, the recommended list is the one
 * full-navy mark, and on a listing that failed the ask that failed is a hollow
 * mark beside it — which is the same reading chapter 1 draws against time,
 * drawn here against the evidence.
 *
 * Nothing here computes a valuation. Every figure is already printed in the
 * grid below it (`adjustedPrice` per sale) or on the pricing row
 * (`valueLow` / `valueHigh` / `recommended`), so a reader can check every mark
 * against a number on the same screen (CLAUDE.md §0).
 */

import { escapeHtml, int, usd } from '@/lib/cma/render-blocks'

const esc = escapeHtml

const INK = '#102742'
const MUTED = 'rgba(16,39,66,0.55)'
const EDGE = 'rgba(16,39,66,0.22)'
const ZONE = 'rgba(16,39,66,0.11)'

export type WorthStripInput = {
  /** One dot per printed sale, in the grid's own order. */
  sales: Array<{ n: number; address: string; adjustedPrice: number }>
  rangeLow: number
  rangeHigh: number
  recommended: number
  /** The ask that failed, on an expired origin. Null otherwise. */
  lastAsk: number | null
}

export type WorthStripLayout = { width: number; height: number; fontSize: number }

export const WORTH_STRIP_WIDE: WorthStripLayout = { width: 720, height: 168, fontSize: 12 }
export const WORTH_STRIP_PHONE: WorthStripLayout = { width: 360, height: 190, fontSize: 10.5 }

/** $475K. A price axis is read at a glance, not audited — the grid audits it. */
function shortUsd(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 || n % 1_000_000 === 0 ? m.toFixed(0) : m.toFixed(2)}M`
  }
  return `$${Math.round(n / 1000)}K`
}

type Geometry = {
  lo: number
  hi: number
  low: number
  high: number
  sales: Array<{ n: number; address: string; adjustedPrice: number }>
}

export function worthStripGeometry(input: WorthStripInput): Geometry | null {
  const sales = input.sales
    .filter((s) => Number.isFinite(s.adjustedPrice) && s.adjustedPrice > 0)
    .sort((a, b) => a.adjustedPrice - b.adjustedPrice)
  if (sales.length < 2) return null
  const low = Math.min(input.rangeLow, input.rangeHigh)
  const high = Math.max(input.rangeLow, input.rangeHigh)
  if (!(low > 0) || !(high > 0) || !(input.recommended > 0)) return null
  const values = [
    ...sales.map((s) => s.adjustedPrice),
    low,
    high,
    input.recommended,
    ...(input.lastAsk != null && input.lastAsk > 0 ? [input.lastAsk] : []),
  ]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.12, Math.max(max * 0.01, 1))
  return { lo: min - pad, hi: max + pad, low, high, sales }
}

/**
 * Keep a label's own box inside the frame. Geist runs about 0.58em per
 * character at these sizes; deliberately generous, because a label that ends
 * three units early is invisible and one that ends three units late is a
 * clipped word.
 */
function fit(
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

export function worthStripSvg(
  input: WorthStripInput,
  layout: WorthStripLayout = WORTH_STRIP_WIDE,
): string {
  const g = worthStripGeometry(input)
  if (!g) return ''
  const { width: W, height: H, fontSize: fs } = layout
  const left = 10
  const right = W - 10
  // The shaded strip sits low in the frame; the marks that name themselves sit above
  // it, and the axis numbers under it. Three rows, no collisions.
  const zoneTop = H - 74
  const zoneBottom = H - 46
  const dotY = zoneTop - 16
  const x = (v: number) => left + ((right - left) * (v - g.lo)) / Math.max(g.hi - g.lo, 1)

  // Dots. Only the two ends carry a number — five prices along 700 units with
  // a label each is unread chaos (dataviz skill, step 4). Every dot names
  // itself on tap, and the grid below prints all five.
  //
  // The tap target is 26 units, not 44: five sales inside three percent of
  // each other are a DENSE SERIES, and 44px targets on a phone would overlap
  // so completely that only the last dot could be reached. The dataviz skill's
  // floor for a mark is 24px, the look-pass holds these to it, and every one
  // of these five prices is also a row in the grid below, which is the 44px
  // path to the same reading.
  const first = g.sales[0]!
  const last = g.sales[g.sales.length - 1]!
  const dots = g.sales
    .map((s) => {
      const cx = x(s.adjustedPrice)
      const read = `${s.n}. ${s.address} · sale price today ${usd(s.adjustedPrice)}`
      return `<g class="ws-dot" data-comp="${s.n}" data-pin="${s.n}" data-read="${esc(read)}" tabindex="0" role="button" aria-label="${esc(read)}">
      <circle cx="${cx.toFixed(1)}" cy="${dotY.toFixed(1)}" r="13" fill="transparent"/>
      <circle cx="${cx.toFixed(1)}" cy="${dotY.toFixed(1)}" r="5" fill="${INK}"/>
    </g>`
    })
    .join('\n    ')
  const endLabel = (v: number, anchorLeft: boolean) => {
    const f = fit(x(v), shortUsd(v), fs, W)
    return `<text x="${anchorLeft ? f.x : f.x}" y="${(dotY - 12).toFixed(1)}" text-anchor="${f.anchor}" font-size="${fs}" font-weight="600" fill="${INK}">${esc(shortUsd(v))}</text>`
  }

  // The recommended list: a full-height rule through the strip, labelled under
  // the axis where nothing else sits.
  const recX = x(input.recommended)
  const recLabel = `list ${shortUsd(input.recommended)}`
  const recFit = fit(recX, recLabel, fs, W)
  // The ask that failed. Hollow, because it is not a price anything sold at.
  const ask = input.lastAsk != null && input.lastAsk > 0 ? input.lastAsk : null
  const askX = ask != null ? x(ask) : 0
  const askLabel = ask != null ? `asked ${shortUsd(ask)}` : ''
  const askFit = ask != null ? fit(askX, askLabel, fs, W) : null

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Where the sales put this home, and where we would list it" class="trend-svg worth-strip">
    <text x="${left}" y="14" font-size="${fs}" fill="${MUTED}">Sale price today, ${int(g.sales.length)} sales</text>
    <rect x="${x(g.low).toFixed(1)}" y="${zoneTop.toFixed(1)}" width="${Math.max(x(g.high) - x(g.low), 2).toFixed(1)}" height="${(zoneBottom - zoneTop).toFixed(1)}" fill="${ZONE}"/>
    <line x1="${left}" y1="${zoneBottom.toFixed(1)}" x2="${right}" y2="${zoneBottom.toFixed(1)}" stroke="${EDGE}" stroke-width="0.75"/>
    ${
      ask != null
        ? `<line x1="${askX.toFixed(1)}" y1="${(zoneTop - 30).toFixed(1)}" x2="${askX.toFixed(1)}" y2="${zoneBottom.toFixed(1)}" stroke="${MUTED}" stroke-width="1.25" stroke-dasharray="3 3"/>
    <text x="${askFit!.x}" y="${(H - 26).toFixed(1)}" text-anchor="${askFit!.anchor}" font-size="${fs}" fill="${MUTED}">${esc(askLabel)}</text>`
        : ''
    }
    <line x1="${recX.toFixed(1)}" y1="${(zoneTop - 30).toFixed(1)}" x2="${recX.toFixed(1)}" y2="${zoneBottom.toFixed(1)}" stroke="${INK}" stroke-width="2"/>
    <text x="${recFit.x}" y="${(H - 8).toFixed(1)}" text-anchor="${recFit.anchor}" font-size="${fs}" font-weight="600" fill="${INK}">${esc(recLabel)}</text>
    ${dots}
    ${endLabel(first.adjustedPrice, true)}
    ${last.adjustedPrice !== first.adjustedPrice ? endLabel(last.adjustedPrice, false) : ''}
    <text x="${x(g.low).toFixed(1)}" y="${(zoneBottom + 15).toFixed(1)}" font-size="${fs}" fill="${MUTED}">what it is worth</text>
  </svg>`
}

export function worthStripPhoneSvg(input: WorthStripInput): string {
  return worthStripSvg(input, WORTH_STRIP_PHONE)
}

/** The reading under the strip. Every figure in it is drawn above it. */
export function worthStripReading(input: WorthStripInput): string {
  const g = worthStripGeometry(input)
  if (!g) return ''
  const n = g.sales.length
  return `${int(n)} closed ${n === 1 ? 'sale' : 'sales'}, each moved to what it would sell for today, land between ${usd(
    g.sales[0]!.adjustedPrice,
  )} and ${usd(g.sales[n - 1]!.adjustedPrice)}. The shading is what your home is worth. The line is where we would list it.`
}

/**
 * Both layouts, wrapped so exactly one is ever visible — the wide drawing on
 * paper and at reading width, the fitted one below 700px. Nothing a seller
 * reads sits in a pan box (blueprint § The register).
 */
export function worthStripHtml(input: WorthStripInput): string {
  const wide = worthStripSvg(input, WORTH_STRIP_WIDE)
  if (!wide) return ''
  const phone = worthStripSvg(input, WORTH_STRIP_PHONE)
  const reading = worthStripReading(input)
  return `<div class="szn worth-wide">${wide}</div>
  ${phone ? `<div class="szn worth-phone">${phone}</div>` : ''}
  ${reading ? `<p class="chart-read">${esc(reading)}</p>` : ''}`
}
