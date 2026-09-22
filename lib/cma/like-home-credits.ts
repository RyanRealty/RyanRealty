/**
 * What homes like this one actually credited the buyer.
 *
 * A median across the price comps mixes a new house's builder credit with a
 * house that has been lived in. This keeps the subdivision, the size, and the
 * year, and it does not turn those sales into one number to subtract.
 */

import { resolveConcessions } from '@/lib/pricing/seller-net'

const SIZE = 0.15
const YEAR = 1
const MONTHS = 18

export type LikeHomeSale = {
  address: string
  subdivision: string | null
  yearBuilt: number | null
  sqft: number | null
  closeDate: string
  concessionsAmount: number | null
  concessionsYn: string | null
}

export type LikeHomeCredit = {
  place: string
  from: string
  to: string
  sqftLow: number
  sqftHigh: number
  yearLow: number
  yearHigh: number
  sales: Array<{ address: string; yearBuilt: number; concessions: number }>
  sentence: string
  source: string
}

function usd(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`
}

/** "Countryside Phase 2" is Countryside. A name with no phase stays whole. */
export function subdivisionFamily(name: string | null | undefined): string | null {
  const t = (name ?? '').trim()
  if (!t) return null
  const head = t.split(/\s+phase\b/i)[0]?.trim()
  return head || t
}

function monthsBefore(iso: string, months: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return ''
  d.setUTCMonth(d.getUTCMonth() - months)
  return d.toISOString().slice(0, 10)
}

function shortDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  if (!y || !m || !d) return iso
  return `${months[m - 1]} ${d}, ${y}`
}

function yearWords(years: number[]): string {
  const u = [...new Set(years)].sort((a, b) => a - b)
  if (u.length === 0) return ''
  if (u.length === 1) return `built in ${u[0]}`
  if (u.length === 2) return `built in ${u[0]} or ${u[1]}`
  return `built in ${u.slice(0, -1).join(', ')} or ${u[u.length - 1]}`
}

function andList(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? ''
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

function countWord(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

const SMALL = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']

function numWord(n: number): string {
  return SMALL[n] ?? n.toLocaleString('en-US')
}

export type LikeHomeBounds = {
  place: string
  from: string
  to: string
  sqftLow: number
  sqftHigh: number
  yearLow: number
  yearHigh: number
}

export function likeHomeBounds(args: {
  subdivision: string | null | undefined
  yearBuilt: number | null | undefined
  sqft: number | null | undefined
  asOf: string
}): LikeHomeBounds | null {
  const place = subdivisionFamily(args.subdivision)
  const year = args.yearBuilt
  const sqft = args.sqft
  const asOf = args.asOf.slice(0, 10)
  if (!place || year == null || !(sqft != null && sqft > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) return null
  const from = monthsBefore(asOf, MONTHS)
  if (!from) return null
  return {
    place,
    from,
    to: asOf,
    sqftLow: Math.round(sqft * (1 - SIZE)),
    sqftHigh: Math.round(sqft * (1 + SIZE)),
    yearLow: year - YEAR,
    yearHigh: year + YEAR,
  }
}

export function likeHomeCredits(args: {
  subdivision: string | null | undefined
  yearBuilt: number | null | undefined
  sqft: number | null | undefined
  asOf: string
  rows: readonly LikeHomeSale[]
}): LikeHomeCredit | null {
  const bounds = likeHomeBounds(args)
  if (!bounds) return null
  const { place, from, to: asOf, sqftLow, sqftHigh, yearLow, yearHigh } = bounds
  const family = place.toLowerCase()
  const sales = args.rows
    .map((r) => {
      const concessions = resolveConcessions({
        amount: r.concessionsAmount,
        yn: r.concessionsYn,
        closeDate: r.closeDate,
      })
      return { ...r, concessions }
    })
    .filter((r) => {
      const sub = (r.subdivision ?? '').trim().toLowerCase()
      const close = r.closeDate.slice(0, 10)
      return (
        sub.startsWith(family) &&
        r.yearBuilt != null &&
        r.yearBuilt >= yearLow &&
        r.yearBuilt <= yearHigh &&
        r.sqft != null &&
        r.sqft >= sqftLow &&
        r.sqft <= sqftHigh &&
        close >= from &&
        close <= asOf &&
        r.concessions != null &&
        r.address.trim()
      )
    })
    .map((r) => ({
      address: r.address.trim(),
      yearBuilt: r.yearBuilt as number,
      concessions: r.concessions as number,
    }))
    .sort((a, b) => a.concessions - b.concessions || a.address.localeCompare(b.address))
  if (sales.length === 0) return null
  const given = sales.filter((s) => s.concessions > 0)
  const none = sales.length - given.length
  const n = sales.length
  const home = countWord(n, 'house', 'houses')
  const verb = countWord(n, 'has', 'have')
  const lead = `${numWord(n)} ${place} ${home} about this size, ${yearWords(
    sales.map((s) => s.yearBuilt),
  )}, ${verb} sold in the last 18 months.`
  let rest: string
  if (given.length === 0) {
    rest =
      n === 1
        ? 'It gave the buyer nothing, so nothing is taken off here for a credit.'
        : 'None of them gave the buyer a credit, so nothing is taken off here for one.'
  } else if (none === 0) {
    rest = `${andList(given.map((s) => `${s.address} gave ${usd(s.concessions)}`))}. Nothing is taken off here for a credit.`
  } else if (given.length === 1) {
    const one = given[0]!
    const quiet =
      none === 1 ? 'The other one gave the buyer nothing' : `${numWord(none)} gave the buyer nothing`
    rest = `${quiet}. ${one.address} gave ${usd(one.concessions)}, so nothing is taken off here for a credit.`
  } else {
    const other = none === 1 ? 'The other one gave the buyer nothing' : `The other ${none} gave the buyer nothing`
    rest = `${andList(given.map((s) => `${s.address} gave ${usd(s.concessions)}`))}. ${other}, so nothing is taken off here for a credit.`
  }
  return {
    place,
    from,
    to: asOf,
    sqftLow,
    sqftHigh,
    yearLow,
    yearHigh,
    sales,
    sentence: `${lead} ${rest}`,
    source: `${n} closed ${countWord(n, 'sale', 'sales')} in ${place}, ${sqftLow.toLocaleString('en-US')} to ${sqftHigh.toLocaleString('en-US')} sqft, built ${yearLow} to ${yearHigh}, from ${shortDate(from)} to ${shortDate(asOf)}. Oregon Data Share MLS.`,
  }
}
