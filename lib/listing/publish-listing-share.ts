/**
 * Share / interval ownership on the listing hero and price strip.
 *
 * Eagle Crest 2390 Snowgoose (220215519) and 2250 Snowgoose (220188968)
 * are MLS PropertySubType "Tenancy in Common" (1/5th deeded share in
 * remarks). The hero printed $5K / $3K next to whole-home beds/baths/sqft
 * with no share kind, and the strip printed $4/sqft / $3/sqft from
 * ListPrice / living area. That is a share ask, not a fee-simple dwelling.
 *
 * Founding fingerprints: ae66a0f065d3affe2713352b2f71e1b5,
 * 41fed0ac49bcf207696a8c1990faf07f.
 *
 * Label is the verified MLS subtype via propertySubTypeDisplayLabel.
 * Do not invent "fractional", "1/5th", or a timeshare label when the
 * feed says Tenancy in Common. Do not parse PublicRemarks.
 *
 * The two sub types this module labels — Tenancy in Common and Timeshare —
 * are enumerated once, in FRACTIONAL_INTEREST_SUB_TYPES inside the figure
 * contract, which the mechanical gate transpiles and executes. This module
 * asks that contract rather than keeping a second copy of the list.
 */

import {
  listingPriceIsFractionalShare,
  publishPricePerSqft,
} from '@/lib/listing/publish-listing-figure'
import { propertySubTypeDisplayLabel } from '@/lib/property-type'

/**
 * The sub-type list itself lives in the figure contract
 * (FRACTIONAL_INTEREST_SUB_TYPES), which the mechanical gate transpiles and
 * executes. A second copy here would be a second rule: this module labels the
 * share, the contract decides what a share price may be used for.
 */
export function publishListingShareKind(
  propertySubType: string | null | undefined,
): string | null {
  const raw = (propertySubType ?? '').trim()
  if (!listingPriceIsFractionalShare(raw)) return null
  return propertySubTypeDisplayLabel(raw) || raw
}

/**
 * The one published price per square foot.
 *
 * `propertyType` is REQUIRED, not optional, so the typechecker — not a
 * reviewer's memory — makes every surface state which listing it is publishing.
 * A commercial lease (PropertyType 'G') carries rent in ListPrice, so its
 * derived "price per square foot" is a rent rate wearing a sale label; the
 * numeric plausibility rule (a figure that prints as $0 is not a figure) lives
 * beside it in publishPricePerSqft. Founding cases: 735 Purcell (220174840,
 * lease, published "$0"), and 220218225 Redmond ($500 over 1,405 sq ft).
 */
export function publishListingSharePricePerSqft(input: {
  propertyType: string | null | undefined
  propertySubType: string | null | undefined
  pricePerSqft: number | null | undefined
}): number | null {
  if (publishListingShareKind(input.propertySubType)) return null
  return publishPricePerSqft({
    propertyType: input.propertyType,
    pricePerSqft: input.pricePerSqft,
  })
}
