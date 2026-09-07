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

import { cleanText, dateLong, dec, escapeHtml, int, sparkPhotoAt, usd, usdSigned } from '@/lib/cma/render-blocks'
import { daysOnMarketFrom, listingHistoryLine as buildListingHistoryLine } from '@/lib/cma/listing-history-line'
import {
  collapseExpiredPeerCycles,
  peerMatchesSubject,
  type CmaExpiredPeer,
} from '@/lib/cma/market-status'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'
import { MIN_COMPS } from '@/lib/cma/comps'

const esc = escapeHtml

/** Same floor as selection — do not paint a thin matrix that did not set the recommend. */
export const MIN_CLOSED_SALES_FOR_MATRIX = MIN_COMPS
const ACRES_TO_SQFT = 43560

/** Prefer DOM baked into listing history so the DOM row and history agree. */
function domFromHistoryLine(line: string | null | undefined): number | null {
  const m = line?.match(/(\d+)\s+days?\s+on\s+market/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) && n >= 0 ? n : null
}

function subjectDomDays(subject: CmaSubject): number | null {
  return (
    domFromHistoryLine(subject.listingHistoryLine) ??
    daysOnMarketFrom({ onMarketDate: subject.lastListDate })
  )
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

type Col = { key: string; label: string; cells: string[]; photoUrl: string | null }

function subjectCol(subject: CmaSubject): Col {
  const living = subject.sqft
  const list = subject.lastListPrice
  const listSf = ppsf(list, living)
  const subjectDom = subjectDomDays(subject)
  const history =
    subject.listingHistoryLine?.trim() ||
    buildListingHistoryLine({
      listPrice: list,
      status: subject.standardStatus,
      onMarketDate: subject.lastListDate,
      daysOnMarket: subjectDom,
    }) ||
    '-'
  return {
    key: 'subject',
    label: subject.streetAddress,
    photoUrl: subject.photoUrl?.trim() || null,
    cells: [
      dash(subject.propertySubType),
      '-',
      '-',
      list != null ? usd(list) : '-',
      listSf != null ? `${usd(listSf)}/sf` : '-',
      // The subject has not SOLD — its list date under a "Sale date" label told
      // an Active seller their home closed in March (caught on all four
      // documents by adversarial verify 2026-08-27). A dash is the truth here;
      // the listing history section carries the dates with their real names.
      '-',
      subject.beds != null ? int(subject.beds) : '-',
      subject.baths != null ? dec(subject.baths, subject.baths % 1 !== 0 ? 1 : 0) : '-',
      living != null && living > 0 ? int(living) : '-',
      lotSqft(subject.lotAcres) != null ? int(lotSqft(subject.lotAcres)!) : '-',
      subject.yearBuilt != null ? String(subject.yearBuilt) : '-',
      subject.garageSpaces != null ? int(subject.garageSpaces) : '-',
      subjectDom != null ? int(subjectDom) : '-',
      '-',
      'Subject',
      dash(subject.subdivision),
      '-',
      '-',
      '-',
      '-',
      history,
    ],
  }
}

function compCol(comp: CmaAdjustedComp, index: number): Col {
  const soldSf = ppsf(comp.closePrice, comp.sqft)
  const listSf = ppsf(comp.listPrice, comp.sqft)
  return {
    key: `c${index + 1}`,
    label: `${index + 1}. ${comp.address}`,
    photoUrl: comp.photoUrl?.trim() || null,
    cells: [
      dash(comp.propertySubType),
      usd(comp.closePrice),
      soldSf != null ? `${usd(soldSf)}/sf` : '-',
      comp.listPrice != null ? usd(comp.listPrice) : '-',
      listSf != null ? `${usd(listSf)}/sf` : '-',
      comp.closeDate ? dateLong(comp.closeDate) : '-',
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
      // Dash when the style premium did not apply, so the shared all-dash rule
      // (line ~189) drops the whole row on documents where no comp carries it.
      (comp.storyAdjustment ?? 0) !== 0 ? usdSigned(comp.storyAdjustment as number) : '-',
      usdSigned(comp.sizeAdjustment),
      usd(comp.adjustedPrice),
      comp.listingHistoryLine?.trim() ||
        buildListingHistoryLine({
          listPrice: comp.listPrice,
          originalListPrice: comp.originalListPrice,
          closePrice: comp.closePrice,
          status: 'Closed',
          onMarketDate: comp.onMarketDate,
          closeDate: comp.closeDate,
          daysOnMarket: comp.domTotal,
        }) ||
        '-',
    ],
  }
}

/**
 * `figure: true` marks a cell that must never break across lines. Everything
 * else (property type, distance, subdivision) is free text of unbounded length
 * and wraps instead of widening its column.
 */
const ROWS: ReadonlyArray<{ label: string; figure: boolean; fact?: 'dom' | 'listing-history' }> = [
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
  { label: 'Days on market', figure: true, fact: 'dom' },
  { label: 'Days to offer', figure: true },
  { label: 'Distance', figure: false },
  { label: 'Subdivision', figure: false },
  { label: 'Brought to today', figure: true },
  { label: 'Style (one story vs two)', figure: true },
  { label: 'Brought to your size', figure: true },
  { label: 'Adjusted close', figure: true },
  { label: 'Listing history', figure: false, fact: 'listing-history' },
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

function matrixTable(
  cols: Col[],
  rows: ReadonlyArray<{ label: string; figure: boolean; fact?: 'dom' | 'listing-history' }> = ROWS,
): string {
  // Fixed layout reads its widths from the colgroup, so the table is exactly
  // 100% of the content box no matter what any cell holds.
  const valueWidth = Math.floor(((100 - LABEL_COL_PCT) / cols.length) * 100) / 100
  const colgroup =
    `<colgroup><col style="width:${LABEL_COL_PCT}%">` +
    cols.map(() => `<col style="width:${valueWidth}%">`).join('') +
    `</colgroup>`
  const head = `<tr><th>Fact</th>${cols
    .map((c) => {
      const pin = c.key === 'subject' ? 'subject' : c.key.replace(/^c/, '')
      const src = c.photoUrl ? sparkPhotoAt(c.photoUrl, '320x240') ?? c.photoUrl : null
      const img = src
        ? `<img class="matrix-thumb" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>`
        : ''
      return `<th class="v" data-comp="${esc(pin)}" data-pin="${esc(pin)}">${img}<span class="matrix-addr">${esc(c.label)}</span></th>`
    })
    .join('')}</tr>`
  const body = rows.map((row, i) => {
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
    const factAttr = row.fact ? ` data-fact="${row.fact}"` : ''
    return `<tr${factAttr}><th>${esc(row.label)}</th>${tds}</tr>`
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


/** Letter screen (≤375+): summary cards. Immersive /view shows the matrix via CSS instead. Never a Subject/Sale flyer dump. */
function joinFacts(parts: Array<string | null | undefined>): string | null {
  const kept = parts.filter((p): p is string => Boolean(p && String(p).trim()))
  return kept.length ? kept.join(' · ') : null
}

function matrixStack(comps: readonly CmaAdjustedComp[]): string {
  const cards = comps
    .map((c, i) => {
      const pin = String(i + 1)
      const src = c.photoUrl ? sparkPhotoAt(c.photoUrl, '320x240') ?? c.photoUrl : null
      const img = src
        ? `<img class="matrix-thumb" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>`
        : ''
      const ppsf =
        c.sqft > 0 && c.closePrice > 0 ? `${usd(Math.round(c.closePrice / c.sqft))}/sf` : null
      const facts = joinFacts([
        c.beds != null ? `${int(c.beds)} bd` : null,
        c.baths != null ? `${dec(c.baths, c.baths % 1 !== 0 ? 1 : 0)} ba` : null,
        c.sqft > 0 ? `${int(c.sqft)} sqft` : null,
        c.yearBuilt != null ? String(c.yearBuilt) : null,
      ])
      const domLabel = c.domTotal != null ? `${int(c.domTotal)} days on market` : null
      const time = joinFacts([
        c.daysToOffer != null ? `${int(c.daysToOffer)}d to offer` : null,
        c.proximity ? c.proximity : null,
      ])
      const history =
        c.listingHistoryLine?.trim() ||
        buildListingHistoryLine({
          listPrice: c.listPrice,
          originalListPrice: c.originalListPrice,
          closePrice: c.closePrice,
          status: 'Closed',
          onMarketDate: c.onMarketDate,
          closeDate: c.closeDate,
          daysOnMarket: c.domTotal,
        })
      return `<article class="comp-stack-card" data-comp="${esc(pin)}" data-pin="${esc(pin)}">${img}<div class="comp-stack-addr">${esc(pin)}. ${esc(c.address)}</div><div class="comp-stack-sold">Sold ${esc(dateLong(c.closeDate))} · ${usd(c.closePrice)}${ppsf ? ` · ${esc(ppsf)}` : ''}</div><div class="comp-stack-nums"><span class="comp-stack-n"><span class="k">Adjusted close</span><span class="v n">${usd(c.adjustedPrice)}</span></span></div>${facts ? `<div class="comp-stack-facts">${esc(facts)}</div>` : ''}${domLabel ? `<div class="comp-stack-facts" data-fact="dom">${esc(domLabel)}</div>` : ''}${time ? `<div class="comp-stack-facts">${esc(time)}</div>` : ''}${history ? `<div class="comp-stack-facts" data-fact="listing-history">${esc(history)}</div>` : ''}</article>`
    })
    .join('')
  return `<div class="comp-stack" aria-label="Comparable sales, stacked for narrow screens">${cards}</div>`
}

export function renderCompMatrixHtml(subject: CmaSubject, comps: readonly CmaAdjustedComp[]): string {
  // Fail closed: a recommend needs ≥ MIN_CLOSED_SALES_FOR_MATRIX closed sales.
  if (comps.length < MIN_CLOSED_SALES_FOR_MATRIX) return ''
  const subj = subjectCol(subject)
  const compCols = comps.map((c, i) => compCol(c, i))
  const groups = splitEvenly(compCols)
  let seen = 0
  const tables = groups
    .map((group) => {
      const heading =
        groups.length > 1 ? `<h4 class="subhead">${esc(groupHeading(seen, group.length))}</h4>` : ''
      seen += group.length
      return `${heading}${matrixTable([subj, ...group])}`
    })
    .join('')
  const stack = matrixStack(comps)
  return `
  <h3 class="subhead">The sales that set this price</h3>
  ${tables}
  ${stack}
  <p class="small">Adjusted close moves the sale for time and size.</p>`
}

/** Fact rows shared with the sold matrix where the peer actually carries them. */
const UNSOLD_ROWS: ReadonlyArray<{ label: string; figure: boolean; fact?: 'dom' | 'listing-history' }> = [
  { label: 'Property type', figure: false },
  { label: 'Last ask', figure: true },
  { label: 'Last ask / sqft', figure: true },
  { label: 'Status', figure: false },
  { label: 'Bedrooms', figure: true },
  { label: 'Bathrooms', figure: true },
  { label: 'Living sqft', figure: true },
  { label: 'Lot sqft', figure: true },
  { label: 'Year built', figure: true },
  { label: 'Garage', figure: true },
  { label: 'Days on market', figure: true, fact: 'dom' },
  { label: 'Listing history', figure: false, fact: 'listing-history' },
]

function unsoldSubjectCol(subject: CmaSubject): Col {
  const living = subject.sqft
  const list = subject.lastListPrice
  const listSf = ppsf(list, living)
  const subjectDom = subjectDomDays(subject)
  const history =
    subject.listingHistoryLine?.trim() ||
    buildListingHistoryLine({
      listPrice: list,
      status: subject.standardStatus,
      onMarketDate: subject.lastListDate,
      daysOnMarket: subjectDom,
    }) ||
    '-'
  return {
    key: 'subject',
    label: subject.streetAddress,
    photoUrl: subject.photoUrl?.trim() || null,
    cells: [
      dash(subject.propertySubType),
      list != null ? usd(list) : '-',
      listSf != null ? `${usd(listSf)}/sf` : '-',
      dash(subject.standardStatus) || 'Subject',
      subject.beds != null ? int(subject.beds) : '-',
      subject.baths != null ? dec(subject.baths, subject.baths % 1 !== 0 ? 1 : 0) : '-',
      living != null && living > 0 ? int(living) : '-',
      lotSqft(subject.lotAcres) != null ? int(lotSqft(subject.lotAcres)!) : '-',
      subject.yearBuilt != null ? String(subject.yearBuilt) : '-',
      subject.garageSpaces != null ? int(subject.garageSpaces) : '-',
      subjectDom != null ? int(subjectDom) : '-',
      history,
    ],
  }
}

function unsoldPeerCol(peer: CmaExpiredPeer, index: number): Col {
  const listSf = ppsf(peer.listPrice, peer.sqft)
  const history =
    peer.listingHistoryLine?.trim() ||
    buildListingHistoryLine({
      listPrice: peer.listPrice,
      originalListPrice: peer.originalListPrice,
      status: peer.status,
      onMarketDate: peer.onMarketDate,
      daysOnMarket: peer.daysOnMarket,
    }) ||
    '-'
  return {
    key: `u${index + 1}`,
    label: `${index + 1}. ${peer.address}`,
    photoUrl: peer.photoUrl?.trim() || null,
    cells: [
      dash(peer.propertySubType),
      usd(peer.listPrice),
      listSf != null ? `${usd(listSf)}/sf` : '-',
      dash(peer.status),
      peer.beds != null ? int(peer.beds) : '-',
      peer.baths != null ? dec(peer.baths, peer.baths % 1 !== 0 ? 1 : 0) : '-',
      peer.sqft != null && peer.sqft > 0 ? int(peer.sqft) : '-',
      lotSqft(peer.lotAcres) != null ? int(lotSqft(peer.lotAcres)!) : '-',
      peer.yearBuilt != null ? String(peer.yearBuilt) : '-',
      '-',
      peer.daysOnMarket != null ? int(peer.daysOnMarket) : '-',
      history,
    ],
  }
}

function unsoldStack(peers: readonly CmaExpiredPeer[]): string {
  const cards = peers
    .map((p, i) => {
      const pin = String(i + 1)
      const src = p.photoUrl ? sparkPhotoAt(p.photoUrl, '320x240') ?? p.photoUrl : null
      const img = src
        ? `<img class="matrix-thumb" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"/>`
        : ''
      const askSf =
        p.sqft != null && p.sqft > 0 && p.listPrice > 0
          ? `${usd(Math.round(p.listPrice / p.sqft))}/sf`
          : null
      const facts = joinFacts([
        p.beds != null ? `${int(p.beds)} bd` : null,
        p.baths != null ? `${dec(p.baths, p.baths % 1 !== 0 ? 1 : 0)} ba` : null,
        p.sqft != null && p.sqft > 0 ? `${int(p.sqft)} sqft` : null,
        p.yearBuilt != null ? String(p.yearBuilt) : null,
        p.status ? p.status : null,
      ])
      const domLabel = p.daysOnMarket != null ? `${int(p.daysOnMarket)} days on market` : null
      const history =
        p.listingHistoryLine?.trim() ||
        buildListingHistoryLine({
          listPrice: p.listPrice,
          originalListPrice: p.originalListPrice,
          status: p.status,
          onMarketDate: p.onMarketDate,
          daysOnMarket: p.daysOnMarket,
        })
      return `<article class="comp-stack-card" data-peer="expired" data-pin="${esc(pin)}">${img}<div class="comp-stack-addr">${esc(pin)}. ${esc(p.address)}</div><div class="comp-stack-sold">Last ask ${usd(p.listPrice)}${askSf ? ` · ${esc(askSf)}` : ''}</div>${facts ? `<div class="comp-stack-facts">${esc(facts)}</div>` : ''}${domLabel ? `<div class="comp-stack-facts" data-fact="dom">${esc(domLabel)}</div>` : ''}${history ? `<div class="comp-stack-facts" data-fact="listing-history">${esc(history)}</div>` : ''}</article>`
    })
    .join('')
  return `<div class="comp-stack" aria-label="Listings in this band that did not sell">${cards}</div>`
}

/**
 * Side-by-side matrix of expired / withdrawn / canceled peers in the same band.
 * Soft-fails empty — never invents homes. Same on-screen matrix + letter stack
 * pattern as the sold comps matrix.
 */
export function renderUnsoldContrastMatrixHtml(
  subject: CmaSubject,
  peers: readonly CmaExpiredPeer[] | null | undefined,
): string {
  if (!peers || peers.length === 0) return ''
  // Peers = other listings only; collapse multi-cycle same-address columns.
  const named = collapseExpiredPeerCycles(
    peers.filter(
      (p) => p.address.trim() && p.listPrice > 0 && !peerMatchesSubject(p, subject),
    ),
  )
  if (named.length === 0) return ''
  const subj = unsoldSubjectCol(subject)
  const peerCols = named.map((p, i) => unsoldPeerCol(p, i))
  const groups = splitEvenly(peerCols)
  let seen = 0
  const tables = groups
    .map((group) => {
      const heading =
        groups.length > 1
          ? `<h4 class="subhead">${esc(
              group.length === 1
                ? `Listing ${seen + 1}`
                : `Listings ${seen + 1} through ${seen + group.length}`,
            )}</h4>`
          : ''
      seen += group.length
      return `${heading}${matrixTable([subj, ...group], UNSOLD_ROWS)}`
    })
    .join('')
  return `
  <h3 class="subhead">Expired peers — what happened</h3>
  <p>Same band. These listings came off without a sale.</p>
  ${tables}
  ${unsoldStack(named)}`
}
