/**
 * One listing's asking price over time, drawn as a stepped line.
 *
 * docs/plans/CMA_REIMAGINED_2026-09-07.md, Delta 1: "Pricing history is a
 * primitive. ONE renderer, used for the subject, every sold sale, every unsold
 * peer, and every competitor." The professional-practice brief (§3) found that
 * no product in the category draws this — Redfin, Zillow, RPR, Cloud CMA,
 * Altos and HouseCanary all present a single listing's history as a table of
 * dated rows. It is the differentiator, not catch-up.
 *
 * WHAT IT MAY DRAW, AND WHAT IT MAY NOT.
 *
 * The line is built from what `render_args` actually carries for that listing,
 * and the four sources carry different amounts:
 *
 *   the seller's own listing  `expiredAudit.finalCycle` — the opening ask, every
 *                             DATED cut, the day it came off. The full story.
 *   a competitor / an unsold  `originalListPrice` + `listPrice` + `onMarketDate`
 *   peer                      — both asks and the day it went on, but no date
 *                             for the change between them.
 *   a closed sale             `listPrice` + `closePrice` + `closeDate` +
 *                             `domTotal` — the ask it was under when it went
 *                             under contract, and what it closed at.
 *
 * Where a change to the ask is recorded with no date, the line does NOT invent
 * one: it runs flat at the opening ask and drops to the later ask as a DASHED
 * segment at the end of the period, which is the drawing convention for "this
 * happened, the record does not say when". §0 — a date from convention is a
 * fabrication (CLAUDE.md §0, the invented-timelines rule), and the same rule is
 * why `buildFinalCycle` carries `cutsDated` at all.
 *
 * Reading rules (.claude/skills/dataviz/SKILL.md): navy on cream, thin marks,
 * direct labels only where the story is. The opening ask and the outcome always
 * carry a number; the cuts in between carry one only while there are few enough
 * that two labels cannot collide. Print cannot hover, so no value the reader
 * needs is hidden behind an interaction.
 */

import { escapeHtml, int } from '@/lib/cma/render-blocks'

const esc = escapeHtml

const INK = '#102742'
const MUTED = 'rgba(16,39,66,0.55)'
const EDGE = 'rgba(16,39,66,0.22)'

/** One dated change to the ask. `price` is the ask AFTER the change. */
export type PricePathCut = { date: string; price: number }

export type PricePathOutcome = 'sold' | 'off-market' | 'for-sale' | 'under-contract'

/**
 * One listing's price path, in the shape every builder below produces and the
 * one drawing consumes. Nothing here is computed from a statistic; every field
 * is a recorded figure off `render_args`.
 */
export type PricePath = {
  /** YYYY-MM-DD the period opened. */
  startDate: string
  /** The ask it opened at. */
  startPrice: number
  /** Every DATED change to the ask, oldest first. */
  cuts: PricePathCut[]
  /**
   * A change to the ask that the record holds with no date — drawn dashed at
   * the end of the period rather than placed on a day nobody recorded.
   */
  undatedCutTo: number | null
  /** YYYY-MM-DD it closed, came off, or (for a live listing) today. */
  endDate: string
  /** What it closed at. Null unless it sold. */
  closePrice: number | null
  outcome: PricePathOutcome
  /** Days the period ran, as the row records them. */
  days: number | null
  /** Read aloud, and the chart's own title. */
  label: string
}

const OUTCOME_WORD: Record<PricePathOutcome, string> = {
  sold: 'sold',
  'off-market': 'came off',
  'for-sale': 'for sale',
  'under-contract': 'under contract',
}

function day(value: string | null | undefined): string | null {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const d = raw.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

function utc(d: string): number {
  return Date.parse(`${d}T00:00:00.000Z`)
}

function price(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

function plusDays(d: string, days: number): string {
  return new Date(utc(d) + days * 86_400_000).toISOString().slice(0, 10)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

/** $465K. Thousands, because a price path is read at a glance, not audited. */
function shortUsd(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `$${m >= 10 || n % 1_000_000 === 0 ? m.toFixed(0) : m.toFixed(2)}M`
  }
  return `$${Math.round(n / 1000)}K`
}

function monthDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// ── builders, one per shape `render_args` carries ───────────────────────────

/**
 * The seller's own failed listing, from the build contract. The only source
 * that carries DATED cuts, which is why it is the only line that can step in
 * the middle.
 */
export function pricePathFromFinalCycle(cycle: {
  listDate: string | null
  initialAsk: number | null
  cuts: ReadonlyArray<{ date: string | null; ask: number }>
  cutsDated: boolean
  finalAsk: number | null
  offMarketDate: string | null
  status: string | null
  days: number | null
} | null | undefined, label: string): PricePath | null {
  if (!cycle) return null
  const startDate = day(cycle.listDate)
  const startPrice = price(cycle.initialAsk) ?? price(cycle.finalAsk)
  if (!startDate || startPrice == null) return null
  const cuts: PricePathCut[] = cycle.cutsDated
    ? cycle.cuts
        .map((c) => ({ date: day(c.date), price: price(c.ask) }))
        .filter((c): c is PricePathCut => c.date != null && c.price != null)
    : []
  const finalAsk = price(cycle.finalAsk)
  const undatedCutTo =
    !cycle.cutsDated && finalAsk != null && finalAsk !== startPrice ? finalAsk : null
  const endDate =
    day(cycle.offMarketDate) ??
    (cycle.days != null && cycle.days >= 0 ? plusDays(startDate, cycle.days) : today())
  return {
    startDate,
    startPrice,
    cuts,
    undatedCutTo,
    endDate,
    closePrice: null,
    outcome: 'off-market',
    days: cycle.days,
    label,
  }
}

/**
 * A closed sale, as `render_args.comps` carries it.
 *
 * The row holds the ask it was under when it went under contract and what it
 * closed at, not the ask it opened on — the build writes `listPrice`, and no
 * original ask or price event reaches the renderer for a comparable sale. So
 * the line runs flat at that ask and lands on the close, and the chapter says
 * so rather than implying the ask never moved.
 *
 * The start of the period is the close date less the days it ran, which is
 * arithmetic on two recorded figures, the same derivation `offMarketFromDays`
 * already makes for the subject.
 */
export function pricePathFromSale(sale: {
  address: string
  listPrice?: number | null
  closePrice?: number | null
  closeDate?: string | null
  domTotal?: number | null
  daysToOffer?: number | null
}): PricePath | null {
  const closeDate = day(sale.closeDate)
  const closePrice = price(sale.closePrice)
  const ask = price(sale.listPrice) ?? closePrice
  if (!closeDate || closePrice == null || ask == null) return null
  const ran = sale.domTotal != null && sale.domTotal > 0 ? Math.round(sale.domTotal) : null
  const startDate = plusDays(closeDate, -(ran ?? 30))
  return {
    startDate,
    startPrice: ask,
    cuts: [],
    undatedCutTo: null,
    endDate: closeDate,
    closePrice,
    outcome: 'sold',
    days: sale.daysToOffer ?? ran,
    label: sale.address,
  }
}

/**
 * A listing still on the market, or one that came off without selling — a
 * competitor or an unsold peer. Both asks are on the row; the day the ask
 * changed is not, so the drop is dashed.
 */
export function pricePathFromListing(listing: {
  address: string
  listPrice?: number | null
  originalListPrice?: number | null
  onMarketDate?: string | null
  daysOnMarket?: number | null
  status?: string | null
}): PricePath | null {
  const startDate = day(listing.onMarketDate)
  const ask = price(listing.listPrice)
  if (!startDate || ask == null) return null
  const original = price(listing.originalListPrice) ?? ask
  const status = (listing.status ?? '').trim().toLowerCase()
  const outcome: PricePathOutcome = /^pending|contingent|under/.test(status)
    ? 'under-contract'
    : /^(expired|withdrawn|cancell?ed)/.test(status)
      ? 'off-market'
      : 'for-sale'
  const days = listing.daysOnMarket != null && listing.daysOnMarket >= 0 ? Math.round(listing.daysOnMarket) : null
  const endDate = days != null ? plusDays(startDate, days) : today()
  return {
    startDate,
    startPrice: original,
    cuts: [],
    undatedCutTo: original !== ask ? ask : null,
    endDate,
    closePrice: null,
    outcome,
    days,
    label: listing.address,
  }
}

/** The final ask the path ends on, whatever route it took to get there. */
export function finalAskOf(path: PricePath): number {
  if (path.undatedCutTo != null) return path.undatedCutTo
  return path.cuts.length > 0 ? path.cuts[path.cuts.length - 1]!.price : path.startPrice
}

/** How many times the ask came down over the period, as the record holds it. */
export function cutCountOf(path: PricePath): number {
  return path.cuts.filter((c, i) => c.price < (i === 0 ? path.startPrice : path.cuts[i - 1]!.price)).length +
    (path.undatedCutTo != null && path.undatedCutTo < path.startPrice ? 1 : 0)
}

// ── the drawing ─────────────────────────────────────────────────────────────

type Geometry = {
  t0: number
  t1: number
  lo: number
  hi: number
  /** Every vertex of the ask line, in order, as [time, price]. */
  steps: Array<{ t: number; price: number }>
}

function geometry(path: PricePath): Geometry | null {
  const t0 = utc(path.startDate)
  const t1raw = utc(path.endDate)
  if (!Number.isFinite(t0) || !Number.isFinite(t1raw)) return null
  const t1 = Math.max(t1raw, t0 + 86_400_000)
  const steps = [
    { t: t0, price: path.startPrice },
    ...path.cuts
      .map((c) => ({ t: utc(c.date), price: c.price }))
      .filter((s) => Number.isFinite(s.t) && s.t >= t0 && s.t <= t1)
      .sort((a, b) => a.t - b.t),
  ]
  const values = [
    ...steps.map((s) => s.price),
    ...(path.undatedCutTo != null ? [path.undatedCutTo] : []),
    ...(path.closePrice != null ? [path.closePrice] : []),
  ]
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.3, Math.max(max * 0.012, 1))
  return { t0, t1, lo: min - pad, hi: max + pad, steps }
}

export type PricePathLayout = { width: number; height: number; fontSize: number }

/** Reading width and paper. Wide enough for two labels and a status word. */
export const PRICE_PATH_WIDE: PricePathLayout = { width: 560, height: 96, fontSize: 11.5 }
/** A phone card. Drawn to fit — never the wide one inside a pan box. */
export const PRICE_PATH_PHONE: PricePathLayout = { width: 320, height: 92, fontSize: 10.5 }

/**
 * The whole primitive. One listing, one line, both layouts from one geometry
 * so the phone drawing and the wide drawing can never disagree about where the
 * ask sat.
 *
 * `id` stamps the cut marks so the interactive layer can name a cut on tap
 * without re-deriving anything the drawing already knows.
 */
export function priceHistoryLineSvg(
  path: PricePath,
  layout: PricePathLayout = PRICE_PATH_WIDE,
  id?: string,
): string {
  const g = geometry(path)
  if (!g) return ''
  const { width: W, height: H, fontSize: fs } = layout
  const top = 20
  const bottom = H - 20
  const left = 2
  // The end label ("sold $457K · 25 days") owns the right margin.
  const endText = priceHistoryEndLabel(path)
  const right = W - Math.min(Math.max(endText.length * fs * 0.56 + 10, 60), W * 0.44)
  const x = (t: number) => left + ((right - left) * (t - g.t0)) / Math.max(g.t1 - g.t0, 1)
  const y = (v: number) => bottom - ((bottom - top) * (v - g.lo)) / Math.max(g.hi - g.lo, 1)

  // The stepped ask: horizontal at each ask, vertical at each dated cut.
  const parts: string[] = []
  for (let i = 0; i < g.steps.length; i++) {
    const s = g.steps[i]!
    const nextT = i + 1 < g.steps.length ? g.steps[i + 1]!.t : g.t1
    parts.push(`${i === 0 ? 'M' : 'L'}${x(s.t).toFixed(1)},${y(s.price).toFixed(1)}`)
    parts.push(`L${x(nextT).toFixed(1)},${y(s.price).toFixed(1)}`)
  }
  const askPath = parts.join(' ')
  const lastAsk = g.steps[g.steps.length - 1]!.price

  // Dated cuts get a mark. A label only while two of them cannot collide —
  // the opening ask and the outcome always carry theirs. A cut that ended the
  // period carries no label of its own either: the end mark right beside it is
  // already printing that same figure, and two of one number three units apart
  // reads as a collision.
  const endValueForLabels = path.closePrice ?? finalAskOf(path)
  const labelCuts = path.cuts.length <= 2
  const cutMarks = path.cuts
    .map((c, i) => {
      const cx = x(utc(c.date))
      const cy = y(c.price)
      const attrs = `class="pp-cut" data-price="${c.price}" data-date="${esc(c.date)}"${
        id ? ` data-path="${esc(id)}"` : ''
      } tabindex="0" role="button" aria-label="${esc(`cut to ${shortUsd(c.price)} on ${monthDay(c.date)}`)}"`
      const label =
        labelCuts && c.price !== endValueForLabels
          ? `<text x="${(cx + 5).toFixed(1)}" y="${(cy + 13).toFixed(1)}" font-size="${fs}" fill="${MUTED}">${esc(shortUsd(c.price))}</text>`
          : ''
      return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="3.2" fill="${INK}" ${attrs}/>${label}`
    })
    .join('')

  // A change the record holds with no date. Dashed, at the end of the period,
  // never placed on a day nobody wrote down.
  const undated =
    path.undatedCutTo != null
      ? `<line x1="${x(g.t1).toFixed(1)}" y1="${y(lastAsk).toFixed(1)}" x2="${x(g.t1).toFixed(1)}" y2="${y(path.undatedCutTo).toFixed(1)}" stroke="${INK}" stroke-width="2" stroke-dasharray="3 3"/>`
      : ''

  const endValue = path.closePrice ?? path.undatedCutTo ?? lastAsk
  const endY = y(endValue)
  const endX = x(g.t1)
  // A close is a real dated event, so the drop to it is solid.
  const closeDrop =
    path.closePrice != null && path.closePrice !== lastAsk
      ? `<line x1="${endX.toFixed(1)}" y1="${y(lastAsk).toFixed(1)}" x2="${endX.toFixed(1)}" y2="${endY.toFixed(1)}" stroke="${INK}" stroke-width="2"/>`
      : ''

  const openLabel = shortUsd(path.startPrice)
  const startY = y(path.startPrice)
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" class="price-path" aria-label="${esc(
    priceHistoryReading(path),
  )}"${id ? ` data-path="${esc(id)}"` : ''}>
  <line x1="${left}" y1="${(bottom + 6).toFixed(1)}" x2="${right.toFixed(1)}" y2="${(bottom + 6).toFixed(1)}" stroke="${EDGE}" stroke-width="0.75"/>
  <path d="${askPath}" fill="none" stroke="${INK}" stroke-width="2" stroke-linejoin="miter" stroke-linecap="butt"/>
  ${undated}
  ${closeDrop}
  ${cutMarks}
  <circle cx="${left + 1}" cy="${startY.toFixed(1)}" r="3.2" fill="${INK}"/>
  <text x="${left}" y="${(startY - 8).toFixed(1)}" font-size="${fs}" font-weight="600" fill="${INK}">${esc(openLabel)}</text>
  <circle cx="${endX.toFixed(1)}" cy="${endY.toFixed(1)}" r="3.2" fill="none" stroke="${INK}" stroke-width="1.6"/>
  <text x="${(endX + 8).toFixed(1)}" y="${(endY + 4).toFixed(1)}" font-size="${fs}" font-weight="600" fill="${INK}">${esc(endText)}</text>
  <text x="${left}" y="${(H - 3).toFixed(1)}" font-size="${fs}" fill="${MUTED}">${esc(monthDay(path.startDate))}</text>
  <text x="${right.toFixed(1)}" y="${(H - 3).toFixed(1)}" text-anchor="end" font-size="${fs}" fill="${MUTED}">${esc(monthDay(path.endDate))}</text>
</svg>`
}

export function priceHistoryLinePhoneSvg(path: PricePath, id?: string): string {
  return priceHistoryLineSvg(path, PRICE_PATH_PHONE, id)
}

/** "sold $457K · 25 days" — the mark at the end of the line names itself. */
export function priceHistoryEndLabel(path: PricePath): string {
  const value = path.closePrice ?? finalAskOf(path)
  const word = OUTCOME_WORD[path.outcome]
  const days =
    path.days != null && path.days > 0 ? ` · ${int(path.days)} ${path.days === 1 ? 'day' : 'days'}` : ''
  return `${word} ${shortUsd(value)}${days}`
}

/**
 * The line in words, for a screen reader and for anything that has to state
 * the path in prose. Every figure in it is drawn above it.
 */
export function priceHistoryReading(path: PricePath): string {
  const bits: string[] = [`${path.label}: asked ${shortUsd(path.startPrice)} on ${monthDay(path.startDate)}`]
  for (const c of path.cuts) bits.push(`cut to ${shortUsd(c.price)} on ${monthDay(c.date)}`)
  if (path.undatedCutTo != null) bits.push(`later asked ${shortUsd(path.undatedCutTo)}, date not recorded`)
  const value = path.closePrice ?? finalAskOf(path)
  const end =
    path.outcome === 'sold'
      ? `sold ${shortUsd(value)} on ${monthDay(path.endDate)}`
      : path.outcome === 'off-market'
        ? `came off ${monthDay(path.endDate)}`
        : path.outcome === 'under-contract'
          ? 'now under contract'
          : 'still for sale'
  bits.push(end)
  if (path.days != null && path.days > 0) {
    bits.push(`${int(path.days)} ${path.days === 1 ? 'day' : 'days'}`)
  }
  return `${bits.join(', ')}.`
}

/**
 * Both layouts of one path, wrapped so exactly one is ever visible — the wide
 * drawing on paper and at reading width, the fitted one below 700px. Nothing
 * on this document sits in a pan box on a phone (blueprint § The register).
 */
export function priceHistoryLineHtml(path: PricePath | null, id?: string): string {
  if (!path) return ''
  const wide = priceHistoryLineSvg(path, PRICE_PATH_WIDE, id)
  if (!wide) return ''
  const phone = priceHistoryLinePhoneSvg(path, id)
  return `<div class="pp-wrap"><div class="pp pp-wide">${wide}</div><div class="pp pp-phone">${phone}</div></div>`
}
