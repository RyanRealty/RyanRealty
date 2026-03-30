import { describe, it, expect } from 'vitest'
import { entityKeyToSlug, communityPagePath, parseCommunitySlug } from './community-slug'

describe('community-slug', () => {
  describe('entityKeyToSlug', () => {
    it('converts colon to dash', () => {
      expect(entityKeyToSlug('bend:sunriver')).toBe('bend-sunriver')
    })

    it('handles no colon', () => {
      expect(entityKeyToSlug('bend')).toBe('bend')
    })

    it('replaces only the first colon', () => {
      // entityKeyToSlug uses String.replace which replaces only the first occurrence
      expect(entityKeyToSlug('bend:sun:river')).toBe('bend-sun:river')
    })
  })

  describe('communityPagePath', () => {
    it('returns homes-for-sale path with city and subdivision', () => {
      expect(communityPagePath('Bend', 'Sunriver')).toBe('/homes-for-sale/bend/sunriver')
    })

    it('handles cities with spaces', () => {
      expect(communityPagePath('La Pine', 'Caldera Springs')).toBe('/homes-for-sale/la-pine/caldera-springs')
    })
  })

  describe('parseCommunitySlug', () => {
    const citySlugs = new Set(['bend', 'redmond', 'la-pine', 'sisters'])

    it('parses valid community slug', () => {
      const result = parseCommunitySlug('bend-sunriver', citySlugs)
      expect(result).toEqual({
        city: 'Bend',
        subdivision: 'Sunriver',
      })
    })

    it('parses multi-word city slug', () => {
      const result = parseCommunitySlug('la-pine-caldera-springs', citySlugs)
      expect(result).toEqual({
        city: 'La Pine',
        subdivision: 'Caldera Springs',
      })
    })

    it('returns null for unknown city', () => {
      const result = parseCommunitySlug('portland-downtown', citySlugs)
      expect(result).toBeNull()
    })

    it('returns null for single-word slug (no subdivision)', () => {
      const result = parseCommunitySlug('bend', citySlugs)
      expect(result).toBeNull()
    })

    it('handles slug with multiple subdivision words', () => {
      const result = parseCommunitySlug('bend-northwest-crossing', citySlugs)
      expect(result).toEqual({
        city: 'Bend',
        subdivision: 'Northwest Crossing',
      })
    })
  })
})
