import { describe, expect, it } from 'vitest'
import {
  conditionBoolean,
  conditionMultiOptions,
  zeroReasonLabel,
} from '@/components/search/class-conditioning'
import { type ClassPrevalenceArtifact } from '@/lib/search/class-prevalence'

const fixture: ClassPrevalenceArtifact = {
  generatedAt: '2026-07-30T00:00:00.000Z',
  rowTotals: { A: 6000, B: 300, C: 200, D: 2000, other: 500, total: 9000 },
  fields: {
    heatingTypes: {
      kind: 'multi',
      mv: 'heating_types',
      values: {
        'Forced Air': { counts: [4000, 200, 150, 0], total: 4400 },
        'Heat Pump': { counts: [1500, 100, 40, 0], total: 1640 },
        Geothermal: { counts: [10, 0, 0, 0], total: 10 },
        'Class B Only': { counts: [0, 40, 0, 0], total: 40, hint: ['B'] },
      },
    },
    hasPool: {
      kind: 'boolean',
      mv: 'pool_yn',
      values: { true: { counts: [1100, 50, 10, 0], total: 1160 } },
    },
  },
}

const def = {
  key: 'heatingTypes',
  options: ['Forced Air', 'Heat Pump', 'Geothermal', 'Class B Only'] as const,
}

describe('conditionMultiOptions', () => {
  it('orders live values by prominence then count, zero values last', () => {
    const { options } = conditionMultiOptions(def, fixture, ['A'], [])
    expect(options.map((o) => o.value)).toEqual(['Forced Air', 'Heat Pump', 'Geothermal'])
    // Class B Only is hidden under A (zero + hint agrees) and not selected.
    expect(options.some((o) => o.value === 'Class B Only')).toBe(false)
  })

  it('keeps a zero-for-class value visible but disabled when the hint does not exclude it', () => {
    const { options } = conditionMultiOptions(def, fixture, ['D'], [])
    const forcedAir = options.find((o) => o.value === 'Forced Air')
    expect(forcedAir).toMatchObject({ count: 0, state: 'disabled-zero', selected: false })
  })

  it('suspends, never drops: a selected value that is invalid for the class stays, struck', () => {
    const { options, suspended } = conditionMultiOptions(def, fixture, ['A'], ['Class B Only'])
    const row = options.find((o) => o.value === 'Class B Only')
    expect(row).toMatchObject({ selected: true, suspended: true, count: 0 })
    expect(suspended.map((o) => o.value)).toEqual(['Class B Only'])
  })

  it('appends a selected value missing from the registry options (old URL, moved vocabulary)', () => {
    const { options } = conditionMultiOptions(def, fixture, ['A'], ['Retired Value'])
    const row = options.find((o) => o.value === 'Retired Value')
    expect(row).toBeTruthy()
    expect(row?.selected).toBe(true)
  })

  it('becomes valid again when the class changes back — pure recompute, no state loss', () => {
    const underA = conditionMultiOptions(def, fixture, ['A'], ['Class B Only'])
    expect(underA.suspended).toHaveLength(1)
    const underB = conditionMultiOptions(def, fixture, ['B'], ['Class B Only'])
    expect(underB.suspended).toHaveLength(0)
    expect(underB.options.find((o) => o.value === 'Class B Only')).toMatchObject({
      selected: true,
      suspended: false,
      count: 40,
    })
  })

  it('passes through unconditioned when the census is not loaded', () => {
    const { options, suspended } = conditionMultiOptions(def, null, ['A'], ['Heat Pump'])
    expect(options.map((o) => o.value)).toEqual([...def.options])
    expect(options.every((o) => o.count === null && o.state === 'shown')).toBe(true)
    expect(suspended).toHaveLength(0)
  })
})

describe('conditionBoolean', () => {
  it('reports live counts for the class scope', () => {
    expect(conditionBoolean('hasPool', fixture, ['A'], false)).toMatchObject({
      count: 1100,
      state: 'shown',
      suspended: false,
    })
  })
  it('flags a checked boolean with zero class matches as suspended', () => {
    expect(conditionBoolean('hasPool', fixture, ['D'], true)).toMatchObject({
      count: 0,
      selected: true,
      suspended: true,
    })
  })
  it('is unconditioned without the census', () => {
    expect(conditionBoolean('hasPool', null, ['D'], true)).toMatchObject({
      count: null,
      state: 'shown',
      suspended: false,
    })
  })
})

describe('zeroReasonLabel', () => {
  it('names the scope when there is one', () => {
    expect(zeroReasonLabel('Multi-family')).toBe('0 multi-family listings')
    expect(zeroReasonLabel(null)).toBe('0 matching listings')
  })
})
