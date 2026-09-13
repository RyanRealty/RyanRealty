import { describe, expect, it } from 'vitest'
import {
  isSparkListingPhotoUrl,
  isVendorListingMediaUrl,
  listingPhotoSrcSet,
  listingRowPhotoSrc,
} from './row-photo'

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

describe('listingPhotoSrcSet', () => {
  it('names the three verified Spark buckets so a hero can pick 1600', () => {
    const src = 'https://cdn.resize.sparkplatform.com/ore/320x240/true/abc-o.jpg'
    expect(listingPhotoSrcSet(src)).toBe(
      [
        'https://cdn.resize.sparkplatform.com/ore/320x240/true/abc-o.jpg 320w',
        'https://cdn.resize.sparkplatform.com/ore/800x600/true/abc-o.jpg 800w',
        'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/abc-o.jpg 1600w',
      ].join(', '),
    )
  })

  it('does not invent a srcset on YouTube or first-party URLs', () => {
    expect(listingPhotoSrcSet('https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg')).toBe(
      undefined,
    )
    expect(listingPhotoSrcSet('/images/brokers/ryan-matt.png')).toBe(undefined)
  })
})

describe('isVendorListingMediaUrl', () => {
  it('covers Spark photos and YouTube / Vimeo posters', () => {
    expect(
      isVendorListingMediaUrl(
        'https://cdn.resize.sparkplatform.com/ore/800x600/true/abc-o.jpg',
      ),
    ).toBe(true)
    expect(isVendorListingMediaUrl('https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg')).toBe(
      true,
    )
    expect(isVendorListingMediaUrl('https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg')).toBe(
      true,
    )
    expect(isVendorListingMediaUrl('https://i.vimeocdn.com/video/123.jpg')).toBe(true)
    expect(
      isVendorListingMediaUrl('https://customer-x.cloudflarestream.com/abc/thumbnails/thumb.jpg'),
    ).toBe(true)
    expect(isVendorListingMediaUrl('https://images.unsplash.com/photo-1')).toBe(false)
  })
})
