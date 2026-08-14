/**
 * Public listing-page sentences for the live pricing read.
 *
 * Voice: state the fact, then stop. Estimate, not an appraisal. Never print
 * the comps-implied close as the price of a listed home.
 */

import type { PublicRefuseReason } from '@/lib/pricing/public-contract'

export function overUnderPhrase(deltaPct: number): string {
  const pct = Math.round(Math.abs(deltaPct) * 100)
  if (pct < 1) return 'in line with the ask'
  if (deltaPct < 0) return `${pct}% under the ask`
  return `${pct}% over the ask`
}

export function listedReadSentence(n: number, deltaPct: number): string {
  const sales = n === 1 ? 'sale' : 'sales'
  return `Nearby ${sales} put a close in this range. That is ${overUnderPhrase(deltaPct)}.`
}

export function unlistedReadSentence(n: number): string {
  const sales = n === 1 ? 'sale' : 'sales'
  return `Nearby ${sales} put a close in this range.`
}

export function evidenceLine(n: number): string {
  const sales = n === 1 ? 'sale' : 'sales'
  return `From ${n} closed ${sales}. The full analysis names each one.`
}

export function refuseCopy(reason: PublicRefuseReason): string | null {
  if (reason === 'thin-set') return 'Not enough nearby sales to put a number on this page.'
  if (reason === 'new-construction') {
    return 'This is new construction. Older sales are the wrong set for a tight number.'
  }
  if (reason === 'builder-phase') {
    return 'This plat is still in a numbered builder phase. Same-plan sales move on their own.'
  }
  return null
}

export const PUBLIC_READ_DISCLAIMER =
  'This is an estimate, not an appraisal. It is not a guarantee of price.'

export const PUBLIC_READ_EYEBROW = 'Our read'
export const PUBLIC_READ_TITLE = 'How the ask sits against nearby sales'
export const PUBLIC_READ_TITLE_UNLISTED = 'What nearby sales imply'
export const PUBLIC_READ_TITLE_REFUSE = 'Why this page has no number'
