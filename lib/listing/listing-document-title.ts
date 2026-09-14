/**
 * Document title for a house URL. Status first (SITE-20: sold vs for sale
 * must lead), then the beds/baths people search, then the street.
 *
 * SITE-99: the prior title was only `Active · {address}`, so a 4-bed query
 * could not match the title. Facts already sit in the meta description;
 * putting them in the title is the SERP increment.
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
    const baths = Number.isInteger(input.baths) ? String(input.baths) : String(input.baths)
    facts.push(`${baths} bath`)
  }
  const parts = [input.statusWord?.trim() || null, facts.join(', ') || null, input.addressTitle.trim() || null].filter(
    (part): part is string => Boolean(part),
  )
  return parts.join(' · ')
}
