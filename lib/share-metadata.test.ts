import { describe, it, expect } from 'vitest'
import {
  getCanonicalSiteUrl,
  listingHashtags,
  shareDescription,
  listingShareSummary,
  listingShareText,
  DEFAULT_HASHTAGS,
  OG_IMAGE_WIDTH,
  OG_IMAGE_HEIGHT,
} from './share-metadata'

describe('share-metadata', () => {
  describe('getCanonicalSiteUrl', () => {
    it('returns a URL that does not contain localhost', () => {
      const url = getCanonicalSiteUrl()
      expect(url).not.toContain('localhost')
    })

    it('returns a URL starting with https', () => {
      const url = getCanonicalSiteUrl()
      expect(url).toMatch(/^https:\/\//)
    })

    it('does not end with trailing slash', () => {
      const url = getCanonicalSiteUrl()
      expect(url).not.toMatch(/\/$/)
    })
  })

  describe('listingHashtags', () => {
    it('includes #RealEstate', () => {
      expect(listingHashtags()).toContain('#RealEstate')
    })

    it('includes city hashtag when city provided', () => {
      const result = listingHashtags('Bend')
      expect(result).toContain('#BendOR')
    })

    it('removes spaces from city name for hashtag', () => {
      const result = listingHashtags('La Pine')
      expect(result).toContain('#LaPineOR')
    })

    it('handles null city', () => {
      const result = listingHashtags(null)
      expect(result).toContain('#RealEstate')
      expect(result).not.toContain('OR')
    })
  })

  describe('shareDescription', () => {
    it('trims and normalizes whitespace', () => {
      expect(shareDescription('  hello   world  ')).toBe('hello world')
    })

    it('truncates to max length', () => {
      const longText = 'A'.repeat(300)
      const result = shareDescription(longText)
      expect(result.length).toBeLessThanOrEqual(155)
    })

    it('uses custom max length', () => {
      const result = shareDescription('Hello World Test', 5)
      expect(result).toBe('Hello')
    })
  })

  describe('listingShareSummary', () => {
    it('includes price formatted as currency', () => {
      const result = listingShareSummary({ price: 500000 })
      expect(result).toContain('$500,000')
    })

    it('includes bed and bath count', () => {
      const result = listingShareSummary({ beds: 3, baths: 2 })
      expect(result).toContain('3 bed')
      expect(result).toContain('2 bath')
    })

    it('includes sqft', () => {
      const result = listingShareSummary({ sqft: 2500 })
      expect(result).toContain('2,500 sq ft')
    })

    it('includes address and city', () => {
      const result = listingShareSummary({ address: '123 Main St', city: 'Bend' })
      expect(result).toContain('123 Main St')
      expect(result).toContain('Bend')
    })

    it('returns default text when no fields provided', () => {
      const result = listingShareSummary({})
      expect(result).toContain('Ryan Realty')
    })

    it('does not include zero price', () => {
      const result = listingShareSummary({ price: 0 })
      expect(result).not.toContain('$0')
    })
  })

  describe('listingShareText', () => {
    it('includes remarks as hook', () => {
      const result = listingShareText({
        publicRemarks: 'Stunning mountain views from this renovated craftsman.',
        price: 500000,
        city: 'Bend',
      })
      expect(result).toContain('mountain views')
    })

    it('generates summary without remarks', () => {
      const result = listingShareText({
        beds: 3,
        baths: 2,
        sqft: 2000,
        city: 'Bend',
        price: 450000,
      })
      expect(result).toContain('3 bed')
      expect(result).toContain('$450,000')
    })

    it('includes hashtags', () => {
      const result = listingShareText({ city: 'Bend' })
      expect(result).toContain('#RyanRealty')
      expect(result).toContain('#RealEstate')
    })

    it('truncates to 250 chars max', () => {
      const result = listingShareText({
        publicRemarks: 'A'.repeat(300),
        price: 1000000,
        beds: 5,
        baths: 4,
        sqft: 5000,
        address: '123 Very Long Street Name',
        city: 'Bend',
      })
      expect(result.length).toBeLessThanOrEqual(250)
    })
  })

  describe('constants', () => {
    it('DEFAULT_HASHTAGS includes RyanRealty', () => {
      expect(DEFAULT_HASHTAGS).toContain('#RyanRealty')
    })

    it('OG image dimensions are 1200x630', () => {
      expect(OG_IMAGE_WIDTH).toBe(1200)
      expect(OG_IMAGE_HEIGHT).toBe(630)
    })
  })
})
