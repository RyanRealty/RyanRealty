import { describe, expect, it } from 'vitest'
import {
  isRegionalSearchHref,
  publishRegionalSearchHref,
  REGIONAL_SEARCH_HREF,
} from './publish-regional-search-href'

describe('publishRegionalSearchHref', () => {
  it('opens list view with no city', () => {
    expect(publishRegionalSearchHref()).toBe('/homes-for-sale?view=list')
    expect(REGIONAL_SEARCH_HREF).toBe('/homes-for-sale?view=list')
    expect(isRegionalSearchHref(publishRegionalSearchHref())).toBe(true)
  })

  it('rejects the silent Bend door', () => {
    expect(isRegionalSearchHref('/homes-for-sale')).toBe(false)
    expect(isRegionalSearchHref('/homes-for-sale?view=map')).toBe(false)
    expect(isRegionalSearchHref('/homes-for-sale?view=list&city=Bend')).toBe(false)
  })
})
