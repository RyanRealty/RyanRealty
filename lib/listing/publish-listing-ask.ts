/**
 * One published asking price for a listing.
 *
 * Hero used `<Price>` (nearest thousand). JSON-LD and payment used the MLS
 * ListPrice. $424,990 printed as $425,000 next to offers.price 424990.
 * A drop line rounded the delta separately ($16,000 from $645,000 = $629,000
 * next to ask $630,000 / JSON-LD $629,500). Fleet listing-detail punch 2026-08-17.
 *
 * Spark type G (commercial) stores lease crumbs in ListPrice ($1.08 / $1.20 /
 * $2.40). `formatPrice` thousand-rounds those to $0 on homes-for-sale cards
 * (725 Broadway, 61400 American, 20748 Carmen). A public sale ask is the
 * exact whole-dollar ListPrice at or above MIN_PUBLIC_SALE_ASK. Below that
 * floor, withhold — do not print $0 or $2 as a home price.
 *
 * Drop is exact original minus exact ask. Do not thousand-round either
 * under the same label.
 */

/** Spark lease crumbs and $0 ListPrice are not a public home ask. */
export const MIN_PUBLIC_SALE_ASK = 1000

export type PublishedListingAsk = {
  ask: number
}

export type PublishedListingDrop = {
  ask: number
  original: number
  drop: number
}

function asPositivePrice(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null
  return Math.round(value)
}

export function publishListingAsk(listPrice: number | null | undefined): PublishedListingAsk | null {
  const ask = asPositivePrice(listPrice)
  if (ask == null || ask < MIN_PUBLIC_SALE_ASK) return null
  return { ask }
}

export function publishListingDrop(input: {
  listPrice: number | null | undefined
  originalListPrice: number | null | undefined
}): PublishedListingDrop | null {
  const ask = asPositivePrice(input.listPrice)
  const original = asPositivePrice(input.originalListPrice)
  if (ask == null || original == null || original <= ask) return null
  return { ask, original, drop: original - ask }
}

export function formatListingAsk(ask: number): string {
  return `$${ask.toLocaleString('en-US')}`
}
