import { describe, expect, it } from 'vitest'
import { streetsForFrame, STREET_MAX_SPAN } from './basemap-streets'
import { basemapPoints, decodeBasemapFeature } from './basemap'

/** Awbrey Butte, Bend — a frame a reader can walk. */
const AWBREY = { minLon: -121.35, maxLon: -121.31, minLat: 44.07, maxLat: 44.1 }
/** The whole basin: too coarse for a street grid. */
const REGION = { minLon: -122, maxLon: -120, minLat: 43.5, maxLat: 44.6 }

describe('streetsForFrame', () => {
  it('a walkable frame gets its named streets', () => {
    const layer = streetsForFrame(AWBREY)
    expect(layer.features.length).toBeGreaterThan(20)
    expect(layer.capped).toBe(false)
    expect(layer.source).toContain('TIGER')
  })

  it('every street it returns actually overlaps the frame', () => {
    const layer = streetsForFrame(AWBREY, 0)
    const q = layer.q
    for (const f of layer.features) {
      expect(f.b[0]! / q).toBeLessThanOrEqual(AWBREY.maxLon)
      expect(f.b[2]! / q).toBeGreaterThanOrEqual(AWBREY.minLon)
      expect(f.b[1]! / q).toBeLessThanOrEqual(AWBREY.maxLat)
      expect(f.b[3]! / q).toBeGreaterThanOrEqual(AWBREY.minLat)
    }
  })

  it('every street decodes to a drawable line, and each is named', () => {
    const layer = streetsForFrame(AWBREY)
    for (const f of layer.features.slice(0, 50)) {
      expect(f.n.length).toBeGreaterThan(0)
      expect(f.c).toBe('local')
      const parts = decodeBasemapFeature(f, layer.q)
      expect(parts.length).toBeGreaterThan(0)
      for (const points of parts) expect(points.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('a street is returned once even when it crosses a tile edge', () => {
    const layer = streetsForFrame({ minLon: -121.36, maxLon: -121.28, minLat: 44.04, maxLat: 44.12 })
    const ids = layer.features.map((f) => `${f.n}|${f.b.join(',')}`)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('a region frame draws no streets', () => {
    expect(streetsForFrame(REGION).features).toEqual([])
    const span = Math.max(REGION.maxLon - REGION.minLon, REGION.maxLat - REGION.minLat)
    expect(span).toBeGreaterThan(STREET_MAX_SPAN)
  })

  it('empty ground and no frame return nothing', () => {
    expect(streetsForFrame(null).features).toEqual([])
    // The high desert east of Brothers: inside the span limit, no named street.
    expect(streetsForFrame({ minLon: -120.2, maxLon: -120.18, minLat: 43.7, maxLat: 43.72 }).features).toEqual([])
  })

  it('a walkable frame stays a small payload', () => {
    const layer = streetsForFrame(AWBREY)
    expect(basemapPoints({ roads: layer.features, waterways: [], bodies: [], q: layer.q } as never)).toBeLessThan(20000)
  })
})
