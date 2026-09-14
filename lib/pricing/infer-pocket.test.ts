import { describe, expect, it } from 'vitest'
import {
  applyInferredPocket,
  inferSubdivisionPocket,
  POCKET_RADIUS_MILES,
} from '@/lib/pricing/infer-pocket'

/** Sisters — 1121 Canter Ct neighborhood. */
const SISTERS = { latitude: 44.2908, longitude: -121.5493 }

function neighbor(
  name: string,
  milesNorth: number,
): { subdivision: string; subdivisionNorm: string; latitude: number; longitude: number } {
  // 1 degree lat ≈ 69 mi
  return {
    subdivision: name,
    subdivisionNorm: name.toLowerCase(),
    latitude: SISTERS.latitude + milesNorth / 69,
    longitude: SISTERS.longitude,
  }
}

describe('inferSubdivisionPocket', () => {
  it('keeps a real MLS tract and does not invent a cluster', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: 'Kenwood',
      subdivisionNorm: 'kenwood',
      ...SISTERS,
      neighbors: [neighbor('Rolling Horse Meadow', 0.04)],
    })
    expect(pocket.inferred).toBe(false)
    expect(pocket.source).toBe('mls')
    expect(pocket.subdivision).toBe('Kenwood')
    expect(pocket.neighborNorms).toEqual([])
  })

  it('treats N/A and empty as blank', () => {
    for (const subdivision of [null, '', 'N/A', 'none']) {
      const pocket = inferSubdivisionPocket({
        subdivision,
        subdivisionNorm: null,
        ...SISTERS,
        neighbors: [neighbor('Rolling Horse Meadow', 0.04)],
      })
      expect(pocket.inferred).toBe(true)
      expect(pocket.subdivision).toBe('Rolling Horse Meadow')
    }
  })

  it('prefers the recorded plat label over nearby sales', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: null,
      platLabel: 'CLAS',
      subdivisionSlug: 'clas',
      ...SISTERS,
      neighbors: [neighbor('Rolling Horse Meadow', 0.04), neighbor('SaddleStone', 0.2)],
    })
    expect(pocket.inferred).toBe(true)
    expect(pocket.source).toBe('plat')
    expect(pocket.subdivision).toBe('CLAS')
    expect(pocket.subdivisionSlug).toBe('clas')
    expect(pocket.neighborNorms).toEqual(['rolling horse meadow', 'saddlestone'])
  })

  it('picks the nearest mapped neighbor inside 0.35 mi when MLS and plat are blank', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: null,
      ...SISTERS,
      neighbors: [
        neighbor('SaddleStone', 0.2),
        neighbor('Rolling Horse Meadow', 0.04),
        neighbor('Crossroads', 0.8),
      ],
    })
    expect(pocket.inferred).toBe(true)
    expect(pocket.source).toBe('nearest-neighbor')
    expect(pocket.subdivision).toBe('Rolling Horse Meadow')
    expect(pocket.neighborNorms).toEqual(['saddlestone'])
    expect(pocket.neighborNorms).not.toContain('crossroads')
  })

  it('breaks a nearest-mile tie by the most frequent name in the window', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: null,
      ...SISTERS,
      neighbors: [
        neighbor('SaddleStone', 0.1),
        neighbor('Timber Creek', 0.1),
        neighbor('Timber Creek', 0.12),
        neighbor('Timber Creek', 0.18),
      ],
    })
    expect(pocket.subdivision).toBe('Timber Creek')
    expect(pocket.neighborNorms).toEqual(['saddlestone'])
  })

  it('finds nothing when every mapped neighbor sits outside the pocket radius', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: null,
      ...SISTERS,
      neighbors: [neighbor('Crossroads', 0.8)],
    })
    expect(pocket.inferred).toBe(false)
    expect(pocket.subdivision).toBeNull()
    expect(pocket.neighborNorms).toEqual([])
  })

  it('finds nothing without coordinates', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: null,
      neighbors: [neighbor('Rolling Horse Meadow', 0.04)],
    })
    expect(pocket.inferred).toBe(false)
  })
})

describe('applyInferredPocket', () => {
  it('fills subdivision and the pocket cluster only when inferred', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: null,
      ...SISTERS,
      neighbors: [neighbor('Rolling Horse Meadow', 0.04), neighbor('SaddleStone', 0.2)],
    })
    const next = applyInferredPocket(
      { subdivision: null, subdivisionNorm: null, city: 'Sisters' },
      pocket,
    )
    expect(next.subdivision).toBe('Rolling Horse Meadow')
    expect(next.subdivisionNorm).toBe('rolling horse meadow')
    expect(next.pocketSubdivisionNorms).toEqual(['saddlestone'])
    expect(next.inferredPocket?.inferred).toBe(true)
  })

  it('leaves a named subject untouched', () => {
    const subject = { subdivision: 'Kenwood', subdivisionNorm: 'kenwood' }
    const next = applyInferredPocket(
      subject,
      inferSubdivisionPocket({ subdivision: 'Kenwood', subdivisionNorm: 'kenwood' }),
    )
    expect(next).toBe(subject)
    expect(next.pocketSubdivisionNorms).toBeUndefined()
  })
})

describe('POCKET_RADIUS_MILES', () => {
  it('is a third of a mile', () => {
    expect(POCKET_RADIUS_MILES).toBe(0.35)
  })
})
