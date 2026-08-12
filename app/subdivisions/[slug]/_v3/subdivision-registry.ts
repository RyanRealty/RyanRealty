/**
 * Registry alias resolution for the plat node, and the display name a slug falls
 * back to. Behaviour is the KB page's, unchanged by the register migration and
 * unchanged by this repair: it moved out of page.tsx so the route file stays under
 * the ci:file-size-budget floor (600 LOC, and a NEW file over it is a hard fail,
 * so the gate's own instruction is split rather than re-baseline).
 *
 * PATH 2 of the NO-404 CONTRACT. data/resort-communities.json is the registry of
 * record for resort communities and the subdivision aliases under them; a slug that
 * matches one of those aliases renders even with no GIS polygon and no listings.
 */

import { slugify } from '@/lib/slug'
import resortCommunitiesData from '@/data/resort-communities.json'

export interface RegistryMatch {
  canonicalName: string   // the literal alias text, e.g. "Sunrise Village"
  resortSlug: string      // parent resort slug, e.g. "tetherow"
  resortLabel: string     // human-readable resort name, e.g. "Tetherow"
  city: string            // city name, e.g. "Bend"
  citySlug: string        // city slug, e.g. "bend"
}

type ResortEntry = {
  slug: string
  label: string
  city: string
  city_slug: string
  subdivision_aliases: string[]
}

/**
 * Walk data/resort-communities.json and find the first alias whose slugify()
 * matches the incoming URL slug. Returns null when no match.
 */
export function resolveRegistryAlias(slug: string): RegistryMatch | null {
  const communities = (resortCommunitiesData as { communities: ResortEntry[] }).communities
  for (const entry of communities) {
    for (const alias of entry.subdivision_aliases) {
      if (slugify(alias) === slug) {
        return {
          canonicalName: alias,
          resortSlug: entry.slug,
          resortLabel: entry.label,
          city: entry.city,
          citySlug: entry.city_slug,
        }
      }
    }
  }
  return null
}

/** Title-case a slug for display when no registry match is found. */
export function slugToTitle(slug: string): string {
  return slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
