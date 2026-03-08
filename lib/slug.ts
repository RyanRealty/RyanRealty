/**
 * Normalize display names to URL- and storage-safe keys.
 * Used for banner entity_key and storage paths so web and mobile share the same URLs.
 */
export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

/** Entity key for a city (e.g. "Bend" -> "bend"). */
export function cityEntityKey(city: string): string {
  return slugify(city)
}

/** Entity key for a subdivision (e.g. city "Bend", subdivision "Sunriver" -> "bend:sunriver"). */
export function subdivisionEntityKey(city: string, subdivision: string): string {
  return `${slugify(city)}:${slugify(subdivision)}`
}

/** Parse entity_key "city:subdivision" into display parts (e.g. "bend:sunriver" -> { city: "Bend", subdivision: "Sunriver" }). */
export function parseEntityKey(entityKey: string): { city: string; subdivision: string } {
  const [city = '', subdivision = ''] = entityKey.split(':')
  const format = (s: string) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  return { city: format(city), subdivision: format(subdivision) }
}

/**
 * Build an SEO-friendly listing URL slug from address parts (e.g. "123-main-st-bend-oregon-97702").
 * Includes street, city, state, and zip for maximum local SEO. Used for /listing/[key]-[addressSlug].
 */
export function listingAddressSlug(parts: {
  streetNumber?: string | null
  streetName?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
}): string {
  const street = [parts.streetNumber, parts.streetName].filter(Boolean).join('-')
  const loc = [parts.city, parts.state].filter(Boolean).join('-')
  const zip = (parts.postalCode ?? '').toString().trim().replace(/\D/g, '')
  const combined = [street, loc, zip].filter(Boolean).join('-')
  return slugify(combined)
}

/**
 * Extract the listing key from a URL segment that may be "key" or "key-address-slug".
 * When the first segment is all digits (ListNumber), the rest is address slug; otherwise the whole segment is the key.
 */
export function listingKeyFromSlug(slug: string): string {
  const decoded = decodeURIComponent(slug).trim()
  if (!decoded) return ''
  const parts = decoded.split('-')
  const first = parts[0]?.trim() ?? ''
  if (parts.length > 1 && /^\d+$/.test(first)) return first
  return decoded
}
