/**
 * KbHero prefixes "{N} homes for sale " when `activeCount` is known.
 * The continuation MUST name this page's geo grain, never a coarser parent.
 *
 * Fleet finding 97c68da5 (2026-08-16): /cities/bend/awbrey-butte rendered
 * "63 homes for sale in Bend" because the neighborhood page passed
 * `lead={`in ${cityName}`}` — the count is neighborhood-scoped, the label
 * was city-scoped. Same shape on /communities/[slug].
 *
 * reachability: entry-point place-page heroes (city, neighborhood, community,
 * subdivision, zip)
 */
export function placeHeroLead(input: {
  placeName: string
  parentName?: string | null
  activeCount: number | null
  knownSuffix?: string
  unknownSuffix?: string
}): string {
  const place = input.placeName.trim()
  if (!place) {
    throw new Error('placeHeroLead: placeName is required')
  }
  const parent = input.parentName?.trim() || null
  const knownSuffix = input.knownSuffix ?? 'List prices and days on market, pulled live.'
  const unknownSuffix = input.unknownSuffix ?? knownSuffix
  if (input.activeCount == null) {
    const where = parent && parent !== place ? `${place}, ${parent}` : place
    return `Single-family homes in ${where}. ${unknownSuffix}`
  }
  return `in ${place}. ${knownSuffix}`
}
