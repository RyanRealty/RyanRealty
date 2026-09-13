import { describe, expect, it } from 'vitest'
import { isSparkListingPhotoUrl, listingRowPhotoSrc } from './row-photo'

describe('isSparkListingPhotoUrl', () => {
  it('matches Spark resize, photos, and API hosts', () => {
    expect(
      isSparkListingPhotoUrl(
        'https://cdn.resize.sparkplatform.com/ore/800x600/true/abc-o.jpg',
      ),
    ).toBe(true)
    expect(isSparkListingPhotoUrl('https://cdn.photos.sparkplatform.com/ore/abc-o.jpg')).toBe(
      true,
    )
    expect(isSparkListingPhotoUrl('https://sparkplatform.com/ore/abc-o.jpg')).toBe(true)
    expect(isSparkListingPhotoUrl('https://photos.sparkapi.com/v1/listings/1/photos')).toBe(
      true,
    )
  })

  it('leaves first-party, Unsplash, and Supabase storage on the optimizer', () => {
    expect(isSparkListingPhotoUrl('/images/brokers/ryan-matt.png')).toBe(false)
    expect(isSparkListingPhotoUrl('https://images.unsplash.com/photo-1')).toBe(false)
    expect(
      isSparkListingPhotoUrl(
        'https://example.supabase.co/storage/v1/object/public/brand/office.jpg',
      ),
    ).toBe(false)
    expect(isSparkListingPhotoUrl('https://images.googleusercontent.com/a')).toBe(false)
    expect(isSparkListingPhotoUrl('')).toBe(false)
    expect(isSparkListingPhotoUrl(null)).toBe(false)
    expect(isSparkListingPhotoUrl('not a url')).toBe(false)
  })
})

describe('listingRowPhotoSrc', () => {
  it('rewrites only the verified Spark resize host', () => {
    expect(
      listingRowPhotoSrc(
        'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/abc-o.jpg',
      ),
    ).toBe('https://cdn.resize.sparkplatform.com/ore/320x240/true/abc-o.jpg')
  })
})
