import { describe, expect, it } from 'vitest'
import * as gate from '../../../.claude/skills/ryan-studio/tools/video_gate.mjs'
import { ADDRESS, NAMEISH, peopleAndPlaceHits } from './copy-rules'
import { loadVideoTypes } from './thresholds'

describe('copy rules are video_gate\'s own', () => {
  it('uses the same address and name patterns as video_gate.mjs', () => {
    expect(ADDRESS.source).toBe((gate as { ADDRESS: RegExp }).ADDRESS.source)
    expect(NAMEISH.source).toBe((gate as { NAMEISH: RegExp }).NAMEISH.source)
  })

  it('reads the fair housing list from video_types.json', () => {
    expect(loadVideoTypes().fair_housing_flags).toContain('young professionals')
  })
})

describe('peopleAndPlaceHits', () => {
  const flags = loadVideoTypes().fair_housing_flags

  it('catches fair housing flags as whole words, any case', () => {
    expect(peopleAndPlaceHits('Perfect for young professionals', flags).map((h) => h.what)).toEqual(['fair housing flag "young professionals" (describe homes and places, never people)'])
    expect(peopleAndPlaceHits('[warm] A FAMILY-FRIENDLY street', flags)).toHaveLength(1)
    expect(peopleAndPlaceHits('Familyfriendly', flags)).toEqual([])
  })

  it('catches an address and a name', () => {
    expect(peopleAndPlaceHits('Sold at 1234 NW Galveston Ave', flags)[0].what).toContain('an address')
    expect(peopleAndPlaceHits('Mrs Jones listed it', flags)[0].what).toContain("a person's name")
    expect(peopleAndPlaceHits('the Smiths sold fast', flags)[0].what).toContain("a person's name")
  })

  it('passes copy about homes and places', () => {
    expect(peopleAndPlaceHits('Bend has 3.5 months of homes for sale', flags)).toEqual([])
  })
})
