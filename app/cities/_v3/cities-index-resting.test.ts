import { describe, expect, it } from 'vitest'
import { cityLeftoverActive, restingCityDetail } from './cities-index-resting'

describe('restingCityDetail', () => {
  it('surfaces a published supply reading at rest', () => {
    expect(
      restingCityDetail({
        medianLine: 'Median list $425K',
        sentence: null,
        hasPhoto: false,
        restingSupply: 'Balanced market · 5.2 months',
      }),
    ).toBe('Median list $425K · Balanced market · 5.2 months')
  })

  it('does not invent production language when there is no photo and no supply', () => {
    expect(
      restingCityDetail({
        medianLine: null,
        sentence: null,
        hasPhoto: false,
        restingSupply: null,
      }),
    ).toBeNull()
  })

  it('uses one leftover pile and never mixes a later snapshot over headlines', () => {
    expect(
      cityLeftoverActive({
        headlinesActive: 29,
        inventoryActive: 648,
        snapshotActive: 648,
        indexActive: 12,
      }),
    ).toBe(29)
    expect(
      cityLeftoverActive({
        headlinesActive: null,
        inventoryActive: 29,
        snapshotActive: 648,
        indexActive: 12,
      }),
    ).toBe(29)
  })

  it('keeps median and sentence when a verified photo is present', () => {
    expect(
      restingCityDetail({
        medianLine: 'Median list $749K',
        sentence: 'A city on the Deschutes.',
        hasPhoto: true,
        restingSupply: null,
      }),
    ).toBe('Median list $749K · A city on the Deschutes.')
  })
})
