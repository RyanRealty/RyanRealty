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
  /** TOA / marketing name vs a recorded county plat. */
  kind?: 'toa_marketing' | 'recorded_plat'
  /** Recorded plat the marketing name sits on, when known. */
  recorded_plat?: string
  source?: string
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
  display_name?: string
  broad_radius_km: number
  center_lon_lat: [number, number]
  subdivision_aliases: string[]
  /** MLS `City` spellings that carry this community's active listings when they
   *  differ from the registry city (e.g. Caldera Springs lists under Bend, Black
   *  Butte Ranch under its own city name). The community page must pull tiles
   *  for the registry city PLUS these, or alias matching sees zero homes.
   *  Verified 2026-07-29 audit sweep; gated by check-community-alias-cities. */
  mls_cities?: string[]
  sub_neighborhoods: SubNeighborhood[]
  child_count: number
  nest?: {
    kind?: string
    levels?: string[]
    in_city_plats?: string[]
    note?: string
  }
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

// Built once: lowercased label + each subdivision_alias → registry entry.
const communityByAlias: Map<string, ResortCommunityEntry> = (() => {
  const map = new Map<string, ResortCommunityEntry>()
  for (const entry of communities) {
    map.set(entry.label.trim().toLowerCase(), entry)
    map.set(entry.slug.trim().toLowerCase(), entry)
    for (const alias of entry.subdivision_aliases ?? []) {
      map.set(alias.trim().toLowerCase(), entry)
    }
    for (const sub of entry.sub_neighborhoods ?? []) {
      map.set(sub.name.trim().toLowerCase(), entry)
      map.set(sub.slug.trim().toLowerCase(), entry)
      for (const a of sub.mls_aliases ?? []) {
        map.set(a.trim().toLowerCase(), entry)
      }
    }
  }
  return map
})()

/**
 * Resolve a curated Community (resort / master-plan) from an MLS subdivision
 * name or slug. Returns null when the string is an ordinary plat, not a
 * registry Community. See CONTEXT.md — Community vs Subdivision.
 */
export function getResortCommunityBySubdivisionName(
  subdivisionName: string | null | undefined,
): ResortCommunityEntry | null {
  const key = subdivisionName?.trim().toLowerCase()
  if (!key) return null
  return communityByAlias.get(key) ?? null
}
