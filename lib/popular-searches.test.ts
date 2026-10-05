import { describe, expect, it } from 'vitest'
import { getPopularSearchesForCity } from '@/lib/popular-searches'

describe('getPopularSearchesForCity', () => {
  it('sends the Bend new-construction search to /new-construction, never the 308 twin (SITE-213)', () => {
    const links = getPopularSearchesForCity('bend')
    const nc = links.find((l) => l.shortLabel === 'New Construction')
    expect(nc?.href).toBe('/new-construction')
    expect(links.some((l) => l.href === '/homes-for-sale/bend/new-construction')).toBe(false)
  })

  it('keeps every other preset on its search path', () => {
    const links = getPopularSearchesForCity('bend')
    expect(links.find((l) => l.shortLabel === 'Luxury')?.href).toBe('/homes-for-sale/bend/luxury')
    const redmond = getPopularSearchesForCity('redmond')
    expect(redmond.find((l) => l.shortLabel === 'New Construction')?.href).toBe('/homes-for-sale/redmond/new-construction')
  })
})
