/**
 * The places the homepage search opens onto before anything is typed.
 *
 * The client keeps `HOME_HERO_PLACE_SEEDS` as its fallback; the page passes
 * the same places with each one's live count beside its kind (2026-09-29: the
 * opened search read as a static list of names). Plain data, no registry
 * import, so the client bundle carries nothing new.
 */

export type HomeHeroPlaceSeed = {
  /** Where the row goes. */
  id: string
  title: string
  /** What kind of place it is, or the town a community sits in. */
  description: string
  /** Key into the page's live counts. */
  slug: string
  kind: 'city' | 'community'
}

export const HOME_HERO_PLACE_SEEDS: readonly HomeHeroPlaceSeed[] = [
  { id: '/homes-for-sale/bend', title: 'Bend', description: 'City', slug: 'bend', kind: 'city' },
  { id: '/homes-for-sale/redmond', title: 'Redmond', description: 'City', slug: 'redmond', kind: 'city' },
  { id: '/homes-for-sale/sisters', title: 'Sisters', description: 'City', slug: 'sisters', kind: 'city' },
  { id: '/homes-for-sale/sunriver', title: 'Sunriver', description: 'Community', slug: 'sunriver', kind: 'city' },
  { id: '/communities/tetherow', title: 'Tetherow', description: 'Bend', slug: 'tetherow', kind: 'community' },
  { id: '/homes-for-sale/prineville', title: 'Prineville', description: 'City', slug: 'prineville', kind: 'city' },
  { id: '/homes-for-sale/la-pine', title: 'La Pine', description: 'City', slug: 'la-pine', kind: 'city' },
  { id: '/homes-for-sale/madras', title: 'Madras', description: 'City', slug: 'madras', kind: 'city' },
]

export type HomeHeroPlaceItem = { id: string; title: string; description: string }

/**
 * Each seed with its live count named beside its kind. A city's figure is
 * the one the page's Towns run prints (geo_snapshot_mv active single-family,
 * "houses for sale"); a community's is the featured slide's own "homes for
 * sale". No figure (null, zero, non-finite) prints the plain kind (section 0).
 */
export function homeHeroPlaceItems(
  cityHouses: ReadonlyMap<string, number | null | undefined>,
  communityHomes: ReadonlyMap<string, number | null | undefined>,
): HomeHeroPlaceItem[] {
  return HOME_HERO_PLACE_SEEDS.map((seed) => {
    const n = seed.kind === 'city' ? cityHouses.get(seed.slug) : communityHomes.get(seed.slug)
    const live = typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.round(n) : null
    const unit = seed.kind === 'city' ? (live === 1 ? 'house' : 'houses') : live === 1 ? 'home' : 'homes'
    return {
      id: seed.id,
      title: seed.title,
      description: live != null ? `${seed.description} · ${live.toLocaleString('en-US')} ${unit} for sale` : seed.description,
    }
  })
}
