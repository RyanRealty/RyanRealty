/**
 * The sales that set the price, as a table (CMA_REIMAGINED_2026-09-07.md
 * chapter 3). Your home in the first column, each sale as a column, one row per
 * fact — and only the seven facts the blueprint names.
 *
 * Every address is a tracked link into ryan-realty.com. A row identical across
 * the whole table folds into one sentence above it.
 *
 * The table is CHUNKED. At most MAX_COMPS_PER_TABLE sales per table, spread
 * evenly, with your home repeated at the head of each. A single table holding
 * every sale is what broke the page contract: at twelve sales it was thirteen
 * columns wide, ran past the right margin, and `overflow-x: auto` then CLIPPED
 * the tail — sales 4 through 12 were absent from the delivered PDF with no
 * error and no visible truncation. Chunking keeps every table inside the
 * content box at any count, and the colgroup makes that width deterministic
 * rather than a function of how long an address happens to be.
 */

import {
  UNADDRESSED_DOC_LINKS,
  cleanText,
  dateLong,
  dec,
  escapeHtml,
  int,
  sparkPhotoAt,
  usd,
  usdSigned,
} from '@/lib/cma/render-blocks'
import { priceHistoryLineHtml, priceHistorySparkHtml, pricePathFromSale } from '@/lib/cma/price-path'
import { trackedDocLink, type TrackedDocLinkCtx } from '@/lib/cma/doc-links'
import { daysOnMarketFrom } from '@/lib/cma/listing-history-line'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'
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
 * Most sales one table may hold. Five plus the subject is seven columns;
 * against the 7.3in content box that leaves 13.3% (about 93px) per value
 * column, which holds every value we print without wrapping a figure — checked
 * against eight-figure prices and 22-acre lots, not the fixture's tidy ones.
 *
 * Five is the ceiling because TARGET_COMPS is five (lib/cma/comps.ts): the
 * CMA a seller actually receives is one table, undivided, and MAX_COMPS of ten
 * is two even tables of five.
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
  /** Sort keys for the interactive layer, off the sale's own figures. */
  sort: string
  key: string
  label: string
  href: string | null
  sub: string | null
  cells: string[]
  photoUrl: string | null
}

/**
 * THE ROWS, and only these (CMA_REIMAGINED_2026-09-07.md chapter 3).
 *
 * Twenty-one rows became seven. Gone: list price and list $/sqft (a seller
 * reading a valuation does not price off another seller's ask), sale $/sqft
 * (the same fact twice), lot sqft, garage, days on market beside days to
 * offer, distance, subdivision, the three itemized adjustment lines, and the
 * listing-history paragraph in a table cell.
 *
 * `Property type` is a row so that it can FOLD: on almost every document every
 * column says "Single Family Residence", and a row repeating one value six
 * times is the wall of text. Any row identical across the whole table folds
 * into one sentence above it.
 */
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
}

const ROWS: ReadonlyArray<MatrixRow> = [
  { label: 'Property type', figure: false },
  { label: 'Size', figure: true },
  { label: 'Beds and baths', figure: true },
  { label: 'Year built', figure: true },
  { label: 'Days to offer', figure: true },
  { label: 'Sold for', figure: true },
  { label: 'Sold', figure: true },
  { label: 'Price history', figure: false, html: true },
  { label: 'Seller concessions', figure: true, grid: true },
  { label: 'Adjusted for date', figure: true, grid: true },
  { label: 'Adjusted for size', figure: true, grid: true },
  { label: 'Adjusted for style', figure: true, grid: true },
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

function bedsBaths(beds: number | null | undefined, baths: number | null | undefined): string {
  const b = beds != null ? `${int(beds)} bd` : null
  const ba = baths != null ? `${dec(baths, baths % 1 !== 0 ? 1 : 0)} ba` : null
  return b && ba ? `${b} / ${ba}` : (b ?? ba ?? '-')
}

function subjectCol(subject: CmaSubject): Col {
  const list = subject.lastListPrice
  const sub = [
    list != null && list > 0 ? `listed ${usd(list)}` : null,
    subject.sqft != null && subject.sqft > 0 ? `${int(subject.sqft)} sqft` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return {
    key: 'subject',
    label: 'Your home',
    href: null,
    sub: sub || null,
    photoUrl: subject.photoUrl?.trim() || null,
    // The reader's own home never sorts: it is the first column, always.
    sort: '',
    cells: [
      dash(subject.propertySubType),
      sizeCell(subject.sqft, subject.lotAcres),
      bedsBaths(subject.beds, subject.baths),
      subject.yearBuilt != null ? String(subject.yearBuilt) : '-',
      // Nothing under any of the sale rows on a home that has not sold. The
      // ask rides in the column head, where it is labelled as an ask.
      ...Array<string>(ROWS.length - 4).fill('-'),
    ],
  }
}

/**
 * One sale's column, line by line, in Form 1004 order.
 *
 * Research item 1 (docs/research/cma-professional-practice-2026-09-07.md):
 * "print the adjustment grid line by line per sale — sale price, concessions,
 * date/time, size, story, net adj $, net adj %, gross adj % — instead of a
 * single arrow." The document collapsed three itemized adjustments the engine
 * already computes into one number and printed nothing a reader could check.
 *
 * Nothing here computes a valuation. The three adjustment figures and the
 * adjusted price all arrive on `render_args`; the net total and the two
 * percentages are arithmetic over those same printed figures, which is the
 * point of showing them — a reader can add the column up.
 */
function compCol(
  comp: CmaAdjustedComp,
  index: number,
  ctx?: TrackedDocLinkCtx | null,
  weights?: ReadonlyMap<string, CompWeight>,
): Col {
  const adj = adjustmentLines(comp)
  const weight = weights?.get(comp.listingKey ?? '') ?? null
  const gross = weight?.grossAdjustmentPct ?? adj.grossPct
  return {
    key: `c${index + 1}`,
    label: `${index + 1}. ${comp.address}`,
    href: compHref(comp, ctx),
    sub: null,
    photoUrl: comp.photoUrl?.trim() || null,
    sort: sortKeys(comp),
    cells: [
      dash(comp.propertySubType),
      sizeCell(comp.sqft, comp.lotAcres),
      bedsBaths(comp.beds, comp.baths),
      comp.yearBuilt != null ? String(comp.yearBuilt) : '-',
      comp.daysToOffer != null ? `${int(comp.daysToOffer)} ${comp.daysToOffer === 1 ? 'day' : 'days'}` : '-',
      usd(comp.closePrice),
      comp.closeDate ? dateLong(comp.closeDate) : '-',
      // Delta 1's price-path primitive, drawn ONCE, in the column it belongs
      // to. It used to be drawn twice: inside the phone card and again in a
      // stacked block under the grid (tasteReview item 3).
      priceHistorySparkHtml(pricePathFromSale(comp)) || '-',
      concessionCell(comp),
      signedCell(comp.timeAdjustment),
      signedCell(comp.sizeAdjustment),
      signedCell(comp.storyAdjustment),
      adj.net != null ? usdSigned(adj.net) : '-',
      adj.netPct != null ? `${adj.netPct > 0 ? '+' : adj.netPct < 0 ? '−' : ''}${Math.abs(adj.netPct).toFixed(1)}%` : '-',
      gross != null ? `${gross.toFixed(1)}%` : '-',
      usd(comp.adjustedPrice),
      weight?.weight != null ? `${weight.weight.toFixed(1)}%` : '-',
    ],
  }
}

/**
 * What the reader can re-order the sales by (Delta 2: "Sort by distance, date,
 * price"). Every key is a figure the column already prints, so a sort can only
 * rearrange what is on the page. Distance is not on a closed sale's row, so it
 * is not offered — the map beside the grid is where distance is read.
 */
function sortKeys(comp: CmaAdjustedComp): string {
  const parts: string[] = []
  const date = (comp.closeDate ?? '').slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) parts.push(` data-sort-date="${date}"`)
  if (comp.adjustedPrice != null && Number.isFinite(comp.adjustedPrice)) {
    parts.push(` data-sort-price="${Math.round(comp.adjustedPrice)}"`)
  }
  if (comp.sqft != null && Number.isFinite(comp.sqft)) parts.push(` data-sort-size="${Math.round(comp.sqft)}"`)
  return parts.join('')
}

/** `pricing.reconciliation.weights[]`, keyed by listing. */
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

/** Every address in this chapter is a tracked link into the site. */
function compHref(comp: CmaAdjustedComp, ctx?: TrackedDocLinkCtx | null): string {
  return trackedDocLink(
    'listing',
    {
      listingKey: comp.listingKey,
      mlsNumber: comp.mlsNumber,
      streetNumber: /^\s*(\d+[A-Za-z]?)\s/.exec(comp.address)?.[1] ?? null,
      streetName: comp.address.replace(/^\s*\d+[A-Za-z]?\s+/, '').trim() || null,
      city: comp.city,
      subdivisionName: comp.subdivision,
    },
    ctx ?? UNADDRESSED_DOC_LINKS,
  )
}

/**
 * A row whose every filled cell says the same thing is not a comparison. It
 * folds into one sentence above the table (blueprint chapter 3).
 *
 * ONLY the identity facts fold. Sold for, Sold, Size, Days to offer and Sale
 * price today are the comparison itself: on a street of clones every sale can
 * legitimately share a price, and folding that row would delete the most
 * important line in the document to save four words.
 */
const SHARED_PHRASE: Record<string, (v: string) => string> = {
  'Property type': (v) => `Every home here is a ${v.toLowerCase()}.`,
  'Beds and baths': (v) => `Every home here is ${v}.`,
  'Year built': (v) => `Every home here was built in ${v}.`,
  Size: (v) => `Every home here is ${v}.`,
}

function foldIdenticalRows(
  cols: readonly Col[],
  rows: ReadonlyArray<MatrixRow>,
): { rows: typeof rows; sentence: string } {
  const kept: Array<(typeof rows)[number]> = []
  const shared: string[] = []
  const keptIndexes: number[] = []
  rows.forEach((row, i) => {
    const values = cols.map((c) => c.cells[i] ?? '-').filter((v) => v !== '-')
    // A row every column left empty is not a comparison. Nor is a row of
    // zeros: "Adjusted for style, $0, $0, $0, $0, $0" is five cells saying
    // that no style adjustment was made, which the legend already covers.
    if (values.length === 0) return
    if (values.every((v) => v === '$0')) return
    const phrase = SHARED_PHRASE[row.label]
    const same = phrase != null && values.length >= 2 && values.every((v) => v === values[0])
    if (same) {
      shared.push(phrase(values[0]!))
      return
    }
    kept.push(row)
    keptIndexes.push(i)
  })
  // Re-index the cells so a kept row still reads its own column values.
  for (const col of cols as Col[]) {
    col.cells = keptIndexes.map((i) => col.cells[i] ?? '-')
  }
  return { rows: kept, sentence: shared.join(' ') }
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

function groupHeading(startIndex: number, size: number): string {
  const first = startIndex + 1
  const last = startIndex + size
  return size === 1 ? `Sale ${first}` : `Sales ${first} through ${last}`
}

function matrixTable(
  cols: Col[],
  rows: ReadonlyArray<MatrixRow>,
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
      const pin = c.key === 'subject' ? 'subject' : c.key.replace(/^c/, '')
      const src = c.photoUrl ? sparkPhotoAt(c.photoUrl, '320x240') ?? c.photoUrl : null
      const img = src
        ? `<img class="matrix-thumb" src="${esc(src)}" alt="" loading="eager" referrerpolicy="no-referrer"/>`
        : ''
      const name = c.href
        ? `<a class="matrix-addr" href="${esc(c.href)}" data-rr-track="cma-sale">${esc(c.label)}</a>`
        : `<span class="matrix-addr">${esc(c.label)}</span>`
      return `<th class="v" data-comp="${esc(pin)}" data-pin="${esc(pin)}"${c.sort}>${img}${name}${
        c.sub ? `<span class="matrix-sub">${esc(c.sub)}</span>` : ''
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
          const body = row.html === true ? val : esc(val)
          return `<td class="v${row.figure ? ' n' : ''}${row.html === true ? ' is-draw' : ''}${diff ? ' is-diff' : ''}">${body}</td>`
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
    <table class="kv is-wide comp-matrix">
      ${colgroup}
      <thead>${head}</thead>
      <tbody>${body}</tbody>
    </table>
  </div>`
}

/**
 * The phone reading: one card per sale, photo on top, the same fields
 * (blueprint chapter 3). A seven-column table is a desktop object.
 */
function matrixStack(
  subject: CmaSubject,
  comps: readonly CmaAdjustedComp[],
  cols: readonly Col[],
  rows: ReadonlyArray<MatrixRow>,
  ctx?: TrackedDocLinkCtx | null,
): string {
  // THEIR OWN HOME, FIRST. The desktop grid leads with a "Your home" column;
  // the phone drawing dropped it entirely, so at 375 the price chapter held
  // five sales and the string "Your home" appeared nowhere — the seller could
  // not compare their house to the sales on the device they were reading on
  // (tasteReview item 1).
  const yours = subjectStackCard(subject)
  const cards = comps
    .map((c, i) => {
      const pin = String(i + 1)
      const src = c.photoUrl ? sparkPhotoAt(c.photoUrl, '320x240') ?? c.photoUrl : null
      const img = src
        ? `<img class="matrix-thumb" src="${esc(src)}" alt="" loading="eager" referrerpolicy="no-referrer"/>`
        : ''
      const facts = [
        sizeCell(c.sqft, c.lotAcres) !== '-' ? sizeCell(c.sqft, c.lotAcres) : null,
        bedsBaths(c.beds, c.baths) !== '-' ? bedsBaths(c.beds, c.baths) : null,
        c.yearBuilt != null ? `built ${c.yearBuilt}` : null,
        c.daysToOffer != null ? `${int(c.daysToOffer)} ${c.daysToOffer === 1 ? 'day' : 'days'} to offer` : null,
      ]
        .filter(Boolean)
        .join(' · ')
      // The card carries the SAME lines as the column, in the same order, off
      // the SAME columns the table read — a seven-column table is a desktop
      // object, the grid behind it is not (research item 1: "on the phone, one
      // card per sale with the same lines"). Reading the folded columns is
      // what keeps a row the table dropped from surviving on the phone.
      const col = cols[i]
      const lines = rows
        .map((row, ri) => ({
          label: row.label,
          grid: row.grid === true,
          rule: row.rule === true,
          value: col?.cells[ri] ?? '-',
        }))
        .filter((line) => line.grid && line.value !== '-')
        .map(
          (line) =>
            `<div class="comp-stack-line"${
              line.rule ? '' : ' data-adj="1"'
            }><span class="k">${esc(line.label)}</span><span class="v n">${esc(line.value)}</span></div>`,
        )
        .join('')
      return `<article class="comp-stack-card" data-comp="${esc(pin)}" data-pin="${esc(pin)}"${sortKeys(c)}>${img}<a class="comp-stack-addr" href="${esc(
        compHref(c, ctx),
      )}" data-rr-track="cma-sale">${esc(pin)}. ${esc(c.address)}</a><div class="comp-stack-sold">Sold ${esc(
        dateLong(c.closeDate),
      )} · ${usd(c.closePrice)}</div>${facts ? `<div class="comp-stack-facts">${esc(facts)}</div>` : ''}${priceHistoryLineHtml(
        pricePathFromSale(c),
        `sale-${pin}`,
      )}<div class="comp-stack-grid">${lines}</div></article>`
    })
    .join('')
  return `<div class="comp-stack" aria-label="The sales that set this price, one card each">${yours}${cards}</div>`
}

/** The reader's own home as the first phone card: ask, size, beds, baths, year. */
function subjectStackCard(subject: CmaSubject): string {
  const src = subject.photoUrl?.trim()
    ? (sparkPhotoAt(subject.photoUrl, '320x240') ?? subject.photoUrl)
    : null
  const img = src
    ? `<img class="matrix-thumb" src="${esc(src)}" alt="" loading="eager" referrerpolicy="no-referrer"/>`
    : ''
  const ask = subject.lastListPrice
  const facts = [
    sizeCell(subject.sqft, subject.lotAcres) !== '-' ? sizeCell(subject.sqft, subject.lotAcres) : null,
    bedsBaths(subject.beds, subject.baths) !== '-' ? bedsBaths(subject.beds, subject.baths) : null,
    subject.yearBuilt != null ? `built ${subject.yearBuilt}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
  return `<article class="comp-stack-card is-yours" data-comp="subject" data-pin="subject">${img}<span class="comp-stack-addr">Your home · ${esc(
    subject.streetAddress,
  )}</span><div class="comp-stack-sold">${
    ask != null && ask > 0 ? `Listed ${usd(ask)}` : 'Not on the market'
  }</div>${facts ? `<div class="comp-stack-facts">${esc(facts)}</div>` : ''}</article>`
}

/** The one line that says what "Sale price today" is. */
const SALE_PRICE_TODAY_LEGEND =
  'Sale price today is the sale price plus every adjustment above it. A minus figure means that sale had something yours does not. A plus means yours has it.'

export function renderCompMatrixHtml(
  subject: CmaSubject,
  comps: readonly CmaAdjustedComp[],
  lead = '',
  ctx?: TrackedDocLinkCtx | null,
  weights?: ReadonlyMap<string, CompWeight>,
): string {
  // Fail closed: a recommend needs >= MIN_CLOSED_SALES_FOR_MATRIX closed sales.
  if (comps.length < MIN_CLOSED_SALES_FOR_MATRIX) return ''
  const subj = subjectCol(subject)
  const compCols = comps.map((c, i) => compCol(c, i, ctx, weights))
  const folded = foldIdenticalRows([subj, ...compCols], ROWS)
  const groups = splitEvenly(compCols)
  let seen = 0
  const tables = groups
    .map((group) => {
      const heading =
        groups.length > 1 ? `<h4 class="subhead">${esc(groupHeading(seen, group.length))}</h4>` : ''
      seen += group.length
      return `${heading}${matrixTable([subj, ...group], folded.rows)}`
    })
    .join('')
  return `
  <h3 class="subhead">The sales that set this price</h3>
  ${lead}
  ${folded.sentence ? `<p>${esc(folded.sentence)}</p>` : ''}
  ${tables}
  ${matrixStack(subject, comps, compCols, folded.rows, ctx)}
  <p class="small">${esc(SALE_PRICE_TODAY_LEGEND)}</p>`
}
