/**
 * Listing-hero compact price + key stats.
 *
 * Compact prices that thousands-round across $1M printed `$1000K`
 * (195 Roosevelt, MLS 220225285, $999,900). Land / farm listings
 * with a real lot size and no beds/baths/sqft printed price only
 * (33725 Columbus 19.77 acres, 0 Kouns Drive 1.35 acres).
 *
 * Founding fingerprints: 2ceabe03a3cc759cc09d94d2bd1e442a,
 * 639e24f1d222997d0f59f2e137981de8, 57b38d188f133fe2c93c05ca6150d5d9.
 *
 * Do not invent beds or a second MLS row. Acres print only when
 * living-area stats are absent and the lot size is verified.
 */

import { formatPriceCompact } from '@/lib/format/money'

function isPositive(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0
}

function formatAcres(n: number): string {
  const rounded = Math.round(n * 100) / 100
  return `${rounded} acres`
}

export function publishListingHeroCompactPrice(
  listPrice: number | null | undefined,
): string | null {
  if (listPrice == null || !Number.isFinite(listPrice) || listPrice <= 0) return null
  const compact = formatPriceCompact(listPrice)
  if (/\$\d{4,}K/.test(compact)) return null
  return compact
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
