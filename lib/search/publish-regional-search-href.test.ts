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

  it('still accepts the explicit list view as the same regional set', () => {
    expect(isRegionalSearchHref('/homes-for-sale?view=list')).toBe(true)
  })

  it('rejects the Bend-camera views and any city scope', () => {
    expect(isRegionalSearchHref('/homes-for-sale?view=map')).toBe(false)
    expect(isRegionalSearchHref('/homes-for-sale?view=split')).toBe(false)
    expect(isRegionalSearchHref('/homes-for-sale?city=Bend')).toBe(false)
    expect(isRegionalSearchHref('/homes-for-sale?view=list&city=Bend')).toBe(false)
    expect(isRegionalSearchHref('/homes-for-sale/bend')).toBe(false)
    expect(isRegionalSearchHref('')).toBe(false)
  })
})
