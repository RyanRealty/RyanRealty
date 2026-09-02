import { describe, expect, it } from 'vitest'
import { fenceAxis, recordFrame, type FrameTown } from './record-frame'

/** A square town silhouette around a centre, half-width `r` degrees. */
function town(id: string, cx: number, cy: number, r: number): FrameTown {
  return {
    id,
    rings: [
      [
        [cx - r, cy - r],
        [cx + r, cy - r],
        [cx + r, cy + r],
        [cx - r, cy + r],
        [cx - r, cy - r],
      ],
    ],
  }
}

const BEND = town('bend', -121.31, 44.06, 0.08)
const ASHLAND = town('ashland', -122.71, 42.19, 0.05)
const PRINEVILLE = town('prineville', -120.83, 44.3, 0.04)

describe('fenceAxis', () => {
  it('keeps a tight cluster and drops the far outlier', () => {
    const values = [...Array.from({ length: 20 }, (_, i) => -121.35 + i * 0.004), -122.71].sort((a, b) => a - b)
    const [lo, hi] = fenceAxis(values)
    expect(lo).toBeCloseTo(-121.35, 6)
    expect(hi).toBeCloseTo(-121.35 + 19 * 0.004, 6)
  })

  it('never fences tighter than a 0.06-degree spread', () => {
    // Four closings a block apart: the IQR floor keeps them all.
    const values = [44.06, 44.061, 44.062, 44.063]
    const [lo, hi] = fenceAxis(values)
    expect(lo).toBe(44.06)
    expect(hi).toBe(44.063)
  })
})

describe('recordFrame', () => {
  it('a small record frames no tighter than the town that holds it', () => {
    // Rebecca: four closings inside Bend. Alone they span a few blocks and no
    // town label lands in the stage; the frame widens to Bend's silhouette.
    const dots = [
      { lng: -121.31, lat: 44.06 },
      { lng: -121.3, lat: 44.061 },
      { lng: -121.305, lat: 44.058 },
      { lng: -121.312, lat: 44.063 },
    ]
    const frame = recordFrame(dots, [BEND, ASHLAND, PRINEVILLE])
    expect(frame.bbox).not.toBeNull()
    expect(frame.bbox!.minLon).toBeCloseTo(-121.39, 6)
    expect(frame.bbox!.maxLon).toBeCloseTo(-121.23, 6)
    expect(frame.bbox!.minLat).toBeCloseTo(43.98, 6)
    expect(frame.bbox!.maxLat).toBeCloseTo(44.14, 6)
    expect(frame.kept).toBe(4)
    expect(frame.holders).toEqual(['bend'])
  })

  it('a far outlier stays beyond the frame and its town is not unioned in', () => {
    // Matt: twenty closings around Bend and one in Ashland. The fence drops
    // Ashland, so Ashland's silhouette must not drag the frame south.
    const dots = [
      ...Array.from({ length: 20 }, (_, i) => ({ lng: -121.35 + i * 0.004, lat: 44.02 + i * 0.004 })),
      { lng: -122.71, lat: 42.19 },
    ]
    const frame = recordFrame(dots, [BEND, ASHLAND, PRINEVILLE])
    expect(frame.kept).toBe(20)
    expect(frame.holders).toEqual(['bend'])
    expect(frame.bbox!.minLat).toBeGreaterThan(43.9)
  })

  it('a record split between two towns unions both silhouettes', () => {
    const dots = [
      ...Array.from({ length: 3 }, (_, i) => ({ lng: -121.31 + i * 0.003, lat: 44.06 + i * 0.003 })),
      ...Array.from({ length: 3 }, (_, i) => ({ lng: -120.83 + i * 0.003, lat: 44.3 + i * 0.003 })),
    ]
    const frame = recordFrame(dots, [BEND, ASHLAND, PRINEVILLE])
    expect(frame.kept).toBe(6)
    expect(frame.holders).toEqual(['bend', 'prineville'])
    expect(frame.bbox!.maxLon).toBeCloseTo(-120.79, 6)
    expect(frame.bbox!.maxLat).toBeCloseTo(44.34, 6)
  })

  it('dots outside every town frame themselves', () => {
    const dots = [
      { lng: -121.0, lat: 43.7 },
      { lng: -121.02, lat: 43.72 },
    ]
    const frame = recordFrame(dots, [BEND])
    expect(frame.holders).toEqual([])
    expect(frame.bbox).toEqual({ minLon: -121.02, maxLon: -121.0, minLat: 43.7, maxLat: 43.72 })
  })

  it('no dots, no frame', () => {
    expect(recordFrame([], [BEND]).bbox).toBeNull()
  })
})
