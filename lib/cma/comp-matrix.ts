/**
 * THE THREE MATRICES (docs/plans/CMA_REIMAGINED_2026-09-07.md, Delta 3).
 *
 * One column set, the subject column first in each, in this order: the closed
 * sales that set the price, the listings in the same area that came off
 * unsold, and the homes asking in this range now. Each property is a COLUMN
 * and each fact a ROW, so a reader reads down one house and across one fact;
 * on a phone the same fields become one card per home, in the same order.
 *
 * Every address is a tracked link into ryan-realty.com. A row identical across
 * the whole table folds into one sentence above it. The adjustment grid — the
 * itemised Form 1004 lines — stays under matrix 1 only, as its own table,
 * because it is the working behind ONE of the three sets and printing it over
 * the other two would claim adjustments nobody made.
 *
 * The table is CHUNKED. At most MAX_COMPS_PER_TABLE homes per table, spread
 * evenly, with your home repeated at the head of each. A single table holding
 * every home is what broke the page contract: at twelve sales it was thirteen
 * columns wide, ran past the right margin, and `overflow-x: auto` then CLIPPED
 * the tail — sales 4 through 12 were absent from the delivered PDF with no
 * error and no visible truncation. Chunking keeps every table inside the
 * content box at any count, and the colgroup makes that width deterministic
 * rather than a function of how long an address happens to be.
 */

import {
  cleanText,
  dec,
  escapeHtml,
  int,
  sparkPhotoAt,
  usd,
  usdSigned,
} from '@/lib/cma/render-blocks'
import {
  priceHistoryLineHtml,
  priceHistorySparkHtml,
  shortUsd,
  type PricePathRange,
} from '@/lib/cma/price-path'
import type { TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import { daysOnMarketFrom } from '@/lib/cma/listing-history-line'
import { closedEntries, remodelCell, subjectEntry, type MatrixEntry } from '@/lib/cma/matrix-entry'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'
import type { ExpiredFinalCycle } from '@/lib/cma/expired-audit'
import { PRICING_MIN_COMPS } from '@/lib/pricing/ladder'

const esc = escapeHtml

/**
 * The floor is the PRICING unit's floor, not the selector's target.
 *
 * It used to be MIN_COMPS (5), the selector's target set size, while
 * lib/pricing publishes a recommend from PRICING_MIN_COMPS (3). Every CMA
 * built on three or four sales therefore shipped a recommended list with no
 * comparable sales visible anywhere in the document — caught on
 * cma-19968 and cma-1617-nw-8th, 2026-09-07, both of which printed a price
 * chapter containing a map and nothing else.
 *
 * If the pricing unit trusted the set enough to publish a number, the seller
 * sees that set. A thin matrix is honest; an invisible one is not.
 */
export const MIN_CLOSED_SALES_FOR_MATRIX = PRICING_MIN_COMPS

/** Prefer DOM baked into listing history so the DOM row and history agree. */
function domFromHistoryLine(line: string | null | undefined): number | null {
  const m = line?.match(/(\d+)\s+days?\s+on\s+market/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 0 ? n : null
}

/**
 * Days the subject's own listing sat. Exported so the days chart and the
 * matrix's Days on market row can never print two different numbers.
 *
 * Elapsed time since the last list date is only "days on market" while the
 * listing is live or has just come off. On a CLOSED listing it is the age of a
 * sale: 19968 Terrace last listed in November 2004 and sold, and the document
 * printed 7,969 days on market, then a chart captioned "Yours sat 7,969 days
 * and never got one" (2026-09-07). Both were false. When the history line
 * carries a real DOM it wins; otherwise the elapsed figure is derived only for
 * a listing that is on market or recently off it.
 */
const DOM_ELAPSED_CEILING_DAYS = 1095
const ON_MARKET = /^(active|pending|coming)/i
const CAME_OFF_UNSOLD = /^(expired|withdrawn|cancell?ed)/i

export function subjectDomDays(subject: CmaSubject): number | null {
  const stated = domFromHistoryLine(subject.listingHistoryLine)
  if (stated != null) return stated
  const status = subject.standardStatus?.trim() ?? ''
  if (!ON_MARKET.test(status) && !CAME_OFF_UNSOLD.test(status)) return null
  const elapsed = daysOnMarketFrom({ onMarketDate: subject.lastListDate })
  if (elapsed == null || elapsed > DOM_ELAPSED_CEILING_DAYS) return null
  return elapsed
}

/** True when the subject's own listing came off without selling. */
export function subjectListingFailed(subject: CmaSubject): boolean {
  return CAME_OFF_UNSOLD.test(subject.standardStatus?.trim() ?? '')
}

/**
 * AN ASK IS ONLY AN ASK WHILE IT IS THIS LISTING'S ASK.
 *
 * Round-four class E, 19968 Terrace: the subject column printed "listed
 * $140,000" from a listing cycle that ended in November 2004, undated, three
 * times, beside a $461,000 recommendation. The DOM fix of 2026-09-07 put a
 * ceiling on the ELAPSED figure and left the price itself ungated, so the
 * document kept stating a twenty-two-year-old number in the present tense.
 *
 * Two gates, and either one alone kills the figure:
 *
 *   1. `expiredAudit.finalCycle` is null — the build looked for a listing
 *      cycle to reason about and did not find one. A price with no cycle
 *      behind it is a record, not an ask.
 *   2. the last list date is more than twelve months old. The gap is not a
 *      rounding matter: a seller reads "listed $140,000" as what their home is
 *      on the market for today.
 *
 * A live listing (Active / Pending / Coming) keeps its ask whatever the audit
 * says: that IS today's price, and the compliance carve-out depends on the
 * document being able to state it.
 */
export const SUBJECT_ASK_MAX_AGE_DAYS = 366

export type SubjectAskContext = {
  /** The document's own date. Defaults to now. */
  asOfIso?: string | null
  /**
   * False when `expiredAudit.finalCycle` is null. Undefined means the caller
   * does not know, and only the date gate applies.
   */
  hasFinalCycle?: boolean | null
}

export function subjectAskIsCurrent(subject: CmaSubject, ctx?: SubjectAskContext): boolean {
  const ask = subject.lastListPrice
  if (ask == null || !(ask > 0)) return false
  if (ON_MARKET.test(subject.standardStatus?.trim() ?? '')) return true
  if (ctx?.hasFinalCycle === false) return false
  const asOfRaw = ctx?.asOfIso?.trim() ? new Date(ctx.asOfIso) : null
  const asOf = asOfRaw && !Number.isNaN(asOfRaw.getTime()) ? asOfRaw : undefined
  const age = daysOnMarketFrom({ onMarketDate: subject.lastListDate, asOf })
  // No date at all is not a pass. An undated price cannot be shown to be this
  // listing's price, and the whole defect was an undated price.
  if (age == null) return false
  return age <= SUBJECT_ASK_MAX_AGE_DAYS
}

/** The ask the subject column may print, or null. */
export function subjectPrintableAsk(
  subject: CmaSubject,
  ctx?: SubjectAskContext,
): number | null {
  return subjectAskIsCurrent(subject, ctx) ? subject.lastListPrice : null
}

/**
 * Most homes one table may hold. Five plus the subject is seven columns;
 * against the 7.3in content box that leaves 13.3% (about 93px) per value
 * column, which holds every value we print without wrapping a figure — checked
 * against eight-figure prices and 22-acre lots, not the fixture's tidy ones.
 */
const MAX_COMPS_PER_TABLE = 5

/** Row-label column share. The rest is split evenly across the value columns. */
const LABEL_COL_PCT = 20

function dash(v: string | null | undefined): string {
  return cleanText(v) ?? '-'
}

/**
 * One column. `sub` is the small line under the column name — the seller's own
 * listed price and size, which the blueprint puts in the head rather than in a
 * "Sold for" cell where it could be misread as a sale.
 */
type Col = {
  /** Sort keys for the interactive layer, off the home's own figures. */
  sort: string
  key: string
  label: string
  /**
   * The home's number, drawn as the badge the map draws.
   *
   * It used to be typed into the label as "3. 947 6th", which reads as a rank
   * — so a reader who sorted the grid by price met 3, 5, 1, 2, 4 and a map
   * still saying 1 through 5, and concluded the sort was broken. The key is
   * not a position, it is the key to the pin, and drawn as the pin's own badge
   * it says so without a caption.
   */
  pin: string | null
  href: string | null
  sub: string | null
  cells: string[]
  photoUrl: string | null
  /** Matrix 3 only: what the chapter's filter hides a column by. */
  status?: 'active' | 'pending'
}

/** The map's pin, at reading size, so the two read as one object. */
function pinBadge(pin: string | null, family?: string): string {
  return pin
    ? `<span class="pin-badge${family ? ` is-${esc(family)}` : ''}" aria-hidden="true">${esc(pin)}</span>`
    : ''
}

/**
 * One line of the table. `rule` draws the total's rule above it; `grid` marks
 * a line of the adjustment grid, which the phone card repeats verbatim.
 */
type MatrixRow = {
  label: string
  figure: boolean
  fact?: 'dom' | 'listing-history'
  rule?: boolean
  grid?: boolean
  /** The cell holds a drawing, not a figure. Printed as written, never escaped. */
  html?: boolean
  /** The cell holds an MLS sentence as written, so it reads as prose. */
  note?: boolean
}

/**
 * THE COLUMN SET, EXACTLY, AND THE SAME ONE THREE TIMES (Delta 3).
 *
 * "Columns exactly: photo · address (tracked link) · outcome line · year built
 * · remodel or update notes · size · lot size · rooms · beds · baths · days on
 * market · price changes (count, and the path drawn) · first ask → last ask →
 * outcome."
 *
 * Photo and address live in the column head, where a reader meets the house
 * before its facts. Everything else is a row, in that order.
 */
const SHARED_ROWS: ReadonlyArray<MatrixRow> = [
  { label: 'Outcome', figure: false },
  { label: 'Year built', figure: true },
  { label: 'Remodel or update notes', figure: false, note: true },
  { label: 'Size', figure: true },
  { label: 'Lot size', figure: true },
  { label: 'Rooms', figure: true },
  { label: 'Beds', figure: true },
  { label: 'Baths', figure: true },
  { label: 'Days on market', figure: true, fact: 'dom' },
  { label: 'Price changes', figure: true },
  { label: 'How the price moved', figure: false, html: true },
  // NOT `figure`: `td.n` is nowrap, and "$475K → $460K → came off" in a 93px
  // column then ran 4pt past the right margin on the print sheet
  // (page-safety.int). The arc wraps; every figure inside it is still short.
  { label: 'First ask → last ask → outcome', figure: false },
]

/**
 * The adjustment grid, under matrix 1 only.
 *
 * Research item 1 (docs/research/cma-professional-practice-2026-09-07.md):
 * "print the adjustment grid line by line per sale — sale price, concessions,
 * date/time, size, story, net adj $, net adj %, gross adj % — instead of a
 * single arrow." Delta 3 keeps it, and keeps it where it belongs: these are
 * the working behind the closed sales, and an unsold listing or a live rival
 * was never adjusted for anything.
 */
const ADJUSTMENT_ROWS: ReadonlyArray<MatrixRow> = [
  { label: 'Sold for', figure: true, grid: true },
  { label: 'Sold', figure: true, grid: true },
  { label: 'Seller concessions', figure: true, grid: true },
  { label: 'Adjusted for date', figure: true, grid: true },
  { label: 'Adjusted for size (theirs vs yours)', figure: true, grid: true },
  { label: 'Adjusted for style (theirs vs yours)', figure: true, grid: true },
  // A sale one bedroom or bathroom from the subject is used on this home's own
  // ground and is NOT priced for the room (lib/pricing/room-counts.ts: paired
  // sales in this market put the extra bath slightly below its pair at the
  // median). The reader asks "what did you adjust for" in this grid, so the
  // honest $0 belongs in it. Folds away when no sale carries a difference.
  { label: 'Adjusted for rooms (theirs vs yours)', figure: true, grid: true },
  { label: 'Net adjustment', figure: true, grid: true },
  { label: 'Net, as a share of the sale', figure: true, grid: true },
  { label: 'Every adjustment added up', figure: true, grid: true },
  { label: 'Sale price today', figure: true, rule: true, grid: true },
  { label: 'Weight in this price', figure: true, grid: true },
]

const ACRES_TO_SQFT = 43560

/**
 * The size that matters for THIS report.
 *
 * Living area on an improved home. On land there is none, and printing a dash
 * in the one row a land seller reads is worse than useless — so the row falls
 * back to the lot, labelled as the lot.
 */
function sizeCell(sqft: number | null | undefined, lotAcres: number | null | undefined): string {
  if (sqft != null && sqft > 0) return `${int(sqft)} sqft`
  if (lotAcres != null && lotAcres > 0) return `${int(Math.round(lotAcres * ACRES_TO_SQFT))} sqft lot`
  return '-'
}

/** The lot, in the unit a Central Oregon seller reads it in. */
function lotCell(lotAcres: number | null | undefined): string {
  if (lotAcres == null || !(lotAcres > 0)) return '-'
  return lotAcres >= 1
    ? `${dec(lotAcres, 2)} ac`
    : `${int(Math.round(lotAcres * ACRES_TO_SQFT))} sqft`
}

function bedsBaths(beds: number | null | undefined, baths: number | null | undefined): string {
  const b = beds != null ? `${int(beds)} bd` : null
  const ba = baths != null ? `${dec(baths, baths % 1 !== 0 ? 1 : 0)} ba` : null
  return b && ba ? `${b} / ${ba}` : (b ?? ba ?? '-')
}

/** "$475K → $460K → sold $457K" — the whole listing in one cell. */
export function askArcCell(entry: MatrixEntry): string {
  const bits: string[] = []
  if (entry.firstAsk != null && entry.firstAsk > 0) bits.push(shortUsd(entry.firstAsk))
  if (entry.lastAsk != null && entry.lastAsk > 0 && entry.lastAsk !== entry.firstAsk) {
    bits.push(shortUsd(entry.lastAsk))
  }
  if (entry.endLabel) bits.push(entry.endLabel)
  return bits.length > 0 ? bits.join(' → ') : '-'
}

/** The shared cells for one home, in SHARED_ROWS order. */
function sharedCells(entry: MatrixEntry, range?: PricePathRange | null): string[] {
  return [
    entry.outcome || '-',
    entry.yearBuilt != null ? String(entry.yearBuilt) : '-',
    remodelCell(entry),
    sizeCell(entry.sqft, entry.lotAcres),
    lotCell(entry.lotAcres),
    entry.rooms != null ? int(entry.rooms) : '-',
    entry.beds != null ? int(entry.beds) : '-',
    entry.baths != null ? dec(entry.baths, entry.baths % 1 !== 0 ? 1 : 0) : '-',
    entry.domDays != null ? `${int(entry.domDays)} ${entry.domDays === 1 ? 'day' : 'days'}` : '-',
    entry.priceChanges == null
      ? '-'
      : entry.priceChanges === 0
        ? 'none'
        : entry.priceChangesExact
          ? int(entry.priceChanges)
          : 'at least 1',
    priceHistorySparkHtml(entry.path, range) || '-',
    askArcCell(entry),
  ]
}

function colFor(entry: MatrixEntry, range?: PricePathRange | null): Col {
  return {
    key: entry.key === 'subject' ? 'subject' : `k${entry.key}`,
    label: entry.family === 'subject' ? 'Your home' : entry.address,
    pin: entry.family === 'subject' ? null : entry.key,
    href: entry.href,
    sub:
      entry.family === 'subject'
        ? [
            entry.lastAsk != null && entry.lastAsk > 0 ? `listed ${usd(entry.lastAsk)}` : null,
            entry.sqft != null && entry.sqft > 0 ? `${int(entry.sqft)} sqft` : null,
          ]
            .filter(Boolean)
            .join('<br/>') || null
        : null,
    photoUrl: entry.photoUrl,
    sort: entry.sort,
    status: entry.status,
    cells: sharedCells(entry, range),
  }
}

/**
 * `pricing.reconciliation.weights[]`, keyed by listing.
 */
export type CompWeight = { weight: number | null; grossAdjustmentPct: number | null }

/**
 * The net total and the two percentages, over the same figures the grid prints
 * above them. A sale with no recorded adjustment carries none of these rather
 * than a row of zeros.
 */
function adjustmentLines(comp: CmaAdjustedComp): {
  net: number | null
  netPct: number | null
  grossPct: number | null
} {
  const parts = [comp.timeAdjustment, comp.sizeAdjustment, comp.storyAdjustment].filter(
    (v): v is number => v != null && Number.isFinite(v),
  )
  if (parts.length === 0) return { net: null, netPct: null, grossPct: null }
  const close = comp.closePrice
  const net = parts.reduce((sum, v) => sum + v, 0)
  const gross = parts.reduce((sum, v) => sum + Math.abs(v), 0)
  if (close == null || !(close > 0)) return { net, netPct: null, grossPct: null }
  return { net, netPct: (net / close) * 100, grossPct: (gross / close) * 100 }
}

/**
 * The 1004's FIRST value adjustment, and the one this document printed nowhere
 * (research item 8) while the net sheet quoted two concession figures with no
 * basis on the page.
 */
function concessionCell(comp: CmaAdjustedComp): string {
  const c = comp.concessions ?? comp.concessionsAmount ?? null
  if (c == null || !Number.isFinite(c)) return '-'
  return c > 0 ? usd(c) : 'none'
}

function signedCell(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '-' : usdSigned(v)
}

function dateCell(iso: string | null | undefined): string {
  const d = (iso ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '-'
  const parsed = new Date(`${d}T12:00:00.000Z`)
  return Number.isNaN(parsed.getTime())
    ? '-'
    : parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

/**
 * What the room difference cost: nothing, and the cell says so out loud.
 * A dash when the sale matches the subject's room counts, so the row folds
 * away on a set where every sale matches.
 */
function roomAdjustmentCell(comp: CmaAdjustedComp): string {
  const notes = comp.roomDifference ?? []
  if (notes.length === 0) return '-'
  const parts = notes.map((n) => (n === 'beds' ? '1 bed' : '1 bath'))
  return `$0 (${parts.join(', ')})`
}

/** The adjustment-grid cells for one closed sale, in ADJUSTMENT_ROWS order. */
function adjustmentCells(
  comp: CmaAdjustedComp,
  weights?: ReadonlyMap<string, CompWeight>,
): string[] {
  const adj = adjustmentLines(comp)
  const weight = weights?.get(comp.listingKey ?? '') ?? null
  const gross = weight?.grossAdjustmentPct ?? adj.grossPct
  return [
    usd(comp.closePrice),
    dateCell(comp.closeDate),
    concessionCell(comp),
    signedCell(comp.timeAdjustment),
    signedCell(comp.sizeAdjustment),
    signedCell(comp.storyAdjustment),
    roomAdjustmentCell(comp),
    adj.net != null ? usdSigned(adj.net) : '-',
    adj.netPct != null
      ? `${adj.netPct > 0 ? '+' : adj.netPct < 0 ? '−' : ''}${Math.abs(adj.netPct).toFixed(1)}%`
      : '-',
    gross != null ? `${gross.toFixed(1)}%` : '-',
    usd(comp.adjustedPrice),
    weight?.weight != null ? `${weight.weight.toFixed(1)}%` : '-',
  ]
}

/**
 * A row whose every filled cell says the same thing is not a comparison. It
 * folds into one sentence above the table (blueprint chapter 3).
 *
 * ONLY the identity facts fold. The outcome, the days, the price changes and
 * the ask arc are the comparison itself: on a street of clones every home can
 * legitimately share a price, and folding that row would delete the most
 * important line in the document to save four words.
 *
 * ONE SENTENCE, not one per row. "Every home here is a single family
 * residence. Every home here is 3 bd / 2 ba." was two consecutive sentences of
 * one shape (tasteReview round three, §3). Each row contributes a CLAUSE and
 * the clauses compose one sentence.
 */
const SHARED_PHRASE: Record<string, (v: string) => string> = {
  Beds: (v) => `${v} bd`,
  Baths: (v) => `${v} ba`,
  'Year built': (v) => `built in ${v}`,
  Size: (v) => v,
  'Lot size': (v) => `on ${v}`,
  Rooms: (v) => `${v} rooms`,
}

/** The clauses read best in this order, whatever order the rows are in. */
const SHARED_ORDER = ['Beds', 'Baths', 'Rooms', 'Year built', 'Size', 'Lot size']

function foldIdenticalRows(
  cols: readonly Col[],
  rows: ReadonlyArray<MatrixRow>,
): { rows: typeof rows; sentence: string } {
  const kept: Array<(typeof rows)[number]> = []
  const shared: Array<{ label: string; clause: string }> = []
  const keptIndexes: number[] = []
  rows.forEach((row, i) => {
    const values = cols.map((c) => c.cells[i] ?? '-').filter((v) => v !== '-')
    // A row every column left empty is not a comparison. Nor is a row of
    // zeros: "Adjusted for style, $0, $0, $0, $0, $0" is five cells saying
    // that no style adjustment was made, which the legend already covers.
    if (values.length === 0) return
    if (values.every((v) => v === '$0')) return
    // A row only the reader's own home fills is not a comparison either: the
    // MLS carries no remarks on a live rival, so "Remodel or update notes"
    // arrived as one cell and four dashes (look-pass, 2026-09-08).
    if (cols.slice(1).every((c) => (c.cells[i] ?? '-') === '-')) return
    const phrase = SHARED_PHRASE[row.label]
    const same = phrase != null && values.length >= 2 && values.every((v) => v === values[0])
    if (same) {
      shared.push({ label: row.label, clause: phrase(values[0]!) })
      return
    }
    kept.push(row)
    keptIndexes.push(i)
  })
  // Re-index the cells so a kept row still reads its own column values.
  for (const col of cols as Col[]) {
    col.cells = keptIndexes.map((i) => col.cells[i] ?? '-')
  }
  const clauses = [...shared]
    .sort((a, b) => SHARED_ORDER.indexOf(a.label) - SHARED_ORDER.indexOf(b.label))
    .map((c) => c.clause)
  return {
    rows: kept,
    sentence: clauses.length > 0 ? `Every home here is ${clauses.join(', ')}.` : '',
  }
}

function splitEvenly(cols: Col[]): Col[][] {
  const tableCount = Math.max(1, Math.ceil(cols.length / MAX_COMPS_PER_TABLE))
  const groups: Col[][] = []
  let cut = 0
  for (let t = 0; t < tableCount; t++) {
    // Distribute the remainder one column at a time across the leading tables,
    // so sizes never differ by more than one.
    const size = Math.ceil((cols.length - cut) / (tableCount - t))
    groups.push(cols.slice(cut, cut + size))
    cut += size
  }
  return groups
}

function matrixTable(
  cols: Col[],
  rows: ReadonlyArray<MatrixRow>,
  family: string,
  opts: { heads?: boolean; adjustments?: boolean } = {},
): string {
  // Fixed layout reads its widths from the colgroup, so the table is exactly
  // 100% of the content box no matter what any cell holds.
  const valueWidth = Math.floor(((100 - LABEL_COL_PCT) / cols.length) * 100) / 100
  const colgroup =
    `<colgroup><col style="width:${LABEL_COL_PCT}%">` +
    cols.map(() => `<col style="width:${valueWidth}%">`).join('') +
    `</colgroup>`
  const head = `<tr><th></th>${cols
    .map((c) => {
      const pin = c.key === 'subject' ? 'subject' : (c.pin ?? c.key)
      const src = c.photoUrl ? sparkPhotoAt(c.photoUrl, '320x240') ?? c.photoUrl : null
      // The adjustment table under matrix 1 repeats the SAME columns, so it
      // repeats the addresses and drops the photographs: two thumbnails of one
      // house on one screen is the wall this document is trying not to be.
      const img =
        opts.heads === false || !src
          ? ''
          : `<img class="matrix-thumb" src="${esc(src)}" alt="" loading="eager" referrerpolicy="no-referrer"/>`
      // THE BADGE SITS OUTSIDE THE ANCHOR'S TEXT. Inside it, `innerText` read
      // "31737 7th" and a copy-paste or a text extraction carried the pin
      // number into the address (tasteReview round three, §4 item 6). It is
      // aria-hidden either way; this puts it out of the text as well, and the
      // row it draws keeps the badge beside the address.
      const badge = pinBadge(c.pin, c.key === 'subject' ? 'subject' : family)
      const name = c.href
        ? `<span class="addr-row">${badge}<a class="matrix-addr" href="${esc(
            c.href,
          )}" data-rr-track="cma-sale">${esc(c.label)}</a></span>`
        : `<span class="addr-row"><span class="matrix-addr">${badge}${esc(c.label)}</span></span>`
      // ROW → PIN IS A CONTROL, so it says so. The pin on the map is a real
      // <button>; this end of the same pair was a bare <th> with no role, no
      // tabindex and no cursor, so one direction of a two-way interaction was
      // neither discoverable nor keyboard-reachable (tasteReview round two,
      // §4). `role="button"` on the <th> would take the header semantics away
      // from the column, so the affordance goes on an inner element and the
      // <th> keeps being a header.
      const control =
        c.key === 'subject'
          ? ''
          : `<span class="matrix-hit" role="button" tabindex="0" aria-label="${esc(
              `Show ${c.label} on the map`,
            )}" data-comp="${esc(pin)}" data-pin="${esc(pin)}"></span>`
      const status = c.status ? ` data-status="${esc(c.status)}"` : ''
      return `<th class="v" data-comp="${esc(pin)}" data-pin="${esc(pin)}"${status}${c.sort}>${control}${img}${name}${
        // `sub` is composed here, from figures already escaped by usd()/int(),
        // and carries one <br/> of our own — never reader input.
        c.sub ? `<span class="matrix-sub">${c.sub}</span>` : ''
      }</th>`
    })
    .join('')}</tr>`
  const body = rows
    .map((row, i) => {
      const subjectVal = cols[0]!.cells[i] ?? '-'
      const tds = cols
        .map((c, ci) => {
          const val = c.cells[i] ?? '-'
          const diff =
            row.html !== true && ci > 0 && val !== subjectVal && val !== '-' && subjectVal !== '-'
          const cell = row.html === true ? val : esc(val)
          return `<td class="v${row.figure ? ' n' : ''}${row.html === true ? ' is-draw' : ''}${
            row.note === true ? ' is-note' : ''
          }${diff ? ' is-diff' : ''}">${cell}</td>`
        })
        .join('')
      const factAttr = row.fact ? ` data-fact="${row.fact}"` : ''
      // The conclusion of the grid gets a rule above it, the way a total does.
      const cls = row.rule ? ' class="is-total"' : ''
      // Delta 2: 'Toggle "adjusted for date and size" on and off on the sale
      // prices to see what the adjustments do.' The toggle hides the working,
      // never the conclusion — the sale price today keeps its row.
      const adjAttr = row.grid === true && row.rule !== true ? ' data-adj="1"' : ''
      return `<tr${factAttr}${cls}${adjAttr}><th>${esc(row.label)}</th>${tds}</tr>`
    })
    .join('')
  return `
  <div class="comp-matrix-wrap">
    <table class="kv is-wide comp-matrix is-${esc(family)}${opts.adjustments ? ' is-adjustments' : ''}">
      ${colgroup}
      <thead>${head}</thead>
      <tbody>${body}</tbody>
    </table>
  </div>`
}

/**
 * The phone reading: one card per home, photo on top, the same fields in the
 * same order (Delta 3). A seven-column table is a desktop object.
 */
function matrixStack(input: {
  family: string
  subject: Col
  cols: readonly Col[]
  entries: readonly MatrixEntry[]
  rows: ReadonlyArray<MatrixRow>
  adjustment?: { cols: readonly Col[]; rows: ReadonlyArray<MatrixRow> } | null
  range?: PricePathRange | null
  label: string
  subjectAddress?: string | null
}): string {
  const line = (label: string, value: string, html: boolean, adj: boolean, rule: boolean) =>
    `<div class="comp-stack-line${rule ? ' is-total' : ''}"${
      adj ? ' data-adj="1"' : ''
    }><span class="k">${esc(label)}</span><span class="v${html ? '' : ' n'}">${
      html ? value : esc(value)
    }</span></div>`
  const cardFor = (col: Col, entry: MatrixEntry | null, i: number): string => {
    const pin = col.key === 'subject' ? 'subject' : (col.pin ?? col.key)
    const src = col.photoUrl ? sparkPhotoAt(col.photoUrl, '320x240') ?? col.photoUrl : null
    const img = src
      ? `<img class="matrix-thumb" src="${esc(src)}" alt="" loading="eager" referrerpolicy="no-referrer"/>`
      : ''
    // The phone card has room for the whole line; the desktop column head,
    // 93px wide, does not. "Your home · 2465 7th" is what a seller looks for.
    const cardLabel =
      col.key === 'subject' && input.subjectAddress ? `Your home · ${input.subjectAddress}` : col.label
    const addr = col.href
      ? `<a class="comp-stack-addr" href="${esc(col.href)}" data-rr-track="cma-sale">${esc(cardLabel)}</a>`
      : `<span class="comp-stack-addr">${esc(cardLabel)}</span>`
    // The card carries the SAME lines as the column, in the same order, off
    // the SAME columns the table read (research item 1: "on the phone, one
    // card per sale with the same lines"). Reading the folded columns is what
    // keeps a row the table dropped from surviving on the phone.
    const facts = input.rows
      .map((row, ri) => ({ row, value: col.cells[ri] ?? '-' }))
      .filter(({ value }) => value !== '-')
    // THE CARD IS A CONCLUSION; THE WORKING IS ONE TAP UNDER IT.
    //
    // tasteReview round two, item 3: the phone document went the wrong way,
    // 19,987px to 20,768px. Nothing is removed: the price path, its dated
    // history and every adjustment line sit behind the card's own expand,
    // built by the interaction layer, so the print letter and a reader with no
    // JavaScript still see all of it.
    // WHAT STAYS ON THE CARD, AND WHAT GOES UNDER IT. Three matrices of full
    // cards took the phone document from 15,832px to 20,763px in one pass
    // (look-pass, 2026-09-08). Nothing is removed — every one of the twelve
    // columns is still on the card — but only the four a reader compares homes
    // on are open: what happened, what it asked and got, how long it took, and
    // how big it is. The rest opens with the price path and the working.
    const OPEN = new Set(['Outcome', 'First ask \u2192 last ask \u2192 outcome', 'Days on market', 'Size'])
    const headline = facts
      .filter(({ row }) => row.label === 'Outcome')
      .map(({ row, value }) => line(row.label, value, row.html === true, false, false))
      .join('')
    const body = facts
      .filter(({ row }) => row.label !== 'Outcome' && OPEN.has(row.label))
      .map(({ row, value }) => line(row.label, value, row.html === true, false, false))
      .join('')
    const rest = facts
      .filter(({ row }) => !OPEN.has(row.label) && row.label !== 'How the price moved')
      .map(({ row, value }) => line(row.label, value, row.html === true, false, false))
      .join('')
    const adjCol = input.adjustment?.cols[i] ?? null
    const adjLines = adjCol
      ? (input.adjustment?.rows ?? [])
          .map((row, ri) => ({ row, value: adjCol.cells[ri] ?? '-' }))
          .filter(({ value }) => value !== '-')
          .map(({ row, value }) => line(row.label, value, false, row.rule !== true, row.rule === true))
          .join('')
      : ''
    const fold = `<div class="comp-fold" data-fold-label="The rest of this home">${
      rest ? `<div class="comp-stack-grid">${rest}</div>` : ''
    }${priceHistoryLineHtml(entry?.path ?? null, `${input.family}-${pin}`, input.range)}${
      adjLines ? `<div class="comp-stack-grid">${adjLines}</div>` : ''
    }</div>`
    return `<article class="comp-stack-card${
      col.key === 'subject' ? ' is-yours' : ''
    }" data-comp="${esc(pin)}" data-pin="${esc(pin)}"${
      col.status ? ` data-status="${esc(col.status)}"` : ''
    }${col.sort}>${img}<span class="addr-row is-card">${pinBadge(
      col.pin,
      col.key === 'subject' ? 'subject' : input.family,
    )}${addr}</span>${headline ? `<div class="comp-stack-grid is-answer">${headline}</div>` : ''}${
      body ? `<div class="comp-stack-grid">${body}</div>` : ''
    }${fold}</article>`
  }
  // THEIR OWN HOME, FIRST. The desktop grid leads with a "Your home" column;
  // the phone drawing dropped it entirely, so at 375 the price chapter held
  // five sales and the string "Your home" appeared nowhere (tasteReview item 1).
  const yours = cardFor(input.subject, input.entries[0] ?? null, -1)
  const cards = input.cols.map((c, i) => cardFor(c, input.entries[i + 1] ?? null, i)).join('')
  return `<div class="comp-stack" aria-label="${esc(input.label)}">${yours}${cards}</div>`
}

/**
 * ONE MATRIX. The generic behind all three.
 *
 * `entries[0]` is always the reader's own home; the rest are the set. The
 * caller decides the heading and the sentence over it; this decides nothing
 * about the argument, only how the same twelve facts are laid out.
 */
export function renderMatrixHtml(input: {
  /** The DOM id the interaction layer scopes its controls to. */
  id: string
  family: 'closed' | 'unsold' | 'active'
  heading: string
  lead?: string
  entries: readonly MatrixEntry[]
  /** Shaded on every price path, so the reader sees who came into it. */
  range?: PricePathRange | null
  /** Matrix 1 only: the itemised Form 1004 lines, as their own table. */
  adjustments?: {
    comps: readonly CmaAdjustedComp[]
    weights?: ReadonlyMap<string, CompWeight>
  } | null
  /** Under the adjustment table, in the letter. */
  adjustmentsFooter?: string
}): string {
  const [subject, ...rest] = input.entries
  if (!subject || rest.length === 0) return ''
  const subjectCol = colFor(subject, input.range)
  const cols = rest.map((e) => colFor(e, input.range))
  const folded = foldIdenticalRows([subjectCol, ...cols], SHARED_ROWS)
  const groups = splitEvenly(cols)
  const tables = groups
    .map((group, gi) => {
      // `matrix-group-h`: the heading belongs to the TABLE, so it goes when
      // the table does. At 375 both headings rendered back to back with
      // nothing between them and then all the cards under the second one.
      const heading =
        groups.length > 1 && gi > 0
          ? `<h4 class="subhead matrix-group-h">${esc(`${input.heading}, continued`)}</h4>`
          : ''
      return `${heading}${matrixTable([subjectCol, ...group], folded.rows, input.family)}`
    })
    .join('')
  // The adjustment grid, in the SAME column order, under matrix 1 only.
  let adjustment: { cols: Col[]; rows: ReadonlyArray<MatrixRow> } | null = null
  let adjustmentHtml = ''
  if (input.adjustments) {
    const subjAdj: Col = {
      ...subjectCol,
      cells: Array<string>(ADJUSTMENT_ROWS.length).fill('-'),
    }
    const adjCols = input.adjustments.comps.map((c, i) => ({
      ...(cols[i] ?? colFor(rest[i]!, input.range)),
      cells: adjustmentCells(c, input.adjustments!.weights),
    }))
    // The same drop rules the shared rows get: a row every column left empty,
    // or a row of five "$0" cells, is not a comparison (foldIdenticalRows).
    const adjFolded = foldIdenticalRows([subjAdj, ...adjCols], ADJUSTMENT_ROWS)
    adjustment = { cols: adjCols, rows: adjFolded.rows }
    const adjGroups = splitEvenly(adjCols)
    adjustmentHtml = `<h4 class="subhead adjustments-h">How each sale was adjusted</h4>
  ${adjGroups
    .map((group) =>
      matrixTable([subjAdj, ...group], adjFolded.rows, input.family, {
        heads: false,
        adjustments: true,
      }),
    )
    .join('')}
  ${input.adjustmentsFooter ?? ''}`
  }
  return `
  <h3 class="subhead">${esc(input.heading)}</h3>
  ${input.lead ?? ''}
  ${folded.sentence ? `<p>${esc(folded.sentence)}</p>` : ''}
  ${tables}
  ${matrixStack({
    family: input.family,
    subject: subjectCol,
    cols,
    entries: input.entries,
    rows: folded.rows,
    adjustment,
    range: input.range,
    label: input.heading,
    subjectAddress: subject.address,
  })}
  ${adjustmentHtml}`
}

/**
 * Matrix 1. The closed sales that set the price, with the adjustment grid.
 *
 * Kept as its own export because the price chapter has always called it, and
 * because it is the one matrix whose set is `render_args.comps` rather than a
 * chapter's own selection.
 */
export function renderCompMatrixHtml(
  subject: CmaSubject,
  comps: readonly CmaAdjustedComp[],
  lead = '',
  ctx?: TrackedDocLinkCtx | null,
  weights?: ReadonlyMap<string, CompWeight>,
  askCtx?: SubjectAskContext,
  opts: { range?: PricePathRange | null; finalCycle?: ExpiredFinalCycle | null; footer?: string } = {},
): string {
  // Fail closed: a recommend needs >= MIN_CLOSED_SALES_FOR_MATRIX closed sales.
  if (comps.length < MIN_CLOSED_SALES_FOR_MATRIX) return ''
  const entries = [
    subjectEntry({
      subject,
      finalCycle: opts.finalCycle ?? null,
      domDays: subjectDomDays(subject),
      printableAsk: subjectPrintableAsk(subject, askCtx),
    }),
    ...closedEntries(comps, ctx),
  ]
  return renderMatrixHtml({
    id: 'sales-that-set-it',
    family: 'closed',
    heading: 'The sales that set this price',
    lead,
    entries,
    range: opts.range ?? null,
    adjustments: { comps, weights },
    adjustmentsFooter: opts.footer,
  })
}
