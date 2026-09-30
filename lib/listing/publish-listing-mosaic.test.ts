import { describe, expect, it } from 'vitest'
import {
  LISTING_FRAME_ASPECT_DEFAULT,
  LISTING_FRAME_ASPECT_MAX,
  LISTING_FRAME_ASPECT_MIN,
  LISTING_MOSAIC_PHOTO_QUALITY,
  listingFrameAspect,
  preferListingMosaicPhotoUrl,
} from './publish-listing-mosaic'

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

  it('asks the optimizer for quality 75 when a non-Spark still is optimized', () => {
    expect(LISTING_MOSAIC_PHOTO_QUALITY).toBe(75)
  })
})

describe('listingFrameAspect (the phone frame takes the photograph shape)', () => {
  it('keeps the 3:2 default for a 3:2 still, including Spark rounding', () => {
    expect(LISTING_FRAME_ASPECT_DEFAULT).toBe(1.5)
    expect(listingFrameAspect(1600, 1067)).toBeNull()
    // 61390 Merriewood Court's lead still, measured 2026-09-25.
    expect(listingFrameAspect(1537, 1023)).toBeNull()
    expect(listingFrameAspect(1200, 800)).toBeNull()
  })

  it('takes a 4:3 or 16:9 still at its own shape, so a cover fit crops nothing', () => {
    expect(listingFrameAspect(1600, 1200)).toBe(1.3333)
    expect(listingFrameAspect(1365, 1024)).toBeCloseTo(1.333, 3)
    expect(listingFrameAspect(1600, 900)).toBe(1.7778)
    expect(listingFrameAspect(1631, 1024)).toBe(1.5928)
  })

  it('stops at 4:3 for a square or portrait still and at 16:9 for a panorama', () => {
    expect(listingFrameAspect(768, 1024)).toBe(1.3333)
    expect(listingFrameAspect(1000, 1000)).toBe(1.3333)
    expect(listingFrameAspect(3200, 1000)).toBe(1.7778)
    expect(LISTING_FRAME_ASPECT_MIN).toBeCloseTo(4 / 3)
    expect(LISTING_FRAME_ASPECT_MAX).toBeCloseTo(16 / 9)
  })

  it('answers nothing for a still that has not decoded', () => {
    expect(listingFrameAspect(0, 0)).toBeNull()
    expect(listingFrameAspect(Number.NaN, 800)).toBeNull()
    expect(listingFrameAspect(1600, -1)).toBeNull()
  })
})

