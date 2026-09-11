import { describe, expect, it } from 'vitest'
import { preferListingMosaicPhotoUrl } from './publish-listing-mosaic'

describe('preferListingMosaicPhotoUrl', () => {
  it('bumps a Spark resize path that already names a small derivative', () => {
    const src = 'https://cdn.resize.sparkplatform.com/ore/640x480/true/abc-o.jpg'
    expect(preferListingMosaicPhotoUrl(src)).toBe(
      'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/abc-o.jpg',
    )
  })

  it('bumps an existing width query and leaves URLs without size alone', () => {
    expect(preferListingMosaicPhotoUrl('https://cdn.example.com/p.jpg?w=300')).toBe(
      'https://cdn.example.com/p.jpg?w=1600',
    )
    expect(
      preferListingMosaicPhotoUrl('https://cdn.photos.sparkplatform.com/ore/abc-o.jpg'),
    ).toBe('https://cdn.photos.sparkplatform.com/ore/abc-o.jpg')
  })

  it('bumps an 800 field-lead plate to 1600 mosaic', () => {
    const src = 'https://cdn.resize.sparkplatform.com/ore/800x600/true/abc-o.jpg'
    expect(preferListingMosaicPhotoUrl(src)).toBe(
      'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/abc-o.jpg',
    )
  })

  it('does not shrink a 1600-wide Spark plate', () => {
    const src = 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/abc-o.jpg'
    expect(preferListingMosaicPhotoUrl(src)).toBe(src)
  })
})
