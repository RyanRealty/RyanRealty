import { describe, expect, it } from 'vitest'
import { formatListingAsk, publishListingAsk, publishListingDrop } from './publish-listing-ask'

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

  it('withholds a positive ask that thousand-rounds to $0', () => {
    expect(publishListingAsk(2.4)).toBeNull()
    expect(publishListingAsk(1.08)).toBeNull()
    expect(publishListingAsk(1.2)).toBeNull()
    expect(publishListingAsk(499)).toBeNull()
    expect(publishListingAsk(500)).toEqual({ ask: 500 })
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
