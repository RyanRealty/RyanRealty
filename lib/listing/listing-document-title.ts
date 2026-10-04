import { TITLE_BUDGET } from '@/lib/site/page-metadata'

/**
 * Document title for a house URL (Matt 2026-10-04): status, then the ADDRESS,
 * then beds/baths only while the whole title fits Google's ~60-char display.
 *
 * - Status first, kept from SITE-20: "Sold" or "Off market" must never be the
 *   part Google cuts, or a sold home reads as for sale. Active has no word.
 * - Address second: an address is what people type for a specific home, and
 *   the 2026-10-04 crawl found 18 of 40 sampled titles over 60 chars, most of
 *   them "5 bed, 4 bath · 61288 King Saul Avenue, Bend, OR 97702 | Ryan Realty"
 *   with the town cut off. Zillow and Redfin lead with the address too.
 * - Beds/baths last, and only when they fit TITLE_BUDGET (60 minus the layout's
 *   " | Ryan Realty"). SITE-99 put them in the title for "4 bed" queries; the
 *   meta description carries them on every listing regardless.
 */
export function listingDocumentTitle(input: {
  statusWord?: string | null
  addressTitle: string
  beds?: number | null
  baths?: number | null
}): string {
  const facts: string[] = []
  if (typeof input.beds === 'number' && Number.isFinite(input.beds) && input.beds > 0) {
    facts.push(`${input.beds} bed`)
  }
  if (typeof input.baths === 'number' && Number.isFinite(input.baths) && input.baths > 0) {
    facts.push(`${input.baths} bath`)
  }
  const head = [input.statusWord?.trim() || null, input.addressTitle.trim() || null]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
  const withFacts = facts.length > 0 ? `${head} · ${facts.join(', ')}` : head
  return withFacts.length <= TITLE_BUDGET ? withFacts : head
}
