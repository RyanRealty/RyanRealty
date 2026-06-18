import resortRegistry from '@/data/resort-communities.json' assert { type: 'json' }

// Active single-family count per resort/golf community, ALIAS-AWARE. A resort's
// homes are MLS-tagged under many different SubdivisionName values (e.g. Widgi
// Creek's homes are tagged "Inn Of The 7th", "7th Mtn Golf Village", "PointsWest",
// "Elkai Woods", "Milepost 1" — almost nothing is literally "Widgi Creek"). The
// registry `subdivision_aliases` is the curated spatial truth for each resort, so a
// literal-name count (geo_snapshot_mv / getCommunitiesForIndex) badly undercounts
// every resort (Widgi 0 vs true 48, Tetherow 14 vs true 55). This buckets the city's
// active SFR tiles into resorts by matching each tile's SubdivisionName against the
// alias set, so the city-page golf/master-planned ledger shows the real count. (§0)

interface SubTile {
  subdivisionName?: string | null
  /** MLS PropertyType code. 'A' = Residential (SFR + multi-family). */
  propertyType?: string | null
}

interface ResortEntry {
  slug: string
  label: string
  city_slug: string
  is_resort?: boolean
  subdivision_aliases?: string[]
}

/**
 * Token-boundary alias match: the subdivision equals the alias OR begins with the
 * alias followed by a space (a phase suffix like "Inn Of The 7th Mountain" or
 * "Tetherow Phase 2"). Stricter than a bare startsWith — a generic alias like
 * "Triple" or "Braeburn" can no longer attribute an unrelated subdivision that
 * merely shares those leading characters with no word boundary (e.g. "Tetherowville",
 * "Braeburnwood"). Keeps every real match in the current data unchanged. (§0)
 */
function aliasMatches(sub: string, prefix: string): boolean {
  return sub === prefix || sub.startsWith(prefix + ' ')
}

/** Genuine golf/master-planned resorts in a city: `is_resort === true`. Excludes
 *  registry rows like Three Rivers (is_resort:false, a south-county recreational
 *  subdivision whose generic aliases — "Oww", "Sun Dance" — over-match unrelated
 *  city homes). Sole source for both the count helper and the ledger membership. */
export function cityResorts(citySlug: string): ResortEntry[] {
  return (resortRegistry.communities as ResortEntry[]).filter((c) => c.city_slug === citySlug && c.is_resort === true)
}

/**
 * Returns Map<resortSlug, activeSfrCount> for every resort registered in `citySlug`.
 * Each active 'A' tile is matched to AT MOST ONE resort, by the longest alias prefix
 * (case-insensitive), so when one alias is a prefix of another the more specific one
 * wins and no tile is double-counted. Resorts with no matching tile map to 0 (so the
 * ledger can drop the count rather than show a stale snapshot number). Pure +
 * deterministic — unit tested, and computed from the same active tiles the map uses
 * (no extra query).
 */
export function resortActiveSfrCounts(citySlug: string, tiles: SubTile[]): Map<string, number> {
  const resorts = cityResorts(citySlug)
  const counts = new Map<string, number>(resorts.map((r) => [r.slug, 0]))

  // [resortSlug, lowercased alias prefix], longest prefix first so a specific alias
  // ("the highlands at broken top") wins over a generic one ("broken top").
  const aliasIndex = resorts
    .flatMap((r) => (r.subdivision_aliases?.length ? r.subdivision_aliases : [r.label]).map((a) => ({ slug: r.slug, prefix: a.toLowerCase().trim() })))
    .filter((a) => a.prefix.length > 0)
    .sort((a, b) => b.prefix.length - a.prefix.length)

  for (const t of tiles) {
    if (t.propertyType !== 'A') continue
    const sub = (t.subdivisionName ?? '').toLowerCase().trim()
    if (!sub) continue
    const hit = aliasIndex.find((a) => aliasMatches(sub, a.prefix))
    if (hit) counts.set(hit.slug, (counts.get(hit.slug) ?? 0) + 1)
  }
  return counts
}

/** Map of resort label (lowercased) -> slug, for the cities in `citySlug`. Lets a
 *  community-rail card resolve its resort alias-aware count by name. */
export function resortLabelToSlug(citySlug: string): Map<string, string> {
  return new Map(cityResorts(citySlug).map((c) => [c.label.toLowerCase().trim(), c.slug]))
}

/**
 * The active SFR tiles that belong to ONE resort, alias-aware. Same longest-prefix
 * assignment as resortActiveSfrCounts (so a tile lands in exactly one resort), but
 * returns the full tiles for `resortSlug` — used to populate a resort community
 * page's map / featured / ticker, which the literal-name subdivision query misses
 * entirely for alias-heavy resorts (Widgi Creek has ~0 homes literally tagged
 * "Widgi Creek" but ~48 across its aliases). Generic over the tile type. (§0)
 */
export function resortTilesForSlug<T extends SubTile>(citySlug: string, resortSlug: string, tiles: T[]): T[] {
  const resorts = cityResorts(citySlug)
  if (!resorts.some((r) => r.slug === resortSlug)) return []
  const aliasIndex = resorts
    .flatMap((r) => (r.subdivision_aliases?.length ? r.subdivision_aliases : [r.label]).map((a) => ({ slug: r.slug, prefix: a.toLowerCase().trim() })))
    .filter((a) => a.prefix.length > 0)
    .sort((a, b) => b.prefix.length - a.prefix.length)
  const out: T[] = []
  for (const t of tiles) {
    if (t.propertyType !== 'A') continue
    const sub = (t.subdivisionName ?? '').toLowerCase().trim()
    if (!sub) continue
    const hit = aliasIndex.find((a) => aliasMatches(sub, a.prefix))
    if (hit && hit.slug === resortSlug) out.push(t)
  }
  return out
}
