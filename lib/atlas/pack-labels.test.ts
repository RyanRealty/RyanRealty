import { describe, expect, it } from 'vitest'
import { atlasLabelBox, packAtlasLabels, type AtlasLabelCandidate } from './pack-labels'

function cand(partial: Partial<AtlasLabelCandidate> & Pick<AtlasLabelCandidate, 'id' | 'text'>): AtlasLabelCandidate {
  return {
    kind: 'place',
    x: 100,
    y: 100,
    hw: 40,
    hh: 10,
    rank: 1,
    ...partial,
  }
}

describe('packAtlasLabels', () => {
  const view = { w: 400, h: 300 }

  it('keeps the higher-rank name when two plats share a point', () => {
    const packed = packAtlasLabels(
      [
        cand({ id: 'nwc', text: 'Northwest Crossing', rank: 80, hw: 50, hh: 10 }),
        cand({ id: 'ak', text: 'Auburn Knolls', rank: 20, hw: 40, hh: 10 }),
        cand({ id: 'ak2', text: 'Auburn Knolls II', rank: 10, hw: 48, hh: 10 }),
      ],
      view,
    )
    expect(packed.map((l) => l.id)).toEqual(['nwc'])
  })

  it('keeps both when they do not collide', () => {
    const packed = packAtlasLabels(
      [
        cand({ id: 'a', text: 'Bend', kind: 'town', x: 80, y: 80, rank: 100 }),
        cand({ id: 'b', text: 'Redmond', kind: 'town', x: 300, y: 200, rank: 90 }),
      ],
      view,
    )
    expect(packed.map((l) => l.id).sort()).toEqual(['a', 'b'])
  })

  it('drops a place that sits off the stage', () => {
    const packed = packAtlasLabels(
      [cand({ id: 'out', text: 'La Pine', x: 800, y: 800, rank: 50 })],
      view,
    )
    expect(packed).toEqual([])
  })

  it('clamps the active name into the stage instead of dropping it', () => {
    const packed = packAtlasLabels(
      [cand({ id: 'on', text: 'Northwest Crossing', kind: 'active', x: -20, y: 10, rank: 9000, hw: 40, hh: 10 })],
      view,
    )
    expect(packed).toHaveLength(1)
    expect(packed[0]!.id).toBe('on')
    expect(packed[0]!.x).toBeGreaterThanOrEqual(40)
  })

  it('lets the hovered name win a collision with a town', () => {
    const packed = packAtlasLabels(
      [
        cand({ id: 'town', text: 'Bend', kind: 'town', rank: 1000 }),
        cand({ id: 'on', text: 'Northwest Crossing', kind: 'active', rank: 9000 }),
      ],
      view,
    )
    expect(packed.map((l) => l.id)).toEqual(['on'])
  })
})

describe('atlasLabelBox', () => {
  it('gives a long plat a wider box than a short town', () => {
    const long = atlasLabelBox('Northwest Crossing', 'place')
    const town = atlasLabelBox('Bend', 'town')
    expect(long.hw).toBeGreaterThan(town.hw)
  })
})
