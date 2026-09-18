import { describe, expect, it } from 'vitest'
import { getParkBySlug } from '@/data/co-parks'
import { getTrailBySlug } from '@/data/co-trails'
import {
  assembleAmenityLayers,
  amenityGeomTouchesPlace,
  amenityInsidePlace,
  cityNameMatches,
  isParkPolygon,
  isTrailLine,
  parksNeedingGeom,
  selectParkCandidates,
  selectTrailCandidates,
  trailsNeedingGeom,
} from './place-amenity-layers'
import { lineStringParts } from '@/lib/geo/project-svg'

const BEND_SQUARE: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-121.4, 44.0],
      [-121.2, 44.0],
      [-121.2, 44.1],
      [-121.4, 44.1],
      [-121.4, 44.0],
    ],
  ],
}

const PARK_POLY: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-121.32, 44.05],
      [-121.31, 44.05],
      [-121.31, 44.06],
      [-121.32, 44.06],
      [-121.32, 44.05],
    ],
  ],
}

const TRAIL_LINE: GeoJSON.LineString = {
  type: 'LineString',
  coordinates: [
    [-121.31, 44.055],
    [-121.3, 44.058],
  ],
}

describe('place amenity membership', () => {
  it('contract: real-park-polygons-only — Bend candidates are registry parks, not invented slugs', () => {
    const parks = selectParkCandidates({ grain: 'city', cityName: 'Bend' })
    expect(parks.some((park) => park.slug === 'juniper-park')).toBe(true)
    expect(parks.some((park) => park.slug === 'farewell-bend-park')).toBe(true)
    expect(parks.every((park) => cityNameMatches('Bend', park.city))).toBe(true)
    expect(parks.length).toBeGreaterThan(0)
  })

  it('contract: real-trail-lines-only — Bend candidates are registry trails; communitySlug is a real assignment', () => {
    const trails = selectTrailCandidates({ grain: 'city', cityName: 'Bend', citySlug: 'bend' })
    expect(trails.some((trail) => trail.slug === 'phils-trail')).toBe(true)
    const ranch = selectTrailCandidates({
      grain: 'community',
      cityName: 'Terrebonne',
      communitySlug: 'crooked-river-ranch',
    })
    expect(ranch.some((trail) => trail.slug === 'steelhead-falls')).toBe(true)
  })

  it('contract: omit-missing-geom — a registry park without a boundaries row never becomes a circle', () => {
    const juniper = getParkBySlug('juniper-park')!
    const layers = assembleAmenityLayers({
      grain: 'city',
      cityName: 'Bend',
      parkGeom: new Map([[juniper.slug, null]]),
      trailGeom: new Map(),
    })
    expect(layers.parks).toHaveLength(0)
    expect(layers.omitted.some((row) => row.slug === juniper.slug && row.reason === 'geom-missing')).toBe(
      true,
    )
    expect(layers.parks.every((park) => isParkPolygon(park.geometry))).toBe(true)
  })

  it('omits a trail with no trail_lines row instead of drawing a trailhead stroke', () => {
    const phils = getTrailBySlug('phils-trail')!
    const layers = assembleAmenityLayers({
      grain: 'city',
      cityName: 'Bend',
      citySlug: 'bend',
      parkGeom: new Map(),
      trailGeom: new Map([[phils.slug, null]]),
    })
    expect(layers.trails).toHaveLength(0)
    expect(layers.omitted.some((row) => row.slug === phils.slug && row.reason === 'geom-missing')).toBe(
      true,
    )
  })

  it('keeps only parks whose centroid sits inside a neighborhood / community / plat ring', () => {
    const juniper = getParkBySlug('juniper-park')!
    const inside = assembleAmenityLayers({
      grain: 'neighborhood',
      cityName: 'Bend',
      placeGeometry: BEND_SQUARE,
      parkGeom: new Map([[juniper.slug, PARK_POLY]]),
      trailGeom: new Map(),
    })
    expect(amenityInsidePlace(juniper.lng, juniper.lat, BEND_SQUARE)).toBe(true)
    expect(inside.parks.map((park) => park.slug)).toContain('juniper-park')

    const far: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-120.9, 44.3],
          [-120.8, 44.3],
          [-120.8, 44.4],
          [-120.9, 44.4],
          [-120.9, 44.3],
        ],
      ],
    }
    const outside = assembleAmenityLayers({
      grain: 'neighborhood',
      cityName: 'Bend',
      placeGeometry: far,
      parkGeom: new Map([[juniper.slug, PARK_POLY]]),
      trailGeom: new Map(),
    })
    expect(outside.parks).toHaveLength(0)
    expect(outside.omitted.some((row) => row.slug === 'juniper-park' && row.reason === 'outside-place')).toBe(
      true,
    )
  })

  it('contract: official-geom-touch-local — community grain keeps a park whose official polygon touches the ring even when the centroid sits outside', () => {
    const communityRing: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-121.305, 44.048],
          [-121.295, 44.048],
          [-121.295, 44.058],
          [-121.305, 44.058],
          [-121.305, 44.048],
        ],
      ],
    }
    const overlappingPark: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-121.32, 44.04],
          [-121.3, 44.04],
          [-121.3, 44.052],
          [-121.32, 44.052],
          [-121.32, 44.04],
        ],
      ],
    }
    expect(amenityGeomTouchesPlace(overlappingPark, communityRing)).toBe(true)
    expect(amenityInsidePlace(-121.31, 44.046, communityRing)).toBe(false)

    const layers = assembleAmenityLayers({
      grain: 'community',
      cityName: 'Bend',
      citySlug: 'bend',
      communitySlug: 'tetherow',
      placeGeometry: communityRing,
      parkGeom: new Map([['juniper-park', overlappingPark]]),
      trailGeom: new Map(),
    })
    expect(layers.parks.map((park) => park.slug)).toContain('juniper-park')
    expect(layers.parks[0]?.geometry).toBe(overlappingPark)
  })

  it('contract: official-geom-touch-local — subdivision grain keeps a trail_lines stroke that crosses the plat and omits one that does not', () => {
    const plat: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-121.305, 44.048],
          [-121.295, 44.048],
          [-121.295, 44.058],
          [-121.305, 44.058],
          [-121.305, 44.048],
        ],
      ],
    }
    const crossing: GeoJSON.LineString = {
      type: 'LineString',
      coordinates: [
        [-121.31, 44.053],
        [-121.3, 44.053],
      ],
    }
    const elsewhere: GeoJSON.LineString = {
      type: 'LineString',
      coordinates: [
        [-121.4, 44.2],
        [-121.39, 44.21],
      ],
    }
    expect(amenityGeomTouchesPlace(crossing, plat)).toBe(true)
    expect(amenityGeomTouchesPlace(elsewhere, plat)).toBe(false)

    const layers = assembleAmenityLayers({
      grain: 'subdivision',
      cityName: 'Bend',
      citySlug: 'bend',
      communitySlug: 'tetherow',
      placeGeometry: plat,
      parkGeom: new Map(),
      trailGeom: new Map([
        ['phils-trail', crossing],
        ['whoops-trail', elsewhere],
      ]),
    })
    expect(layers.trails.map((trail) => trail.slug)).toContain('phils-trail')
    expect(layers.trails.map((trail) => trail.slug)).not.toContain('whoops-trail')
    expect(
      layers.omitted.some((row) => row.slug === 'whoops-trail' && row.reason === 'outside-place'),
    ).toBe(true)
  })

  it('draws a communitySlug trail from trail_lines even when the trailhead sits outside the ring', () => {
    const steelhead = getTrailBySlug('steelhead-falls')!
    const layers = assembleAmenityLayers({
      grain: 'community',
      cityName: 'Terrebonne',
      communitySlug: 'crooked-river-ranch',
      placeGeometry: BEND_SQUARE,
      parkGeom: new Map(),
      trailGeom: new Map([[steelhead.slug, TRAIL_LINE]]),
    })
    expect(layers.trails.some((trail) => trail.slug === 'steelhead-falls')).toBe(true)
    expect(layers.trails.every((trail) => isTrailLine(trail.geometry))).toBe(true)
  })

  it('fetches only parks and trails that already have membership, never a city-wide fan-out on a local ring', () => {
    const far: GeoJSON.Polygon = {
      type: 'Polygon',
      coordinates: [
        [
          [-120.9, 44.3],
          [-120.8, 44.3],
          [-120.8, 44.4],
          [-120.9, 44.4],
          [-120.9, 44.3],
        ],
      ],
    }
    expect(parksNeedingGeom({ grain: 'neighborhood', cityName: 'Bend', placeGeometry: far })).toEqual([])
    expect(
      trailsNeedingGeom({
        grain: 'community',
        cityName: 'Terrebonne',
        communitySlug: 'crooked-river-ranch',
        placeGeometry: far,
      }).some((trail) => trail.slug === 'steelhead-falls'),
    ).toBe(true)
  })

  it('contract: no-osm-invent — assemble never synthesizes coordinates; it only forwards provided geom', () => {
    const src = [
      assembleAmenityLayers.toString(),
      selectParkCandidates.toString(),
      selectTrailCandidates.toString(),
    ].join('\n')
    expect(src).not.toMatch(/overpass|openstreetmap|\bosm\b/i)
    expect(src).not.toMatch(/buffer|corridor|invent/i)
    const layers = assembleAmenityLayers({
      grain: 'city',
      cityName: 'Bend',
      parkGeom: new Map([['juniper-park', PARK_POLY]]),
      trailGeom: new Map([['phils-trail', TRAIL_LINE]]),
    })
    expect(layers.parks.find((park) => park.slug === 'juniper-park')?.geometry).toBe(PARK_POLY)
    expect(layers.trails.find((trail) => trail.slug === 'phils-trail')?.geometry).toBe(TRAIL_LINE)
    expect(lineStringParts(TRAIL_LINE)[0]).toEqual([
      [-121.31, 44.055],
      [-121.3, 44.058],
    ])
  })
})
