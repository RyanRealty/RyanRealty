import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock('@/lib/data', () => ({ getAtlasTiles: () => Promise.resolve([]) }))

import { deferredAtlasProps } from './atlas-deferred'
import { hashAtlasBoundary } from './build-place-atlas'
import { parseAtlasDotsScope } from './atlas-dots-scope'
import { atlasMembership, atlasShapeRings } from './atlas-derive'
import type { AtlasDot, AtlasRegion } from '@/components/site/v3'

/** A plat outline the way the county digitised it: 600 vertices at 15 decimals. */
function plat(id: string, cx: number, cy: number, r: number): AtlasRegion {
  const ring: number[][] = []
  for (let i = 0; i < 600; i += 1) {
    const a = (i / 600) * Math.PI * 2
    ring.push([cx + r * Math.cos(a) + 1.23456789e-11, cy + r * Math.sin(a) * 0.7 - 9.8765e-12])
  }
  ring.push(ring[0]!)
  return {
    id: `subdivision:${id}`,
    kind: 'subdivision',
    name: id,
    href: `/subdivisions/${id}`,
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}

const TOWN: AtlasRegion = {
  id: 'neighborhood:awbrey-test',
  kind: 'town',
  name: 'Awbrey Test',
  href: '/cities/bend/awbrey-test',
  geometry: plat('outline', -121.34, 44.07, 0.03).geometry,
}
const PLATS = Array.from({ length: 60 }, (_, i) => plat(`phase-${i}`, -121.36 + (i % 10) * 0.004, 44.05 + Math.floor(i / 10) * 0.006, 0.0018))

function dots(n: number): AtlasDot[] {
  return Array.from({ length: n }, (_, i) => ({
    k: `k${i}`,
    href: `/homes-for-sale/bend/k${i}`,
    lat: Number((44.05 + (i % 37) * 0.001).toFixed(4)),
    lng: Number((-121.36 + (i % 41) * 0.001).toFixed(4)),
    p: 400_000 + i * 5_000,
    t: i % 7 === 0 ? 'land' : 'house',
    s: i % 5 === 0 ? 'pending' : 'active',
    age: i,
    photo: `https://cdn.resize.sparkplatform.com/ore/800x600/true/2026${String(i).padStart(12, '0')}-o.jpg`,
    street: `${1000 + i} NW Test Avenue, Bend`,
    beds: 3,
    baths: 2,
    sqft: 1800,
  }))
}

const BOUNDARY = TOWN.geometry
const BASE = {
  scope: {
    cities: ['Bend'],
    boundaryRef: { kind: 'geo' as const, geoType: 'neighborhood' as const, geoSlug: 'bend-awbrey-test' },
    boundary: BOUNDARY,
  },
  regions: [TOWN],
  childRegions: PLATS,
  fit: 'dots' as const,
  basemapFrame: { bbox: { minLon: -121.4, minLat: 44.0, maxLon: -121.3, maxLat: 44.1 } },
  nowMs: Date.parse('2026-09-23T12:00:00Z'),
}

describe('deferredAtlasProps (UXLIVE-3)', () => {
  it('moves the dots behind a URL the route can rebuild exactly, and keeps a summary', () => {
    const population = { dots: dots(140), types: [{ key: 'house', label: 'House' }, { key: 'land', label: 'Land' }], complete: true }
    const out = deferredAtlasProps({ ...BASE, population })
    expect(out.dots).toEqual([])
    expect(out.dotsSrc).toBeDefined()
    const url = new URL(out.dotsSrc!, 'https://ryan-realty.com')
    expect(parseAtlasDotsScope(url.searchParams)).toEqual({
      cities: ['Bend'],
      boundary: { kind: 'geo', geoType: 'neighborhood', geoSlug: 'bend-awbrey-test' },
    })
    expect(url.searchParams.get('h')).toBe(hashAtlasBoundary(BOUNDARY))
    expect(url.searchParams.get('d')).toBe('2026-09-23')
    expect(out.dotsSummary!.n).toBe(140)
    expect(out.dotsSummary!.counts.forSale + out.dotsSummary!.counts.pending).toBe(140)
    expect(out.basemapSrc).toMatch(/^\/api\/atlas\/basemap\?b=/)
  })

  it('server props for the atlas fall from hundreds of KB to a few', () => {
    const population = { dots: dots(1600), types: [{ key: 'house', label: 'House' }], complete: true }
    const before = JSON.stringify({ dots: population.dots, regions: [TOWN], childRegions: PLATS })
    const out = deferredAtlasProps({ ...BASE, population })
    const after = JSON.stringify({
      dots: out.dots,
      dotsSummary: out.dotsSummary,
      regions: out.regions,
      childRegions: out.childRegions,
    })
    expect(before.length).toBeGreaterThan(900_000)
    expect(after.length).toBeLessThan(before.length / 8)
  })

  it('summarises over the SAME compacted shapes it hands the Atlas', () => {
    const population = { dots: dots(300), types: [{ key: 'house', label: 'House' }], complete: true }
    const out = deferredAtlasProps({ ...BASE, population })
    // Every place id in the summary is a region the Atlas receives.
    const ids = new Set([...out.regions, ...out.childRegions].map((r) => r.id))
    for (const id of Object.keys(out.dotsSummary!.places)) expect(ids.has(id)).toBe(true)
    // And each count is what the browser will compute from the dots over
    // the shapes it receives: one membership, two runtimes.
    const shapes = atlasShapeRings([...out.regions, ...out.childRegions])
    const membership = atlasMembership(population.dots, shapes)
    const live = new Map<string, number>()
    for (const ids of membership) for (const id of ids) live.set(id, (live.get(id) ?? 0) + 1)
    expect(Object.fromEntries(Object.entries(out.dotsSummary!.places).map(([id, [n]]) => [id, n]))).toEqual(
      Object.fromEntries(live),
    )
    expect(live.get(TOWN.id)).toBeGreaterThan(100)
  })

  it('keeps the dots inline when the route could not rebuild the same population', () => {
    const population = { dots: dots(20), types: [], complete: true }
    // A short read: the Atlas says so; nothing is deferred.
    expect(deferredAtlasProps({ ...BASE, population: { ...population, complete: false } }).dotsSrc).toBeUndefined()
    // A boundary with no reference.
    const noRef = deferredAtlasProps({ ...BASE, population, scope: { ...BASE.scope, boundaryRef: null } })
    expect(noRef.dotsSrc).toBeUndefined()
    expect(noRef.dots).toHaveLength(20)
    // A city name the URL form refuses.
    const odd = deferredAtlasProps({ ...BASE, population, scope: { ...BASE.scope, cities: ['Bend<x>'] } })
    expect(odd.dots).toHaveLength(20)
    // Nothing to fetch.
    expect(deferredAtlasProps({ ...BASE, population: { ...population, dots: [] } }).dotsSrc).toBeUndefined()
  })

  it('addresses the whole service area with no boundary and no cities', () => {
    const out = deferredAtlasProps({
      ...BASE,
      population: { dots: dots(50), types: [], complete: true },
      scope: { cities: [], boundaryRef: null, boundary: null },
      fit: 'regions',
    })
    expect(out.dotsSrc).toMatch(/^\/api\/atlas\/dots\?/)
    expect(parseAtlasDotsScope(new URL(out.dotsSrc!, 'https://x.test').searchParams)).toEqual({ cities: [], boundary: null })
  })
})
