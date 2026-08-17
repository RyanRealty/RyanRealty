/**
 * One published asking price for a listing.
 *
 * Hero used `<Price>` (nearest thousand). JSON-LD and payment used the MLS
 * ListPrice. $424,990 printed as $425,000 next to offers.price 424990.
 * A drop line rounded the delta separately ($16,000 from $645,000 = $629,000
 * next to ask $630,000 / JSON-LD $629,500). Fleet listing-detail punch 2026-08-17.
 *
 * The published ask is the exact whole-dollar ListPrice. Drop is exact
 * original minus exact ask. Do not thousand-round either under the same label.
 *
 * A positive ListPrice that thousand-rounds to $0 ($1.08 / $2.40 commercial
 * rows on Old Bend / Old Farm under-$X cards) is withheld. Printing $0 next
 * to a real ask is a different number. Fleet listing-detail punch 2026-08-17.
 */

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
  if (ask == null) return null
  // formatPrice / brand thousand-round would print $0. That is not the ask.
  if (Math.round(ask / 1000) * 1000 === 0) return null
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
