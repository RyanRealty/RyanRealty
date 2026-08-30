import { describe, expect, it } from 'vitest'
import { publishListingFaceMapSrc } from './publish-listing-face-map'

describe('publishListingFaceMapSrc', () => {
  it('909 Delaware: pin at the leftover point', () => {
    const src = publishListingFaceMapSrc({
      lat: 44.058,
      lng: -121.315,
      key: 'test-key',
    })
    expect(src).toContain('center=44.058')
    expect(src).toContain('-121.315')
    expect(src).toContain('size=240x240')
    expect(src).toContain('zoom=14')
    expect(src).toContain('key=test-key')
  })

  it('withholds when the listing has no point or no maps key', () => {
    expect(publishListingFaceMapSrc({ lat: 44, lng: -121, key: null })).toBeNull()
    expect(publishListingFaceMapSrc({ lat: null, lng: -121, key: 'k' })).toBeNull()
  })
})
