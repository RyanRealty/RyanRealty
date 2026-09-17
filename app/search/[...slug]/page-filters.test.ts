import { describe, expect, it } from 'vitest'
import { buildSearchFilters } from './page-filters'

const emptySp = {}

describe('buildSearchFilters exclusive path places', () => {
  it('Caldera community door does not keep parent city Sunriver', () => {
    const { filterOpts } = buildSearchFilters({
      sp: emptySp,
      city: 'Sunriver',
      decodedSubdivision: 'Caldera Springs',
      neighborhood: undefined,
      preset: null,
    })
    expect(filterOpts.subdivision).toBe('Caldera Springs')
    expect(filterOpts.city).toBeUndefined()
  })

  it('parent city alone still pins the city', () => {
    const { filterOpts } = buildSearchFilters({
      sp: emptySp,
      city: 'Sunriver',
      decodedSubdivision: undefined,
      neighborhood: undefined,
      preset: null,
    })
    expect(filterOpts.city).toBe('Sunriver')
    expect(filterOpts.subdivision).toBeUndefined()
  })

  it('neighborhood pages keep the city pin', () => {
    const { filterOpts } = buildSearchFilters({
      sp: emptySp,
      city: 'Bend',
      decodedSubdivision: 'Southern Crossing',
      neighborhood: 'Southern Crossing',
      preset: null,
    })
    expect(filterOpts.city).toBe('Bend')
    expect(filterOpts.neighborhood).toBe('Southern Crossing')
  })
})
