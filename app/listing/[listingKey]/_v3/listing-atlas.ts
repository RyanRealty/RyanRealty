/**
 * The living map for a listing page: the home's own neighborhood (or, without
 * a recorded neighborhood, its city) as the frame, every listing of every
 * type inside it as dots, the recorded plats as doors — the same population
 * and the same builder the place pages read (buildPlaceAtlas), so a buyer on
 * a listing sees the map the neighborhood page shows, with this home held.
 *
 * Every read is capped and falls back: a listing page never waits on the map
 * and never prints a count it could not read (the Atlas's incomplete branch).
 */
import type { AtlasRegion } from '@/components/site/v3'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS, type AtlasPopulation } from '@/lib/atlas/build-place-atlas'
import { atlasRegionNames } from '@/lib/atlas/place-names'
import { getBoundaryGeoJSON, getCommunitySubdivisions } from '@/lib/data'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { outerRings, pointInRings } from '@/lib/geo/project-svg'

export type ListingAtlasScope = {
  /** The MLS City the home files under; scopes the population read. */
  city: string
  citySlug: string | null
  cityName: string | null
  neighborhoodSlug: string | null
  neighborhoodName: string | null
  /**
   * The boundary the page resolved by its own fallback chain — used as the
   * CITY frame. The neighborhood frame is read here by its recorded slug, so
   * the headline never names a neighborhood over a city's population.
   */
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null
  /** The home's coordinate, so its own plat is always among the outlines. */
  lat: number | null
  lng: number | null
}

export type ListingAtlas = {
  atlas: AtlasPopulation
  regions: AtlasRegion[]
  /** How many places with a recorded boundary the frame holds (the outlines are a subset). */
  outlinedOf: number
  /** True when the frame is the dots' own extent: a city with no recorded boundary. */
  dotsFrame: boolean
  /** What the frame is: "Awbrey Butte" or "Bend". */
  frameName: string
  frameHref: string | null
}

const READ_MS = 4500

export async function buildListingAtlas(scope: ListingAtlasScope): Promise<ListingAtlas | null> {
  if (!scope.city.trim()) return null
  const wantsNeighborhood = !!(scope.citySlug && scope.neighborhoodSlug && scope.neighborhoodName)
  const neighborhoodBoundary = wantsNeighborhood
    ? await withTimeoutFallback(
        getBoundaryGeoJSON({ geoType: 'neighborhood', geoSlug: `${scope.citySlug}-${scope.neighborhoodSlug}` }).catch(() => null),
        null,
        READ_MS,
        'listing:atlasBoundary',
      )
    : null
  const hasNeighborhood = neighborhoodBoundary != null
  const boundary = neighborhoodBoundary ?? scope.boundary
  const frameName = hasNeighborhood ? scope.neighborhoodName! : (scope.cityName ?? scope.city)
  const frameHref = hasNeighborhood
    ? `/cities/${scope.citySlug}/${scope.neighborhoodSlug}`
    : scope.citySlug
      ? `/cities/${scope.citySlug}`
      : null

  // No recorded boundary (a city outside the mapped set): the frame is the
  // city's own listings, no outlines — one section for every listing, never a
  // different map by city (pass four, E13).
  const [atlasRead, plats] = await Promise.all([
    withTimeoutFallback(
      buildPlaceAtlas(boundary ? { cities: [scope.city], boundary, label: frameName } : { cities: [scope.city], label: frameName }).catch(() => null),
      null,
      READ_MS + 1500,
      'listing:atlas',
    ),
    withTimeoutFallback(
      (hasNeighborhood
        ? getCommunitySubdivisions({ geoType: 'neighborhood', geoSlug: `${scope.citySlug}-${scope.neighborhoodSlug}` })
        : scope.citySlug
          ? getCommunitySubdivisions({ geoType: 'city', geoSlug: scope.citySlug })
          : Promise.resolve([])
      ).catch(() => []),
      [],
      READ_MS,
      'listing:atlasPlats',
    ),
  ])

  const withGeometry = plats.filter((c) => !!c.geometry)
  const ranked = hasNeighborhood ? withGeometry : [...withGeometry].sort((a, b) => (b.activeHomes ?? 0) - (a.activeHomes ?? 0))
  const cap = hasNeighborhood ? 80 : 60
  const cells = ranked.slice(0, cap)
  // The home's own plat is always outlined, cap or no cap (pass four, E2).
  if (scope.lat != null && scope.lng != null) {
    const home = withGeometry.find((c) => pointInRings(scope.lng!, scope.lat!, outerRings(c.geometry)))
    if (home && !cells.includes(home)) cells.push(home)
  }
  const names = atlasRegionNames(cells.map((c) => c.label))
  const regions: AtlasRegion[] = [
    ...(boundary
      ? [
          {
            id: hasNeighborhood ? `neighborhood:${scope.neighborhoodSlug}` : `city:${scope.citySlug ?? scope.city}`,
            kind: 'town' as const,
            kindLabel: hasNeighborhood ? 'Neighborhood' : 'City',
            name: frameName,
            href: frameHref ?? '#',
            geometry: boundary,
          },
        ]
      : []),
    ...cells.flatMap((cell, i): AtlasRegion[] =>
      cell.geometry
        ? [
            {
              id: `subdivision:${cell.slug}`,
              kind: 'neighborhood',
              kindLabel: 'Subdivision',
              name: names[i] ?? cell.label,
              href: `/subdivisions/${cell.slug}`,
              geometry: cell.geometry,
            },
          ]
        : [],
    ),
  ]

  return {
    atlas: atlasRead ?? EMPTY_PLACE_ATLAS,
    regions,
    frameName,
    frameHref,
    outlinedOf: (boundary ? 1 : 0) + withGeometry.length,
    dotsFrame: !boundary,
  }
}
