import { describe, expect, it } from 'vitest'
import { ATLAS_CAM_HOME, clampCam, fitRect, panBy, screenToWorld, zoomAt } from './atlas-camera'

describe('atlas-camera', () => {
  it('at k=1 pan is a no-op: the map cannot leave the stage', () => {
    expect(panBy(ATLAS_CAM_HOME, 40, -20, 800, 500)).toEqual(ATLAS_CAM_HOME)
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

  it('clamp keeps the stage covered after a wild pan', () => {
    const zoomed = zoomAt(ATLAS_CAM_HOME, 400, 250, 4, 800, 500)
    const wild = clampCam({ k: zoomed.k, x: 9999, y: -9999 }, 800, 500)
    expect(wild.x).toBeLessThanOrEqual(0)
    expect(wild.y).toBeLessThanOrEqual(0)
    expect(wild.x + 800 * wild.k).toBeGreaterThanOrEqual(800)
    expect(wild.y + 500 * wild.k).toBeGreaterThanOrEqual(500)
  })
})
