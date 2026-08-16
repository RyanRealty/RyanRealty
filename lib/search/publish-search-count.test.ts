import { describe, expect, it } from 'vitest'
import {
  publishSearchCount,
  publishSearchCountPair,
  searchCountCaption,
} from './publish-search-count'

describe('publishSearchCount', () => {
  it('labels filter-match as homes', () => {
    expect(publishSearchCount({ value: 409, grain: 'filter-match' })).toEqual({
      value: 409,
      caption: 'homes',
      phrase: '409 homes',
    })
  })

  it('labels viewport as in this map view', () => {
    expect(publishSearchCount({ value: 318, grain: 'map-viewport' })?.phrase).toBe(
      '318 homes in this map view',
    )
  })

  it('labels an unlabeled city header as all types', () => {
    expect(publishSearchCount({ value: 1298, grain: 'all-types' })?.phrase).toBe(
      '1,298 homes for sale, all types',
    )
  })

  it('labels SFR pulse as active single-family', () => {
    expect(publishSearchCount({ value: 483, grain: 'sfr' })?.phrase).toBe(
      '483 active single-family listings',
    )
  })

  it('withholds a missing or negative count', () => {
    expect(publishSearchCount({ value: null, grain: 'filter-match' })).toBeNull()
    expect(publishSearchCount({ value: -1, grain: 'filter-match' })).toBeNull()
    expect(publishSearchCount({ value: Number.NaN, grain: 'filter-match' })).toBeNull()
  })

  it('keeps a plus on a capped viewport', () => {
    expect(
      publishSearchCount({ value: 500, grain: 'map-viewport', capped: true })?.phrase,
    ).toBe('500+ homes in this map view')
  })
})

describe('publishSearchCountPair', () => {
  it('keeps one number when match and viewport agree', () => {
    expect(publishSearchCountPair({ matchCount: 318, viewportCount: 318 })).toEqual({
      match: {
        value: 318,
        caption: 'homes',
        phrase: '318 homes',
      },
      viewport: null,
    })
  })

  it('labels the viewport when it differs from the filter match', () => {
    const published = publishSearchCountPair({ matchCount: 409, viewportCount: 318 })
    expect(published.match?.phrase).toBe('409 homes')
    expect(published.viewport?.phrase).toBe('318 homes in this map view')
  })
})

describe('searchCountCaption', () => {
  it('singularizes a one-home match', () => {
    expect(searchCountCaption('filter-match', 1)).toBe('home')
    expect(searchCountCaption('map-viewport', 1)).toBe('home in this map view')
  })
})
