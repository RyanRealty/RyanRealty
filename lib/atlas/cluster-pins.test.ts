import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { makeProjection, padBbox } from '@/lib/geo/project-svg'
import { recordFrame } from '@/lib/geo/record-frame'
import {
  ATLAS_CLUSTER_PILL,
  ATLAS_PIN_CLUSTER_CELL_PX,
  ATLAS_PIN_HANG_PX,
  ATLAS_PIN_ISLAND_MARGIN_PX,
  ATLAS_PIN_PILL,
  CITY_FOLD_CLUSTER_STAGE,
  CITY_FOLD_CLUSTER_STAGE_PHONE,
  atlasClusterCanExpand,
  atlasClusterSize,
  atlasClusterWorldBounds,
  atlasViewFromStage,
  clampAtlasPinToIsland,
  clusterAtlasPins,
  mergeOverlappingAtlasClusters,
  floorCityFoldPaintView,
  hitAtlasPinLayer,
  pickCityFoldClusterStage,
  projectPinsToFoldStage,
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

  it('merges adjacent-cell pills whose boxes still sit on each other', () => {
    const grid = clusterAtlasPins([pin(0, 150, 100), pin(1, 170, 108)], 160)
    expect(grid).toHaveLength(2)
    const merged = mergeOverlappingAtlasClusters(grid)
    expect(merged).toHaveLength(1)
    expect(merged[0]!.count).toBe(2)
    expect(merged[0]!.indices).toEqual([0, 1])
  })

  it('does not merge pills that already have air between them', () => {
    const grid = clusterAtlasPins([pin(0, 40, 40), pin(1, 200, 180)], 160)
    expect(mergeOverlappingAtlasClusters(grid)).toHaveLength(2)
  })

  it('UXLIVE-6: a two-line cluster pill (median over the figure) overlaps by its own height', () => {
    // 30px apart vertically: two lone asks (26px tall) clear each other, but a
    // two-line cluster pill (34px) above a lone ask would sit on it.
    const lone = [
      { id: 'c-0', x: 100, y: 100, indices: [0], count: 1 },
      { id: 'c-1', x: 110, y: 130, indices: [1], count: 1 },
    ]
    expect(mergeOverlappingAtlasClusters(lone)).toHaveLength(2)
    const withCluster = [
      { id: 'c-0', x: 100, y: 100, indices: [0, 2, 3], count: 3 },
      { id: 'c-1', x: 110, y: 130, indices: [1], count: 1 },
    ]
    const merged = mergeOverlappingAtlasClusters(withCluster)
    expect(merged).toHaveLength(1)
    expect(merged[0]!.indices).toEqual([0, 1, 2, 3])
    expect(ATLAS_CLUSTER_PILL.h).toBeGreaterThan(ATLAS_PIN_PILL.h)
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

  it('contract: bend-desktop-fold — 46 marks / 44 clusters / 2 pills, not one 759 blob', () => {
    const houses = JSON.parse(
      readFileSync(resolve('lib/atlas/fixtures/bend-city-fold-houses.json'), 'utf8'),
    ) as { lat: number; lng: number }[]
    expect(houses.length).toBeGreaterThanOrEqual(758)

    const frame = recordFrame(houses, [])
    expect(frame.bbox).not.toBeNull()
    const proj = makeProjection(padBbox(frame.bbox!, 0.1), 1000)
    const projPins = houses.map((d, i) => {
      const [x, y] = proj.toXY(d.lng, d.lat)
      return { i, x, y }
    })
    const out = clusterAtlasPins(
      projectPinsToFoldStage(projPins, CITY_FOLD_CLUSTER_STAGE, proj, 1),
      ATLAS_PIN_CLUSTER_CELL_PX,
    )
    const clustered = out.filter((c) => c.count > 1)
    const pills = out.filter((c) => c.count === 1)
    expect(out).toHaveLength(46)
    expect(clustered).toHaveLength(44)
    expect(pills).toHaveLength(2)
    expect(Math.max(...out.map((c) => c.count))).toBeLessThan(houses.length)
    expect(out.reduce((n, c) => n + c.count, 0)).toBe(houses.length)
  })

  it('contract: bend-phone-fold — 14 navy bubbles + 2 price pills', () => {
    const houses = JSON.parse(
      readFileSync(resolve('lib/atlas/fixtures/bend-city-fold-houses.json'), 'utf8'),
    ) as { lat: number; lng: number }[]
    const frame = recordFrame(houses, [])
    const proj = makeProjection(padBbox(frame.bbox!, 0.1), 1000)
    const projPins = houses.map((d, i) => {
      const [x, y] = proj.toXY(d.lng, d.lat)
      return { i, x, y }
    })
    const out = clusterAtlasPins(
      projectPinsToFoldStage(projPins, CITY_FOLD_CLUSTER_STAGE_PHONE, proj, 1),
      ATLAS_PIN_CLUSTER_CELL_PX,
    )
    expect(out.filter((c) => c.count > 1)).toHaveLength(14)
    expect(out.filter((c) => c.count === 1)).toHaveLength(2)
  })

  it('contract: collapsed desktop GBR still uses the fold stage (not 1 × 759)', () => {
    const houses = JSON.parse(
      readFileSync(resolve('lib/atlas/fixtures/bend-city-fold-houses.json'), 'utf8'),
    ) as { lat: number; lng: number }[]
    const frame = recordFrame(houses, [])
    const proj = makeProjection(padBbox(frame.bbox!, 0.1), 1000)
    const collapsed = atlasViewFromStage(1112, 64, proj.width, proj.height)
    expect(collapsed.scale).toBeLessThan(0.08)
    const floored = floorCityFoldPaintView(collapsed, CITY_FOLD_CLUSTER_STAGE, proj.width, proj.height)
    expect(floored.scale).toBeCloseTo(
      atlasViewFromStage(CITY_FOLD_CLUSTER_STAGE.w, CITY_FOLD_CLUSTER_STAGE.h, proj.width, proj.height)
        .scale,
    )
    const projPins = houses.map((d, i) => {
      const [x, y] = proj.toXY(d.lng, d.lat)
      return { i, x, y }
    })
    const liveCollapsed = clusterAtlasPins(
      projPins.map((p) => ({
        i: p.i,
        x: collapsed.ox + p.x * collapsed.scale,
        y: collapsed.oy + p.y * collapsed.scale,
      })),
    )
    expect(liveCollapsed.length).toBeLessThan(5)
    expect(Math.max(...liveCollapsed.map((c) => c.count))).toBeGreaterThan(houses.length * 0.7)
    const locked = clusterAtlasPins(projectPinsToFoldStage(projPins, CITY_FOLD_CLUSTER_STAGE, proj, 1))
    expect(locked).toHaveLength(46)
  })

  it('desktop +1 zoom (k=1.18) engages — more marks than the default 46', () => {
    const houses = JSON.parse(
      readFileSync(resolve('lib/atlas/fixtures/bend-city-fold-houses.json'), 'utf8'),
    ) as { lat: number; lng: number }[]
    const frame = recordFrame(houses, [])
    const proj = makeProjection(padBbox(frame.bbox!, 0.1), 1000)
    const projPins = houses.map((d, i) => {
      const [x, y] = proj.toXY(d.lng, d.lat)
      return { i, x, y }
    })
    const rest = clusterAtlasPins(projectPinsToFoldStage(projPins, CITY_FOLD_CLUSTER_STAGE, proj, 1))
    const zoomed = clusterAtlasPins(projectPinsToFoldStage(projPins, CITY_FOLD_CLUSTER_STAGE, proj, 1.18))
    expect(rest).toHaveLength(46)
    expect(zoomed.length).toBeGreaterThan(46)
  })

  it('picks desktop vs phone fold stage at the 64rem cut', () => {
    expect(pickCityFoldClusterStage(1400)).toEqual(CITY_FOLD_CLUSTER_STAGE)
    expect(pickCityFoldClusterStage(1024)).toEqual(CITY_FOLD_CLUSTER_STAGE)
    expect(pickCityFoldClusterStage(375)).toEqual(CITY_FOLD_CLUSTER_STAGE_PHONE)
    expect(pickCityFoldClusterStage(1023)).toEqual(CITY_FOLD_CLUSTER_STAGE_PHONE)
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

describe('clampAtlasPinToIsland', () => {
  it('slides a 375 west-edge $440k+ pill back inside the island', () => {
    const island = { w: 335, h: 208 }
    const at = clampAtlasPinToIsland(18, 90, island)
    expect(at.x - ATLAS_PIN_PILL.w / 2).toBeGreaterThanOrEqual(ATLAS_PIN_ISLAND_MARGIN_PX)
    expect(at.x + ATLAS_PIN_PILL.w / 2).toBeLessThanOrEqual(island.w - ATLAS_PIN_ISLAND_MARGIN_PX)
    expect(at.y - ATLAS_PIN_PILL.h - ATLAS_PIN_HANG_PX).toBeGreaterThanOrEqual(ATLAS_PIN_ISLAND_MARGIN_PX)
  })

  it('slides a top-right count chip back inside the 375 island', () => {
    const island = { w: 335, h: 208 }
    const at = clampAtlasPinToIsland(330, -4, island)
    expect(at.x + ATLAS_PIN_PILL.w / 2).toBeLessThanOrEqual(island.w - ATLAS_PIN_ISLAND_MARGIN_PX)
    expect(at.y - ATLAS_PIN_PILL.h - ATLAS_PIN_HANG_PX).toBeGreaterThanOrEqual(ATLAS_PIN_ISLAND_MARGIN_PX)
  })

  it('leaves a centred desktop pin unmoved so SITE-127 hover stays on the house', () => {
    const island = { w: 996, h: 558 }
    const at = clampAtlasPinToIsland(480, 280, island)
    expect(at).toEqual({ x: 480, y: 280 })
  })
})
