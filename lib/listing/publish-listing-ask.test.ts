import { describe, expect, it } from 'vitest'
import { formatListingAsk, formatPublishedAsk, publishListingAsk, publishListingDrop } from './publish-listing-ask'

describe('publishListingAsk', () => {
  it('keeps the 7th Street and Hudspeth founding cases exact', () => {
    expect(publishListingAsk(424990)).toEqual({ ask: 424990 })
    expect(formatListingAsk(424990)).toBe('$424,990')
    expect(formatListingAsk(424990)).not.toBe('$425,000')
    expect(publishListingAsk(629500)).toEqual({ ask: 629500 })
    expect(formatListingAsk(629500)).toBe('$629,500')
    expect(formatListingAsk(629500)).not.toBe('$630,000')
  })

  it('withholds a missing or non-positive ask', () => {
    expect(publishListingAsk(0)).toBeNull()
    expect(publishListingAsk(null)).toBeNull()
  })

  it('keeps Boyd Acres and Old Bend place-card asks exact', () => {
    expect(formatPublishedAsk(949900)).toBe('$949,900')
    expect(formatPublishedAsk(949900)).not.toBe('$950,000')
    expect(formatPublishedAsk(899900)).toBe('$899,900')
    expect(formatPublishedAsk(1999500)).toBe('$1,999,500')
    expect(formatPublishedAsk(1999500)).not.toBe('$2,000,000')
    expect(formatPublishedAsk(919500)).toBe('$919,500')
    expect(formatPublishedAsk(919500)).not.toBe('$920,000')
  })
})

describe('publishListingDrop', () => {
  it('keeps Hudspeth drop math on the exact ask', () => {
    expect(publishListingDrop({ listPrice: 629500, originalListPrice: 645000 })).toEqual({
      ask: 629500,
      original: 645000,
      drop: 15500,
    })
  })

  it('keeps 7th Street drop math on the exact ask', () => {
    expect(publishListingDrop({ listPrice: 424990, originalListPrice: 430000 })).toEqual({
      ask: 424990,
      original: 430000,
      drop: 5010,
    })
  })

  it('withholds when original is not above the ask', () => {
    expect(publishListingDrop({ listPrice: 629500, originalListPrice: 629500 })).toBeNull()
    expect(publishListingDrop({ listPrice: 629500, originalListPrice: null })).toBeNull()
  })
})
