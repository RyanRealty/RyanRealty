import { describe, expect, it } from 'vitest'
import {
  isListingDetailPath,
  isListingPhotoUrl,
  listingPhotoSizeToken,
  summarizeListingPhotoHits,
} from '../measure-listing-prefetch-bytes.mjs'

const SPARK_1600 =
  'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/20260501165710852242000000-o.jpg'
const SPARK_320 =
  'https://cdn.resize.sparkplatform.com/ore/320x240/true/20260501165710852242000000-o.jpg'

describe('isListingPhotoUrl', () => {
  it('matches Spark resize and photos hosts', () => {
    expect(isListingPhotoUrl(SPARK_1600)).toBe(true)
    expect(isListingPhotoUrl('https://cdn.photos.sparkplatform.com/ore/abc-o.jpg')).toBe(true)
  })

  it('matches the Next image optimizer when it proxies Spark', () => {
    const proxied = `http://127.0.0.1:3127/_next/image?url=${encodeURIComponent(SPARK_1600)}&w=1920&q=90`
    expect(isListingPhotoUrl(proxied)).toBe(true)
  })

  it('ignores first-party and unrelated CDN urls', () => {
    expect(isListingPhotoUrl('http://127.0.0.1:3127/_next/static/chunks/app.js')).toBe(false)
    expect(isListingPhotoUrl('https://images.unsplash.com/photo-1')).toBe(false)
    expect(
      isListingPhotoUrl(
        'http://127.0.0.1:3127/_next/image?url=' +
          encodeURIComponent('https://images.unsplash.com/photo-1') +
          '&w=640&q=75',
      ),
    ).toBe(false)
  })
})

describe('listingPhotoSizeToken', () => {
  it('reads the Spark path token from a direct URL and from the optimizer', () => {
    expect(listingPhotoSizeToken(SPARK_1600)).toBe('1600x1200')
    expect(listingPhotoSizeToken(SPARK_320)).toBe('320x240')
    const proxied = `http://127.0.0.1:3127/_next/image?url=${encodeURIComponent(SPARK_1600)}&w=1920&q=90`
    expect(listingPhotoSizeToken(proxied)).toBe('1600x1200')
  })
})

describe('isListingDetailPath', () => {
  it('accepts a house URL and rejects city indexes', () => {
    expect(isListingDetailPath('/homes-for-sale/medford/139-columbus-220222551')).toBe(true)
    expect(
      isListingDetailPath(
        'http://127.0.0.1:3127/homes-for-sale/medford/frances-addition/835-cherry-220220485?_rsc=1',
      ),
    ).toBe(true)
    expect(isListingDetailPath('/listing/abc123')).toBe(true)
    expect(isListingDetailPath('/homes-for-sale/medford')).toBe(false)
    expect(isListingDetailPath('/cities/bend')).toBe(false)
  })
})

describe('summarizeListingPhotoHits', () => {
  it('sums bytes and groups by Spark size token', () => {
    const summary = summarizeListingPhotoHits([
      { url: SPARK_1600, bytes: 330_871 },
      { url: SPARK_1600, bytes: 330_871 },
      { url: SPARK_320, bytes: 30_147 },
    ])
    expect(summary.requests).toBe(3)
    expect(summary.bytes).toBe(330_871 * 2 + 30_147)
    expect(summary.bySize['1600x1200']).toEqual({ requests: 2, bytes: 661_742 })
    expect(summary.bySize['320x240']).toEqual({ requests: 1, bytes: 30_147 })
  })
})
