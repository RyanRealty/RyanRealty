/**
 * listingPhotoAlt — the one place a listing-photo `alt` string is built.
 *
 * A photo carries a property in image search and AI answer engines only when
 * it says which home it is: address, plus city/state when the row has one.
 * `cityLine` is empty or whitespace on some rows (land parcels, incomplete
 * geocodes) — fall back to the address alone rather than publish a trailing
 * comma. Pure and side-effect-free so every caller (V3ListingRow,
 * SplitCardMedia, and anything else rendering a listing photo) shares one
 * definition instead of re-deriving the string inline.
 */
export function listingPhotoAlt({
  addressLine,
  cityLine,
}: {
  addressLine: string
  cityLine?: string | null
}): string {
  const address = addressLine.trim()
  const city = (cityLine ?? '').trim()
  if (!address) return city
  return city ? `${address}, ${city}` : address
}
