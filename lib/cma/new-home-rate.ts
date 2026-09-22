/**
 * A lived-in house priced against houses built this year or last year.
 *
 * The comparison is close price divided by living area, on the sales this
 * letter already prints, limited to homes about the subject's size. A newer
 * house does not raise the range unless these sales themselves show that
 * premium. One sale is named. It is not treated as a market-wide rate.
 */

import { usd } from '@/lib/cma/render-blocks'

const SIZE = 0.15

export type NewHomeSale = {
  address: string
  yearBuilt: number | null
  closePrice: number
  sqft: number
}

export type NewHomeRival = {
  address: string
  yearBuilt: number | null
  listPrice: number
  sqft: number | null
}

export type NewHomeRateInput = {
  subjectYear: number | null
  subjectSqft: number | null
  asOfIso: string
  /** The printed value range, so a listing is "this price" only inside it. */
  rangeLow: number | null
  rangeHigh: number | null
  comps: readonly NewHomeSale[]
  rivals?: readonly NewHomeRival[]
}

function yearOf(iso: string): number | null {
  const y = Number(iso.slice(0, 4))
  return Number.isInteger(y) && y > 1900 ? y : null
}

function similar(sqft: number | null, subject: number | null): boolean {
  if (subject == null || !(subject > 0) || sqft == null || !(sqft > 0)) return false
  return sqft >= subject * (1 - SIZE) && sqft <= subject * (1 + SIZE)
}

function perFoot(price: number, sqft: number): number | null {
  if (!(price > 0) || !(sqft > 0)) return null
  return Math.round(price / sqft)
}

function moneyList(values: number[]): string {
  const s = [...values].sort((a, b) => a - b)
  if (s.length === 0) return ''
  if (s.length === 1) return usd(s[0]!)
  if (s.length === 2) return `${usd(s[0]!)} and ${usd(s[1]!)}`
  return `${s.slice(0, -1).map((n) => usd(n)).join(', ')}, and ${usd(s[s.length - 1]!)}`
}

function yearList(years: number[]): string {
  const s = [...new Set(years)].sort((a, b) => a - b)
  if (s.length === 0) return ''
  if (s.length === 1) return String(s[0])
  if (s.length === 2) return `${s[0]} or ${s[1]}`
  return `${s.slice(0, -1).join(', ')}, or ${s[s.length - 1]}`
}

/**
 * The paragraph, or null when this home is not the older one in a set of
 * newer sales about its size.
 */
export function newHomeRateParagraph(input: NewHomeRateInput): string | null {
  const asOf = yearOf(input.asOfIso)
  const subjectYear = input.subjectYear
  if (asOf == null || subjectYear == null || subjectYear < 1850) return null
  const newFrom = asOf - 1
  if (subjectYear >= newFrom) return null
  const newer = input.comps.filter(
    (c) => c.yearBuilt != null && c.yearBuilt >= newFrom && similar(c.sqft, input.subjectSqft),
  )
  if (newer.length === 0) return null
  const newerRates = newer
    .map((c) => perFoot(c.closePrice, c.sqft))
    .filter((n): n is number => n != null)
  if (newerRates.length === 0) return null
  const peers = input.comps.filter(
    (c) =>
      c.yearBuilt != null &&
      c.yearBuilt < newFrom &&
      Math.abs(c.yearBuilt - subjectYear) <= 1 &&
      similar(c.sqft, input.subjectSqft),
  )
  const peerRates = peers
    .map((c) => ({ address: c.address, year: c.yearBuilt!, rate: perFoot(c.closePrice, c.sqft) }))
    .filter((p): p is { address: string; year: number; rate: number } => p.rate != null)

  const lo = input.rangeLow
  const hi = input.rangeHigh
  const inRange = (price: number) =>
    lo != null && hi != null && lo > 0 && hi > 0
      ? price >= Math.min(lo, hi) && price <= Math.max(lo, hi)
      : false
  const listed = (input.rivals ?? []).filter(
    (r) =>
      r.yearBuilt != null &&
      r.yearBuilt >= newFrom &&
      r.sqft != null &&
      similar(r.sqft, input.subjectSqft) &&
      inRange(r.listPrice),
  )

  const count = newer.length === 1 ? 'One of these sales was' : `${newer.length} of these sales were`
  const bits = [
    `Your home was built in ${subjectYear}.`,
    `${count} built in ${yearList(newer.map((c) => c.yearBuilt!))} and about this size. They closed at ${moneyList(newerRates)} a square foot.`,
  ]
  if (peerRates.length === 1) {
    const p = peerRates[0]!
    bits.push(
      `${p.address}, built in ${p.year} like yours, closed at ${usd(p.rate)} a square foot.`,
    )
    const newerMed = [...newerRates].sort((a, b) => a - b)[Math.floor(newerRates.length / 2)]!
    if (newerMed <= p.rate) {
      bits.push(
        'The newer houses in this set did not sell for more per square foot, so the range is not raised because a house is new.',
      )
    } else {
      bits.push(
        'The newer houses closed for more per square foot. One sale from your year is not enough to move the range for that, so the gap is shown and not applied.',
      )
    }
  } else if (peerRates.length >= 2) {
    bits.push(
      `The sales built in ${yearList(peerRates.map((p) => p.year))} closed at ${moneyList(peerRates.map((p) => p.rate))} a square foot.`,
    )
  }
  if (listed.length === 1) {
    const r = listed[0]!
    const rate = perFoot(r.listPrice, r.sqft!)
    if (rate != null) {
      bits.push(
        `${r.address}, built in ${r.yearBuilt}, is listed at ${usd(r.listPrice)}, ${usd(rate)} a square foot.`,
      )
    }
  } else if (listed.length > 1) {
    const rates = listed
      .map((r) => perFoot(r.listPrice, r.sqft!))
      .filter((n): n is number => n != null)
    bits.push(
      `${listed.length} houses built in ${yearList(listed.map((r) => r.yearBuilt!))} are listed in this range, at ${moneyList(rates)} a square foot.`,
    )
  }
  return bits.join(' ')
}
