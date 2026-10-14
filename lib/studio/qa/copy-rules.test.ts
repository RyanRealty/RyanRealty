import { describe, expect, it } from 'vitest'
import * as gate from '../../../.claude/skills/ryan-studio/tools/video_gate.mjs'
import { ADDRESS, NAMEISH, peopleAndPlaceHits } from './copy-rules'
import { loadVideoTypes } from './thresholds'

describe('copy rules are video_gate\'s own', () => {
  it('uses the same address and name patterns as video_gate.mjs', () => {
    expect(ADDRESS.source).toBe((gate as { ADDRESS: RegExp }).ADDRESS.source)
    expect(NAMEISH.source).toBe((gate as { NAMEISH: RegExp }).NAMEISH.source)
    expect(ADDRESS.flags).toBe((gate as { ADDRESS: RegExp }).ADDRESS.flags)
    expect(NAMEISH.flags).toBe((gate as { NAMEISH: RegExp }).NAMEISH.flags)
    expect(ADDRESS.flags).toContain('i')
    expect(NAMEISH.flags).toContain('i')
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

describe('addresses and names in any case (F6)', () => {
  const flags = loadVideoTypes().fair_housing_flags
  const hit = (text: string) => peopleAndPlaceHits(text, flags).map((h) => h.what)

  it("catches the review's cases in capitals and lower case", () => {
    // review finding: only Title Case was caught, and cards and captions are drawn in capitals
    for (const text of ['Sold at 123 Main Street', 'SOLD AT 123 MAIN ST', 'sold at 123 main street', 'JUST LISTED: 61234 SW BROOKSWOOD BLVD.']) {
      expect(hit(text).some((h) => h.startsWith('an address')), text).toBe(true)
    }
    for (const text of ['MRS JONES SOLD', 'mr smith bought', 'THE SMITHS SOLD', 'Sarah and Tom just closed', 'SARAH AND TOM JUST CLOSED', 'sarah & tom bought']) {
      expect(hit(text).some((h) => h.startsWith("a person's name")), text).toBe(true)
    }
  })

  it('leaves the lines a market film says every day alone', () => {
    for (const text of [
      'It is a 15 minute drive to the river',
      '20 homes on the way to town',
      'the homes sold fast this spring',
      'the listings closed in 30 days',
      'Bend and Redmond sold more homes',
      'buyers and sellers just closed the gap',
      'you and your partner just bought',
      '3.5 months of homes for sale',
      'Send this to whoever you\'re house hunting with.',
    ]) {
      expect(hit(text), text).toEqual([])
    }
  })

  it('is the same in video_gate: the gate refuses a capitals address and a first-name pair', () => {
    const g = gate as { ADDRESS: RegExp; NAMEISH: RegExp }
    expect(g.ADDRESS.test('SOLD AT 123 MAIN ST')).toBe(true)
    expect(g.NAMEISH.test('Sarah and Tom just closed')).toBe(true)
  })
})
