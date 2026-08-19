/**
 * Visitor-facing street line.
 *
 * MLS StreetNumber 0 / 00 is a placeholder, not a house number. Do not
 * publish it. Keep the street name when one exists.
 *
 * Founding case: /cities/bend/awbrey-butte cards printed 0 Moonshadow Court
 * for MLS 220221237 / 220221242 / 220221243 (fleet 3545811a84a2445587694783602cebc1).
 */

export function publishStreetNumber(raw: string | number | null | undefined): string | null {
  if (raw == null) return null
  const value = String(raw).trim()
  if (!value) return null
  if (/^0+$/.test(value)) return null
  return value
}

export function publishStreetPart(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? ''
  return value || null
}

/** True when the street name already ends with this suffix (Drive Drive). */
export function streetNameHasSuffix(streetName: string, streetSuffix: string): boolean {
  const name = streetName.trim()
  const suffix = streetSuffix.trim()
  if (!name || !suffix) return false
  const last = name.split(/\s+/).pop() ?? ''
  return last.localeCompare(suffix, undefined, { sensitivity: 'accent' }) === 0
}

export function publishStreetLine(input: {
  streetNumber?: string | number | null
  streetName?: string | null
  streetSuffix?: string | null
}): string | null {
  const name = publishStreetPart(input.streetName)
  const suffix = publishStreetPart(input.streetSuffix)
  const line = [
    publishStreetNumber(input.streetNumber),
    name,
    name && suffix && streetNameHasSuffix(name, suffix) ? null : suffix,
  ]
    .filter((part): part is string => part != null)
    .join(' ')
    .trim()
  return line || null
}

type ListingStreetBits = {
  streetNumber?: string | number | null
  streetName?: string | null
  streetSuffix?: string | null
  city?: string | null
  postalCode?: string | null
}

/** Street line for listing detail (never a leading placeholder 0). */
export function listingMlsStreetLine(listing: ListingStreetBits): string {
  return publishStreetLine(listing) ?? ''
}

/**
 * Street, city, OR postal. Comma between street and city — the comma-less
 * form matched no county/Zillow record (design-audit P1, trust).
 */
export function listingMlsAddressFull(listing: ListingStreetBits): string {
  const street = listingMlsStreetLine(listing)
  return [street, listing.city ? `${listing.city}, OR` : '', listing.postalCode ?? '']
    .filter(Boolean)
    .join(', ')
    .replace(/, OR,\s/, ', OR ')
    .trim()
}

/** Already-joined MLS line. Strip a leading placeholder 0. */
export function publishUnparsedStreetLine(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? ''
  if (!value) return null
  const stripped = value.replace(/^0+\s+/, '').trim()
  return stripped || null
}
