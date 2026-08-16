import { describe, expect, it } from 'vitest'
import {
  canonicalCityCacheSlug,
  citySlugCandidates,
  cityUrlSlug,
} from './city-cache-slug'

describe('canonicalCityCacheSlug', () => {
  it('maps a hyphen URL slug to the space-form cache key', () => {
    expect(canonicalCityCacheSlug('la-pine')).toBe('la pine')
    expect(canonicalCityCacheSlug('powell-butte')).toBe('powell butte')
    expect(canonicalCityCacheSlug('black-butte-ranch')).toBe('black butte ranch')
    expect(canonicalCityCacheSlug('camp-sherman')).toBe('camp sherman')
  })

  it('maps a display name to the same space-form key', () => {
    expect(canonicalCityCacheSlug('La Pine')).toBe('la pine')
    expect(canonicalCityCacheSlug('Powell Butte')).toBe('powell butte')
  })

  it('leaves a single-word city unchanged', () => {
    expect(canonicalCityCacheSlug('bend')).toBe('bend')
    expect(canonicalCityCacheSlug('Bend')).toBe('bend')
  })
})

describe('citySlugCandidates', () => {
  it('returns space-separated first, hyphenated second', () => {
    expect(citySlugCandidates('La Pine')).toEqual(['la pine', 'la-pine'])
  })

  it('single-word cities collapse to one candidate', () => {
    expect(citySlugCandidates('Bend')).toEqual(['bend'])
  })
})

describe('cityUrlSlug', () => {
  it('hyphenates for public city URLs', () => {
    expect(cityUrlSlug('La Pine')).toBe('la-pine')
    expect(cityUrlSlug('Bend')).toBe('bend')
  })
})
