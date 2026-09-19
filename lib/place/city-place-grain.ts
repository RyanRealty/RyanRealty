/**
 * City place-rail grain (SITE-128 rematch).
 *
 * Matt LOCK: Community ≠ Neighborhood. A city Communities rail that mixes
 * Awbrey Butte (a designated district) with Parkside Place Phase 1 (a plat)
 * is the wrong grain. Neighborhoods stay on #neighborhoods. Registry /
 * resort communities stay on #communities. Everything else is a plat and
 * belongs on name-only #child-places, not the photo rail.
 *
 * Pure. No DB. Registry + the committed Bend district list.
 */
import { BEND_NEIGHBORHOOD_DISTRICTS } from '@/lib/data/geo/bend-neighborhood-districts'
import { getAllResortCommunities } from '@/lib/data/communities/registry'

export type CityPlaceGrain = 'neighborhood' | 'community' | 'plat'

export function bareCityPlaceSlug(slug: string, citySlug?: string | null): string {
  const s = slug.trim().toLowerCase()
  const city = (citySlug ?? '').trim().toLowerCase()
  if (city && s.startsWith(`${city}-`)) return s.slice(city.length + 1)
  if (s.startsWith('bend-')) return s.slice(5)
  return s
}

function registryCommunity(slug: string, name: string) {
  const s = slug.trim().toLowerCase()
  const n = name.trim().toLowerCase()
  return (
    getAllResortCommunities().find((c) => {
      if (c.slug === s) return true
      if (c.label.trim().toLowerCase() === n) return true
      if (c.former_labels?.some((label) => label.trim().toLowerCase() === n)) return true
      return false
    }) ?? null
  )
}

export function isNeighborhoodGrain(name: string, slug: string, citySlug?: string | null): boolean {
  const n = name.trim().toLowerCase()
  const s = slug.trim().toLowerCase()
  const bare = bareCityPlaceSlug(s, citySlug)
  return BEND_NEIGHBORHOOD_DISTRICTS.some(
    (d) => d.slug === s || d.slug === bare || d.label.trim().toLowerCase() === n,
  )
}

export function cityPlaceGrain(input: {
  name: string
  slug: string
  isResort?: boolean
  citySlug?: string | null
}): CityPlaceGrain {
  const name = input.name.trim()
  const slug = input.slug.trim().toLowerCase()
  if (!name || !slug) return 'plat'
  if (isNeighborhoodGrain(name, slug, input.citySlug)) return 'neighborhood'
  const bare = bareCityPlaceSlug(slug, input.citySlug)
  if (input.isResort || registryCommunity(slug, name) || registryCommunity(bare, name)) {
    return 'community'
  }
  return 'plat'
}
