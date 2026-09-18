import { describe, expect, it } from 'vitest'
import {
  ATLAS_PIN_CLUSTER_RADIUS_PX,
  atlasClusterCanExpand,
  atlasClusterSize,
  atlasClusterWorldBounds,
  clusterAtlasPins,
  hitAtlasPinLayer,
  type AtlasPinCandidate,
} from './cluster-pins'

function pin(i: number, x: number, y: number): AtlasPinCandidate {
  return { i, x, y }
}

describe('clusterAtlasPins', () => {
  it('keeps two far pins as price pills', () => {
    const out = clusterAtlasPins([pin(0, 40, 40), pin(1, 200, 180)])
    expect(out).toHaveLength(2)
    expect(out.every((c) => c.count === 1)).toBe(true)
    expect(out.map((c) => c.indices[0])).toEqual([0, 1])
  })

  it('merges two centres inside the radius into one bubble', () => {
    const out = clusterAtlasPins([pin(4, 100, 100), pin(9, 112, 108)])
    expect(out).toHaveLength(1)
    expect(out[0]!.count).toBe(2)
    expect(out[0]!.id).toBe('c-4')
    expect(out[0]!.indices).toEqual([4, 9])
    expect(out[0]!.x).toBeCloseTo(106)
    expect(out[0]!.y).toBeCloseTo(104)
  })

  it('is transitive: a street of close pins is one bubble, not a chain of pairs', () => {
    const row = Array.from({ length: 8 }, (_, i) => pin(i, 80 + i * 18, 120))
    const out = clusterAtlasPins(row)
    expect(out).toHaveLength(1)
    expect(out[0]!.count).toBe(8)
  })

  it('is deterministic for the same pile', () => {
    const pile = [pin(2, 50, 50), pin(0, 55, 48), pin(7, 52, 60)]
    expect(clusterAtlasPins(pile)).toEqual(clusterAtlasPins([...pile].reverse()))
  })

  it('contract: old-bend-spaced-pins-stay-pills — neighborhood spacing keeps asks', () => {
    const spaced: AtlasPinCandidate[] = []
    let i = 0
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 6; col += 1) {
        spaced.push(pin(i, 60 + col * 90, 50 + row * 80))
        i += 1
      }
    }
    const out = clusterAtlasPins(spaced)
    expect(out).toHaveLength(24)
    expect(out.every((c) => c.count === 1)).toBe(true)
  })

  it('contract: bend-city-758-declutter — city frame does not paint 758 stacked pills', () => {
    const pins: AtlasPinCandidate[] = []
    let i = 0
    // 14 Bend-ish clumps (hoods) × ~54 listings, plus a few loners.
    for (let hood = 0; hood < 14; hood += 1) {
      const ox = 80 + (hood % 7) * 145
      const oy = 70 + Math.floor(hood / 7) * 200
      for (let n = 0; n < 54; n += 1) {
        pins.push(pin(i, ox + (n % 9) * 7, oy + Math.floor(n / 9) * 6))
        i += 1
      }
    }
    while (i < 758) {
      pins.push(pin(i, 40 + (i % 17) * 62, 30 + (i % 11) * 28))
      i += 1
    }
    expect(pins).toHaveLength(758)
    const out = clusterAtlasPins(pins, ATLAS_PIN_CLUSTER_RADIUS_PX)
    const marks = out.length
    const clustered = out.filter((c) => c.count > 1)
    expect(marks).toBeLessThan(80)
    expect(marks).toBeGreaterThan(10)
    expect(clustered.length).toBeGreaterThan(8)
    expect(out.reduce((n, c) => n + c.count, 0)).toBe(758)
  })

  it('zoom doubles distances and a pair that piled becomes two pills', () => {
    const piled = clusterAtlasPins([pin(0, 100, 100), pin(1, 130, 100)])
    expect(piled).toHaveLength(1)
    const zoomed = clusterAtlasPins([pin(0, 200, 200), pin(1, 260, 200)])
    expect(zoomed).toHaveLength(2)
  })
})

describe('atlasClusterCanExpand / bounds', () => {
  it('a spread pair can expand at max zoom; a stacked pair cannot', () => {
    const spread = [
      { x: 10, y: 10 },
      { x: 40, y: 12 },
    ]
    const stack = [
      { x: 10, y: 10 },
      { x: 10.2, y: 10.1 },
    ]
    expect(atlasClusterCanExpand(spread, 5)).toBe(true)
    expect(atlasClusterCanExpand(stack, 5)).toBe(false)
    expect(atlasClusterCanExpand([{ x: 1, y: 1 }], 5)).toBe(false)
    const box = atlasClusterWorldBounds(spread)
    expect(box).toEqual({ x0: 10, y0: 10, x1: 40, y1: 12 })
  })
})

describe('hitAtlasPinLayer', () => {
  it('hits a cluster bubble on its centroid and a pin above its caret', () => {
    const marks = [
      { kind: 'cluster' as const, id: 'c-0', x: 100, y: 80 },
      { kind: 'pin' as const, id: 'p-3', i: 3, x: 300, y: 200 },
    ]
    expect(hitAtlasPinLayer(102, 78, marks, 28)).toEqual({ kind: 'cluster', id: 'c-0' })
    expect(hitAtlasPinLayer(300, 188, marks, 28)).toEqual({ kind: 'pin', i: 3 })
    expect(hitAtlasPinLayer(10, 10, marks, 28)).toBeNull()
  })
})

describe('atlasClusterSize', () => {
  it('steps the bubble by count', () => {
    expect(atlasClusterSize(3)).toBe('sm')
    expect(atlasClusterSize(10)).toBe('md')
    expect(atlasClusterSize(40)).toBe('lg')
  })
})
