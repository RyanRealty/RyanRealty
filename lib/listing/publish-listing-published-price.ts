/**
 * THE published price of a listing — the one number every surface of the
 * listing page prints, including the ones a person never opens.
 *
 * FOUNDING CASE (verified live 2026-09-08 against https://ryan-realty.com).
 * 55550 Heidi Court, Bend — MLS 220219603, ListingKey
 * 20260418234131878480000000 — is Closed. It listed at $1,250,000 and it sold
 * for $1,100,000. The page's own headline already read $1,100,000 beside a
 * Closed pill, because PriceCtaStrip branched on the status by hand. Every
 * surface that did NOT branch published the ask of a home that is not for sale:
 *
 *   <meta name="description">     "$1,250,000 · 3 bed, 3 bath · 3,174 sq ft …"
 *   <meta property="og:description">  the same string
 *   RealEstateListing.description "$1,250,000 · 3 bed, 3 bath · 3,174 sq ft …"
 *   the on-media hero caption     "$1,250,000"
 *   the map card                  the same figure
 *   <title>                       the address alone, no status word
 *
 * and because buildOffer() correctly refuses to advertise a sold home as
 * purchasable, the emitted RealEstateListing carried NO offers node and NO
 * availability — so nothing machine-readable said the home had sold. A search
 * engine, a share preview and an answer engine each read the list price of a
 * home that closed for $150,000 less, with no signal that it was off market.
 *
 * SCALE, re-measured in this session 2026-09-08 rather than carried over.
 * Search Console page rows for https://ryan-realty.com/, 2026-06-08..2026-09-05,
 * grouped by trailing 9-digit MLS id, joined to `listings` on ListNumber:
 *   1,714 Closed MLS ids drew impressions in that window
 *   1,713 of them carry both a ListPrice and a ClosePrice
 *   1,288 of those 1,713 have ListPrice != ClosePrice
 * The same shape reproduces on 220221350, 220223377 and 220222253. The exposure
 * is §0 on index,follow pages: Closed URLs are excluded from the sitemap
 * (lib/data/sitemap/getListingSitemapRows.ts) and are residual index, so this
 * is a published-accuracy defect, not a traffic one. Indexing policy is SITE-32,
 * not this file.
 *
 * THE RULE. One publisher answers "what price does this listing publish?" for
 * every surface, so no surface can answer it differently. A Closed listing
 * publishes its CLOSE price or no price at all — never the ask it did not get.
 * A Closed row whose ClosePrice the feed withholds publishes nothing, which is
 * §0.7 and is exactly what the headline strip already did.
 */

import {
  publishSaleAskAmount,
  publishWholePropertyAmount,
  type FractionalInterestSubject,
} from '@/lib/listing/publish-listing-figure'

/**
 * MLS StandardStatus values whose published price is the CLOSE price. Only
 * Closed: a Pending or Active Under Contract row has agreed a price nobody has
 * published, and the feed carries no ClosePrice for it until it closes.
 */
export const CLOSED_PRICE_STATUSES: ReadonlySet<string> = new Set(['Closed'])

/**
 * MLS StandardStatus values that are OFF MARKET — the home cannot be bought at
 * the figure the page prints, whatever that figure is. Pending is deliberately
 * absent: a pending home is still on market and its ask is still the ask.
 */
export const OFF_MARKET_STATUSES: ReadonlySet<string> = new Set([
  'Closed',
  'Expired',
  'Canceled',
  'Withdrawn',
])

function normalizeStatus(status: string | null | undefined): string {
  return (status ?? '').trim()
}

/** True when this listing's published price is its ClosePrice, not its ask. */
export function listingPublishesClosePrice(status: string | null | undefined): boolean {
  return CLOSED_PRICE_STATUSES.has(normalizeStatus(status))
}

/** True when the home is no longer for sale at any price the page prints. */
export function listingIsOffMarket(status: string | null | undefined): boolean {
  return OFF_MARKET_STATUSES.has(normalizeStatus(status))
}

export type ListingPublishedPriceInput = {
  /** MLS StandardStatus, verbatim from the feed. */
  status: string | null | undefined
  listPrice: number | null | undefined
  closePrice: number | null | undefined
  /** MLS PropertyType — 'G' is a lease rate, never a sale price. */
  propertyType: string | null | undefined
}

/**
 * THE published price. The ask for a listing that is on market, the sale price
 * for one that closed, null when neither publishes honestly.
 *
 * There is no fallback from a missing ClosePrice to the ask, and that is the
 * point: a sold home's list price published under its address is the defect
 * this function exists to end, so it may not reappear as a fallback. The
 * caller renders whatever it renders when there is no price — which on this
 * page is nothing, the same as a commercial lease.
 */
export function publishListingPublishedPrice(input: ListingPublishedPriceInput): number | null {
  const source = listingPublishesClosePrice(input.status) ? input.closePrice : input.listPrice
  return publishSaleAskAmount({ price: source, propertyType: input.propertyType })
}

/**
 * The same figure, narrowed to what the WHOLE property published — the input
 * every figure that describes the dwelling must take (the machine-readable
 * node, the payment, the near-this-price band). Stricter than the published
 * price by exactly one rule: a fractional interest is withheld. See
 * publishWholePropertyAmount for why the two differ.
 */
export function publishListingPublishedWholePropertyPrice(
  input: ListingPublishedPriceInput & FractionalInterestSubject,
): number | null {
  const source = listingPublishesClosePrice(input.status) ? input.closePrice : input.listPrice
  return publishWholePropertyAmount({
    price: source,
    propertyType: input.propertyType,
    propertySubType: input.propertySubType,
    subdivisionName: input.subdivisionName,
    city: input.city,
    listNumber: input.listNumber,
  })
}

/**
 * The word a person reads first when the home is not for sale — the prefix on
 * the SERP title, the meta description, and the structured-data description.
 * Null on every on-market status, where the price speaks for itself.
 *
 * "Sold" rather than "Closed" because that is the word a reader uses; "Off
 * market" covers Expired, Canceled and Withdrawn, which differ only in who
 * ended the listing and none of which means the home changed hands.
 */
export function publishListingStatusWord(status: string | null | undefined): string | null {
  const s = normalizeStatus(status)
  if (s === 'Closed') return 'Sold'
  if (OFF_MARKET_STATUSES.has(s)) return 'Off market'
  return null
}

/**
 * The schema.org availability the RealEstateListing NODE carries.
 *
 * This is not the Offer's availability. buildOffer() drops the Offer entirely
 * for every off-market status — correctly, because a sold home is not
 * purchasable — and before this existed, dropping the Offer dropped the only
 * machine-readable statement of what the listing IS. The node states the fact
 * whether or not an Offer is emitted beside it.
 *
 * Pending is deliberately unmapped. schema.org has no value that means "under
 * contract, not yet sold": InStock is false, SoldOut is false, and inventing
 * one of them would be publishing a claim the record does not support (§0).
 * Its Offer is dropped and its status pill on the page says Pending.
 */
export function publishListingSchemaAvailability(
  status: string | null | undefined,
): string | null {
  const s = normalizeStatus(status)
  if (s === 'Closed') return 'https://schema.org/SoldOut'
  if (s === 'Expired' || s === 'Canceled' || s === 'Withdrawn') {
    return 'https://schema.org/OutOfStock'
  }
  // Mirrors buildOffer exactly, so the node and the Offer never disagree.
  if (s === 'Active Under Contract') return 'https://schema.org/PreOrder'
  if (s === 'Active' || s === 'For Sale' || s === '') return 'https://schema.org/InStock'
  return null
}
