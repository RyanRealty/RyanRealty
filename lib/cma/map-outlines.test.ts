import { describe, expect, it } from 'vitest'
import { labelsForUsedPlats, platSlugsToDraw, pointsWithoutPlat } from '@/lib/cma/map-outlines'

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

  it('labels two used plats and the parent by name, not by slug', () => {
    const square = (lat: number, lng: number, d = 0.01) => [
      { lat, lng },
      { lat: lat + d, lng },
      { lat: lat + d, lng: lng + d },
      { lat, lng: lng + d },
    ]
    const labels = labelsForUsedPlats({
      plats: [
        { label: 'Countryside', rings: [square(44.07, -121.32)] },
        { label: 'Northwest Crossing', rings: [square(44.1, -121.25)] },
        { label: 'own-street-24mo', rings: [square(44.11, -121.24)] },
      ],
      parent: { label: 'River West', rings: [square(44.05, -121.35, 0.08)] },
    })
    expect(labels.map((l) => l.text)).toEqual(['Countryside', 'Northwest Crossing', 'River West'])
    expect(labels.map((l) => l.kind)).toEqual(['subdivision', 'subdivision', 'parent'])
  })
})