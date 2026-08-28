/**
 * Listing-hero price + key stats.
 *
 * Hero used a compact $569K next to the body $568,900 (2949 Flagstone).
 * The published ask is the exact whole-dollar ListPrice, same as the
 * price strip. Compact K/M rounding is gone from this hero.
 *
 * Land / farm listings with a real lot size and no beds/baths/sqft
 * printed price only (33725 Columbus 19.77 acres, 0 Kouns Drive 1.35 acres).
 *
 * Do not invent beds or a second MLS row. Acres print only when
 * living-area stats are absent and the lot size is verified.
 */

import { publishMoneyText } from '@/lib/listing/publish-listing-figure'

function isPositive(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0
}

function formatAcres(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return `${rounded} acres`
}

export function publishListingHeroPrice(
  listPrice: number | null | undefined,
): string | null {
  return publishMoneyText(listPrice, 'exact')
}

/** Same exact dollars as publishListingHeroPrice. Kept for existing callers. */
export function publishListingHeroCompactPrice(
  listPrice: number | null | undefined,
): string | null {
  return publishListingHeroPrice(listPrice)
}

export function publishListingHeroKeyStats(input: {
  beds?: number | null
  baths?: number | null
  sqft?: number | null
  acres?: number | null
}): string[] {
  const stats: string[] = []
  if (isPositive(input.beds)) stats.push(`${input.beds} bd`)
  if (isPositive(input.baths)) stats.push(`${input.baths} ba`)
  if (isPositive(input.sqft)) stats.push(`${Math.round(input.sqft).toLocaleString('en-US')} sqft`)
  if (stats.length === 0 && isPositive(input.acres)) stats.push(formatAcres(input.acres))
  return stats
}
