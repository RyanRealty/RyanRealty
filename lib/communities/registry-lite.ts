/**
 * Client-safe resort-community lookups.
 *
 * Reads data/resort-communities.lite.json (naming + alias fields only,
 * generated from data/resort-communities.json by
 * scripts/build-resort-communities-lite.mjs), never the ~50 KB source
 * registry. Anything a 'use client' component can reach MUST come through
 * here: importing lib/data/communities/registry or the source JSON from
 * client-reachable code ships the whole registry into ~26 route chunks
 * (1.15 MB of client JS, 2026-09-29). ci:server-only-imports enforces this
 * transitively.
 *
 * The alias index below is the one implementation. The full DAL accessor
 * getResortCommunityBySubdivisionName (lib/data/communities/registry.ts)
 * resolves through it and then hands back the full entry, so the two can
 * never disagree about which community a name belongs to.
 *
 * Pure and synchronous, no server-only imports: safe on the client, the
 * server and the edge.
 */
import liteRegistry from '@/data/resort-communities.lite.json'

export type ResortCommunityLiteSubNeighborhood = {
  slug: string
  name: string
  mls_aliases?: string[]
}

export type ResortCommunityLite = {
  slug: string
  label: string
  city: string
  city_slug: string
  is_resort: boolean
  subdivision_aliases: string[]
  /** Names this community used to go by, still live in the MLS. */
  former_labels?: string[]
  /** MLS `City` spellings that carry this community's listings besides `city`. */
  mls_cities?: string[]
  sub_neighborhoods: ResortCommunityLiteSubNeighborhood[]
}

const communities = liteRegistry.communities as unknown as ResortCommunityLite[]

/** Every resort community, in registry order. */
export function getAllResortCommunitiesLite(): ResortCommunityLite[] {
  return communities
}

// Built once: lowercased label, slug, each subdivision alias, and each
// sub-neighborhood name / slug / MLS alias, mapped to its community. Later
// entries overwrite earlier ones on a shared key, in registry order.
const communityByAlias: ReadonlyMap<string, ResortCommunityLite> = (() => {
  const map = new Map<string, ResortCommunityLite>()
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
 * name or slug. Null when the string is an ordinary plat, not a registry
 * Community. See CONTEXT.md, Community vs Subdivision.
 */
export function getResortCommunityLiteBySubdivisionName(
  subdivisionName: string | null | undefined,
): ResortCommunityLite | null {
  const key = subdivisionName?.trim().toLowerCase()
  if (!key) return null
  return communityByAlias.get(key) ?? null
}
