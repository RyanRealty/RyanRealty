import { describe, expect, it } from 'vitest'
import { GONE_BODY, isGonePath } from './gone-prefixes'

describe('isGonePath', () => {
  it('matches the two retired prefixes, exact and with a trailing segment', () => {
    expect(isGonePath('/find-central-oregon-homes-for-sale-with-our-home-search')).toBe(true)
    expect(isGonePath('/find-central-oregon-homes-for-sale-with-our-home-search/')).toBe(true)
    expect(isGonePath('/find-central-oregon-homes-for-sale-with-our-home-search/mattyrox')).toBe(true)
    expect(isGonePath('/property-search')).toBe(true)
    expect(isGonePath('/property-search/features/pdf')).toBe(true)
  })

  it('does not claim a path that only shares a prefix string', () => {
    expect(isGonePath('/property-searching')).toBe(false)
    expect(isGonePath('/homes-for-sale')).toBe(false)
    expect(isGonePath('/find-central-oregon-homes')).toBe(false)
  })

  it('the 410 body is the same tiny Gone as /_next/image', () => {
    expect(GONE_BODY).toBe('Gone')
  })
})
