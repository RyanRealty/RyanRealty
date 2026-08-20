/**
 * Side-by-side sold-comp matrix. Same grain as an RPR comparison:
 * subject in the first column, each kept sale as a column, one row per fact.
 */

import { cleanText, dateLong, dec, escapeHtml, int, usd, usdSigned } from '@/lib/cma/render-blocks'
import type { CmaAdjustedComp, CmaSubject } from '@/lib/cma/types'

const esc = escapeHtml
const ACRES_TO_SQFT = 43560

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
      int(comp.sqft),
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

const ROW_LABELS = [
  'Property type',
  'Sale price',
  'Sale price / sqft',
  'List price',
  'List price / sqft',
  'Sale date',
  'Bedrooms',
  'Bathrooms',
  'Living sqft',
  'Lot sqft',
  'Year built',
  'Garage',
  'Days on market',
  'Days to offer',
  'Distance',
  'Subdivision',
  'Brought to today',
  'Brought to your size',
  'This sale as your house',
]

export function renderCompMatrixHtml(subject: CmaSubject, comps: readonly CmaAdjustedComp[]): string {
  if (comps.length === 0) return ''
  const cols = [subjectCol(subject), ...comps.map((c, i) => compCol(c, i))]
  const head = `<tr><th>Fact</th>${cols.map((c) => `<th class="v">${esc(c.label)}</th>`).join('')}</tr>`
  const body = ROW_LABELS.map((label, i) => {
    const subjectVal = cols[0]!.cells[i] ?? '-'
    const tds = cols
      .map((c, ci) => {
        const val = c.cells[i] ?? '-'
        const diff = ci > 0 && val !== subjectVal && val !== '-' && subjectVal !== '-'
        return `<td class="v${diff ? ' is-diff' : ''}">${esc(val)}</td>`
      })
      .join('')
    return `<tr><th>${esc(label)}</th>${tds}</tr>`
  }).join('')
  return `
  <h3 class="subhead">Side by side</h3>
  <p>Subject in the first column. Each kept sale is a column. Sale date is when that house closed. This sale as your house is the sold price after bringing that sale to today and to your living area. It is not a second list price. Sale price per square foot is close price over living area. Lot square feet is acres times 43,560.</p>
  <div class="comp-matrix-wrap">
    <table class="kv is-wide comp-matrix">
      <thead>${head}</thead>
      <tbody>${body}</tbody>
    </table>
  </div>`
}
