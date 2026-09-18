import { describe, expect, it } from 'vitest'
import {
  ringLabelAnchor,
  SUBJECT_RING_HALO_WEIGHT,
  SUBJECT_RING_INK_WEIGHT,
  SUBJECT_RING_Z_UNDER_PILLS,
  subjectRingHaloWeight,
  subjectRingInkWeight,
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
