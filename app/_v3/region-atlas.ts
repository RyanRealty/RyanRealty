/**
 * The regional Atlas regions — every town with a recorded boundary, every
 * registry community with one, every Bend neighborhood with one — assembled
 * once for the surfaces that draw Central Oregon whole (the homepage hero,
 * the About page's service area). One assembly, one set of names, so two
 * pages never outline a different region.
 *
 * Names: a town is its indexed city name; a community is its registry label;
 * a neighborhood is its recorded name. Recorded plat names are not in play
 * here (they belong to the scoped place pages), so no residue stripping.
 */
import { getCitiesForIndex } from '@/app/actions/cities'
import { getAllNeighborhoodsWithCity, getBoundaryGeoJSON } from '@/lib/data'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import type { AtlasRegion } from '@/components/site/v3'

/** The six featured towns, in the order the homepage ledgers them. */
export const REGION_TOWN_ORDER = ['bend', 'la-pine', 'redmond', 'sunriver', 'sisters', 'terrebonne'] as const

export type RegionAtlasRegions = {
  regions: AtlasRegion[]
  towns: number
  communities: number
  neighborhoods: number
  /** The featured towns' boundaries, in REGION_TOWN_ORDER (null when unrecorded). */
  townBoundaries: Awaited<ReturnType<typeof getBoundaryGeoJSON>>[]
}

function titleCaseName(s: string): string {
  return s.replace(/\b\w/g, (m) => m.toUpperCase())
}

export async function buildRegionAtlasRegions(): Promise<RegionAtlasRegions> {
  const [cities, neighborhoodRows, townBoundaries, communityBoundaries] = await Promise.all([
    getCitiesForIndex().catch(() => []),
    getAllNeighborhoodsWithCity().catch(() => []),
    Promise.all(
      REGION_TOWN_ORDER.map((slug) => getBoundaryGeoJSON({ geoType: 'city', geoSlug: slug }).catch(() => null)),
    ),
    Promise.all(
      getAllResortCommunities().map((c) =>
        getBoundaryGeoJSON({ geoType: 'neighborhood', geoSlug: c.slug })
          .then((geometry) => ({ c, geometry }))
          .catch(() => ({ c, geometry: null })),
      ),
    ),
  ])
  const cityBySlug = new Map(cities.map((c) => [c.slug, c] as const))
  const featured = new Set<string>(REGION_TOWN_ORDER)

  // Every indexed city with a recorded boundary is a town silhouette, not
  // just the six featured ones (evaluator pass four, Q2).
  const extraTowns = await Promise.all(
    cities
      .filter((c) => !featured.has(c.slug))
      .map((c) =>
        getBoundaryGeoJSON({ geoType: 'city', geoSlug: c.slug })
          .then((geometry) => ({ c, geometry }))
          .catch(() => ({ c, geometry: null })),
      ),
  )

  const registrySlugs = new Set(getAllResortCommunities().map((c) => c.slug))
  const bendNeighborhoods = neighborhoodRows.filter((r) => {
    const city = Array.isArray(r.cities) ? r.cities[0] : r.cities
    const citySlug = (city?.slug ?? '').toLowerCase().trim()
    const slug = (r.slug ?? '').toLowerCase().trim()
    return citySlug === 'bend' && slug && r.name && !registrySlugs.has(slug)
  })
  const neighborhoodBoundaries = await Promise.all(
    bendNeighborhoods.map((r) =>
      getBoundaryGeoJSON({ geoType: 'neighborhood', geoSlug: `bend-${(r.slug ?? '').toLowerCase().trim()}` })
        .then((geometry) => ({ r, geometry }))
        .catch(() => ({ r, geometry: null })),
    ),
  )

  const regions: AtlasRegion[] = [
    ...REGION_TOWN_ORDER.flatMap((slug, i): AtlasRegion[] => {
      const geometry = townBoundaries[i]
      if (!geometry) return []
      const name = cityBySlug.get(slug)?.name ?? titleCaseName(slug.replace(/-/g, ' '))
      return [{ id: `town:${slug}`, kind: 'town', name, href: `/cities/${slug}`, geometry }]
    }),
    ...extraTowns.flatMap(({ c, geometry }): AtlasRegion[] =>
      geometry ? [{ id: `town:${c.slug}`, kind: 'town', name: c.name, href: `/cities/${c.slug}`, geometry }] : [],
    ),
    ...communityBoundaries.flatMap(({ c, geometry }): AtlasRegion[] =>
      geometry
        ? [{ id: `community:${c.slug}`, kind: 'community', name: c.label, href: `/communities/${c.slug}`, geometry }]
        : [],
    ),
    ...neighborhoodBoundaries.flatMap(({ r, geometry }): AtlasRegion[] => {
      const slug = (r.slug ?? '').toLowerCase().trim()
      return geometry
        ? [{ id: `neighborhood:${slug}`, kind: 'neighborhood', name: r.name as string, href: `/cities/bend/${slug}`, geometry }]
        : []
    }),
  ]

  return {
    regions,
    towns: regions.filter((r) => r.kind === 'town').length,
    communities: regions.filter((r) => r.kind === 'community').length,
    neighborhoods: regions.filter((r) => r.kind === 'neighborhood').length,
    townBoundaries,
  }
}
