/**
 * Resort-community registry DAL accessor.
 *
 * Provides typed read access to `data/resort-communities.json` for page
 * and component consumers. The JSON file is the registry source-of-truth
 * (see CLAUDE.md "Data Accuracy" — registry source: data/resort-communities.json).
 *
 * All exports are pure, synchronous, and have zero Supabase dependency.
 * They are safe to call in any server component without caching overhead.
 *
 * Consumers: app/communities/[slug]/page.tsx (detail page), and any future
 * page or component that needs typed registry data without reaching into
 * raw JSON inline.
 */

import rawRegistry from '@/data/resort-communities.json' assert { type: 'json' }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SubNeighborhood = {
  slug: string
  name: string
  type: string
  hoa_annual_estimate?: number | null
  hoa_sub_quarterly?: number | null
  hoa_master_annual?: number | null
  hoa_manager?: string | null
  lot_size_note?: string | null
  character?: string | null
  description?: string | null
  mls_aliases?: string[]
}

export type ResortCommunityEntry = {
  slug: string
  label: string
  city: string
  city_slug: string
  is_resort: boolean
  broad_radius_km: number
  center_lon_lat: [number, number]
  subdivision_aliases: string[]
  sub_neighborhoods: SubNeighborhood[]
  child_count: number
  character?: string | null
  description?: string | null
  hoa_annual_estimate?: number | null
  amenity_tags?: string[]
}

// ---------------------------------------------------------------------------
// Registry access
// ---------------------------------------------------------------------------

const communities = rawRegistry.communities as unknown as ResortCommunityEntry[]

/**
 * Find a resort community entry by its slug.
 * Returns null if the slug is not in the registry.
 */
export function getResortCommunityBySlug(slug: string): ResortCommunityEntry | null {
  return communities.find((c) => c.slug === slug) ?? null
}

/**
 * All resort community entries, in registry order.
 */
export function getAllResortCommunities(): ResortCommunityEntry[] {
  return communities
}

/**
 * Resort communities for a given city slug.
 */
export function getResortCommunitiesForCity(citySlug: string): ResortCommunityEntry[] {
  return communities.filter((c) => c.city_slug === citySlug)
}

// Built once at module load: every registered community's label + subdivision
// aliases, lowercased, mapped to that community's verified canonical city.
const canonicalCityByAlias: Map<string, string> = (() => {
  const map = new Map<string, string>()
  for (const entry of communities) {
    map.set(entry.label.trim().toLowerCase(), entry.city)
    for (const alias of entry.subdivision_aliases ?? []) {
      map.set(alias.trim().toLowerCase(), entry.city)
    }
  }
  return map
})()

/**
 * The verified canonical city for a subdivision/community name, per the
 * registry (data/resort-communities.json). Some subdivisions have listings
 * whose raw MLS City field is inconsistent (mailing-address quirks common
 * in unincorporated Central Oregon — e.g. hundreds of Crosswater listings
 * say "Bend" even though Crosswater is a Sunriver-area resort). Any code
 * that groups listings or index rows BY (city, subdivision) should resolve
 * through this first so the same real community never splits into two
 * entries under two different cities (design-audit #131).
 *
 * Returns null when the name isn't a registered community — callers should
 * fall back to the listing's own raw City field in that case.
 */
export function getCanonicalCityForSubdivision(subdivisionName: string | null | undefined): string | null {
  const key = subdivisionName?.trim().toLowerCase()
  if (!key) return null
  return canonicalCityByAlias.get(key) ?? null
}
