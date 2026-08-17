import { describe, expect, it } from 'vitest'
import { publishListingRooms } from './publish-listing-rooms'

describe('publishListingRooms', () => {
  it('keeps ordinary Central Oregon room counts', () => {
    expect(publishListingRooms({ beds: 3, baths: 2, livingSqft: 1800 })).toEqual({
      beds: 3,
      baths: 2,
    })
    expect(publishListingRooms({ beds: 4, baths: 3, livingSqft: 1618 })).toEqual({
      beds: 4,
      baths: 3,
    })
  })

  it('withholds the Agness 23 / 22 / 1,000 founding case', () => {
    expect(publishListingRooms({ beds: 23, baths: 22, livingSqft: 1000 })).toEqual({
      beds: null,
      baths: null,
    })
  })

  it('keeps a dense-but-plausible lodge', () => {
    expect(publishListingRooms({ beds: 10, baths: 8, livingSqft: 2500 })).toEqual({
      beds: 10,
      baths: 8,
    })
  })

  it('withholds 16-plus rooms when living area is missing', () => {
    expect(publishListingRooms({ beds: 23, baths: 22, livingSqft: null })).toEqual({
      beds: null,
      baths: null,
    })
  })

  it('withholds missing or non-positive counts', () => {
    expect(publishListingRooms({ beds: 0, baths: 0, livingSqft: 1800 })).toEqual({
      beds: null,
      baths: null,
    })
  })
})
