import { describe, expect, it } from 'vitest'
import {
  buildSearchDescription,
  buildSearchTitle,
  formatSearchPriceBand,
} from '@/lib/search/search-title'

describe('formatSearchPriceBand', () => {
  it('names both ends, a floor, and a ceiling', () => {
    expect(formatSearchPriceBand(300_000, 800_000)).toBe('$300K to $800K')
    expect(formatSearchPriceBand(1_500_000, undefined)).toBe('$1.5M+')
    expect(formatSearchPriceBand(undefined, 800_000)).toBe('under $800K')
    expect(formatSearchPriceBand()).toBeNull()
  })
})

describe('buildSearchTitle', () => {
  it('keeps the unfiltered Central Oregon title', () => {
    expect(buildSearchTitle({})).toBe('Central Oregon homes for sale')
  })

  it('puts the price band the URL already carries into the SERP title', () => {
    expect(
      buildSearchTitle({
        beds: 3,
        city: 'Tetherow',
        maxPrice: 800_000,
      }),
    ).toBe('3+ Bedroom Tetherow under $800K Homes for Sale')
  })
})

describe('buildSearchDescription', () => {
  it('repeats the price band so the snippet matches the title', () => {
    expect(buildSearchDescription({ city: 'Bend', maxPrice: 750_000 })).toContain('under $750K')
  })
})
