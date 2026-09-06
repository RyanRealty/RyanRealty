import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const regional = readFileSync('components/search/SearchResults.tsx', 'utf8')
const city = readFileSync('app/search/[...slug]/sections/ListingsResults.tsx', 'utf8')

describe('one Field house-row language', () => {
  it('regional search and city slug search both render through V3ListingRow fields', () => {
    for (const src of [regional, city]) {
      expect(src).toMatch(/photoUrl/)
      expect(src).toMatch(/price:/)
      expect(src).toMatch(/addressLine/)
      expect(src).toMatch(/beds:/)
      expect(src).toMatch(/baths:/)
      expect(src).toMatch(/sqft:/)
    }
    expect(regional).toMatch(/<V3ListingRow/)
    expect(city).toMatch(/HideAwareListingGrid/)
    expect(regional).not.toMatch(/<ListingCard[\s/>]/)
    expect(city).not.toMatch(/<ListingCard[\s/>]/)
  })
})
