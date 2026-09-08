import { describe, expect, it } from 'vitest'
import {
  fitStaticMapView,
  latLngToWorld,
  projectToImagePercent,
  worldToLatLng,
  type LatLng,
} from './static-map-projection'

/** Five Redmond sales and the subject, from the 2465 7th document. */
const SUBJECT: LatLng = { lat: 44.272, lng: -121.174 }
const SALES: LatLng[] = [
  { lat: 44.2731, lng: -121.1751 },
  { lat: 44.2698, lng: -121.1712 },
  { lat: 44.2765, lng: -121.1802 },
  { lat: 44.2712, lng: -121.1688 },
  { lat: 44.2744, lng: -121.1779 },
]

describe('Web Mercator, the part a static map needs', () => {
  it('puts the origin at the middle of the world', () => {
    const w = latLngToWorld({ lat: 0, lng: 0 })
    expect(w.x).toBeCloseTo(128, 6)
    expect(w.y).toBeCloseTo(128, 6)
  })

  it('round-trips every point it projects', () => {
    for (const p of [SUBJECT, ...SALES, { lat: 0, lng: 0 }, { lat: -33.9, lng: 151.2 }]) {
      const back = worldToLatLng(latLngToWorld(p))
      expect(back.lat).toBeCloseTo(p.lat, 9)
      expect(back.lng).toBeCloseTo(p.lng, 9)
    }
  })

  it('clamps past the Mercator pole rather than returning infinity', () => {
    expect(Number.isFinite(latLngToWorld({ lat: 90, lng: 0 }).y)).toBe(true)
    expect(Number.isFinite(latLngToWorld({ lat: -90, lng: 0 }).y)).toBe(true)
  })
})

describe('fitting a static map to the sales', () => {
  const view = fitStaticMapView([SUBJECT, ...SALES], { width: 640, height: 360, padding: 56 })!

  it('centres on the middle of the set', () => {
    expect(view).not.toBeNull()
    expect(view.centerLat).toBeGreaterThan(44.269)
    expect(view.centerLat).toBeLessThan(44.277)
    expect(view.centerLng).toBeGreaterThan(-121.181)
    expect(view.centerLng).toBeLessThan(-121.168)
  })

  it('asks for an integer zoom Google can actually give us', () => {
    expect(Number.isInteger(view.zoom)).toBe(true)
    expect(view.zoom).toBeGreaterThanOrEqual(1)
    expect(view.zoom).toBeLessThanOrEqual(17)
  })

  it('lands every point inside the frame, with the padding it was asked for', () => {
    for (const p of [SUBJECT, ...SALES]) {
      const at = projectToImagePercent(p, view)
      expect(at, `${p.lat},${p.lng} fell outside the frame`).not.toBeNull()
      // 56 logical pixels of 640 wide / 360 tall.
      expect(at!.xPct).toBeGreaterThanOrEqual((56 / 640) * 100 - 0.001)
      expect(at!.xPct).toBeLessThanOrEqual(100 - (56 / 640) * 100 + 0.001)
      expect(at!.yPct).toBeGreaterThanOrEqual((56 / 360) * 100 - 0.001)
      expect(at!.yPct).toBeLessThanOrEqual(100 - (56 / 360) * 100 + 0.001)
    }
  })

  it('puts the centre of the frame at 50 percent of both axes', () => {
    const at = projectToImagePercent({ lat: view.centerLat, lng: view.centerLng }, view)!
    expect(at.xPct).toBeCloseTo(50, 6)
    expect(at.yPct).toBeCloseTo(50, 6)
  })

  it('keeps north above south and east right of west', () => {
    const north = projectToImagePercent({ lat: view.centerLat + 0.002, lng: view.centerLng }, view)!
    const east = projectToImagePercent({ lat: view.centerLat, lng: view.centerLng + 0.002 }, view)!
    expect(north.yPct).toBeLessThan(50)
    expect(east.xPct).toBeGreaterThan(50)
  })

  it('refuses a point that is not on this map rather than drawing it at 118 percent', () => {
    expect(projectToImagePercent({ lat: 45.52, lng: -122.68 }, view)).toBeNull()
    expect(projectToImagePercent({ lat: Number.NaN, lng: -121.17 }, view)).toBeNull()
  })

  it('handles one point, and a set of clones, without an infinite zoom', () => {
    const one = fitStaticMapView([SUBJECT], { width: 640, height: 360 })!
    expect(one.zoom).toBe(17)
    expect(projectToImagePercent(SUBJECT, one)!.xPct).toBeCloseTo(50, 6)
    const clones = fitStaticMapView([SUBJECT, SUBJECT, SUBJECT], { width: 640, height: 360 })!
    expect(clones.zoom).toBe(17)
  })

  it('returns nothing when there is nothing to fit', () => {
    expect(fitStaticMapView([], { width: 640, height: 360 })).toBeNull()
    expect(
      fitStaticMapView([{ lat: Number.NaN, lng: 0 }], { width: 640, height: 360 }),
    ).toBeNull()
  })

  it('zooms out for a set spread across the county', () => {
    const wide = fitStaticMapView(
      [
        { lat: 44.0582, lng: -121.3153 },
        { lat: 44.2726, lng: -121.1739 },
      ],
      { width: 640, height: 360, padding: 56 },
    )!
    expect(wide.zoom).toBeLessThan(fitStaticMapView([SUBJECT, ...SALES], { width: 640, height: 360, padding: 56 })!.zoom)
    expect(projectToImagePercent({ lat: 44.0582, lng: -121.3153 }, wide)).not.toBeNull()
    expect(projectToImagePercent({ lat: 44.2726, lng: -121.1739 }, wide)).not.toBeNull()
  })
})
