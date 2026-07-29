/**
 * Neighborhood name matching for the site-search autocomplete.
 *
 * Buyers type a neighborhood the way they say it, not the way it is stored:
 * "RiverWest", "riverwest", "River West", "RIVER WEST", and "river-west" all
 * mean the Bend district stored as "River West". The suggestions path used to
 * push the raw query straight into `neighborhoods.name ILIKE '%<q>%'`, so only
 * the two-word spelling could ever match. "RiverWest" returned an empty
 * dropdown ("No results") even though /cities/bend/river-west has been live the
 * whole time, and the only way into the page was a direct URL or the nav.
 *
 * The rule now: normalize BOTH sides to lowercase alphanumerics (spaces,
 * hyphens, apostrophes, and every other separator dropped) and match on that
 * key, so one word, two words, mixed case, and the hyphenated slug all collapse
 * to "riverwest". A city-qualified query ("bend river west") matches through the
 * combined city + neighborhood key.
 *
 * Pure and dependency-free on purpose. This runs on every keystroke against a
 * small cached directory (13 Bend districts today), never a DB round trip.
 */

export type NeighborhoodDirectoryEntry = {
  neighborhoodName: string
  neighborhoodSlug: string
  cityName: string
  citySlug: string
}

/**
 * A single-character key matches nearly every neighborhood, which is noise, not
 * a suggestion. Mirrors the 2-char floor the suggestions route already enforces.
 */
export const NEIGHBORHOOD_MATCH_MIN_KEY_LENGTH = 2

/**
 * Collapse a place name or a typed query to its comparison key: lowercase,
 * alphanumerics only. "River West" / "RiverWest" / "river-west" / "RIVER  WEST"
 * all become "riverwest". Diacritics fold to their base letter.
 */
export function normalizeSearchKey(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '')
}

/** Lower is better. Exact name beats a prefix, which beats a substring. */
function scoreEntry(key: string, entry: NeighborhoodDirectoryEntry): number | null {
  const nameKey = normalizeSearchKey(entry.neighborhoodName)
  const slugKey = normalizeSearchKey(entry.neighborhoodSlug)
  if (!nameKey && !slugKey) return null

  if (key === nameKey || key === slugKey) return 0
  if (nameKey.startsWith(key) || slugKey.startsWith(key)) return 1
  if (nameKey.includes(key) || slugKey.includes(key)) return 2

  // City-qualified: "bend river west" -> "bendriverwest". The query must carry a
  // neighborhood part BEYOND the city name — a bare "bend" stays a city query,
  // otherwise every district in Bend would flood the neighborhood group.
  for (const cityKey of [normalizeSearchKey(entry.cityName), normalizeSearchKey(entry.citySlug)]) {
    if (!cityKey || !key.startsWith(cityKey)) continue
    const rest = key.slice(cityKey.length)
    if (rest.length < NEIGHBORHOOD_MATCH_MIN_KEY_LENGTH) continue
    if (nameKey.includes(rest) || slugKey.includes(rest)) return 3
  }

  return null
}

/**
 * Rank a neighborhood directory against a typed query. Returns at most `limit`
 * entries, best match first, ties broken alphabetically by name so the order is
 * stable across renders.
 */
export function matchNeighborhoodEntries<T extends NeighborhoodDirectoryEntry>(
  query: string | null | undefined,
  entries: readonly T[],
  limit = 10
): T[] {
  const key = normalizeSearchKey(query)
  if (key.length < NEIGHBORHOOD_MATCH_MIN_KEY_LENGTH) return []
  if (!entries?.length) return []

  const scored: Array<{ entry: T; score: number }> = []
  for (const entry of entries) {
    const score = scoreEntry(key, entry)
    if (score === null) continue
    scored.push({ entry, score })
  }
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      a.entry.neighborhoodName.localeCompare(b.entry.neighborhoodName)
  )
  return scored.slice(0, Math.max(limit, 0)).map((s) => s.entry)
}
