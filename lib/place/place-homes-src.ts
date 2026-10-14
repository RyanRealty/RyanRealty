/**
 * Where a place page reads the homes the map's listing dials did not seed.
 *
 * The community server render keeps one fold page of cards in the document.
 * PlaceSubdivisionMap always fetches the full set from here so the dials and
 * the fold grid do not serialize the same rows twice (Tetherow sat under 24
 * homes, so a "rest of the list" fetch never ran).
 */
export function communityHomesSrc(slug: string): string {
  const key = slug.trim()
  if (!key) return ''
  return `/api/place/homes?community=${encodeURIComponent(key)}`
}

export function isCommunitySlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.trim())
}
