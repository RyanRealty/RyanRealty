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
 */

import { publishSaleAskAmount } from '@/lib/listing/publish-listing-figure'
import { computeMonthlyPiti, type MonthlyPitiInput } from '@/lib/listing-tier1'

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
  return { ask }
}

/**
 * The published asking SALE price for a listing whose property type is known.
 *
 * Every listing-detail surface uses this rather than publishListingAsk(number),
 * because ListPrice does not always mean an asking sale price. On MLS
 * PropertyType 'G' — "Commercial Lease" in the feed's own PropertyTypeLabel,
 * 214 Active rows — it is a lease rate per square foot. 735 Purcell Boulevard,
 * Bend (MLS 220174840) is a sublease of a former bank building carrying
 * ListPrice 2.5; the detail page published an H1 of "$3", a price strip of
 * "$3", a loan amount of "$2", and JSON-LD offers.price 2.5 on a
 * SingleFamilyResidence. §0.7: withhold the figure rather than publish a rent
 * rate under a sale label.
 */
export function publishListingSaleAsk(input: {
  price: number | null | undefined
  propertyType: string | null | undefined
}): PublishedListingAsk | null {
  const ask = publishSaleAskAmount({ price: input.price, propertyType: input.propertyType })
  if (ask == null) return null
  return { ask }
}

export function publishListingHistoryPrices(
  rows: ReadonlyArray<{ price?: number | null } | null | undefined> | null | undefined,
): number[] {
  const out: number[] = []
  for (const row of rows ?? []) {
    const price = asPositivePrice(row?.price)
    if (price != null) out.push(price)
  }
  return out
}

export function publishListingDrop(input: {
  listPrice: number | null | undefined
  originalListPrice: number | null | undefined
  /**
   * Prices on the published listing-history rail. When this list is passed,
   * OriginalListPrice may print only if that exact dollar amount already
   * appears on the timeline. Founding case: 65930 Mariposa (220204494)
   * printed Down $1,900,000 from $9,800,000 while history only had $7,900,000.
   */
  historyPrices?: ReadonlyArray<number | null | undefined> | null
}): PublishedListingDrop | null {
  const ask = asPositivePrice(input.listPrice)
  const original = asPositivePrice(input.originalListPrice)
  if (ask == null || original == null || original <= ask) return null
  if (input.historyPrices !== undefined && input.historyPrices !== null) {
    const supported = input.historyPrices
      .map((price) => asPositivePrice(price))
      .filter((price): price is number => price != null)
    if (!supported.includes(original)) return null
  }
  return { ask, original, drop: original - ask }
}

export function formatListingAsk(ask: number): string {
  return `$${ask.toLocaleString('en-US')}`
}

/** Face estimate next to the ask. Whole-dollar leftover of monthly PITI — miss omits. */
export function publishListingEstPaymentLabel(
  piti: number | null | undefined,
): string | null {
  const amount = asPositivePrice(piti)
  if (amount == null) return null
  return `Est. $${amount.toLocaleString('en-US')}/mo`
}

/**
 * Face Est. $/mo from the one PITI formula. Same inputs the listing
 * calculator seeds: listPrice, taxAnnual, hoaMonthly, DEFAULT_PITI_RATE
 * (or the live 30-yr rate both surfaces receive), 0.35%/yr insurance.
 */
export function publishListingEstPayment(input: MonthlyPitiInput): {
  piti: number
  label: string
} | null {
  const piti = computeMonthlyPiti(input)
  const label = publishListingEstPaymentLabel(piti)
  if (piti == null || label == null) return null
  return { piti, label }
}

/** Place-page listing cards and map pins. Null when there is no ask. */
export function formatPublishedAsk(listPrice: number | null | undefined): string | null {
  const published = publishListingAsk(listPrice)
  return published ? formatListingAsk(published.ask) : null
}

/**
 * The same, for a card that knows what kind of listing it is drawing.
 *
 * Null on a commercial lease, where ListPrice is rent per square foot: 213
 * Active PropertyType 'G' rows sit in listing_tile_mv, and the search map and
 * results list printed their rent as a card ask ("$3" beside for-sale homes).
 */
export function formatPublishedSaleAsk(input: {
  price: number | null | undefined
  propertyType: string | null | undefined
}): string | null {
  const published = publishListingSaleAsk(input)
  return published ? formatListingAsk(published.ask) : null
}
