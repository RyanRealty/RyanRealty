import { describe, expect, it } from 'vitest'
import { atlasRegionName, atlasRegionNames } from './place-names'

describe('atlasRegionName', () => {
  it('strips every recorder residue class the evaluator quoted', () => {
    const cases: [string, string][] = [
      ['Trailhead Cottages 247-23-000715-tp', 'Trailhead Cottages'],
      ['North Forty At Tetherow (also In Section 2)', 'North Forty At Tetherow'],
      ['Daly Estates Aff Cor See Cs06506', 'Daly Estates'],
      ['Acapella Pz 20-0027 , Pz 20-0028', 'Acapella'],
      ['Westgate Pz-20-0726', 'Westgate'],
      ['Bend Park Third Addition Replat Block 186 Lots 15 & 16', 'Bend Park Third Addition'],
      ['Bend Park Second Addition Portion Of Blocks 145-164 Vacation', 'Bend Park Second Addition'],
      ['River Rim P.u.d', 'River Rim'],
      ['Gardenside P.u.d Phase 1', 'Gardenside Phase 1'],
      ['Desert Skies Phases 1 & 2', 'Desert Skies Phases 1 & 2'],
      ['South Bend Vacation Plat', 'South Bend'],
    ]
    for (const [raw, want] of cases) expect(atlasRegionName(raw)).toBe(want)
  })

  it('returns null when nothing survives', () => {
    expect(atlasRegionName('Pz 20-0027')).toBeNull()
    expect(atlasRegionName('')).toBeNull()
  })
})

describe('atlasRegionNames', () => {
  it('keeps the published name when stripping would fold two plats onto one', () => {
    const raws = ['Daly Estates Replat Block 1', 'Daly Estates Replat Block 2', 'Daly Estates', 'Aviara Subdivision']
    const names = atlasRegionNames(raws)
    expect(new Set(names).size).toBe(4)
    expect(names[3]).toBe('Aviara Subdivision')
    expect(names[0]).not.toBe(names[1])
  })
})
