/**
 * URL slug helpers for /lp/listings/[mls_slug]/ pages.
 *
 * Slug format: <MLS_NUMBER>-<URL-safe-street-address>
 *   e.g. 220218603-61572-hardin-martin
 *        220215797-19209-cartwright
 *
 * The MLS number leads so the address is always recoverable from the URL,
 * and so two listings with the same address (rare but possible) don't collide.
 */

export function slugifyAddress(streetNumber: string | null, streetName: string | null): string {
  const parts = [streetNumber, streetName]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim())
  if (parts.length === 0) return ''
  return parts
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function listingPageSlug(
  mlsNumber: string | null,
  streetNumber: string | null,
  streetName: string | null,
): string {
  const addr = slugifyAddress(streetNumber, streetName)
  if (!mlsNumber) return addr
  return addr ? `${mlsNumber}-${addr}` : mlsNumber
}

/**
 * Parse a /lp/listings/[mls_slug]/ param. Returns the MLS number (the
 * leading numeric portion before the first dash). The slug always starts
 * with the MLS number per `listingPageSlug` above.
 */
export function mlsNumberFromSlug(slug: string): string | null {
  const m = slug.match(/^([0-9]+)(?:-|$)/)
  return m ? m[1] : null
}

export function listingPageUrl(
  mlsNumber: string | null,
  streetNumber: string | null,
  streetName: string | null,
): string {
  return `/lp/listings/${listingPageSlug(mlsNumber, streetNumber, streetName)}/`
}
