/**
 * WHAT THE ADU ADDS (Matt 2026-10-14, second call).
 *
 * A home with a recorded accessory dwelling unit is priced in two parts: the
 * main home against the sales in the grid, and the unit on its own, from
 * nearby homes that sold with one (lib/pricing/adu-value.ts). This chapter
 * shows that second read: the paired sales, what each unit brought per square
 * foot of unit, the lower-quartile rate the price uses, and the dollars it
 * adds. Under five pairs it says the unit adds nothing and why.
 *
 * It also prints the duplex cross-check, one line, when the home's earlier
 * record typed it two to four units: the multi-unit ladder's figure beside
 * the price, never as the price (`pricing.multiUnitCrossCheck`).
 *
 * Every figure is read off the stored row (lib/cma/render-contract.ts) and
 * printed as stored. Nothing here computes a dollar: a row the readers reject
 * prints no chapter, and the grid's ADU row still shows the move each sale
 * carried.
 */

import { countWord, dateLong, escapeHtml, int, usd, usdSigned } from '@/lib/cma/render-blocks'
import { readStoredAduValue, readMultiUnitCrossCheck, type AduValueRead, type MultiUnitCrossCheckRead } from '@/lib/cma/render-contract'
import { movesADollar } from '@/lib/cma/adjustments-applied'
import type { CmaAdjustedComp, CmaPricing, CmaSubject } from '@/lib/cma/types'

const esc = escapeHtml

export const ADU_CHAPTER_HEADING = 'What the ADU adds'
export const ADU_CHAPTER_KICK = 'The unit'

/** "Seven" from "seven": the count that opens a sentence. */
function cap(s: string): string {
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}` : s
}

/** "a mile", "two miles". */
export function radiusWords(miles: number): string {
  if (miles === 1) return 'a mile'
  if (miles === 2) return 'two miles'
  return `${miles} miles`
}

/** The ADU dollars the cover carries, when the price includes them. */
export function aduDollarsOnCover(pricing: CmaPricing | null | undefined): { dollars: number; sqft: number } | null {
  const v = readStoredAduValue(pricing)
  if (!v || v.dollars == null || !(v.dollars > 0)) return null
  return { dollars: v.dollars, sqft: v.subjectAduSqft }
}

/** Over every pair the rate was read from, not only the printed list (the stored low and high; else the list). */
function perFootRange(v: AduValueRead): { low: number; high: number } | null {
  if (v.perSqftLow != null && v.perSqftHigh != null) return { low: v.perSqftLow, high: v.perSqftHigh }
  const rates = v.pairs.map((p) => p.aduPerSqft).filter((n) => Number.isFinite(n))
  if (rates.length === 0) return null
  return { low: Math.min(...rates), high: Math.max(...rates) }
}

function windowClause(v: AduValueRead): string {
  return v.windowMonths != null && v.windowMonths > 0 ? ` in the last ${int(v.windowMonths)} months` : ''
}

/** The paragraphs for a read that reached the rate. */
function ratedParagraphs(v: AduValueRead, rate: NonNullable<AduValueRead['rate']>, dollars: number): string[] {
  const range = perFootRange(v)
  const spread = range ? `${money(range.low)} to ${money(range.high)} a square foot of unit, ${money(rate.median)} at the middle` : `${money(rate.median)} a square foot of unit at the middle`
  return [
    `${cap(countWord(v.pairsCounted))} homes within ${radiusWords(v.radiusMiles)} of yours sold with an ADU${windowClause(v)} and could be read this way. For each, the main home was priced against plain sales of its own era and size, and what was left of the sale price is what its unit brought: ${spread}.`,
    `The price uses the lower quartile, ${usd(rate.lowerQuartile)} a foot, not the middle, so the unit is never the reason the price is high. Times your ${int(v.subjectAduSqft)} square feet, that adds ${usd(dollars)}. Each sale above without a unit is moved up by that amount, and a sale with its own unit is moved only for the difference in unit area.`,
  ]
}

/** A pair whose baseline overshot reads below zero; the minus sign is the grid's (usdSigned), not a hyphen. */
const money = (n: number) => (n < 0 ? usdSigned(n) : usd(n))

/** The sentence for a read that reached five pairs whose lower quartile is at or below zero. */
function noDollarsSentence(v: AduValueRead, rate: NonNullable<AduValueRead['rate']>): string {
  const range = perFootRange(v)
  const spread = range ? `${money(range.low)} to ${money(range.high)} a square foot of unit` : `${money(rate.median)} a square foot of unit at the middle`
  return `${cap(countWord(v.pairsCounted))} homes within ${radiusWords(v.radiusMiles)} of yours sold with an ADU${windowClause(v)} and could be read against plain sales of their own era and size. What their units brought runs from ${spread}, and the lower quartile, ${money(rate.lowerQuartile)} a foot, is at or below zero, so the unit adds no dollars here. The price above reads your home as the sales above read theirs.`
}

/** The sentence for a read that fell short of the rate. */
function shortSentence(v: AduValueRead): string {
  if (v.aduSalesSeen === 0) {
    return `No home within ${radiusWords(v.radiusMiles)} of yours sold with an ADU${windowClause(v)}, so the unit cannot be priced on its own and adds no dollars here. The price above reads your home as the sales above read theirs.`
  }
  const read = v.pairsCounted === 0 ? 'none' : countWord(v.pairsCounted)
  return `Within ${radiusWords(v.radiusMiles)} of your home, ${countWord(v.aduSalesSeen)} ${v.aduSalesSeen === 1 ? 'home' : 'homes'} sold with an ADU${windowClause(v)}, and ${read} could be read against plain sales of ${v.pairsCounted === 1 ? 'its' : 'their'} own era and size. ${cap(countWord(v.minimumPairs))} are needed for a rate, so the unit adds no dollars here. The price above reads your home as the sales above read theirs, and the unit is not priced on its own.`
}

function pairsTableHtml(v: AduValueRead): string {
  if (v.pairs.length === 0) return ''
  const head = ['Home', 'Sold', 'Sale price', 'Main home', 'ADU', 'Unit brought', 'Per sq ft']
  const rows = v.pairs
    .map((p) => {
      const cells = [
        esc(p.address),
        p.closeDate ? esc(dateLong(p.closeDate)) : '-',
        usd(p.closePrice),
        p.mainValue != null ? usd(p.mainValue) : '-',
        `${int(p.aduSqft)} sq ft`,
        usdSigned(p.aduDollars),
        usdSigned(p.aduPerSqft),
      ]
      return `<tr><th scope="row">${cells[0]}</th>${cells
        .slice(1)
        .map((c) => `<td class="v n">${c}</td>`)
        .join('')}</tr>`
    })
    .join('')
  const plainFloor = Math.min(...v.pairs.map((p) => p.plainComps ?? Number.POSITIVE_INFINITY))
  const floorClause = Number.isFinite(plainFloor) ? `at least ${countWord(plainFloor)} ` : ''
  const capped = v.pairsCounted > v.pairs.length ? `The nearest ${countWord(v.pairs.length)} of the ${countWord(v.pairsCounted)} pairs are listed. ` : ''
  return `
  <table class="kv is-wide adu-pairs">
    <thead><tr>${head.map((h, i) => `<th${i > 0 ? ' class="n"' : ''}>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="small">${esc(
    `${capped}Main home is the sale's main-home area (its living area on record, or the remarks' main-home figure where the record counted both units) at the median price per square foot of ${floorClause}plain sales near it, in its era and size band. Unit brought is the sale price less that figure. The unit's area is the MLS ADU field, or the listing remarks where the field is blank.`,
  )}</p>`
}

/**
 * The duplex cross-check, one line. The ladder's figure sits beside the
 * price as a check and the sentence says so; a ladder that could not price
 * says that instead, naming no count it does not hold.
 */
export function duplexCrossCheckSentence(x: MultiUnitCrossCheckRead, subject: Pick<CmaSubject, 'streetAddress'>): string {
  const kind = x.propertySubType.toLowerCase()
  // The area is the reading's, not the earlier record's: that record may have
  // stated another figure, and the basis names where this one came from.
  const area = x.sqft != null && x.sqft > 0 ? ` over ${int(x.sqft)} square feet${x.sqftBasis ? ` (${x.sqftBasis})` : ''}` : ''
  const read = `A check beside the price: an earlier MLS record typed ${subject.streetAddress} as a ${kind}.`
  if (x.recommended == null || !(x.recommended > 0)) {
    return `${read} Read that way${area}, too few closed sales of that kind were found to price it, so no ${kind} figure is set beside the price.`
  }
  const band =
    x.valueLow != null && x.valueHigh != null && x.valueLow > 0 && x.valueHigh > 0 ? ` (${usd(x.valueLow)} to ${usd(x.valueHigh)})` : ''
  // The class pass prices from every two- to four-unit sale, not the kind alone.
  const sales = x.outcome === 'class' ? 'two- to four-unit' : kind
  return `${read} Read that way${area}, ${countWord(x.compsHeld)} closed ${sales} ${x.compsHeld === 1 ? 'sale puts' : 'sales put'} it at ${usd(x.recommended)}${band} before the comparability review. The current record lists a house with a unit, and that is the price above; the ${kind} read is printed so you can see both.`
}

/**
 * How each printed sale was read on the ADU line, off the grid's own basis
 * strings (lib/pricing/adu-value.ts applyAduAdjustments): which sales had a
 * unit, what area, and where a record counted both units. Empty when no sale
 * carries a basis.
 */
export function aduSaleLinesHtml(comps: readonly CmaAdjustedComp[] | null | undefined): string {
  const rows = (comps ?? []).filter((c) => typeof c.aduAdjustmentBasis === 'string' && c.aduAdjustmentBasis.trim() && c.aduAdjustment != null)
  if (rows.length === 0) return ''
  const items = rows
    .map((c) => `<li>${esc(c.address)}: ${esc(c.aduAdjustmentBasis!.trim())}, ${esc(usdSigned(c.aduAdjustment!))}.</li>`)
    .join('')
  return `
  <p>How each sale above was read on the ADU line:</p>
  <ul class="adu-sale-lines">${items}</ul>`
}

/** The chapter body, or '' when the row carries neither read. */
export function aduChapterBodyHtml(a: { subject: CmaSubject; pricing: CmaPricing; comps?: readonly CmaAdjustedComp[] | null }): string {
  const v = readStoredAduValue(a.pricing)
  const x = readMultiUnitCrossCheck(a.pricing)
  if (!v && !x) return ''
  const parts: string[] = []
  if (v) {
    parts.push(
      `<p>${esc(
        `Your home carries a ${int(v.subjectAduSqft)} square foot accessory dwelling unit. Its price is read in two parts: the main home against the sales above, and the unit on its own, from homes near you that sold with one.`,
      )}</p>`,
    )
    if (v.rate && v.dollars != null) {
      parts.push(...ratedParagraphs(v, v.rate, v.dollars).map((s) => `<p>${esc(s)}</p>`))
      parts.push(pairsTableHtml(v))
      parts.push(aduSaleLinesHtml(a.comps))
    } else if (v.rate) {
      parts.push(`<p>${esc(noDollarsSentence(v, v.rate))}</p>`)
    } else {
      parts.push(`<p>${esc(shortSentence(v))}</p>`)
    }
  }
  if (x) parts.push(`<p>${esc(duplexCrossCheckSentence(x, a.subject))}</p>`)
  return parts.filter(Boolean).join('\n  ')
}

/**
 * The Basis sentences on the ADU line, read off the grid: printed only when
 * a sale above actually moved for the unit, and only when the row carries the
 * read the dollars came from.
 */
export function aduMethodSentences(pricing: CmaPricing, comps: readonly CmaAdjustedComp[]): string[] {
  if (!comps.some((c) => movesADollar(c.aduAdjustment))) return []
  const v = readStoredAduValue(pricing)
  if (!v || v.rate == null || v.dollars == null) return []
  return [
    `Each sale without an ADU is moved up by ${usd(v.dollars)}, what your ${int(v.subjectAduSqft)} square foot unit adds at ${usd(v.rate.lowerQuartile)} a foot, the lower quartile of ${countWord(v.pairsCounted)} paired sales within ${radiusWords(v.radiusMiles)}. A sale with its own unit is moved only for the difference in unit area.`,
  ]
}
