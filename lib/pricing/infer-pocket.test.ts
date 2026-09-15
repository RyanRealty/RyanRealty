import { describe, expect, it } from 'vitest'
import {
  applyInferredPocket,
  inferSubdivisionPocket,
  POCKET_RADIUS_MILES,
  STREET_CLUSTER_RADIUS_MILES,
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
  it('keeps a named MLS tract and still collects the 0.25 mi street cluster', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: 'SaddleStone',
      subdivisionNorm: 'saddlestone',
      ...SISTERS,
      neighbors: [
        neighbor('Horse Back', 0.12),
        neighbor('Ranch', 0.2),
        neighbor('Clearpine', 2.1),
      ],
    })
    expect(pocket.inferred).toBe(false)
    expect(pocket.source).toBe('mls')
    expect(pocket.subdivision).toBe('SaddleStone')
    expect(pocket.neighborNorms).toEqual(['horse back', 'ranch'])
    expect(pocket.neighborNorms).not.toContain('clearpine')
  })

  it('does not invent a cluster when every mapped neighbor sits outside a quarter mile', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: 'Kenwood',
      subdivisionNorm: 'kenwood',
      ...SISTERS,
      neighbors: [neighbor('Rolling Horse Meadow', 0.4)],
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

  it('contract: live-rebuild-plat-rhm-infers-cluster — plat Rolling Horse Meadow loses to Canter/Horse/Ranch', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: null,
      platLabel: 'Rolling Horse Meadow',
      streetAddress: '1130 E Canter',
      ...SISTERS,
      neighbors: [
        { ...neighbor('Rolling Horse Meadow', 0.04), address: '1121 Canter Ct' },
        { ...neighbor('Rolling Horse Meadow', 0.08), address: '200 Meadow Ln' },
        { ...neighbor('SaddleStone', 0.12), address: '1 SaddleStone Ln' },
        { ...neighbor('Horse Back', 0.14), address: '1025 E Horse Back' },
        { ...neighbor('Ranch', 0.18), address: '1058 E Ranch' },
      ],
    })
    expect(pocket.inferred).toBe(true)
    expect(pocket.source).toBe('street-cluster')
    expect(pocket.subdivision).not.toBe('Rolling Horse Meadow')
    expect(['SaddleStone', 'Horse Back', 'Ranch']).toContain(pocket.subdivision)
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

  it('contract: blank-subdiv-infers-saddlestone-cluster — 1130 E Canter does not take Rolling Horse Meadow', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: null,
      streetAddress: '1130 E Canter',
      ...SISTERS,
      neighbors: [
        { ...neighbor('Rolling Horse Meadow', 0.04), address: '1121 Canter Ct' },
        { ...neighbor('SaddleStone', 0.12), address: '1 SaddleStone Ln' },
        { ...neighbor('Horse Back', 0.14), address: '1025 E Horse Back' },
        { ...neighbor('Ranch', 0.18), address: '1058 E Ranch' },
      ],
    })
    expect(pocket.inferred).toBe(true)
    expect(pocket.source).toBe('street-cluster')
    expect(pocket.subdivision).not.toBe('Rolling Horse Meadow')
    expect(['SaddleStone', 'Horse Back', 'Ranch']).toContain(pocket.subdivision)
    const cluster = [pocket.subdivisionNorm, ...pocket.neighborNorms]
    expect(cluster).toEqual(expect.arrayContaining(['saddlestone', 'horse back', 'ranch']))
    expect(pocket.pocketStreetKeys).toEqual(expect.arrayContaining(['canter', 'horse', 'ranch']))
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

  it('leaves a named subject without nearby mapped names untouched', () => {
    const subject = { subdivision: 'Kenwood', subdivisionNorm: 'kenwood' }
    const next = applyInferredPocket(
      subject,
      inferSubdivisionPocket({ subdivision: 'Kenwood', subdivisionNorm: 'kenwood' }),
    )
    expect(next).toBe(subject)
    expect(next.pocketSubdivisionNorms).toBeUndefined()
  })

  it('attaches the street-cluster names on a named tract', () => {
    const pocket = inferSubdivisionPocket({
      subdivision: 'SaddleStone',
      subdivisionNorm: 'saddlestone',
      ...SISTERS,
      neighbors: [neighbor('Horse Back', 0.12), neighbor('Clearpine', 2.1)],
    })
    const next = applyInferredPocket(
      { subdivision: 'SaddleStone', subdivisionNorm: 'saddlestone' },
      pocket,
    )
    expect(next.subdivision).toBe('SaddleStone')
    expect(next.pocketSubdivisionNorms).toEqual(['horse back'])
    expect(next.inferredPocket?.inferred).toBe(false)
  })
})

describe('POCKET_RADIUS_MILES', () => {
  it('is a third of a mile for blank-MLS inference', () => {
    expect(POCKET_RADIUS_MILES).toBe(0.35)
  })
})

describe('STREET_CLUSTER_RADIUS_MILES', () => {
  it('is a quarter mile for named-tract exclusive first', () => {
    expect(STREET_CLUSTER_RADIUS_MILES).toBe(0.25)
  })
})

describe('street-cluster exclusive streets (Flex HARD LOCK residual)', () => {
  it('contract: plat RHM with no RHM sales still beats geographic-nearest Timber Creek', () => {
    const neighbors = [
      { ...neighbor('Timber Creek', 0.09), address: '1141 Cascade' },
      { ...neighbor('Timber Creek', 0.12), address: '912 Timber Pine' },
      { ...neighbor('SaddleStone', 0.11), address: '1025 E Horse Back' },
      { ...neighbor('SaddleStone', 0.13), address: '995 E Horse Back' },
      { ...neighbor('SaddleStone', 0.14), address: '945 E Horse Back' },
      { ...neighbor('SaddleStone', 0.18), address: '1006 Black Butte' },
    ]
    const pocket = inferSubdivisionPocket({
      subdivision: null,
      platLabel: 'Rolling Horse Meadow',
      streetAddress: '1130 E Canter',
      ...SISTERS,
      neighbors,
    })
    expect(pocket.source).toBe('street-cluster')
    expect(pocket.subdivision).toBe('SaddleStone')
    expect(pocket.pocketStreetKeys).toEqual(expect.arrayContaining(['canter', 'horse']))
    expect(pocket.pocketStreetKeys).not.toContain('timber')
    expect(pocket.pocketStreetKeys).not.toContain('cascade')
    expect(pocket.neighborNorms).not.toContain('timber creek')
  })

  it('contract: dense SaddleStone keeps densest street only — not Timber Creek / Black Butte', () => {
    const neighbors = [
      { ...neighbor('Rolling Horse Meadow', 0.04), address: '1121 Canter Ct' },
      { ...neighbor('Timber Creek', 0.09), address: '1141 Cascade' },
      { ...neighbor('Timber Creek', 0.12), address: '912 Timber Pine' },
      { ...neighbor('SaddleStone', 0.11), address: '1025 E Horse Back' },
      { ...neighbor('SaddleStone', 0.13), address: '995 E Horse Back' },
      { ...neighbor('SaddleStone', 0.14), address: '945 E Horse Back' },
      { ...neighbor('SaddleStone', 0.15), address: '994 E Horse Back' },
      { ...neighbor('SaddleStone', 0.16), address: '1006 Black Butte' },
      { ...neighbor('SaddleStone', 0.17), address: '1048 Black Butte' },
      { ...neighbor('SaddleStone', 0.18), address: '1009 Black Butte' },
    ]
    const pocket = inferSubdivisionPocket({
      subdivision: null,
      platLabel: 'Rolling Horse Meadow',
      streetAddress: '1130 E Canter',
      ...SISTERS,
      neighbors,
    })
    expect(pocket.source).toBe('street-cluster')
    expect(pocket.subdivision).toBe('SaddleStone')
    expect(pocket.subdivisionSlug).toBeNull()
    expect(pocket.pocketStreetKeys).toEqual(expect.arrayContaining(['canter', 'horse']))
    expect(pocket.pocketStreetKeys).not.toContain('timber')
    expect(pocket.pocketStreetKeys).not.toContain('cascade')
    expect(pocket.pocketStreetKeys).not.toContain('black')
    expect(pocket.neighborNorms).not.toContain('timber creek')
  })
})
