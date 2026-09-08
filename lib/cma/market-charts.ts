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

/**
 * Median close over completed months. Needs six priced months.
 *
 * Two layouts, exactly one visible: 720 units on paper and at reading width,
 * 360 drawn to fit below 700px. It was the last chart on the document still
 * held in a pan box on a phone, which cropped six of its twelve months —
 * nothing a seller reads sits in a scroll box (blueprint § The register).
 */
export function medianCloseLineSvg(points: TrendPoint[], opts?: { width?: number }): string {
  const priced = [...points]
    .filter((p) => p.medianSalePrice != null && p.medianSalePrice > 0)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
  if (priced.length < 6) return ''
  const W = opts?.width ?? 720
  const phone = W <= 400
  const H = phone ? 190 : 220
  const fs = phone ? 10 : 11
  // The y-value labels sit in a gutter to the LEFT of the plot. Drawn at the
  // plot's own left edge they shared ink with September's mark.
  const left = phone ? 44 : 68
  const right = W - (phone ? 8 : 24)
  const top = 28
  const bottom = H - 52
  const vals = priced.map((p) => p.medianSalePrice!)
  const y = scaleY(vals, top, bottom)
  const xs = priced.map((_, i) => left + ((right - left) * i) / Math.max(priced.length - 1, 1))
  const ys = vals.map(y)
  const path = linePath(xs, ys)
  const area = `${path} L${xs[xs.length - 1]!.toFixed(1)},${bottom} L${xs[0]!.toFixed(1)},${bottom} Z`
  // Thin the month axis so two labels never overlap on a phone.
  let lastTickX = Number.NEGATIVE_INFINITY
  const dots = xs
    .map((x, i) => {
      const label = monthLabel(priced[i]!.periodStart)
      const halfW = label.length * fs * 0.58
      let tick = ''
      if (x - lastTickX >= halfW * 2 + 3) {
        lastTickX = x
        tick = `<text x="${x.toFixed(1)}" y="${bottom + 22}" text-anchor="middle" font-size="${fs}" fill="#102742" opacity="0.75">${label}</text>`
      }
      // Delta 2: "Hover or tap the month line: the value and the month." The
      // reading is the month and the figure already plotted at that point.
      const read = `${monthLabel(priced[i]!.periodStart)}: ${chartUsd(vals[i]!)} median close`
      return `<g class="month-mark" data-read="${esc(read)}" tabindex="0" role="button" aria-label="${esc(read)}">
      <circle cx="${x.toFixed(1)}" cy="${ys[i]!.toFixed(1)}" r="12" fill="transparent"/>
      <circle cx="${x.toFixed(1)}" cy="${ys[i]!.toFixed(1)}" r="${phone ? 3 : 4}" fill="#102742"/>
    </g>${tick}`
    })
    .join('')
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Median close by month" class="trend-svg month-line">
    <text x="0" y="14" font-size="${fs}" fill="#102742" opacity="0.7">Median close</text>
    <text x="${left - 10}" y="${(y(max) + 4).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="#102742" opacity="0.7">${chartUsd(max)}</text>
    <text x="${left - 10}" y="${(y(min) + 4).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="#102742" opacity="0.7">${chartUsd(min)}</text>
    <path d="${area}" fill="#102742" fill-opacity="0.08"/>
    <path d="${path}" fill="none" stroke="#102742" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    <line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#102742" stroke-opacity="0.25" stroke-width="1"/>
    ${dots}
  </svg>
  <p class="small">Median close by month. Range ${chartUsd(min)} to ${chartUsd(max)}.</p>`
}

export function medianCloseLinePhoneSvg(points: TrendPoint[]): string {
  return medianCloseLineSvg(points, { width: 360 })
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
  steps: Array<{ t: number; ask: number; date: string }>
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
    .map((s) => ({ t: timelineDay(s.date) ?? t0, ask: s.ask, date: s.date }))
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
      const w = label.length * fs * 0.58
      // The first ask labels above its own run, from the left. A cut labels to
      // the RIGHT of its drop: centred, the label would sit inside the vertical
      // segment it belongs to and read as struck through. It flips back to the
      // left when the drop lands too near the right edge.
      const flip = i > 0 && cx + 8 + w > W - 2
      const lx = i === 0 ? cx : flip ? cx - 8 : cx + 8
      const anchor: 'start' | 'end' = i === 0 || !flip ? 'start' : 'end'
      // Delta 2: "Tap or hover a cut: the date and the ask." The reading is
      // composed here, from the same two recorded figures the mark is drawn
      // from; the script prints it and derives nothing.
      const read = `${i === 0 ? 'Asked' : 'Cut to'} ${label} on ${monthDay(s.date)}`
      return `<g class="tl-mark" data-read="${esc(read)}" tabindex="0" role="button" aria-label="${esc(read)}">
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="10" fill="transparent"/>
    <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.5" fill="${TL_INK}"/>
    <text x="${lx.toFixed(1)}" y="${(cy - 9).toFixed(1)}" text-anchor="${anchor}" font-size="${fs}" font-weight="600" fill="${TL_INK}">${esc(label)}</text>
    </g>`
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

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(input.caption)}" class="trend-svg tl-figure" data-draw="1">
    <rect x="${plotL}" y="${zoneTop.toFixed(1)}" width="${(plotR - plotL).toFixed(1)}" height="${Math.max(zoneBottom - zoneTop, 2).toFixed(1)}" fill="${TL_INK}" fill-opacity="0.11"/>
    <line x1="${plotL}" y1="${zoneTop.toFixed(1)}" x2="${plotR}" y2="${zoneTop.toFixed(1)}" stroke="${TL_INK}" stroke-opacity="0.34" stroke-width="1"/>
    <line x1="${plotL}" y1="${zoneBottom.toFixed(1)}" x2="${plotR}" y2="${zoneBottom.toFixed(1)}" stroke="${TL_INK}" stroke-opacity="0.34" stroke-width="1"/>
    <text x="${plotL}" y="${zoneLabelY.toFixed(1)}" font-size="${fs}" fill="${TL_MUTED}">${esc(input.rangeLabel)}</text>
    <text x="${plotL - 8}" y="${(zoneTop + 4).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="${TL_MUTED}">${esc(chartUsd(g.high))}</text>
    <text x="${plotL - 8}" y="${(zoneBottom + 4).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="${TL_MUTED}">${esc(chartUsd(g.low))}</text>
    <line x1="${plotL}" y1="${bottom.toFixed(1)}" x2="${plotR}" y2="${bottom.toFixed(1)}" stroke="${TL_EDGE}" stroke-width="0.75"/>
    <path d="${path}" class="tl-ask" fill="none" stroke="${TL_INK}" stroke-width="2.5" stroke-linejoin="miter" stroke-linecap="butt"/>
    ${marks}
    <circle cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="3.5" fill="none" stroke="${TL_INK}" stroke-width="1.6"/>
    <text x="${endFit.x}" y="${endLabelY.toFixed(1)}" text-anchor="${endFit.anchor}" font-size="${endFs}" font-weight="600" fill="${TL_INK}">${esc(endText)}</text>
    <text x="${plotL}" y="${(bottom + 16).toFixed(1)}" font-size="${fs}" fill="${TL_MUTED}">${esc(startDay)}</text>
    ${endDay ? `<text x="${plotR}" y="${(bottom + 16).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="${TL_MUTED}">${esc(endDay)}</text>` : ''}
  </svg>`
}

// ── Chapter 2: priced right sells, priced high sits ─────────────────────────
// docs/plans/CMA_REIMAGINED_2026-09-07.md chapter 2. Two graphics from local
// data, each with one sentence. Both read their figures off `render_args.market`
// exactly as stored; nothing here computes a statistic.

/** `render_args.market.offerTiming`. Computed at BUILD through the DAL. */
export type OfferTiming = {
  city: string
  windowMonths: number
  n: number
  points: Array<{ days: number; pct: number }>
  medianDays: number | null
}

/** `render_args.market.askOutcome`. Computed at BUILD through the DAL. */
export type AskOutcomeGroup = {
  key: 'sold-no-cut' | 'sold-after-cut' | 'did-not-sell'
  n: number
  medianDays: number
  medianCutPct?: number | null
  /**
   * Median close as a share of the ORIGINAL ask, for the sold groups. Null on
   * the group that never sold — there is no close to divide.
   */
  medianSoldToOriginalAskPct?: number | null
  /** How many rows that share was measured over. Printed beside it. */
  soldToOriginalAskN?: number | null
}
export type AskOutcome = {
  city: string
  windowMonths: number
  groups: AskOutcomeGroup[]
}

/**
 * When homes like yours get their offer.
 *
 * A cumulative curve: the share of closed sales in this city that had an
 * accepted offer by day 7, 14, 30, 60, 90, 180. The seller's own days are a
 * full-navy rule on the same axis, far past the curve's shoulder, which is the
 * whole reading.
 *
 * Direct labels only where the story is (the median, the endpoint, their own
 * mark). A percent on every point is unread chaos.
 */
export function offerTimingCurveSvg(
  timing: OfferTiming,
  subjectDays: number | null,
  opts?: { width?: number; height?: number },
): string {
  const points = [...timing.points]
    .filter((p) => Number.isFinite(p.days) && p.days > 0 && Number.isFinite(p.pct) && p.pct >= 0)
    .sort((a, b) => a.days - b.days)
  if (points.length < 3) return ''
  const W = opts?.width ?? 720
  const H = opts?.height ?? 240
  const phone = W <= 400
  const fs = phone ? 10.5 : 12
  const plotL = phone ? 34 : 46
  const plotR = W - (phone ? 8 : 14)
  const top = 30
  const bottom = H - 34
  const maxDay = Math.max(points[points.length - 1]!.days, subjectDays ?? 0)
  const x = (d: number) => plotL + ((plotR - plotL) * d) / Math.max(maxDay, 1)
  const y = (p: number) => bottom - ((bottom - top) * Math.min(p, 100)) / 100

  const path = [{ days: 0, pct: 0 }, ...points]
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.days).toFixed(1)},${y(p.pct).toFixed(1)}`)
    .join(' ')
  const dots = points
    .map((p) => `<circle cx="${x(p.days).toFixed(1)}" cy="${y(p.pct).toFixed(1)}" r="3" fill="${TL_INK}"/>`)
    .join('')
  // Thin the day axis so two ticks never overlap. Day 7 and day 14 sit ~11
  // units apart on a phone, which prints "714".
  let lastTickX = Number.NEGATIVE_INFINITY
  const ticks = points
    .map((p) => {
      const tx = x(p.days)
      const halfW = String(p.days).length * fs * 0.58
      if (tx - lastTickX < halfW * 2 + 4) return ''
      lastTickX = tx
      // The last tick sits ON the right edge of the plot, so centred it runs
      // half a label past the frame — "180" clipped at 375 on every Bend row.
      // It anchors to the edge instead of hanging over it.
      const overflows = tx + halfW > W - 1
      return `<text x="${(overflows ? W - 1 : tx).toFixed(1)}" y="${(bottom + 15).toFixed(1)}" text-anchor="${
        overflows ? 'end' : 'middle'
      }" font-size="${fs}" fill="${TL_MUTED}">${p.days}</text>`
    })
    .join('')

  // The endpoint label sits to the LEFT of its dot, under the flat tail of the
  // curve. Anywhere above or right of it collides with the seller's own mark,
  // which lands beside the last point whenever they sat past six months.
  const last = points[points.length - 1]!
  // One decimal, because the sentence under the curve states the same figure
  // and 95.6 rounded to 96 makes the two disagree on the page.
  const endLabel = `${last.pct.toFixed(1)}% by day ${last.days}`
  const endFit = { x: (x(last.days) - 8).toFixed(1), anchor: 'end' as const }

  const median = timing.medianDays
  const medianMark =
    median != null && median > 0 && median <= maxDay
      ? `<line x1="${x(median).toFixed(1)}" y1="${y(50).toFixed(1)}" x2="${x(median).toFixed(1)}" y2="${bottom.toFixed(1)}" stroke="${TL_MUTED}" stroke-width="1" stroke-dasharray="3 3"/>
    <line x1="${plotL}" y1="${y(50).toFixed(1)}" x2="${x(median).toFixed(1)}" y2="${y(50).toFixed(1)}" stroke="${TL_MUTED}" stroke-width="1" stroke-dasharray="3 3"/>`
      : ''

  const yours =
    subjectDays != null && subjectDays > 0
      ? (() => {
          const label = `yours, ${int(subjectDays)} days`
          const fit = fitText(x(subjectDays), label, fs, W)
          return `<line x1="${x(subjectDays).toFixed(1)}" y1="${top - 12}" x2="${x(subjectDays).toFixed(1)}" y2="${bottom.toFixed(1)}" stroke="${TL_INK}" stroke-width="1.75"/>
    <text x="${fit.x}" y="${top - 17}" text-anchor="${fit.anchor}" font-size="${fs}" font-weight="600" fill="${TL_INK}">${esc(label)}</text>`
        })()
      : ''

  // Delta 2: "a slider or a tap on the axis moves a marker along the curve and
  // reads 'by day N, X percent had an offer'." The points and the plot box go
  // on the element; the script interpolates BETWEEN measured points and says
  // so, and derives no figure of its own.
  const scrubData = ` data-points="${esc(
    JSON.stringify(points.map((pt) => [pt.days, Number(pt.pct.toFixed(2))])),
  )}" data-plot="${esc(JSON.stringify([plotL, plotR, top, bottom, maxDay]))}"`
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Share of sales with an accepted offer, by day" class="trend-svg curve-scrub"${scrubData}>
    <text x="${plotL - 6}" y="${(y(100) + 4).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="${TL_MUTED}">100%</text>
    <text x="${plotL - 6}" y="${(y(50) + 4).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="${TL_MUTED}">50%</text>
    <line x1="${plotL}" y1="${y(100).toFixed(1)}" x2="${plotR}" y2="${y(100).toFixed(1)}" stroke="${TL_EDGE}" stroke-width="0.75"/>
    ${medianMark}
    ${yours}
    <line x1="${plotL}" y1="${bottom.toFixed(1)}" x2="${plotR}" y2="${bottom.toFixed(1)}" stroke="${TL_EDGE}" stroke-width="0.75"/>
    <path d="${path}" fill="none" stroke="${TL_INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}
    <text x="${endFit.x}" y="${(y(last.pct) + 18).toFixed(1)}" text-anchor="${endFit.anchor}" font-size="${fs}" font-weight="600" fill="${TL_INK}">${esc(endLabel)}</text>
    ${ticks}
    <text x="${plotR}" y="${(H - 6).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="${TL_MUTED}">days to an accepted offer</text>
    <g class="scrub" aria-hidden="true" opacity="0">
      <line class="scrub-line" x1="0" y1="${top}" x2="0" y2="${bottom.toFixed(1)}" stroke="${TL_INK}" stroke-width="1" stroke-dasharray="2 3"/>
      <circle class="scrub-dot" cx="0" cy="0" r="4.5" fill="${TL_INK}"/>
    </g>
    <rect class="scrub-hit" x="${plotL}" y="${top}" width="${(plotR - plotL).toFixed(1)}" height="${(bottom - top).toFixed(1)}" fill="transparent"/>
  </svg>`
}

export function offerTimingCurvePhoneSvg(timing: OfferTiming, subjectDays: number | null): string {
  return offerTimingCurveSvg(timing, subjectDays, { width: 360, height: 214 })
}

const ASK_OUTCOME_LABEL: Record<AskOutcomeGroup['key'], string> = {
  'sold-no-cut': 'Sold without a price cut',
  'sold-after-cut': 'Sold after a price cut',
  'did-not-sell': 'Came off unsold',
}

/**
 * The first price decides the days.
 *
 * Three named rows on one days axis, the seller's own group in full navy and
 * marked. The count rides under the name rather than on the bar, so no bar
 * carries two numbers.
 */
export function askOutcomeBarsSvg(
  outcome: AskOutcome,
  subjectGroup: AskOutcomeGroup['key'] | null,
  opts?: { width?: number },
): string {
  const groups = outcome.groups.filter((g) => Number.isFinite(g.medianDays) && g.medianDays > 0)
  if (groups.length < 2) return ''
  const W = opts?.width ?? 720
  const phone = W <= 400
  const fs = phone ? 11 : 12.5
  const subFs = phone ? 10 : 11
  // A group that realized a share of its first ask carries a THIRD line under
  // its name, so every row grows rather than one row overlapping the next.
  const hasShare = groups.some(
    (g) => g.medianSoldToOriginalAskPct != null && g.medianSoldToOriginalAskPct > 0,
  )
  const rowH = hasShare ? (phone ? 70 : 66) : phone ? 56 : 52
  const top = 8
  const H = top + groups.length * rowH + 10
  // The gutter holds the longest label the rows carry, not a fixed 190: the
  // realized-share line ("sold at 94.3% of the first ask, 302 sales") is
  // right-anchored in it, and a fixed gutter pushed it off the left edge.
  const gutter = phone ? 8 : 250
  const plotL = phone ? 8 : gutter
  const longest = Math.max(...groups.map((g) => `${int(g.medianDays)} days`.length))
  const plotR = W - Math.min(Math.max(longest * fs * 0.62 + 14, 60), 150)
  const max = Math.max(...groups.map((g) => g.medianDays))
  const x = (v: number) => plotL + ((plotR - plotL) * v) / Math.max(max, 1)

  const rows = groups
    .map((g, i) => {
      const mine = g.key === subjectGroup
      const name = `${ASK_OUTCOME_LABEL[g.key]}${mine ? ' · your home' : ''}`
      const count = [
        `${int(g.n)} ${g.n === 1 ? 'listing' : 'listings'}`,
        g.medianCutPct != null && g.medianCutPct > 0 ? `median cut ${g.medianCutPct.toFixed(1)}%` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      // What each sold group actually realized against the price it FIRST
      // asked (research item 4), with the count it was measured over. It sits
      // under the group's name, never on the bar: the bar's axis is days, and
      // a second unit on it is a dual axis by another route.
      const share =
        g.medianSoldToOriginalAskPct != null && g.medianSoldToOriginalAskPct > 0
          ? `sold at ${g.medianSoldToOriginalAskPct.toFixed(1)}% of the first ask${
              g.soldToOriginalAskN != null && g.soldToOriginalAskN > 0
                ? `, ${int(g.soldToOriginalAskN)} ${g.soldToOriginalAskN === 1 ? 'sale' : 'sales'}`
                : ''
            }`
          : ''
      // Delta 2: "tap a bar to see its n, median days, median cut, median share
      // of ask." Every figure in the reading is already drawn on the row; the
      // group carries it as one sentence so a tap on a phone, where the row's
      // sub-lines are 9px, states it in reading type under the chart.
      // The measure is NOT the same for all three groups, and calling it one
      // thing made the document assert something impossible: "came off unsold
      // · your home · 118 days to an accepted offer" was the accessible name
      // of a bar about listings that never got one (CLAUDE.md §0).
      const read = [
        name,
        askOutcomeDaysPhrase(g),
        count,
        share,
      ]
        .filter(Boolean)
        .join(' · ')
      const stroke = mine ? TL_INK : TL_MUTED
      const weight = mine ? 9 : 6
      const bold = mine ? ' font-weight="600"' : ''
      const open = `<g class="bar-row" data-bar="${esc(g.key)}" data-read="${esc(read)}" tabindex="0" role="button" aria-label="${esc(read)}"><rect x="0" y="${(top + i * rowH).toFixed(1)}" width="${W}" height="${rowH}" fill="transparent"/>`
      if (phone) {
        const nameY = top + i * rowH + 12
        const countY = nameY + 14
        const shareY = countY + 13
        const barY = (share ? shareY : countY) + 14
        return `${open}<text x="${plotL}" y="${nameY}"${bold} font-size="${fs}" fill="${TL_INK}">${esc(name)}</text>
    <text x="${plotL}" y="${countY}" font-size="${subFs}" fill="${TL_MUTED}">${esc(count)}</text>
    ${share ? `<text x="${plotL}" y="${shareY}" font-size="${subFs}" fill="${TL_MUTED}">${esc(share)}</text>` : ''}
    <line x1="${plotL}" y1="${barY}" x2="${Math.max(x(g.medianDays), plotL + 1).toFixed(1)}" y2="${barY}" stroke="${stroke}" stroke-width="${weight}" stroke-linecap="butt"/>
    <text x="${W - 6}" y="${barY + 4}" text-anchor="end"${bold} font-size="${fs}" fill="${TL_INK}">${int(g.medianDays)} days</text></g>`
      }
      const mid = top + i * rowH + rowH / 2
      return `${open}<text x="${gutter - 14}" y="${(mid - (share ? 10 : 3)).toFixed(1)}" text-anchor="end"${bold} font-size="${fs}" fill="${TL_INK}">${esc(name)}</text>
    <text x="${gutter - 14}" y="${(mid + (share ? 6 : 13)).toFixed(1)}" text-anchor="end" font-size="${subFs}" fill="${TL_MUTED}">${esc(count)}</text>
    ${share ? `<text x="${gutter - 14}" y="${(mid + 20).toFixed(1)}" text-anchor="end" font-size="${subFs}" fill="${TL_MUTED}">${esc(share)}</text>` : ''}
    <line x1="${plotL}" y1="${mid.toFixed(1)}" x2="${Math.max(x(g.medianDays), plotL + 1).toFixed(1)}" y2="${mid.toFixed(1)}" stroke="${stroke}" stroke-width="${weight}" stroke-linecap="butt"/>
    <text x="${(Math.max(x(g.medianDays), plotL + 1) + 10).toFixed(1)}" y="${(mid + 4).toFixed(1)}"${bold} font-size="${fs}" fill="${TL_INK}">${int(g.medianDays)} days</text></g>`
    })
    .join('\n    ')

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Median days on the market, by what the first price did" class="trend-svg">
    ${phone ? '' : `<line x1="${plotL}" y1="${top}" x2="${plotL}" y2="${(H - 10).toFixed(1)}" stroke="${TL_EDGE}" stroke-width="0.75"/>`}
    ${rows}
  </svg>`
}

/**
 * What a bar's days figure MEANS for its own group. Two of these groups sold
 * and one never did, so only two of them can be counting days to an offer.
 */
export function askOutcomeDaysPhrase(g: AskOutcomeGroup): string {
  const n = int(g.medianDays)
  const unit = g.medianDays === 1 ? 'day' : 'days'
  return g.key === 'did-not-sell'
    ? `median ${n} ${unit} on market before it came off`
    : `median ${n} ${unit} to an accepted offer`
}

export function askOutcomeBarsPhoneSvg(
  outcome: AskOutcome,
  subjectGroup: AskOutcomeGroup['key'] | null,
): string {
  return askOutcomeBarsSvg(outcome, subjectGroup, { width: 360 })
}
