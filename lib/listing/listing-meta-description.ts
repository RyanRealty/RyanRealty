import { listingShareSummary, shareDescription } from '@/lib/share-metadata'
import { publishStreetLine, publishStreetNumber } from '@/lib/listing/publish-street-line'
import { displaySubdivision } from '@/lib/slug'

/**
 * The listing page's <meta name="description"> (also its og:description and
 * twitter:description, through pageMetadata).
 *
 * UNIQUE BY CONSTRUCTION. The snippet used to be price, beds/baths/sqft, plat
 * and town, then the listing's MLS remarks. The street address was left out
 * because the <title> carries it. That is fine for a house and wrong for a
 * block of siblings: a developer lists lots 64, 84, 85 and 86 of one plat at
 * one price with one set of remarks, and the three Federal Way parcels do the
 * same, so every sibling's description came out byte-identical. The 2026-10-14
 * deploy:verify baseline failed on five pages for it (lots 84, 86 and 64
 * Galveston Loop in Longhorn Ridge, Prineville, against lot 85; 430 and 450
 * Federal Way, Central Point, against 440).
 *
 * The rule now: the facts that tell this listing from its neighbors come
 * FIRST, and the shared remarks come last, so the cut the length limit makes
 * always lands in the remarks and never in the part that differs.
 *
 *   [status] price · beds, baths · sq ft  (or, on land, the lot) ·
 *   street, plat, town · [MLS number, only when the street has no house number]
 *   . remarks as the broker wrote them
 *
 * Every value is read from the listing row; a missing value drops its clause.
 * Nothing is estimated and nothing is added. The remarks are the broker's words
 * (MLS remarks shown as written): only whitespace is normalised and the tail is
 * cut at a word.
 *
 * WHY THE MLS NUMBER IS CONDITIONAL. The street line is the differentiator.
 * When MLS StreetNumber is a placeholder ("0") the line is just "Kouns Drive",
 * which every bare parcel on that road shares, so the MLS number (unique per
 * listing) is added. A house with a real number never prints it: it would cost
 * every snippet 16 characters of the broker's words to guard the one case the
 * address already covers.
 */

/** Google's snippet limit, the same cap shareDescription applies. */
const MAX_DESCRIPTION = 155
/** ". " between the facts and the remarks. */
const JOINER = '. '
/**
 * Fewer characters than this left after the facts would print a fragment of
 * two or three words; the facts alone read better.
 */
const MIN_TAIL_ROOM = 24

export type ListingMetaDescriptionInput = {
  /** "Sold", "Off market" from publishListingStatusWord; null on market. */
  statusWord?: string | null
  /** The published price (status-aware; the close price when sold). */
  price?: number | null
  beds?: number | null
  baths?: number | null
  /** Living area. */
  sqft?: number | null
  lotSizeAcres?: number | null
  lotSizeSqft?: number | null
  streetNumber?: string | number | null
  streetDirPrefix?: string | null
  streetName?: string | null
  streetSuffix?: string | null
  streetDirSuffix?: string | null
  subdivisionName?: string | null
  city?: string | null
  listNumber?: string | null
  publicRemarks?: string | null
}

function positive(n: number | null | undefined): n is number {
  return n != null && Number.isFinite(n) && n > 0
}

/**
 * The lot, worded for a land listing: "0.46-acre lot", or "12,000 sq ft lot"
 * when the row has square feet only. Null when the row has neither, or when the
 * listing is a home (it has beds, baths or living area): a house's lot is on
 * the page, and the snippet's characters go to the facts a buyer scans for.
 * Acres follow the page's own Quick facts rounding (two decimals).
 */
function landLotPhrase(input: ListingMetaDescriptionInput): string | null {
  if (positive(input.beds) || positive(input.baths) || positive(input.sqft)) return null
  if (positive(input.lotSizeAcres)) {
    const acres = Math.round(input.lotSizeAcres * 100) / 100
    if (acres > 0) return `${acres}-acre lot`
  }
  if (positive(input.lotSizeSqft)) {
    return `${Math.round(input.lotSizeSqft).toLocaleString('en-US')} sq ft lot`
  }
  return null
}

export function listingMetaDescription(input: ListingMetaDescriptionInput): string {
  const street = publishStreetLine(input)
  const plat = displaySubdivision(input.subdivisionName)
  const town = [plat, input.city?.trim()].filter(Boolean).join(', ')
  const mls = input.listNumber?.trim() || null
  // No house number, or no street at all: the address cannot tell this listing
  // from the parcels beside it, so the MLS number does.
  const needsMlsNumber = !publishStreetNumber(input.streetNumber)

  const lead = listingShareSummary({
    price: input.price,
    statusWord: input.statusWord,
    beds: input.beds,
    baths: input.baths,
    sqft: input.sqft,
    lot: landLotPhrase(input),
    address: street ?? undefined,
    city: town || undefined,
    mlsNumber: needsMlsNumber ? mls : null,
  })

  // A lead that was itself cut (it ends in an ellipsis) is already the whole
  // description; appending remarks after "…" would read as two broken halves.
  if (lead.endsWith('…')) return lead
  const remarks = (input.publicRemarks ?? '').replace(/\s+/g, ' ').trim()
  const tail = remarks || 'Photos, map, and nearby sales.'
  const room = MAX_DESCRIPTION - lead.length - JOINER.length
  if (room < MIN_TAIL_ROOM) return lead.length < MAX_DESCRIPTION ? `${lead}.` : lead
  return shareDescription(`${lead}${JOINER}${tail}`, MAX_DESCRIPTION)
}
