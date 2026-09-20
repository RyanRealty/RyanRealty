import { describe, expect, it } from 'vitest'
import {
  clampMarkNudge,
  clampRingChip,
  listingsInsideSubjectRing,
  ringLabelAnchor,
  SUBJECT_RING_CHIP_Z,
  SUBJECT_RING_HALO_WEIGHT,
  SUBJECT_RING_INK_WEIGHT,
  SUBJECT_RING_KNOT_PX,
  SUBJECT_RING_MIN_ISLAND_FILL,
  SUBJECT_RING_Z_UNDER_PILLS,
  subjectRingHaloWeight,
  subjectRingInkWeight,
  subjectRingIslandFill,
  subjectRingIsKnot,
  subjectRingKeepFittedZoom,
  subjectRingLabel,
  subjectRingProjectedBox,
  subjectRingZoomFromMeasuredBox,
  subjectRingZoomFromPaths,
} from '@/lib/maps/subject-ring'

describe('subject ring label', () => {
  it('strips the city placeQuery suffix and keeps a named place', () => {
    expect(subjectRingLabel('Bend Oregon')).toBe('Bend')
    expect(subjectRingLabel('Old Bend Bend')).toBe('Old Bend Bend')
    expect(subjectRingLabel('  Redmond Oregon  ')).toBe('Redmond')
    expect(subjectRingLabel('')).toBeNull()
    expect(subjectRingLabel(null)).toBeNull()
  })
})

describe('subject ring paint', () => {
  it('keeps Cos rematch ink at 8 and a cream halo wider than the ink', () => {
    expect(SUBJECT_RING_INK_WEIGHT).toBe(8)
    expect(subjectRingInkWeight(8)).toBe(8)
    expect(subjectRingInkWeight(undefined)).toBe(8)
    expect(subjectRingHaloWeight(8)).toBeGreaterThanOrEqual(SUBJECT_RING_HALO_WEIGHT)
    expect(subjectRingHaloWeight(8)).toBeGreaterThan(8)
    expect(SUBJECT_RING_Z_UNDER_PILLS).toBe(0)
    expect(SUBJECT_RING_CHIP_Z).toBeGreaterThan(1)
  })
})

describe('subject ring island fill', () => {
  const phone = { width: 335, height: 208 }

  it('flags the live 87×99 knot and accepts a ring that spans the island', () => {
    const knot = { width: 87, height: 99 }
    expect(SUBJECT_RING_KNOT_PX).toBe(110)
    expect(subjectRingIslandFill(phone, knot)).toBeLessThan(SUBJECT_RING_MIN_ISLAND_FILL)
    expect(subjectRingIsKnot(phone, knot)).toBe(true)

    const fitted = { width: 280, height: 170 }
    expect(subjectRingIslandFill(phone, fitted)).toBeGreaterThanOrEqual(SUBJECT_RING_MIN_ISLAND_FILL)
    expect(subjectRingIsKnot(phone, fitted)).toBe(false)
  })

  it('keeps the fitted zoom instead of clamping the phone island to 9', () => {
    expect(subjectRingKeepFittedZoom(11)).toBe(11)
    expect(subjectRingKeepFittedZoom(10)).toBe(10)
    expect(subjectRingKeepFittedZoom(9)).toBe(9)
    expect(subjectRingKeepFittedZoom(15)).toBe(14)
    expect(subjectRingKeepFittedZoom(null)).toBeNull()
  })

  it('zooms in from the Cos kick 101×126 @ z10 so fill and box settle', () => {
    const island = { width: 320, height: 187 }
    const knot = { width: 101, height: 126 }
    expect(subjectRingIslandFill(island, knot)).toBeCloseTo(101 / 187, 5)
    expect(subjectRingIsKnot(island, knot)).toBe(true)
    expect(subjectRingZoomFromMeasuredBox(10, island, { width: 0, height: 0 })).toBeNull()

    const next = subjectRingZoomFromMeasuredBox(10, island, knot)
    expect(next).not.toBeNull()
    expect(next!).toBeGreaterThan(10)
    expect(next!).toBeLessThan(11)

    const scale = 2 ** (next! - 10)
    const filled = { width: knot.width * scale, height: knot.height * scale }
    expect(subjectRingIslandFill(island, filled)).toBeGreaterThanOrEqual(SUBJECT_RING_MIN_ISLAND_FILL)
    expect(Math.max(filled.width, filled.height)).toBeGreaterThanOrEqual(SUBJECT_RING_KNOT_PX)
    expect(subjectRingIsKnot(island, filled)).toBe(false)
    expect(subjectRingZoomFromMeasuredBox(next!, island, filled)).toBeNull()
  })

  it('projects recorded vertices — no invented geom — until the island fills', () => {
    const island = { width: 320, height: 187 }
    const paths = [[
      { lat: 44.0, lng: -121.4 },
      { lat: 44.1, lng: -121.4 },
      { lat: 44.1, lng: -121.2 },
      { lat: 44.0, lng: -121.2 },
    ]]
    const at10 = subjectRingProjectedBox(paths, 10)
    expect(at10.width).toBeGreaterThan(0)
    expect(at10.height).toBeGreaterThan(0)
    const zoom = subjectRingZoomFromPaths(paths, island)
    expect(zoom).not.toBeNull()
    const box = subjectRingProjectedBox(paths, zoom!)
    expect(subjectRingIslandFill(island, box)).toBeGreaterThanOrEqual(SUBJECT_RING_MIN_ISLAND_FILL)
    expect(Math.max(box.width, box.height)).toBeGreaterThanOrEqual(SUBJECT_RING_KNOT_PX)
    expect(subjectRingIsKnot(island, box)).toBe(false)
  })
})

describe('ring label anchor', () => {
  it('stays inside the recorded vertices — no invented geom', () => {
    const ring = [
      { lat: 44.0, lng: -121.4 },
      { lat: 44.1, lng: -121.4 },
      { lat: 44.1, lng: -121.2 },
      { lat: 44.0, lng: -121.2 },
    ]
    const anchor = ringLabelAnchor([ring])
    expect(anchor).not.toBeNull()
    const lats = ring.map((p) => p.lat)
    const lngs = ring.map((p) => p.lng)
    expect(anchor!.lat).toBeGreaterThanOrEqual(Math.min(...lats))
    expect(anchor!.lat).toBeLessThanOrEqual(Math.max(...lats))
    expect(anchor!.lng).toBeGreaterThanOrEqual(Math.min(...lngs))
    expect(anchor!.lng).toBeLessThanOrEqual(Math.max(...lngs))
    expect(anchor!.lat).toBeGreaterThan(44.05)
  })

  it('returns null for an empty path', () => {
    expect(ringLabelAnchor([])).toBeNull()
    expect(ringLabelAnchor([[]])).toBeNull()
  })
})

describe('clampRingChip', () => {
  it('keeps a north-edge Bend chip inside the 375 island', () => {
    const island = { width: 335, height: 187 }
    const clipped = clampRingChip({ x: 12, y: -4 }, island)
    expect(clipped.x).toBeGreaterThanOrEqual(36)
    expect(clipped.y).toBeGreaterThanOrEqual(14)
    expect(clipped.x).toBeLessThanOrEqual(island.width - 36)
    expect(clipped.y).toBeLessThanOrEqual(island.height - 14)
  })
})

describe('clampMarkNudge', () => {
  it('slides a bottom $795k pill and a top-right count chip back inside the island', () => {
    const island = { width: 335, height: 208 }
    const bottom = clampMarkNudge({ left: 140, right: 196, top: 190, bottom: 222 }, island, 18)
    expect(bottom.nudgeY).toBeLessThan(0)
    expect(190 + bottom.nudgeY).toBeGreaterThanOrEqual(18)
    expect(222 + bottom.nudgeY).toBeLessThanOrEqual(island.height - 18)
    const topRight = clampMarkNudge({ left: 310, right: 360, top: -6, bottom: 20 }, island, 18)
    expect(topRight.nudgeX).toBeLessThan(0)
    expect(topRight.nudgeY).toBeGreaterThan(0)
    expect(310 + topRight.nudgeX).toBeGreaterThanOrEqual(18)
    expect(360 + topRight.nudgeX).toBeLessThanOrEqual(island.width - 18)
  })
})

describe('listingsInsideSubjectRing', () => {
  it('drops homes outside the recorded ring so $ chips cannot sit on cream', () => {
    const square = [
      [
        { lng: -121.4, lat: 44.0 },
        { lng: -121.2, lat: 44.0 },
        { lng: -121.2, lat: 44.1 },
        { lng: -121.4, lat: 44.1 },
        { lng: -121.4, lat: 44.0 },
      ],
    ]
    const kept = listingsInsideSubjectRing(
      [
        { Latitude: 44.05, Longitude: -121.3 },
        { Latitude: 44.2, Longitude: -121.3 },
      ],
      square,
    )
    expect(kept).toEqual([{ Latitude: 44.05, Longitude: -121.3 }])
  })
})
