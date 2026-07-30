import { describe, expect, it } from 'vitest'
import {
  areaShapesToShapeSet,
  getAreaIdsFromFilters,
  resolveAreasToShapeSet,
  MAX_AREA_IDS,
} from './area-resolve'
import { isPointInShapeSet } from '@/lib/map-polygon'

const POLY = {
  type: 'polygon' as const,
  coords: [[-121.40, 44.00], [-121.25, 44.00], [-121.25, 44.12], [-121.40, 44.12]] as [number, number][],
}
const CIRCLE = { type: 'circle' as const, center: [-121.3153, 44.0582] as [number, number], radius_m: 2000 }

describe('getAreaIdsFromFilters', () => {
  it('extracts, trims, dedupes, and caps areaIds', () => {
    expect(getAreaIdsFromFilters({ areaIds: [' a ', 'b', 'a', 42, ''] })).toEqual(['a', 'b'])
    const many = Array.from({ length: 30 }, (_, i) => `id-${i}`)
    expect(getAreaIdsFromFilters({ areaIds: many })).toHaveLength(MAX_AREA_IDS)
  })
  it('returns [] for missing / non-array values', () => {
    expect(getAreaIdsFromFilters({})).toEqual([])
    expect(getAreaIdsFromFilters(null)).toEqual([])
    expect(getAreaIdsFromFilters({ areaIds: 'a,b' })).toEqual([])
  })
})

describe('areaShapesToShapeSet', () => {
  it('splits exclude-flagged shapes into the exclude set and strips the flag', () => {
    const set = areaShapesToShapeSet([POLY, { ...CIRCLE, exclude: true }])
    expect(set).toEqual({
      include: [POLY],
      exclude: [{ type: 'circle', center: CIRCLE.center, radius_m: CIRCLE.radius_m }],
    })
  })
  it('omits the exclude key when nothing is excluded', () => {
    expect(areaShapesToShapeSet([POLY])).toEqual({ include: [POLY] })
  })
  it('drops malformed entries but keeps valid ones', () => {
    const set = areaShapesToShapeSet([{ type: 'nonsense' }, POLY, { type: 'circle', center: [0] }])
    expect(set).toEqual({ include: [POLY] })
  })
  it('null when no valid include shape survives (never widen to the whole feed)', () => {
    expect(areaShapesToShapeSet([])).toBeNull()
    expect(areaShapesToShapeSet('garbage')).toBeNull()
    expect(areaShapesToShapeSet([{ ...POLY, exclude: true }])).toBeNull()
  })
})

describe('resolveAreasToShapeSet', () => {
  it('unions includes and excludes across areas', () => {
    const set = resolveAreasToShapeSet([
      { shapes: [POLY] },
      { shapes: [CIRCLE, { ...POLY, exclude: true }] },
    ])
    expect(set?.include).toHaveLength(2)
    expect(set?.exclude).toHaveLength(1)
  })
  it('skips unresolvable areas and returns null when nothing resolves', () => {
    expect(resolveAreasToShapeSet([{ shapes: null }, { shapes: [] }])).toBeNull()
    expect(resolveAreasToShapeSet([])).toBeNull()
    expect(resolveAreasToShapeSet(undefined)).toBeNull()
    const set = resolveAreasToShapeSet([{ shapes: null }, { shapes: [POLY] }])
    expect(set).toEqual({ include: [POLY] })
  })

  it('resolved set implements area semantics: inside include, outside exclude (acceptance (c) algebra)', () => {
    // Bend box minus the 2 km Drake Park circle — the RPC fixture geometry.
    const set = resolveAreasToShapeSet([{ shapes: [POLY, { ...CIRCLE, exclude: true }] }])!
    // Drake Park itself: inside the box AND inside the exclude circle → out.
    expect(isPointInShapeSet({ lat: 44.0582, lng: -121.3153 }, set)).toBe(false)
    // NE Bend, inside the box, ~4 km from Drake Park → in.
    expect(isPointInShapeSet({ lat: 44.09, lng: -121.28 }, set)).toBe(true)
    // Tumalo, outside the include box → out.
    expect(isPointInShapeSet({ lat: 44.15, lng: -121.33 }, set)).toBe(false)
  })
})
