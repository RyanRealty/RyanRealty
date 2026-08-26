/**
 * PLACE_CONTENT_RULES R1/R2/R3, as tests rather than prose.
 *
 * The rules exist because the naive version ships a wrong number onto thousands
 * of pages, and prose does not stop that from being rewritten. These lock the
 * three refusals and the segment scoping: a range under the sample floor, a
 * dues median under the reported floor, and any form of "there is no HOA here"
 * all have to stay unpublishable.
 */

import { describe, expect, it } from 'vitest'
import {
  DUES_MIN_REPORTED,
  HOA_PRESENCE_MIN_REPORTED,
  YEAR_BUILT_MIN_SAMPLE,
  placeCharacterNoun,
  selectPlaceCharacter,
} from './getPlaceCharacter'

type Row = Parameters<typeof selectPlaceCharacter>[0][number]

function row(over: Partial<Row> & { segment: string }): Row {
  return {
    home_count: 100,
    year_sample: 0,
    year_p10: null,
    year_p90: null,
    hoa_reported: 0,
    hoa_median_monthly: null,
    assoc_reported: 0,
    assoc_yes: 0,
    window_from: '2023-08-26',
    ...over,
  }
}

/** Deschutes River Woods, measured 2026-08-26. The rules doc's own example. */
const DRW_DETACHED = row({
  segment: 'Single Family Residence',
  home_count: 1119,
  year_sample: 1117,
  year_p10: 1975,
  year_p90: 2008,
  hoa_reported: 0,
  assoc_reported: 161,
  assoc_yes: 0,
})

describe('R1 — year built', () => {
  it('publishes the percentile range with its sample', () => {
    const c = selectPlaceCharacter([DRW_DETACHED])
    expect(c?.yearBuilt).toEqual({ p10: 1975, p90: 2008, sample: 1117 })
  })

  it('withholds the range below the sample floor', () => {
    const c = selectPlaceCharacter([
      row({
        segment: 'Single Family Residence',
        year_sample: YEAR_BUILT_MIN_SAMPLE - 1,
        year_p10: 1975,
        year_p90: 2008,
        assoc_reported: 40,
        assoc_yes: 12,
      }),
    ])
    expect(c?.yearBuilt).toBeNull()
  })

  it('withholds the range when a percentile is missing', () => {
    const c = selectPlaceCharacter([
      row({
        segment: 'Single Family Residence',
        year_sample: 400,
        year_p10: 1975,
        year_p90: null,
        assoc_reported: 40,
        assoc_yes: 12,
      }),
    ])
    expect(c?.yearBuilt).toBeNull()
  })
})

describe('R2 — HOA dues', () => {
  it('publishes the median inside one property type', () => {
    const c = selectPlaceCharacter([
      row({
        segment: 'Single Family Residence',
        year_sample: 3655,
        year_p10: 1976,
        year_p90: 1999,
        hoa_reported: 519,
        hoa_median_monthly: 165,
        assoc_reported: 522,
        assoc_yes: 519,
      }),
      // A condo median 100 dollars away, in the same place. It must not reach
      // the detached figure: this is the 840-mixed-type case the rule is about.
      row({
        segment: 'Condominium',
        home_count: 894,
        hoa_reported: 185,
        hoa_median_monthly: 267,
        assoc_reported: 185,
        assoc_yes: 185,
      }),
    ])
    expect(c?.subType).toBe('Single Family Residence')
    expect(c?.dues?.medianMonthly).toBe(165)
    expect(c?.dues?.reported).toBe(519)
  })

  it('withholds the median below the reported floor', () => {
    const c = selectPlaceCharacter([
      row({
        segment: 'Single Family Residence',
        year_sample: 400,
        year_p10: 1990,
        year_p90: 2010,
        hoa_reported: DUES_MIN_REPORTED - 1,
        hoa_median_monthly: 240,
      }),
    ])
    expect(c?.yearBuilt).not.toBeNull()
    expect(c?.dues).toBeNull()
  })
})

describe('R3 — HOA presence', () => {
  it('publishes the count and its denominator', () => {
    const c = selectPlaceCharacter([
      row({
        segment: 'Single Family Residence',
        assoc_reported: 761,
        assoc_yes: 211,
      }),
    ])
    expect(c?.hoaPresence).toEqual({ yes: 211, reported: 761, windowFrom: '2023-08-26' })
  })

  it('never publishes an all-no count, which reads as "no HOA here"', () => {
    const c = selectPlaceCharacter([DRW_DETACHED])
    expect(c?.hoaPresence).toBeNull()
    // The build-year range still publishes: the three facts are independent.
    expect(c?.yearBuilt).not.toBeNull()
  })

  it('withholds the count below the reported floor', () => {
    const c = selectPlaceCharacter([
      row({
        segment: 'Single Family Residence',
        assoc_reported: HOA_PRESENCE_MIN_REPORTED - 1,
        assoc_yes: 3,
      }),
    ])
    expect(c).toBeNull()
  })
})

describe('segment scoping', () => {
  it('leads with detached when detached has anything to say', () => {
    const c = selectPlaceCharacter([
      row({ segment: 'Residential Lots', home_count: 585, hoa_reported: 142, hoa_median_monthly: 360, assoc_reported: 142, assoc_yes: 142 }),
      row({ segment: 'Single Family Residence', home_count: 326, year_sample: 326, year_p10: 2007, year_p90: 2025 }),
    ])
    expect(c?.subType).toBe('Single Family Residence')
    expect(c?.noun).toBe('detached homes')
  })

  it('falls to the largest dwelling type when detached says nothing', () => {
    const c = selectPlaceCharacter([
      row({ segment: 'Single Family Residence', home_count: 400, year_sample: 3 }),
      row({ segment: 'Condominium', home_count: 300, year_sample: 300, year_p10: 1974, year_p90: 2021 }),
      row({ segment: 'Townhouse', home_count: 100, year_sample: 100, year_p10: 1981, year_p90: 2020 }),
    ])
    expect(c?.subType).toBe('Condominium')
  })

  it('never leads with land or commercial', () => {
    const c = selectPlaceCharacter([
      row({ segment: 'Residential Lots', home_count: 900, hoa_reported: 200, hoa_median_monthly: 300, assoc_reported: 200, assoc_yes: 200 }),
      row({ segment: 'Commercial', home_count: 40, assoc_reported: 30, assoc_yes: 20 }),
    ])
    expect(c).toBeNull()
  })

  it('returns null when nothing at all is publishable', () => {
    expect(selectPlaceCharacter([])).toBeNull()
    expect(selectPlaceCharacter([row({ segment: 'Single Family Residence', year_sample: 2 })])).toBeNull()
  })
})

describe('type naming', () => {
  it('names every dwelling type in copy English', () => {
    expect(placeCharacterNoun('Single Family Residence', 2)).toBe('detached homes')
    expect(placeCharacterNoun('Manufactured On Land', 1)).toBe('manufactured home on land')
    expect(placeCharacterNoun('Quadruplex', 2)).toBe('fourplexes')
  })

  it('falls back to the MLS label rather than guessing', () => {
    expect(placeCharacterNoun('Some New RETS Type', 2)).toBe('some new rets type')
  })
})
