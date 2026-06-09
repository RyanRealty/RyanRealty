import { describe, it, expect } from 'vitest'
import { subdivisionLegend } from './subdivision-legend'

describe('subdivisionLegend', () => {
  const pins = [
    { subdivisionName: 'Awbrey Glen' },
    { subdivisionName: 'Awbrey Glen' },
    { subdivisionName: 'Awbrey Glen' },
    { subdivisionName: 'Awbrey Village' },
    { subdivisionName: 'Awbrey Village' },
    { subdivisionName: 'Lone Pine' }, // count 1 -> filtered by default minCount 2
    { subdivisionName: null }, // untagged -> ignored
    { subdivisionName: '  ' }, // blank -> ignored
    {},
  ]

  it('returns distinct subdivisions sorted by count desc, with counts', () => {
    const out = subdivisionLegend(pins)
    expect(out).toEqual([
      { name: 'Awbrey Glen', count: 3 },
      { name: 'Awbrey Village', count: 2 },
    ])
  })

  it('drops singletons by default (minCount 2) and ignores null/blank', () => {
    const out = subdivisionLegend(pins)
    expect(out.some((e) => e.name === 'Lone Pine')).toBe(false)
    expect(out.every((e) => e.count >= 2)).toBe(true)
  })

  it('respects minCount and max', () => {
    expect(subdivisionLegend(pins, { minCount: 1 }).map((e) => e.name)).toContain('Lone Pine')
    expect(subdivisionLegend(pins, { minCount: 1, max: 1 })).toHaveLength(1)
  })

  it('returns empty when nothing is tagged', () => {
    expect(subdivisionLegend([{ subdivisionName: null }, {}])).toEqual([])
  })
})
