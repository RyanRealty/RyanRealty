import { describe, expect, it } from 'vitest'
import { platSlugsToDraw, pointsWithoutPlat } from '@/lib/cma/map-outlines'

describe('CMA map outlines', () => {
  it('draws the subject plat and each comp plat once', () => {
    expect(
      platSlugsToDraw([
        'countryside-phase-2',
        'countryside-phase-4-pz-20-0175',
        'countryside-phase-3-pz-20-0175',
        'countryside-phase-4-pz-20-0175',
        'countryside-phase-1',
      ]),
    ).toEqual([
      'countryside-phase-2',
      'countryside-phase-4-pz-20-0175',
      'countryside-phase-3-pz-20-0175',
      'countryside-phase-1',
    ])
  })

  it('asks for the parent only where a pin has no plat', () => {
    const points = [
      { lat: 44.01, lng: -121.3 },
      { lat: 44.02, lng: -121.29 },
      null,
    ]
    expect(pointsWithoutPlat(points, ['phase-2', 'phase-4', null])).toEqual([])
    expect(pointsWithoutPlat(points, ['phase-2', null, null])).toEqual([{ lat: 44.02, lng: -121.29 }])
  })
})