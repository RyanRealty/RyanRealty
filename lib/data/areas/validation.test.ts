import { describe, expect, it } from 'vitest'
import {
  AREA_NAME_MAX,
  validateAreaName,
  validateAreaShapes,
  validateAreaSlug,
} from './validation'

const POLY = { type: 'polygon' as const, coords: [[-121.4, 44.0], [-121.25, 44.0], [-121.25, 44.12]] as [number, number][] }
const CIRCLE = { type: 'circle' as const, center: [-121.3153, 44.0582] as [number, number], radius_m: 2000 }

describe('validateAreaName', () => {
  it('trims and accepts a normal name', () => {
    const r = validateAreaName('  Bend West Side  ')
    expect(r).toEqual({ ok: true, value: 'Bend West Side' })
  })
  it('rejects empty / non-string names', () => {
    expect(validateAreaName('').ok).toBe(false)
    expect(validateAreaName('   ').ok).toBe(false)
    expect(validateAreaName(42 as unknown as string).ok).toBe(false)
    expect(validateAreaName(undefined).ok).toBe(false)
  })
  it('rejects names over the cap', () => {
    expect(validateAreaName('x'.repeat(AREA_NAME_MAX)).ok).toBe(true)
    expect(validateAreaName('x'.repeat(AREA_NAME_MAX + 1)).ok).toBe(false)
  })
})

describe('validateAreaSlug', () => {
  it('accepts lowercase kebab and lowercases input', () => {
    expect(validateAreaSlug('bend-west-side')).toEqual({ ok: true, value: 'bend-west-side' })
    expect(validateAreaSlug('Bend-West-Side')).toEqual({ ok: true, value: 'bend-west-side' })
  })
  it('rejects malformed slugs', () => {
    for (const bad of ['ab', '-lead', 'trail-', 'two--dashes', 'has space', 'ünicode', '', null]) {
      expect(validateAreaSlug(bad as string).ok, String(bad)).toBe(false)
    }
  })
  it('rejects reserved slugs', () => {
    expect(validateAreaSlug('new').ok).toBe(false)
    expect(validateAreaSlug('api').ok).toBe(false)
  })
})

describe('validateAreaShapes', () => {
  it('accepts polygons + circles with exclude flags', () => {
    const r = validateAreaShapes([POLY, { ...CIRCLE, exclude: true }])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value).toHaveLength(2)
      expect(r.value[1]).toMatchObject({ type: 'circle', exclude: true })
    }
  })
  it('rejects an empty array and non-arrays', () => {
    expect(validateAreaShapes([]).ok).toBe(false)
    expect(validateAreaShapes(null).ok).toBe(false)
    expect(validateAreaShapes({ include: [POLY] }).ok).toBe(false)
  })
  it('rejects a set that is ALL excludes (nothing left to search)', () => {
    expect(validateAreaShapes([{ ...POLY, exclude: true }]).ok).toBe(false)
  })
  it('rejects out-of-contract shapes (bounds mirror the RPC)', () => {
    // < 3 vertices
    expect(validateAreaShapes([{ type: 'polygon', coords: [[-121.4, 44.0], [-121.3, 44.1]] }]).ok).toBe(false)
    // zero / oversized radius
    expect(validateAreaShapes([{ ...CIRCLE, radius_m: 0 }]).ok).toBe(false)
    expect(validateAreaShapes([{ ...CIRCLE, radius_m: 200_001 }]).ok).toBe(false)
    // out-of-range coordinates
    expect(validateAreaShapes([{ type: 'polygon', coords: [[-181, 44], [-121.3, 44.1], [-121.2, 44.2]] }]).ok).toBe(false)
    // unknown type
    expect(validateAreaShapes([{ type: 'rectangle', coords: POLY.coords } as unknown]).ok).toBe(false)
    // over the 50-shape cap
    expect(validateAreaShapes(Array.from({ length: 51 }, () => POLY)).ok).toBe(false)
  })
})
