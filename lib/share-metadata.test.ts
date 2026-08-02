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
      // No word boundary exists in a single 300-char token — hard-cut fallback,
      // but it still signals truncation with a trailing ellipsis.
      expect(result.endsWith('…')).toBe(true)
    })

    it('uses custom max length, cutting on a word boundary with an ellipsis', () => {
      const result = shareDescription('Hello World Test', 8)
      expect(result).toBe('Hello…')
    })

    it('never cuts mid-word — backs off to the last full word and appends a single ellipsis', () => {
      // Reproduces the live-site bug (audit 2026-08-02): a hard slice(0, 155)
      // sheared descriptions mid-word, e.g. "...Request a fr" on /sell.
      const longDescription =
        'List your Central Oregon home with Ryan Realty. Pricing from live market data, ' +
        'professional marketing, and one broker from valuation to close. Request a free home valuation.'
      const result = shareDescription(longDescription)
      expect(result.length).toBeLessThanOrEqual(155)
      // Ends with the ellipsis, not a dangling space before it.
      expect(result.endsWith('…')).toBe(true)
      expect(result.endsWith(' …')).toBe(false)
      // The character right before the ellipsis is a real word character —
      // never a fragment cut out of the middle of a longer word.
      const beforeEllipsis = result.slice(0, -1)
      expect(/[a-zA-Z]$/.test(beforeEllipsis)).toBe(true)
      // The old bug: "Request a fr" (mid-word fragment of "free"). Confirm the
      // fragment is gone and the cut lands on a whole word instead.
      expect(result).not.toContain(' fr…')
      expect(result).not.toMatch(/\bfr…$/)
    })

    it('returns text unchanged (no ellipsis) when already within the limit', () => {
      const result = shareDescription('A short description under the limit.')
      expect(result).toBe('A short description under the limit.')
      expect(result.endsWith('…')).toBe(false)
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
