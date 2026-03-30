import { describe, it, expect } from 'vitest'
import {
  getPresetBySlug,
  isPresetSlug,
  getAllPresetSlugs,
  SEARCH_PRESETS,
} from './search-presets'

describe('search-presets', () => {
  describe('getPresetBySlug', () => {
    it('returns preset for valid slug', () => {
      const preset = getPresetBySlug('under-500k')
      expect(preset).not.toBeNull()
      expect(preset!.label).toBe('Homes Under $500,000')
      expect(preset!.params.maxPrice).toBe(500_000)
    })

    it('returns preset for luxury', () => {
      const preset = getPresetBySlug('luxury')
      expect(preset).not.toBeNull()
      expect(preset!.params.minPrice).toBe(1_000_000)
    })

    it('returns preset for pending', () => {
      const preset = getPresetBySlug('pending')
      expect(preset).not.toBeNull()
      expect(preset!.params.statusFilter).toBe('pending')
    })

    it('returns preset for new-listings', () => {
      const preset = getPresetBySlug('new-listings')
      expect(preset).not.toBeNull()
      expect(preset!.params.newListingsDays).toBe(7)
    })

    it('returns preset for with-pool', () => {
      const preset = getPresetBySlug('with-pool')
      expect(preset).not.toBeNull()
      expect(preset!.params.hasPool).toBe(true)
    })

    it('returns null for invalid slug', () => {
      expect(getPresetBySlug('not-a-preset')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(getPresetBySlug('')).toBeNull()
    })

    it('returns null for null-like input', () => {
      expect(getPresetBySlug(null as unknown as string)).toBeNull()
    })

    it('is case-insensitive', () => {
      const preset = getPresetBySlug('Under-500K')
      expect(preset).not.toBeNull()
    })
  })

  describe('isPresetSlug', () => {
    it('returns true for valid preset slugs', () => {
      expect(isPresetSlug('under-300k')).toBe(true)
      expect(isPresetSlug('luxury')).toBe(true)
      expect(isPresetSlug('pending')).toBe(true)
    })

    it('returns false for invalid slugs', () => {
      expect(isPresetSlug('not-a-preset')).toBe(false)
      expect(isPresetSlug('')).toBe(false)
    })
  })

  describe('getAllPresetSlugs', () => {
    it('returns all preset slugs', () => {
      const slugs = getAllPresetSlugs()
      expect(slugs.length).toBe(SEARCH_PRESETS.length)
      expect(slugs).toContain('under-500k')
      expect(slugs).toContain('luxury')
      expect(slugs).toContain('pending')
      expect(slugs).toContain('new-listings')
    })
  })

  describe('SEARCH_PRESETS', () => {
    it('has unique slugs', () => {
      const slugs = SEARCH_PRESETS.map((p) => p.slug)
      const unique = new Set(slugs)
      expect(unique.size).toBe(slugs.length)
    })

    it('has at least 15 presets', () => {
      expect(SEARCH_PRESETS.length).toBeGreaterThanOrEqual(15)
    })

    it('every preset has label, shortLabel, and params', () => {
      for (const preset of SEARCH_PRESETS) {
        expect(preset.label).toBeTruthy()
        expect(preset.shortLabel).toBeTruthy()
        expect(preset.params).toBeDefined()
      }
    })
  })
})
