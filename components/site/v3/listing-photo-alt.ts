/**
 * listingPhotoAlt — the one place a listing-photo `alt` string is built.
 *
 * A photo carries a property in image search and AI answer engines only when
 * it says which home it is: address, plus city/state when the row has one.
 * `cityLine` is empty or whitespace on some rows (land parcels, incomplete
 * geocodes) — fall back to the address alone rather than publish a trailing
 * comma. Pure and side-effect-free so every caller (V3ListingRow,
 * SplitCardMedia, listing gallery frames, alerts thumbs, ledger thumbs)
 * shares one definition instead of re-deriving the string inline.
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

/**
 * listingGalleryFrameAlt — address + ordinal for every listing-gallery still.
 *
 * Site audit 2026-09-18: a Bend PDP shipped ~54/56 `alt=""` because the
 * filmstrip thumbs were decorative and the carousel only named the one
 * mounted plate. Image search and a screen reader both need the house and
 * which plate this is. Caption is ignored when blank (MLS often stores "")
 * so it cannot wipe the address.
 */
export function listingGalleryFrameAlt({
  addressLine,
  cityLine,
  ordinal,
  total,
}: {
  addressLine?: string | null
  cityLine?: string | null
  ordinal: number
  total: number
}): string {
  const named = listingPhotoAlt({
    addressLine: addressLine ?? '',
    cityLine,
  })
  const n = Number.isFinite(ordinal) ? Math.max(1, Math.trunc(ordinal)) : 1
  const of = Number.isFinite(total) ? Math.max(n, Math.trunc(total)) : n
  const slot = `photo ${n} of ${of}`
  return named ? `${named}, ${slot}` : `Listing ${slot}`
}
