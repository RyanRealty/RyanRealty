import { describe, expect, it } from 'vitest'
import {
  LISTING_PHOTO_SITEMAP_PARTS,
  LISTING_SITEMAP_PHOTO_CAP,
  listingPhotoSitemapPart,
  listingSitemapPhotoUrls,
  parseListingPhotoSitemapPart,
  pickBestListingPhotoUri,
} from './listing-photo-sitemap'

const spark = (id: string, size = '1600x1200') => `https://cdn.resize.sparkplatform.com/ore/${size}/true/${id}-o.jpg`

describe('listingSitemapPhotoUrls', () => {
  it('lists every photo at the 1600 render the listing page loads, in gallery order', () => {
    const photos = [
      { Uri1600: spark('a'), Uri300: spark('a', '320x240') },
      { UriLarge: spark('b', '800x600') },
      { Uri300: spark('c', '320x240') },
    ]
    expect(listingSitemapPhotoUrls(photos, null)).toEqual([spark('a'), spark('b'), spark('c')])
  })

  it('caps the gallery and drops duplicates and non-https entries', () => {
    const photos = Array.from({ length: 45 }, (_, i) => ({ Uri1600: spark(`p${i}`) }))
    photos.splice(1, 0, { Uri1600: spark('p0') }, { Uri1600: 'http://insecure.example.net/x.jpg' })
    const urls = listingSitemapPhotoUrls(photos, null)
    expect(urls).toHaveLength(LISTING_SITEMAP_PHOTO_CAP)
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls.every((u) => u.startsWith('https://cdn.resize.sparkplatform.com/'))).toBe(true)
  })

  it('falls back to the lead PhotoURL when the payload has no photos', () => {
    expect(listingSitemapPhotoUrls(null, spark('lead', '320x240'))).toEqual([spark('lead')])
    expect(listingSitemapPhotoUrls([], null)).toEqual([])
  })

  it('shares the gallery size preference', () => {
    expect(pickBestListingPhotoUri({ Uri2048: 'x', Uri1600: 'y' })).toBe('y')
    expect(pickBestListingPhotoUri({})).toBeNull()
  })
})

describe('photo sitemap parts', () => {
  it('puts every listing in exactly one stable part within range', () => {
    const counts = new Array(LISTING_PHOTO_SITEMAP_PARTS + 1).fill(0)
    for (let i = 0; i < 9000; i++) {
      const key = `2026${String(i).padStart(10, '0')}000000000000`
      const part = listingPhotoSitemapPart(key)
      expect(part).toBeGreaterThanOrEqual(1)
      expect(part).toBeLessThanOrEqual(LISTING_PHOTO_SITEMAP_PARTS)
      counts[part]++
    }
    expect(listingPhotoSitemapPart('20260911205328940056000000')).toBe(listingPhotoSitemapPart(' 20260911205328940056000000 '))
    // Even enough that no part outgrows the response budget: within 25% of the mean.
    const mean = 9000 / LISTING_PHOTO_SITEMAP_PARTS
    for (let p = 1; p <= LISTING_PHOTO_SITEMAP_PARTS; p++) {
      expect(Math.abs(counts[p] - mean) / mean).toBeLessThan(0.25)
    }
  })

  it('parses the route segment and refuses anything outside 1..N', () => {
    expect(parseListingPhotoSitemapPart('1.xml')).toBe(1)
    expect(parseListingPhotoSitemapPart(`${LISTING_PHOTO_SITEMAP_PARTS}.xml`)).toBe(LISTING_PHOTO_SITEMAP_PARTS)
    expect(parseListingPhotoSitemapPart('0.xml')).toBeNull()
    expect(parseListingPhotoSitemapPart(`${LISTING_PHOTO_SITEMAP_PARTS + 1}.xml`)).toBeNull()
    expect(parseListingPhotoSitemapPart('core.xml')).toBeNull()
  })
})
