/**
 * SITE-209: a listing whose plat sits past PostgREST's old 1,000-row cap
 * still gets that plat drawn as its subject outline on a city-scope atlas
 * (no neighborhood or community frame). getCommunitySubdivisions is mocked
 * to hand back 1,001 Bend plats with the home's plat at index 1000.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommunitySubdivision } from '@/lib/data/geo/getCommunitySubdivisions'

const h = vi.hoisted(() => ({
  plats: [] as CommunitySubdivision[],
  platCalls: [] as Array<{ geoType: string; geoSlug: string }>,
  population: {
    dots: [],
    types: [],
    events: [],
    source: 'test',
    stamp: 'test',
    counts: { forSale: 0, pending: 0, sold: 0, cities: 1 },
  },
}))

vi.mock('@/lib/data', () => ({
  getBoundaryGeoJSON: vi.fn(async () => null),
  getResortBoundaryGeoJSON: vi.fn(async () => null),
  getTaxlotsNear: vi.fn(async () => []),
  getCommunitySubdivisions: vi.fn(async (input: { geoType: string; geoSlug: string }) => {
    h.platCalls.push(input)
    return h.plats
  }),
  getAtlasTiles: vi.fn(),
}))

vi.mock('@/lib/atlas/build-place-atlas', () => ({
  buildPlaceAtlas: vi.fn(async () => h.population),
  EMPTY_PLACE_ATLAS: h.population,
}))

import { buildListingAtlas, type ListingAtlasScope } from './listing-atlas'

const TARGET_INDEX = 1000
const TARGET = { slug: 'sunrise-village', label: 'Sunrise Village' }
/** The subject plat's square and a point inside it. */
const TARGET_SQUARE: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [[[-121.26, 44.02], [-121.25, 44.02], [-121.25, 44.03], [-121.26, 44.03], [-121.26, 44.02]]],
}
const HOME = { lat: 44.025, lng: -121.255 }

function squareAt(x: number, y: number, side: number): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [[[x, y], [x + side, y], [x + side, y + side], [x, y + side], [x, y]]],
  }
}

/** 1,001 plats; the home's plat is the one at index 1000, and no other plat holds the home. */
function platsWithTargetAt(index: number): CommunitySubdivision[] {
  return Array.from({ length: index + 1 }, (_, i) =>
    i === index
      ? { ...TARGET, geometry: TARGET_SQUARE, activeHomes: 0 }
      : {
          slug: `plat-${String(i).padStart(4, '0')}`,
          label: `Plat ${String(i).padStart(4, '0')}`,
          geometry: squareAt(-121.5 + (i % 40) * 0.001, 44.1 + Math.floor(i / 40) * 0.001, 0.0005),
          activeHomes: (i * 7919) % 13,
        },
  )
}

const CITY_BOUNDARY: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [[[-121.6, 43.9], [-121.1, 43.9], [-121.1, 44.3], [-121.6, 44.3], [-121.6, 43.9]]],
}

function cityScope(): ListingAtlasScope {
  return {
    city: 'Bend',
    citySlug: 'bend',
    cityName: 'Bend',
    neighborhoodSlug: null,
    neighborhoodName: null,
    communitySlug: null,
    communityName: null,
    boundary: CITY_BOUNDARY,
    lat: HOME.lat,
    lng: HOME.lng,
  }
}

beforeEach(() => {
  h.plats = platsWithTargetAt(TARGET_INDEX)
  h.platCalls.length = 0
})

describe('buildListingAtlas at city scope (SITE-209)', () => {
  it('draws the home\'s plat as the subject outline when it sits past row 1,000 of the city list', async () => {
    const atlas = await buildListingAtlas(cityScope())
    expect(atlas).not.toBeNull()
    expect(h.platCalls).toEqual([{ geoType: 'city', geoSlug: 'bend' }])
    expect(atlas!.frameName).toBe('Bend')
    expect(atlas!.dotsFrame).toBe(false)
    const ids = atlas!.regions.map((r) => r.id)
    expect(ids).toEqual(['city:bend', `subdivision:${TARGET.slug}`])
    const subject = atlas!.regions.find((r) => r.id === `subdivision:${TARGET.slug}`)!
    expect(subject.kind).toBe('subdivision')
    expect(subject.name).toBe(TARGET.label)
    expect(subject.geometry).toEqual(TARGET_SQUARE)
    expect(subject.href).toBe(`/subdivisions/${TARGET.slug}`)
    // outlinedOf counts the frame plus every plat with a recorded boundary.
    expect(atlas!.outlinedOf).toBe(1 + TARGET_INDEX + 1)
    // A city frame never dumps siblings.
    expect(atlas!.otherSubdivs).toEqual([])
  })

  it('(control) the same plat is lost when the list stops at the old 1,000-row cap', async () => {
    h.plats = h.plats.slice(0, TARGET_INDEX)
    const atlas = await buildListingAtlas(cityScope())
    expect(atlas!.regions.map((r) => r.id)).toEqual(['city:bend'])
    expect(atlas!.outlinedOf).toBe(1 + TARGET_INDEX)
  })
})
