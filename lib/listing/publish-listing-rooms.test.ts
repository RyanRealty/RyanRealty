import { describe, expect, it } from 'vitest'
import { publishListingRooms } from './publish-listing-rooms'

describe('publishListingRooms', () => {
  it('withholds the Agness lodge-count pair and keeps living area', () => {
    expect(publishListingRooms({ beds: 23, baths: 22, sqft: 1000 })).toEqual({
      beds: null,
      baths: null,
      sqft: 1000,
    })
  })

  it('keeps a normal Central Oregon home', () => {
    expect(publishListingRooms({ beds: 3, baths: 2.5, sqft: 1850 })).toEqual({
      beds: 3,
      baths: 2.5,
      sqft: 1850,
    })
  })

  it('keeps a large lodge when living area can hold the rooms', () => {
    expect(publishListingRooms({ beds: 12, baths: 10, sqft: 8000 })).toEqual({
      beds: 12,
      baths: 10,
      sqft: 8000,
    })
  })

  it('withholds missing or non-positive rooms', () => {
    expect(publishListingRooms({ beds: 0, baths: null, sqft: 0 })).toEqual({
      beds: null,
      baths: null,
      sqft: null,
    })
  })
})
