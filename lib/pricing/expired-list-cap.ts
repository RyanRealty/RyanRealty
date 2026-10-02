/**
 * Failed-listing list-price cap.
 *
 * A home that Expired / Withdrew / Canceled already told the market its ask.
 * A CMA or BPO that then recommends listing ABOVE that ask is the document
 * telling the owner to retry the price that just failed. The engine may still
 * compute a higher comp-supported number; the printed list band is clipped
 * to the failed ask. The recommendation is under that ask, not on it.
 * Above is not allowed either. A band already under the ask is left alone.
 *
 * Live (Active / Pending) and Closed subjects are untouched:
 * a live ask is shown beside the comps (never blended), and a closed sale
 * is not a failed ask.
 */

import { priceUnderFailedAsk } from '@/lib/pricing/failed-ask-under'

export type FailedAskSubject = {
  lastListPrice: number | null | undefined
  standardStatus: string | null | undefined
}

export type ListBand = {
  conservative: number
  recommended: number
  highEnd: number
}

const FAILED_STATUS = /^(expired|withdrawn|canceled|cancelled)$/i

function money(n: unknown): number | null {
  if (n == null) return null
  const v = typeof n === 'number' ? n : Number(n)
  return Number.isFinite(v) && v > 0 ? v : null
}

/** True when MLS status is a failed (unsold, off-market) listing. */
export function isFailedListingStatus(status: string | null | undefined): boolean {
  return FAILED_STATUS.test((status ?? '').trim())
}

/**
 * The ask that failed to sell, or null when this subject is not a failed listing.
 * `lastListPrice` on an Active or Closed row is not a failed ask.
 */
export function failedListAsk(subject: FailedAskSubject): number | null {
  if (!isFailedListingStatus(subject.standardStatus)) return null
  return money(subject.lastListPrice)
}

/**
 * Clip a list band so no printed list number sits above the failed ask.
 * Preserves conservative ≤ recommended ≤ highEnd.
 */
export function capListBandToFailedAsk(
  band: ListBand,
  failedAsk: number | null | undefined,
): ListBand & { capped: boolean; failedAsk: number | null } {
  const cap = money(failedAsk)
  if (cap == null) return { ...band, capped: false, failedAsk: null }
  const recommended = band.recommended >= cap ? priceUnderFailedAsk(cap) : band.recommended
  const highEnd = band.highEnd >= cap ? recommended : Math.max(band.highEnd, recommended)
  const conservative = Math.min(band.conservative, recommended)
  const capped =
    conservative !== band.conservative || recommended !== band.recommended || highEnd !== band.highEnd
  return { conservative, recommended, highEnd, capped, failedAsk: cap }
}
