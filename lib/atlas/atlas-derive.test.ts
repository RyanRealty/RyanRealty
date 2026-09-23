import { describe, expect, it } from 'vitest'
import {
  atlasCounts,
  atlasFrameBox,
  atlasMembership,
  atlasMedianScope,
  atlasShapeRings,
  summarizeAtlasDots,
  type AtlasDerivableDot,
  type AtlasDerivableRegion,
} from './atlas-derive'
import { pointInRings } from '@/lib/geo/project-svg'

function ring(cx: number, cy: number, r: number, n = 40): GeoJSON.Polygon {
  const pts: number[][] = []
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a) * (0.6 + 0.3 * Math.sin(i))])
  }
  pts.push(pts[0]!)
  return { type: 'Polygon', coordinates: [pts] }
}

const REGIONS: AtlasDerivableRegion[] = [
  { id: 'town:a', kind: 'town', geometry: ring(-121.3, 44.05, 0.05) },
  { id: 'n:1', kind: 'neighborhood', geometry: ring(-121.32, 44.05, 0.015) },
  { id: 'n:2', kind: 'neighborhood', geometry: ring(-121.28, 44.06, 0.02) },
]

function lcg(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const rand = lcg(7)
const DOTS: AtlasDerivableDot[] = Array.from({ length: 400 }, (_, i) => ({
  k: `d${i}`,
  lng: Number((-121.37 + rand() * 0.14).toFixed(4)),
  lat: Number((44.0 + rand() * 0.1).toFixed(4)),
  p: 200_000 + Math.round(rand() * 1_500_000),
  t: i % 9 === 0 ? 'land' : 'house',
  s: i % 11 === 0 ? 'sold' : i % 4 === 0 ? 'pending' : 'active',
  soldAgo: i % 11 === 0 ? i % 45 : null,
}))

describe('atlas-derive (UXLIVE-3)', () => {
  it('membership with the bounding-box skip equals the full ring walk', () => {
    const shapes = atlasShapeRings(REGIONS)
    const brute = DOTS.map((d) => shapes.filter((s) => pointInRings(d.lng, d.lat, s.rings)).map((s) => s.id))
    expect(atlasMembership(DOTS, shapes)).toEqual(brute)
    expect(brute.some((ids) => ids.length === 2)).toBe(true)
  })

  it('frames an explicit frame, a record, and a basin three different ways', () => {
    const shapes = atlasShapeRings(REGIONS)
    const byFrame = atlasFrameBox({ frame: ring(-121.3, 44.05, 0.001), dots: DOTS, shapes })
    expect(byFrame.maxLon - byFrame.minLon).toBeLessThan(0.01)
    const byDots = atlasFrameBox({ fit: 'dots', dots: DOTS, shapes })
    const byRegions = atlasFrameBox({ fit: 'regions', dots: DOTS, shapes })
    expect(byDots).not.toEqual(byRegions)
    // No dots and no towns: Central Oregon, never NaN.
    const empty = atlasFrameBox({ dots: [], shapes: [] })
    expect(Number.isFinite(empty.minLon)).toBe(true)
  })

  it('the summary at rest is the component’s own count with every type on', () => {
    const types = [{ key: 'house' }, { key: 'land' }]
    const summary = summarizeAtlasDots({ dots: DOTS, regions: REGIONS, types, fit: 'dots' })
    const { listed, ...counts } = atlasCounts(DOTS, () => true)
    expect(summary.counts).toEqual(counts)
    expect(summary.n).toBe(400)
    const inTown = atlasMembership(DOTS, atlasShapeRings(REGIONS)).filter((ids, i) => ids.includes('town:a') && listed.includes(i))
    expect(summary.places['town:a']![0]).toBe(inTown.length)
    // Homes median: land is not in a "median home price".
    expect(atlasMedianScope(['house', 'land'], false).label).toBe('median home price')
    expect(atlasMedianScope(['land'], false).label).toBe('median lot price')
  })
})
