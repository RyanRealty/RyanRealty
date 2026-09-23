import { describe, expect, it } from 'vitest'
import { atlasBasemapHref, parseAtlasBasemapFrame } from './atlas-basemap-href'
import { basemapForFrame, basemapForRegions, basemapFrameForRegions } from '@/lib/geo/basemap-source'

const BEND: GeoJSON.Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [-121.383117129, 44.0012345678],
      [-121.2412345678, 44.0012345678],
      [-121.2412345678, 44.1198765432],
      [-121.383117129, 44.1198765432],
      [-121.383117129, 44.0012345678],
    ],
  ],
}

describe('atlas basemap URL (UXLIVE-3)', () => {
  it('round-trips a frame at full precision', () => {
    const frame = { bbox: { minLon: -121.383117129, minLat: 44.0012345678, maxLon: -121.2412345678, maxLat: 44.1198765432 } }
    const href = atlasBasemapHref(frame)!
    expect(href.startsWith('/api/atlas/basemap?')).toBe(true)
    expect(parseAtlasBasemapFrame(new URL(href, 'https://x.test').searchParams)).toEqual(frame)
    const forced = atlasBasemapHref({ ...frame, tier: 'near', pad: 0.2 })!
    expect(parseAtlasBasemapFrame(new URL(forced, 'https://x.test').searchParams)).toEqual({ ...frame, tier: 'near', pad: 0.2 })
  })

  it('the route draws exactly the subset the page used to inline', () => {
    const regions = [{ kind: 'town', geometry: BEND as GeoJSON.Geometry }]
    for (const opts of [{}, { fit: 'dots' as const, dots: [{ lat: 44.05, lng: -121.31 }, { lat: 44.06, lng: -121.3 }] }]) {
      const inline = basemapForRegions(regions, opts)
      const frame = basemapFrameForRegions(regions, opts)!
      const parsed = parseAtlasBasemapFrame(new URL(atlasBasemapHref(frame)!, 'https://x.test').searchParams)!
      expect(JSON.stringify(basemapForFrame(parsed))).toBe(JSON.stringify(inline))
      expect(inline.roads.length + inline.waterways.length + inline.bodies.length).toBeGreaterThan(0)
    }
  })

  it('refuses a frame that is not one of our maps', () => {
    expect(atlasBasemapHref(null)).toBeNull()
    expect(atlasBasemapHref({ bbox: { minLon: 10, minLat: 44, maxLon: 11, maxLat: 45 } })).toBeNull()
    const parse = (qs: string) => parseAtlasBasemapFrame(new URLSearchParams(qs))
    expect(parse('b=-121.4,44,-121.2')).toBeNull()
    expect(parse('b=-121.4,44,-121.2,44.1&t=satellite')).toBeNull()
    expect(parse('b=-121.4,44,-121.2,44.1&p=9')).toBeNull()
    expect(parse('b=abc,44,-121.2,44.1')).toBeNull()
    expect(parse('b=-121.2,44,-121.4,44.1')).toBeNull()
  })

  it('no frame, no URL: a map with nothing to frame draws no basemap', () => {
    expect(basemapFrameForRegions([])).toBeNull()
  })
})
