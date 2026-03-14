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

/** Display label for a subdivision. "Out of area; see remarks" (or similar) → "See homes nearby". */
export function getSubdivisionDisplayName(name: string | null | undefined): string {
  const n = (name ?? '').trim().toLowerCase()
  if (!n) return name?.trim() ?? ''
  if (n === 'out of area; see remarks' || n === 'out of area, see remarks') return 'See homes nearby'
  return (name ?? '').trim()
}

/** Entity key for a city (e.g. "Bend" -> "bend"). */
export function cityEntityKey(city: string): string {
  return slugify(city)
}

/** SEO-friendly city page path (e.g. "Bend" -> "/cities/bend"). Use for all city links. */
export function cityPagePath(city: string): string {
  return `/cities/${cityEntityKey(city)}`
}

/** SEO-friendly neighborhood page path (e.g. citySlug "bend", neighborhoodSlug "larkspur" -> "/cities/bend/larkspur"). */
export function neighborhoodPagePath(citySlug: string, neighborhoodSlug: string): string {
  return `/cities/${citySlug}/${neighborhoodSlug}`
}

/**
 * SEO-friendly path for browsing homes for sale by place.
 * Use for all "homes for sale in [city]" or "homes for sale in [community]" links and canonicals.
 * - No args: /homes-for-sale (main search)
 * - City only: /homes-for-sale/bend
 * - City + subdivision: /homes-for-sale/bend/sunriver
 */
export function homesForSalePath(city?: string | null, subdivision?: string | null): string {
  if (!city?.trim()) return '/homes-for-sale'
  const citySlug = cityEntityKey(city)
  if (!subdivision?.trim()) return `/homes-for-sale/${citySlug}`
  return `/homes-for-sale/${citySlug}/${slugify(subdivision)}`
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
