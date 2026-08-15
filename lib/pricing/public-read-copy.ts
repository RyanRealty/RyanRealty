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

/** Refuse copy for the HouseMe block, including stamp reasons the old range card hid. */
export function housemeRefuseCopy(reason: PublicRefuseReason): string | null {
  const shown = refuseCopy(reason)
  if (shown) return shown
  if (reason === 'facts-not-ready') return 'The facts for this read are not ready.'
  if (reason === 'no-gla') return 'No living area on file. This page will not guess a number.'
  return null
}

export const PUBLIC_READ_DISCLAIMER =
  'This is an estimate, not an appraisal. It is not a guarantee of price.'

export const PUBLIC_READ_EYEBROW = 'Our read'
export const PUBLIC_READ_TITLE = 'How the ask sits against nearby sales'
export const PUBLIC_READ_TITLE_UNLISTED = 'What nearby sales imply'
export const PUBLIC_READ_TITLE_REFUSE = 'Why this page has no number'

export const HOUSEME_EYEBROW = 'This house'
export const HOUSEME_TITLE_FACTS = 'What this listing shows'
export const HOUSEME_LABEL_READ = 'Versus the ask'
export const HOUSEME_LABEL_READ_UNLISTED = 'Nearby sales'
export const HOUSEME_LABEL_READ_REFUSE = 'Why no number'
export const HOUSEME_LABEL_COMPS = 'Comps'
export const HOUSEME_LABEL_PPSF = 'Price per sq ft'
export const HOUSEME_LABEL_DOM = 'Days on market'
export const HOUSEME_LABEL_TRUE_COST = 'True cost'
export const HOUSEME_LABEL_INVESTMENT = 'Rent'
