import { describe, expect, it } from 'vitest'
import { CITY_FOOTNOTE_TERM, cityFootnoteFact } from './city-footnote-fact'

const MACHINE = /published active single-family count|market row|latest sync|shows \d|active with no/

describe('cityFootnoteFact (VOICE-6)', () => {
  it('says each case as a fact about the town, not the pipeline', () => {
    expect(cityFootnoteFact('Tumalo', { active_count: null })).toBe(
      "We don't publish a Tumalo homes-for-sale count right now",
    )
    expect(cityFootnoteFact('Sisters', null)).toBe("We don't have current market numbers for Sisters")
    expect(cityFootnoteFact('Culver', { active_count: 0 })).toBe('Culver has no single-family homes for sale right now')
    expect(cityFootnoteFact('La Pine', { active_count: 1_204, median_list_price: null })).toBe(
      'La Pine has 1,204 single-family homes for sale, and no median asking price we can publish',
    )
    expect(cityFootnoteFact('Metolius', { active_count: 1 })).toContain('1 single-family home for sale')
  })

  it('never prints the old machine phrasing', () => {
    for (const snap of [null, { active_count: null }, { active_count: 0 }, { active_count: 7 }]) {
      expect(cityFootnoteFact('Tumalo', snap)).not.toMatch(MACHINE)
    }
    expect(CITY_FOOTNOTE_TERM).not.toMatch(/table above/)
  })
})
