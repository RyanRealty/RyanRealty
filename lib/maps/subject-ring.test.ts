import { describe, expect, it } from 'vitest'
import {
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
