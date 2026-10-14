import { describe, expect, it } from 'vitest'
import { productPlural } from '@/lib/cma/place-pricing-aggregate'

describe('productPlural names a 2-4 unit product (Matt 2026-10-14, the multi-unit ladder)', () => {
  it('duplexes, triplexes, fourplexes and multi-unit homes beside the existing nouns', () => {
    expect(productPlural('Duplex')).toBe('duplexes')
    expect(productPlural('Triplex')).toBe('triplexes')
    expect(productPlural('Quadruplex')).toBe('fourplexes')
    expect(productPlural('Multi Family')).toBe('multi-unit homes')
    expect(productPlural('Townhouse')).toBe('townhouses')
    expect(productPlural('Single Family Residence')).toBe('single-family homes')
  })
})
