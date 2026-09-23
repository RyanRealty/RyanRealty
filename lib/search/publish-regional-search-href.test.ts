import { describe, expect, it } from 'vitest'
import {
  isRegionalSearchHref,
  publishRegionalSearchHref,
  REGIONAL_SEARCH_HREF,
} from './publish-regional-search-href'

describe('publishRegionalSearchHref', () => {
  it('is the clean, indexable path with no view and no city (UXLIVE-4)', () => {
    expect(publishRegionalSearchHref()).toBe('/homes-for-sale')
    expect(REGIONAL_SEARCH_HREF).toBe('/homes-for-sale')
    expect(REGIONAL_SEARCH_HREF).not.toContain('?')
    expect(isRegionalSearchHref(publishRegionalSearchHref())).toBe(true)
  })

  it('accepts every view of the bare path: none is Bend-bounded since the Central Oregon camera (Matt 2026-09-23)', () => {
    expect(isRegionalSearchHref('/homes-for-sale?view=list')).toBe(true)
    expect(isRegionalSearchHref('/homes-for-sale?view=split')).toBe(true)
    expect(isRegionalSearchHref('/homes-for-sale?view=map')).toBe(true)
  })

  it('rejects any city scope, another path, and a view the page does not serve', () => {
    expect(isRegionalSearchHref('/homes-for-sale?city=Bend')).toBe(false)
    expect(isRegionalSearchHref('/homes-for-sale?view=list&city=Bend')).toBe(false)
    expect(isRegionalSearchHref('/homes-for-sale?view=split&city=Redmond')).toBe(false)
    expect(isRegionalSearchHref('/homes-for-sale?view=3')).toBe(false)
    expect(isRegionalSearchHref('/homes-for-sale/bend')).toBe(false)
    expect(isRegionalSearchHref('')).toBe(false)
  })
})
