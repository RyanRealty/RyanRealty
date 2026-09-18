import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeProjection, padBbox } from '@/lib/geo/project-svg'
import { recordFrame } from '@/lib/geo/record-frame'
import {
  ATLAS_PIN_CLUSTER_CELL_PX,
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

  it('merges two centres in the same cell into one bubble', () => {
    const out = clusterAtlasPins([pin(4, 100, 100), pin(9, 112, 108)])
    expect(out).toHaveLength(1)
    expect(out[0]!.count).toBe(2)
    expect(out[0]!.id).toBe('c-4')
    expect(out[0]!.indices).toEqual([4, 9])
    expect(out[0]!.x).toBeCloseTo(106)
    expect(out[0]!.y).toBeCloseTo(104)
  })

  it('does not chain a street across cell edges into one city-wide blob', () => {
    const row = Array.from({ length: 8 }, (_, i) => pin(i, 80 + i * 18, 120))
    const out = clusterAtlasPins(row)
    expect(out.length).toBeGreaterThan(1)
    expect(out.length).toBeLessThan(8)
    expect(out.reduce((n, c) => n + c.count, 0)).toBe(8)
    expect(Math.max(...out.map((c) => c.count))).toBeLessThan(8)
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

  it('contract: tetherow-spaced-pins-stay-pills — community frame keeps asks', () => {
    const spaced = Array.from({ length: 28 }, (_, i) => pin(i, 40 + (i % 7) * 80, 40 + Math.floor(i / 7) * 70))
    const out = clusterAtlasPins(spaced)
    expect(out).toHaveLength(28)
    expect(out.every((c) => c.count === 1)).toBe(true)
  })

  it('contract: bend-city-fold-path-produces-clusters — city fold invokes grid, not one 759 blob', () => {
    const houses = JSON.parse(
      readFileSync(resolve('lib/atlas/fixtures/bend-city-fold-houses.json'), 'utf8'),
    ) as { lat: number; lng: number }[]
    expect(houses.length).toBeGreaterThanOrEqual(758)

    const frame = recordFrame(houses, [])
    expect(frame.bbox).not.toBeNull()
    const proj = makeProjection(padBbox(frame.bbox!, 0.1), 1000)
    // Live /cities/bend desktop fold stage (Playwright 1400×900, 2026-09-18).
    const stage = { w: 1112, h: 610 }
    const scale = Math.min(stage.w / proj.width, stage.h / proj.height)
    const ox = (stage.w - proj.width * scale) / 2
    const oy = (stage.h - proj.height * scale) / 2
    const pins: AtlasPinCandidate[] = houses.map((d, i) => {
      const [x, y] = proj.toXY(d.lng, d.lat)
      return { i, x: ox + x * scale, y: oy + y * scale }
    })

    const out = clusterAtlasPins(pins, ATLAS_PIN_CLUSTER_CELL_PX)
    const clustered = out.filter((c) => c.count > 1)
    const densest = Math.max(...out.map((c) => c.count))
    expect(out.length).toBeGreaterThan(10)
    expect(out.length).toBeLessThan(80)
    expect(clustered.length).toBeGreaterThan(8)
    expect(densest).toBeGreaterThan(8)
    expect(densest).toBeLessThan(pins.length)
    expect(out.reduce((n, c) => n + c.count, 0)).toBe(pins.length)
  })

  it('zoom doubles distances and a pair that piled becomes two pills', () => {
    const piled = clusterAtlasPins([pin(0, 70, 100), pin(1, 120, 100)])
    expect(piled).toHaveLength(1)
    const zoomed = clusterAtlasPins([pin(0, 140, 200), pin(1, 240, 200)])
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
