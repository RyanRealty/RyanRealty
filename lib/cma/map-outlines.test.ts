import { describe, expect, it } from 'vitest'
import { labelsForUsedPlats, pinsOutsideOutlines, platSlugsToDraw, pointsWithoutPlat, ringLabelAnchor } from '@/lib/cma/map-outlines'

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

  it('does not draw a plat the area holds to the subject\'s street, and always draws the subject\'s own (rule 24)', () => {
    // 3037 Purcell: Holliday Park Third Addition Phase III came in through
    // one sale on Purcell. The caption names the homes on the street, not the plat.
    expect(
      platSlugsToDraw(
        ['silver-sage-phase-i', 'silver-sage-phase-i', 'silver-sage-phase-2', 'holliday-park-third-addition-phase-iii'],
        { heldToStreet: ['holliday-park-third-addition-phase-iii'] },
      ),
    ).toEqual(['silver-sage-phase-i', 'silver-sage-phase-2'])
    // The subject's own plat is in the area whatever the street list says.
    expect(platSlugsToDraw(['own-plat', 'other'], { heldToStreet: ['own-plat'] })).toEqual(['own-plat', 'other'])
    expect(platSlugsToDraw(['own-plat', 'other'], { heldToStreet: null })).toEqual(['own-plat', 'other'])
  })

  it('anchors a name on the part of a plat the frame shows (2382 Jackson, Aspen Heights Phase IV)', () => {
    // A plat from lat 44.0766 to 44.0866; the frame ends at 44.0774.
    const ring = [
      { lat: 44.0766, lng: -121.2703 },
      { lat: 44.0766, lng: -121.2688 },
      { lat: 44.0866, lng: -121.2688 },
      { lat: 44.0866, lng: -121.2703 },
    ]
    const near = (at: { lat: number; lng: number } | null, lat: number, lng: number) => {
      expect(at).not.toBeNull()
      expect(at!.lat).toBeCloseTo(lat, 6)
      expect(at!.lng).toBeCloseTo(lng, 6)
    }
    near(ringLabelAnchor([ring]), 44.0816, -121.26955)
    const frame = { minLat: 44.0736, maxLat: 44.0774, minLng: -121.2722, maxLng: -121.2672 }
    near(ringLabelAnchor([ring], frame), 44.0766, -121.26955)
    // A ring wholly inside the frame keeps its centroid.
    const inside = { minLat: 44.07, maxLat: 44.09, minLng: -121.28, maxLng: -121.26 }
    near(ringLabelAnchor([ring], inside), 44.0816, -121.26955)
    // A ring with no vertex in the frame (a parent around the whole map) keeps its centroid too.
    const tiny = { minLat: 44.08, maxLat: 44.081, minLng: -121.27, maxLng: -121.269 }
    near(ringLabelAnchor([ring], tiny), 44.0816, -121.26955)
  })

  it('names every pin outside the drawn lines, except one the caption holds to the street or the ring', () => {
    const plat = [
      { lat: 44.08, lng: -121.273 },
      { lat: 44.08, lng: -121.272 },
      { lat: 44.0824, lng: -121.272 },
      { lat: 44.0824, lng: -121.273 },
    ]
    const pins = [
      { key: null, lat: 44.081, lng: -121.2725 },
      { key: '1', lat: 44.0823, lng: -121.2725 },
      { key: '3', lat: 44.0827, lng: -121.2725 },
      { key: '5', lat: 44.0747, lng: -121.2698 },
    ]
    expect(pinsOutsideOutlines({ pins, rings: [plat] })).toEqual(['3', '5'])
    expect(pinsOutsideOutlines({ pins, rings: [plat], streetKeys: ['5'] })).toEqual(['3'])
    // Pin 3 is 0.03 miles from the centre, pin 5 is 0.45: a 0.3 mile ring holds one.
    expect(
      pinsOutsideOutlines({ pins, rings: [plat], radius: { centre: { lat: 44.081, lng: -121.2725 }, miles: 0.3 } }),
    ).toEqual(['5'])
    expect(pinsOutsideOutlines({ pins: [{ key: null, lat: 44.09, lng: -121.3 }], rings: [plat] })).toEqual(['subject'])
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