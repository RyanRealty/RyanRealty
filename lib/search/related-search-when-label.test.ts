import { describe, expect, it } from 'vitest'
import { relatedSearchWhenLabel } from './related-search-when-label'

describe('relatedSearchWhenLabel', () => {
  it('classifies price / type / feature / status slugs', () => {
    expect(relatedSearchWhenLabel('/homes-for-sale/bend/under-1-5m')).toBe('Price')
    expect(relatedSearchWhenLabel('/homes-for-sale/bend/luxury')).toBe('Price')
    expect(relatedSearchWhenLabel('/homes-for-sale/bend/single-family')).toBe('Type')
    expect(relatedSearchWhenLabel('/homes-for-sale/bend/with-pool')).toBe('Feature')
    expect(relatedSearchWhenLabel('/homes-for-sale/bend/open-house')).toBe('Status')
    expect(relatedSearchWhenLabel('/homes-for-sale/bend')).toBe('Filter')
  })
})
