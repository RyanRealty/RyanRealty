/**
 * Side-by-side sold-comp matrix. Same grain as an RPR comparison:
 * subject in the first column, each kept sale as a column, one row per fact.
 *
 * The matrix is CHUNKED. At most MAX_COMPS_PER_TABLE sales per table, spread
 * evenly, with the subject repeated at the head of each. A single table holding every sale is what broke the page
 * contract: at twelve comps it was thirteen columns wide, ran past the right
 * margin, and `overflow-x: auto` then CLIPPED the tail — sales 4 through 12
 * were absent from the delivered PDF with no error and no visible truncation.
 * Chunking keeps every table inside the content box at any comp count, and the
 * colgroup below makes that width deterministic rather than a function of how
 * long an address happens to be.
 */

import { cleanText, dateLong, dec, escapeHtml, int, usd, usdSigned } from '@/lib/cma/render-blocks'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'
import { subjectNoun, subjectPossessive } from '@/lib/cma/land-pricing'

const esc = escapeHtml
const ACRES_TO_SQFT = 43560

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

function lotSqft(acres: number | null | undefined): number | null {
  if (acres == null || !Number.isFinite(acres) || acres <= 0) return null
  return Math.round(acres * ACRES_TO_SQFT)
}

function ppsf(price: number | null | undefined, sqft: number | null | undefined): number | null {
  if (price == null || !(price > 0) || sqft == null || !(sqft > 0)) return null
  return Math.round(price / sqft)
}

function dash(v: string | null | undefined): string {
  return cleanText(v) ?? '-'
}

type Col = { key: string; label: string; cells: string[] }

function subjectCol(subject: CmaSubject): Col {
  const living = subject.sqft
  const list = subject.lastListPrice
  const listSf = ppsf(list, living)
  return {
    key: 'subject',
    label: subject.streetAddress,
    cells: [
      dash(subject.propertySubType),
      '-',
      '-',
      list != null ? usd(list) : '-',
      listSf != null ? `${usd(listSf)}/sf` : '-',
      subject.lastListDate ? dateLong(subject.lastListDate) : '-',
      subject.beds != null ? int(subject.beds) : '-',
      subject.baths != null ? dec(subject.baths, subject.baths % 1 !== 0 ? 1 : 0) : '-',
      living != null && living > 0 ? int(living) : '-',
      lotSqft(subject.lotAcres) != null ? int(lotSqft(subject.lotAcres)!) : '-',
      subject.yearBuilt != null ? String(subject.yearBuilt) : '-',
      subject.garageSpaces != null ? int(subject.garageSpaces) : '-',
      '-',
      '-',
      'Subject',
      dash(subject.subdivision),
      '-',
      '-',
      '-',
    ],
  }
}

function compCol(comp: CmaAdjustedComp, index: number): Col {
  const soldSf = ppsf(comp.closePrice, comp.sqft)
  const listSf = ppsf(comp.listPrice, comp.sqft)
  return {
    key: `c${index + 1}`,
    label: `${index + 1}. ${comp.address}`,
    cells: [
      dash(comp.propertySubType),
      usd(comp.closePrice),
      soldSf != null ? `${usd(soldSf)}/sf` : '-',
      comp.listPrice != null ? usd(comp.listPrice) : '-',
      listSf != null ? `${usd(listSf)}/sf` : '-',
      dateLong(comp.closeDate),
      comp.beds != null ? int(comp.beds) : '-',
      comp.baths != null ? dec(comp.baths, comp.baths % 1 !== 0 ? 1 : 0) : '-',
      // Guarded the same way the subject column is: a land comp carries no
      // living area, and printing 0 claims a measured zero rather than a field
      // that does not apply. Safe before only because rowToComp guaranteed >=300.
      comp.sqft > 0 ? int(comp.sqft) : '-',
      lotSqft(comp.lotAcres) != null ? int(lotSqft(comp.lotAcres)!) : '-',
      comp.yearBuilt != null ? String(comp.yearBuilt) : '-',
      comp.garageSpaces != null ? int(comp.garageSpaces) : '-',
      comp.domTotal != null ? int(comp.domTotal) : '-',
      comp.daysToOffer != null ? int(comp.daysToOffer) : '-',
      dash(comp.proximity),
      dash(comp.subdivision),
      usdSigned(comp.timeAdjustment),
      usdSigned(comp.sizeAdjustment),
      usd(comp.adjustedPrice),
    ],
  }
}

/**
 * `figure: true` marks a cell that must never break across lines. Everything
 * else (property type, distance, subdivision) is free text of unbounded length
 * and wraps instead of widening its column.
 */
const ROWS: ReadonlyArray<{ label: string; figure: boolean }> = [
  { label: 'Property type', figure: false },
  { label: 'Sale price', figure: true },
  { label: 'Sale price / sqft', figure: true },
  { label: 'List price', figure: true },
  { label: 'List price / sqft', figure: true },
  { label: 'Sale date', figure: true },
  { label: 'Bedrooms', figure: true },
  { label: 'Bathrooms', figure: true },
  { label: 'Living sqft', figure: true },
  { label: 'Lot sqft', figure: true },
  { label: 'Year built', figure: true },
  { label: 'Garage', figure: true },
  { label: 'Days on market', figure: true },
  { label: 'Days to offer', figure: true },
  { label: 'Distance', figure: false },
  { label: 'Subdivision', figure: false },
  { label: 'Brought to today', figure: true },
  { label: 'Brought to your size', figure: true },
  { label: 'This sale as your house', figure: true }, // label rewritten per product in matrixTable
]

/**
 * Spread the sales across the fewest tables that respect the ceiling, evenly
 * rather than greedily. Filling to five and letting the rest fall through
 * strands a table holding one sale: six comps would print five and then a lone
 * column, which reads as an error on a page a seller studies. Six prints 3 and
 * 3; seven prints 4 and 3; ten prints 5 and 5.
 */
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

function matrixTable(cols: Col[], noun: string): string {
  // Fixed layout reads its widths from the colgroup, so the table is exactly
  // 100% of the content box no matter what any cell holds.
  const valueWidth = Math.floor(((100 - LABEL_COL_PCT) / cols.length) * 100) / 100
  const colgroup =
    `<colgroup><col style="width:${LABEL_COL_PCT}%">` +
    cols.map(() => `<col style="width:${valueWidth}%">`).join('') +
    `</colgroup>`
  const head = `<tr><th>Fact</th>${cols.map((c) => `<th class="v">${esc(c.label)}</th>`).join('')}</tr>`
  const body = ROWS.map((row, i) => {
    // A row every column left blank carries nothing. On a land matrix that is
    // Bedrooms, Bathrooms, Living sqft, Year built and Garage — five empty
    // rows the reader has to scan past to reach the lot size that matters.
    if (cols.every((c) => (c.cells[i] ?? '-') === '-')) return ''
    const subjectVal = cols[0]!.cells[i] ?? '-'
    const tds = cols
      .map((c, ci) => {
        const val = c.cells[i] ?? '-'
        const diff = ci > 0 && val !== subjectVal && val !== '-' && subjectVal !== '-'
        return `<td class="v${row.figure ? ' n' : ''}${diff ? ' is-diff' : ''}">${esc(val)}</td>`
      })
      .join('')
    const label = row.label === 'This sale as your house' ? `This sale as your ${noun}` : row.label
    return `<tr><th>${esc(label)}</th>${tds}</tr>`
  }).join('')
  return `
  <div class="comp-matrix-wrap">
    <table class="kv is-wide comp-matrix">
      ${colgroup}
      <thead>${head}</thead>
      <tbody>${body}</tbody>
    </table>
  </div>`
}

export function renderCompMatrixHtml(subject: CmaSubject, comps: readonly CmaAdjustedComp[]): string {
  if (comps.length === 0) return ''
  const noun = subjectPossessive(subject)
  const subj = subjectCol(subject)
  const compCols = comps.map((c, i) => compCol(c, i))
  const groups = splitEvenly(compCols)
  let seen = 0
  const tables = groups
    .map((group) => {
      const heading =
        groups.length > 1 ? `<h4 class="subhead">${esc(groupHeading(seen, group.length))}</h4>` : ''
      seen += group.length
      return `${heading}${matrixTable([subj, ...group], noun)}`
    })
    .join('')
  const sizeNoun = subjectNoun(subject) === 'home' ? 'living area' : 'acreage'
  const split =
    groups.length > 1
      ? ` The sales run across ${groups.length} tables so every column stays readable. Your ${noun} repeats at the head of each one.`
      : ''
  // subjectPossessive returns 'house', never 'home' — comparing against 'home'
  // here silently dropped this sentence from every improved report.
  const perFoot =
    noun === 'house'
      ? ' Sale price per square foot is close price over living area.'
      : ''
  return `
  <h3 class="subhead">Side by side</h3>
  <p>Subject in the first column. Each kept sale is a column. Sale date is when that sale closed. This sale as your ${noun} is the sold price after bringing that sale to today and to your ${sizeNoun}. It is not a second list price.${perFoot} Lot square feet is acres times 43,560.${split}</p>${tables}`
}
