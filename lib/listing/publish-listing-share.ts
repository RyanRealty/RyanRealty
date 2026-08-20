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
 * WHERE THE LABEL COMES FROM. When the feed's own sub type says share, the
 * label is that sub type via propertySubTypeDisplayLabel. Do not invent
 * "fractional", "1/5th", or a Timeshare label when the feed says Tenancy in
 * Common. When the feed says nothing (eight Active quarter shares at Lake Creek
 * Lodge are filed as "Condominium"), the label is the registry entry's own
 * reviewed `shareLabel`, which is backed by the quoted remarks recorded beside
 * it. Either way the string is read from a verified source, never derived from
 * PublicRemarks at request time.
 *
 * A BADGE IS NOT DECORATION. It is the reason the ask may still publish at all:
 * "$159,900" is true of a quarter share and false of the cabin, so the page may
 * print it only while the share label sits beside it. The label and every
 * withheld whole-property figure therefore ask the same predicate,
 * listingIsFractionalInterest, in the figure contract the mechanical gate
 * transpiles and executes.
 */

import {
  fractionalInterestEntry,
  listingPriceIsFractionalShare,
  publishPricePerSqft,
  type FractionalInterestSubject,
} from '@/lib/listing/publish-listing-figure'
import { propertySubTypeDisplayLabel } from '@/lib/property-type'

/**
 * The label to print beside the ask, or null when this listing prices a whole
 * property. The rule itself lives in the figure contract; this module only
 * chooses which verified string names it.
 */
export function publishListingShareKind(subject: FractionalInterestSubject): string | null {
  const raw = (subject.propertySubType ?? '').trim()
  if (listingPriceIsFractionalShare(raw)) {
    return propertySubTypeDisplayLabel(raw) || raw
  }
  const entry = fractionalInterestEntry(subject)
  return entry ? entry.shareLabel : null
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
 *
 * The square footage is the WHOLE dwelling's on every row, so a share price
 * divided by it is a category error rather than a rounding one. MLS 220222478
 * published "$185 /sqft" from $159,900 over Cabin 10's 866 sq ft.
 */
export function publishListingSharePricePerSqft(
  input: FractionalInterestSubject & {
    propertyType: string | null | undefined
    pricePerSqft: number | null | undefined
  },
): number | null {
  if (publishListingShareKind(input)) return null
  return publishPricePerSqft({
    propertyType: input.propertyType,
    pricePerSqft: input.pricePerSqft,
  })
}
