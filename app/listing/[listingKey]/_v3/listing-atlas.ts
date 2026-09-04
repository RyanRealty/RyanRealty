/**
 * The living map for a listing page: the home's own neighborhood or curated
 * community (NorthWest Crossing), else its city, as the frame. Every listing
 * of every type inside that frame as dots, the recorded plats as doors. Same
 * population and builder the place pages read (buildPlaceAtlas), this home held.
 *
 * Every read is capped and falls back: a listing page never waits on the map
 * and never prints a count it could not read (the Atlas's incomplete branch).
 */
import type { AtlasRegion } from '@/components/site/v3'
import { buildPlaceAtlas, EMPTY_PLACE_ATLAS, type AtlasPopulation } from '@/lib/atlas/build-place-atlas'
import { atlasRegionNames } from '@/lib/atlas/place-names'
import {
  getBoundaryGeoJSON,
  getCommunitySubdivisions,
  getResortBoundaryGeoJSON,
  getTaxlotsNear,
  type Taxlot,
} from '@/lib/data'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { outerRings, pointInRings } from '@/lib/geo/project-svg'
import { listingAtlasFrameIntent } from '@/lib/listing/listing-place-market'
import {
  cityHref,
  cityNeighborhoodHref,
  subdivisionHref,
} from '@/lib/site/place-href'

export type ListingAtlasScope = {
  /** The MLS City the home files under; scopes the population read. */
  city: string
  citySlug: string | null
  cityName: string | null
  neighborhoodSlug: string | null
  neighborhoodName: string | null
  communitySlug: string | null
  communityName: string | null
  /**
   * City fallback polygon when the finer grain has no recorded boundary.
   */
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null
  /** The home's coordinate, so its own plat is always among the outlines. */
  lat: number | null
  lng: number | null
}

export type ListingAtlas = {
  atlas: AtlasPopulation
  regions: AtlasRegion[]
  /** The lot this home sits on, and the lots around it. Empty off the map. */
  parcels: Taxlot[]
  /** The subject lot, when the county has one under this home's coordinate. */
  subjectParcel: Taxlot | null
  /** How many places with a recorded boundary the frame holds (the outlines are a subset). */
  outlinedOf: number
  /** True when the frame is the dots' own extent: a city with no recorded boundary. */
  dotsFrame: boolean
  /** What the frame is: "Awbrey Butte" or "Bend". */
  frameName: string
  frameHref: string | null
}

const READ_MS = 4500

async function readPlaceBoundary(
  slug: string,
  citySlug: string | null,
  preferResort: boolean,
): Promise<GeoJSON.Polygon | GeoJSON.MultiPolygon | null> {
  if (preferResort) {
    const resort = await withTimeoutFallback(
      getResortBoundaryGeoJSON(slug).catch(() => null),
      null,
      READ_MS,
      'listing:atlasResort',
    )
    if (resort) return resort
  }
  const slugs = citySlug && citySlug !== slug ? [slug, `${citySlug}-${slug}`] : [slug]
  for (const geoSlug of slugs) {
    for (const geoType of ['neighborhood', 'subdivision'] as const) {
      const geometry = await withTimeoutFallback(
        getBoundaryGeoJSON({ geoType, geoSlug }).catch(() => null),
        null,
        READ_MS,
        `listing:atlasBoundary:${geoType}:${geoSlug}`,
      )
      if (geometry) return geometry
    }
  }
  return null
}

export async function buildListingAtlas(scope: ListingAtlasScope): Promise<ListingAtlas | null> {
  if (!scope.city.trim()) return null
  const intent = listingAtlasFrameIntent(scope)
  let grain = intent.grain
  let frameName = intent.name
  let frameSlug = intent.slug
  let boundary =
    grain === 'city'
      ? scope.boundary
      : await readPlaceBoundary(intent.slug!, scope.citySlug, grain === 'community')
  if (!boundary && grain !== 'city' && scope.communitySlug && grain !== 'community') {
    const community = await readPlaceBoundary(scope.communitySlug, scope.citySlug, true)
    if (community) {
      grain = 'community'
      frameName = scope.communityName ?? scope.communitySlug
      frameSlug = scope.communitySlug
      boundary = community
    }
  }
  if (!boundary && grain !== 'city') {
    grain = 'city'
    frameName = scope.cityName ?? scope.city
    frameSlug = scope.citySlug
    boundary = scope.boundary
  }
  const hasLocalFrame = grain !== 'city' && boundary != null
  const frameHref =
    grain === 'neighborhood'
      ? cityNeighborhoodHref(scope.citySlug, frameSlug)
      : grain === 'community' && frameSlug
        ? `/communities/${frameSlug}`
        : cityHref(scope.citySlug)

  // No recorded boundary (a city outside the mapped set): the frame is the
  // city's own listings, no outlines — one section for every listing, never a
  // different map by city (pass four, E13).
  const [atlasRead, plats, parcels] = await Promise.all([
    withTimeoutFallback(
      buildPlaceAtlas(boundary ? { cities: [scope.city], boundary, label: frameName } : { cities: [scope.city], label: frameName }).catch(() => null),
      null,
      READ_MS + 1500,
      'listing:atlas',
    ),
    withTimeoutFallback(
      (hasLocalFrame && frameSlug
        ? getCommunitySubdivisions({ geoType: 'neighborhood', geoSlug: frameSlug })
        : scope.citySlug
          ? getCommunitySubdivisions({ geoType: 'city', geoSlug: scope.citySlug })
          : Promise.resolve([])
      ).catch(() => []),
      [],
      READ_MS,
      'listing:atlasPlats',
    ),
    // Lot lines: the county's recorded shape of this parcel and the ones it
    // touches. A read that fails costs the page nothing but the lot line.
    scope.lat != null && scope.lng != null
      ? withTimeoutFallback(
          getTaxlotsNear({ lat: scope.lat, lng: scope.lng, radiusMeters: 140, maxLots: 20 }).catch(() => []),
          [],
          READ_MS,
          'listing:taxlots',
        )
      : Promise.resolve([] as Taxlot[]),
  ])

  const withGeometry = plats.filter((c) => !!c.geometry)
  const ranked = hasLocalFrame ? withGeometry : [...withGeometry].sort((a, b) => (b.activeHomes ?? 0) - (a.activeHomes ?? 0))
  const cap = hasLocalFrame ? 80 : 60
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
            id:
              grain === 'community'
                ? `community:${frameSlug}`
                : grain === 'neighborhood'
                  ? `neighborhood:${frameSlug}`
                  : `city:${scope.citySlug ?? scope.city}`,
            kind: 'town' as const,
            kindLabel: grain === 'community' ? 'Community' : grain === 'neighborhood' ? 'Neighborhood' : 'City',
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
              href: subdivisionHref(cell.slug) ?? `/subdivisions/${cell.slug}`,
              geometry: cell.geometry,
            },
          ]
        : [],
    ),
  ]

  return {
    atlas: atlasRead ?? EMPTY_PLACE_ATLAS,
    regions,
    parcels,
    subjectParcel: parcels.find((p) => p.isSubject) ?? null,
    frameName,
    frameHref,
    outlinedOf: (boundary ? 1 : 0) + withGeometry.length,
    dotsFrame: !boundary,
  }
}
