import { describe, expect, it } from 'vitest'
import { makeProjection } from './project-svg'
import {
  ATLAS_CAM_HOME,
  ATLAS_K_MIN,
  clampCam,
  fitRect,
  inAtlasView,
  panBy,
  screenToWorld,
  visibleLonLat,
  visibleWorld,
  zoomAt,
} from './atlas-camera'

describe('atlas-camera', () => {
  it('at k=1 pan is a no-op: the map cannot leave the stage', () => {
    expect(panBy(ATLAS_CAM_HOME, 40, -20, 800, 500)).toEqual(ATLAS_CAM_HOME)
  })

  it('zoom out from home is allowed, and stops at the floor', () => {
    const out = zoomAt(ATLAS_CAM_HOME, 400, 250, 1 / 1.18, 800, 500)
    expect(out.k).toBeLessThan(1)
    expect(out.k).toBeGreaterThanOrEqual(ATLAS_K_MIN)
    const floor = zoomAt(ATLAS_CAM_HOME, 400, 250, 0.01, 800, 500)
    expect(floor.k).toBe(ATLAS_K_MIN)
  })

  it('zoom-at keeps the point under the cursor', () => {
    const next = zoomAt(ATLAS_CAM_HOME, 200, 100, 2, 800, 500)
    const [wx, wy] = screenToWorld(next, 200, 100)
    expect(wx).toBeCloseTo(200)
    expect(wy).toBeCloseTo(100)
    expect(next.k).toBe(2)
  })

  it('fitRect of a small box zooms in and centres it', () => {
    const cam = fitRect({ x0: 300, y0: 200, x1: 400, y1: 280 }, 800, 500)
    expect(cam.k).toBeGreaterThan(2)
    const [mx, my] = screenToWorld(cam, 400, 250)
    expect(mx).toBeCloseTo(350, 0)
    expect(my).toBeCloseTo(240, 0)
  })

  it('fitRect never blows past ATLAS_K_MAX, so a small place stays readable', () => {
    const cam = fitRect({ x0: 390, y0: 240, x1: 410, y1: 260 }, 800, 500)
    expect(cam.k).toBeLessThanOrEqual(5)
  })

  it('zoom-out past home still keeps the map on the stage', () => {
    const cam = zoomAt(ATLAS_CAM_HOME, 400, 250, 0.5, 800, 500)
    expect(cam.k).toBe(ATLAS_K_MIN)
    expect(cam.x).toBeGreaterThanOrEqual(0)
    expect(cam.y).toBeGreaterThanOrEqual(0)
    expect(cam.x + 800 * cam.k).toBeLessThanOrEqual(800)
    expect(cam.y + 500 * cam.k).toBeLessThanOrEqual(500)
  })

  it('clamp keeps the stage covered after a wild pan', () => {
    const zoomed = zoomAt(ATLAS_CAM_HOME, 400, 250, 4, 800, 500)
    const wild = clampCam({ k: zoomed.k, x: 9999, y: -9999 }, 800, 500)
    expect(wild.x).toBeLessThanOrEqual(0)
    expect(wild.y).toBeLessThanOrEqual(0)
    expect(wild.x + 800 * wild.k).toBeGreaterThanOrEqual(800)
    expect(wild.y + 500 * wild.k).toBeGreaterThanOrEqual(500)
  })

  it('visibleWorld at k=1 is the stage', () => {
    expect(visibleWorld(ATLAS_CAM_HOME, 800, 500)).toEqual({ x0: 0, y0: 0, x1: 800, y1: 500 })
  })

  it('visibleWorld after a 2x zoom is half the stage in world space', () => {
    const cam = zoomAt(ATLAS_CAM_HOME, 400, 250, 2, 800, 500)
    const box = visibleWorld(cam, 800, 500)
    expect(box.x1 - box.x0).toBeCloseTo(400)
    expect(box.y1 - box.y0).toBeCloseTo(250)
  })

  it('visibleLonLat inverts toPx + toXY back to the projection frame at rest', () => {
    const b = { minLon: -121.5, maxLon: -121.0, minLat: 44.0, maxLat: 44.2 }
    const proj = makeProjection(b, 1000)
    const view = { w: proj.width, h: proj.height, scale: 1, ox: 0, oy: 0 }
    const box = visibleLonLat(ATLAS_CAM_HOME, view, proj.toXY)
    expect(box.minLon).toBeCloseTo(b.minLon, 4)
    expect(box.maxLon).toBeCloseTo(b.maxLon, 4)
    expect(box.minLat).toBeCloseTo(b.minLat, 3)
    expect(box.maxLat).toBeCloseTo(b.maxLat, 4)
  })

  it('inAtlasView is unfiltered at null bounds and drops points without a coordinate when zoomed', () => {
    const bounds = { minLat: 43, maxLat: 45, minLon: -122, maxLon: -120 }
    expect(inAtlasView(44, -121, null)).toBe(true)
    expect(inAtlasView(null, -121, null)).toBe(true)
    expect(inAtlasView(44, -121, bounds)).toBe(true)
    expect(inAtlasView(42, -121, bounds)).toBe(false)
    expect(inAtlasView(null, -121, bounds)).toBe(false)
  })
})
