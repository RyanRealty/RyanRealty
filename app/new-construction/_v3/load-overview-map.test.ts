/**
 * SITE-209: a Bend plat past PostgREST's old 1,000-row cap reaches the
 * new-construction overview map. getCommunitySubdivisions is mocked to hand
 * back 1,001 plats with the named community's plat at index 1000; the map must
 * outline it from the paged list, not fall through to the per-name boundary read.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CommunitySubdivision } from '@/lib/data/geo/getCommunitySubdivisions'
import type { BendNewConLiveMarket } from './load-live-market'

const h = vi.hoisted(() => ({
  plats: [] as CommunitySubdivision[],
  boundaryCalls: [] as Array<{ geoType: string; geoSlug: string }>,
}))

vi.mock('@/lib/data', () => ({
  getBoundaryGeoJSON: vi.fn(async (input: { geoType: string; geoSlug: string }) => {
    h.boundaryCalls.push(input)
    return null
  }),
  getCommunitySubdivisions: vi.fn(async () => h.plats),
  getAtlasTiles: vi.fn(),
}))

import { loadNewConOverviewMap } from './load-overview-map'

const TARGET_INDEX = 1000
const TARGET_NAME = 'Stevens Ranch'

function squareAt(x: number, y: number, side: number): GeoJSON.Polygon {
  return {
    type: 'Polygon',
    coordinates: [[[x, y], [x + side, y], [x + side, y + side], [x, y + side], [x, y]]],
  }
}

/** 1,001 plats; only the one at index 1000 is the named community's plat. */
function platsWithTargetAt(index: number): CommunitySubdivision[] {
  return Array.from({ length: index + 1 }, (_, i) =>
    i === index
      ? { slug: 'stevens-ranch', label: TARGET_NAME, geometry: squareAt(-121.25, 44.02, 0.01), activeHomes: 0 }
      : {
          slug: `plat-${String(i).padStart(4, '0')}`,
          label: `Plat ${String(i).padStart(4, '0')}`,
          geometry: squareAt(-121.5 + (i % 40) * 0.001, 44.1 + Math.floor(i / 40) * 0.001, 0.0005),
          activeHomes: (i * 7919) % 13,
        },
  )
}

function market(): BendNewConLiveMarket {
  return {
    named: [
      {
        name: TARGET_NAME,
        count: 1,
        href: '/homes-for-sale/bend',
        priceBand: null,
        typical: null,
        propertySubTypes: [],
        snapshot: null,
      },
    ],
    unspecifiedCount: 0,
    excluded: [],
    homeCount: 1,
    namedCount: 1,
    priceMin: null,
    priceMax: null,
    median: null,
    tiles: [],
    bendTiles: [],
    source: 'test',
    stamp: 'test',
    incomplete: false,
    listingsOk: true,
    rawTotal: 1,
  }
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'
  h.plats = platsWithTargetAt(TARGET_INDEX)
  h.boundaryCalls.length = 0
})

describe('loadNewConOverviewMap (SITE-209)', () => {
  it('outlines a named community whose plat sits past row 1,000 of the city list', async () => {
    const map = await loadNewConOverviewMap(market())
    const region = map.regions.find((r) => r.id === 'subdivision:stevens-ranch')
    expect(region).toBeDefined()
    expect(region!.name).toBe(TARGET_NAME)
    expect(region!.geometry).toEqual(h.plats[TARGET_INDEX]!.geometry)
    expect(map.outlinedNamed).toBe(1)
    expect(map.namedTotal).toBe(1)
    expect(map.incomplete).toBe(false)
    // Matched from the plat list: no per-name subdivision boundary read fired.
    expect(h.boundaryCalls.filter((c) => c.geoType === 'subdivision')).toEqual([])
  })

  it('draws only the matched plat, never the whole city list', async () => {
    const map = await loadNewConOverviewMap(market())
    expect(map.regions.filter((r) => r.kind === 'subdivision')).toHaveLength(1)
  })

  it('(control) the same plat is lost when the list stops at the old 1,000-row cap', async () => {
    h.plats = h.plats.slice(0, TARGET_INDEX)
    const map = await loadNewConOverviewMap(market())
    expect(map.regions.find((r) => r.id === 'subdivision:stevens-ranch')).toBeUndefined()
    expect(map.outlinedNamed).toBe(0)
    // It fell through to the per-name boundary read, which had nothing.
    expect(h.boundaryCalls.some((c) => c.geoType === 'subdivision' && c.geoSlug === 'stevens-ranch')).toBe(true)
  })
})
