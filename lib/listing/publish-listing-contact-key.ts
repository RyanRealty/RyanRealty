/**
 * One public contact key for a listing.
 *
 * Hero/footer CTAs used Spark ListingKey. The broker block used the URL
 * ListNumber. `/contact?listingKey=<MLS>` then looked up listing_key only, so
 * the tour form loaded with no address. Fleet 1400f2fa89d1a2082646e324d4b8d8ba.
 *
 * Public identifier is ListNumber. ListingKey is internal. Contact hrefs
 * publish ListNumber when present. The contact page resolves either shape.
 */

export function publishListingContactKey(input: {
  listNumber?: string | null
  listingKey?: string | null
}): string | null {
  const mls = input.listNumber?.trim()
  if (mls) return mls
  const key = input.listingKey?.trim()
  return key || null
}

export function listingContactHref(
  key: string | null | undefined,
  intent: 'tour' | 'question',
): string | null {
  if (!key?.trim()) return null
  return `/contact?listingKey=${encodeURIComponent(key.trim())}&intent=${intent}`
}
