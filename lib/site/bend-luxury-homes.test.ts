import { describe, expect, it } from 'vitest'
import { getPresetBySlug, getIndexablePresetSlugs } from '@/lib/search-presets'
import { cityPresetPath } from '@/lib/seo/search-matrix'
import {
  BEND_LUXURY_HOMES_LABEL,
  BEND_LUXURY_HOMES_PATH,
  BEND_LUXURY_LEGACY_PATHS,
  bendLuxuryHomesDoor,
  isLuxuryPreset,
  luxuryPresetDescription,
  luxuryPresetHeading,
} from './bend-luxury-homes'
import legacyRedirects from '@/data/legacy-redirects.json'

describe('SITE-185: one winner for "Bend luxury homes for sale"', () => {
  const luxury = getPresetBySlug('luxury')
  const under1m = getPresetBySlug('under-1m')

  it('the winner is the city x luxury preset search page the sitemap emits', () => {
    expect(luxury).not.toBeNull()
    expect(cityPresetPath('bend', 'luxury')).toBe(BEND_LUXURY_HOMES_PATH)
    // Not a sort-only preset, so the sitemap preset loop lists it.
    expect(getIndexablePresetSlugs()).toContain('luxury')
  })

  it('the sitewide door carries the query as its anchor text', () => {
    expect(bendLuxuryHomesDoor()).toEqual({
      href: '/homes-for-sale/bend/luxury',
      label: 'Bend luxury homes for sale',
    })
    expect(BEND_LUXURY_HOMES_LABEL).toBe('Bend luxury homes for sale')
  })

  it('title / h1 for the luxury preset is the win query in human form, place first', () => {
    expect(luxuryPresetHeading(luxury, 'Bend')).toBe('Bend luxury homes for sale')
    expect(luxuryPresetHeading(luxury, 'Redmond')).toBe('Redmond luxury homes for sale')
    expect(luxuryPresetHeading(luxury, '  ')).toBe('Luxury homes for sale')
    expect(isLuxuryPreset(luxury)).toBe(true)
  })

  it('every other preset keeps its own composition', () => {
    expect(luxuryPresetHeading(under1m, 'Bend')).toBeNull()
    expect(luxuryPresetHeading(null, 'Bend')).toBeNull()
    expect(luxuryPresetDescription(under1m, 'Bend')).toBeNull()
    expect(isLuxuryPreset(under1m)).toBe(false)
  })

  it('the description opens on the query and names the preset floor, not a market figure', () => {
    const desc = luxuryPresetDescription(luxury, 'Bend')
    expect(desc).toMatch(/^Bend luxury homes for sale: /)
    expect(desc).toContain('luxury real estate listings in Bend')
    // The floor is the preset's own minPrice filter (lib/search-presets.ts).
    expect(luxury?.params.minPrice).toBe(1_000_000)
    expect(desc).toContain('priced $1 million and up')
    expect(desc).not.toMatch(/median|days on market|months of supply/i)
  })

  it('both retired luxury URLs 301 onto the winner in one hop', () => {
    const map = legacyRedirects as Record<string, string>
    for (const path of BEND_LUXURY_LEGACY_PATHS) {
      expect(map[path], path).toBe(BEND_LUXURY_HOMES_PATH)
    }
    // The winner is never itself a redirect key (no chain).
    expect(map[BEND_LUXURY_HOMES_PATH]).toBeUndefined()
  })
})
