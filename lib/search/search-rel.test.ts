import { describe, expect, it } from 'vitest'
import { searchRelHrefs } from '@/lib/search/search-rel'

describe('searchRelHrefs', () => {
  const canonical = new URL('https://ryan-realty.com/homes-for-sale?city=Bend')

  it('omits prev on page 1 and names page 2 as next', () => {
    const rel = searchRelHrefs(canonical, 1, 50)
    expect(rel.prev).toBeUndefined()
    expect(rel.next).toBe('https://ryan-realty.com/homes-for-sale?city=Bend&page=2')
  })

  it('drops the page param on the previous link back to page 1', () => {
    const rel = searchRelHrefs(new URL('https://ryan-realty.com/homes-for-sale?city=Bend&page=2'), 2, 50)
    expect(rel.prev).toBe('https://ryan-realty.com/homes-for-sale?city=Bend')
    expect(rel.next).toBe('https://ryan-realty.com/homes-for-sale?city=Bend&page=3')
  })

  it('emits nothing when one page holds the set', () => {
    expect(searchRelHrefs(canonical, 1, 10)).toEqual({ prev: undefined, next: undefined })
  })
})
