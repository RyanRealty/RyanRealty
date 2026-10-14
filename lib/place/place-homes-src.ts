/**
 * Where a place page reads the homes the map's listing dials did not seed.
 *
 * The community (and later city / neighborhood) server render keeps one page
 * of cards in the RSC payload. PlaceSubdivisionMap fetches the rest from here
 * so the count stays the full population (SITE-193) without serializing every
 * row on first paint.
 */
export function communityHomesSrc(slug: string): string {
  const key = slug.trim()
  if (!key) return ''
  return `/api/place/homes?community=${encodeURIComponent(key)}`
}

export function isCommunitySlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim())
}
