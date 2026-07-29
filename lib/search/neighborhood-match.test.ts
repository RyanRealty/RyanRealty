/**
 * F6 regression lock: the site-search autocomplete could not find a real Bend
 * neighborhood by name. `RiverWest` (one word, the way a buyer types it)
 * returned "No results" because the backend ran `name ILIKE '%RiverWest%'`
 * against the stored "River West".
 *
 * These tests pin the normalization rule — strip case, spaces, and hyphens on
 * BOTH sides — and the negative case that keeps the rule from turning into a
 * fuzzy match that surfaces the wrong place.
 */
import { describe, expect, it } from 'vitest'
import {
  matchNeighborhoodEntries,
  normalizeSearchKey,
  type NeighborhoodDirectoryEntry,
} from './neighborhood-match'

/** Shaped like the live `neighborhoods` rows (13 Bend districts, verified 2026-07-29). */
const DIRECTORY: NeighborhoodDirectoryEntry[] = [
  { neighborhoodName: 'Awbrey Butte', neighborhoodSlug: 'awbrey-butte', cityName: 'Bend', citySlug: 'bend' },
  { neighborhoodName: 'Century West', neighborhoodSlug: 'century-west', cityName: 'Bend', citySlug: 'bend' },
  { neighborhoodName: 'Mountain View', neighborhoodSlug: 'mountain-view', cityName: 'Bend', citySlug: 'bend' },
  { neighborhoodName: 'Old Farm District', neighborhoodSlug: 'old-farm-district', cityName: 'Bend', citySlug: 'bend' },
  { neighborhoodName: 'River West', neighborhoodSlug: 'river-west', cityName: 'Bend', citySlug: 'bend' },
  { neighborhoodName: 'Southwest Bend', neighborhoodSlug: 'southwest-bend', cityName: 'Bend', citySlug: 'bend' },
  { neighborhoodName: 'Summit West', neighborhoodSlug: 'summit-west', cityName: 'Bend', citySlug: 'bend' },
]

function names(query: string): string[] {
  return matchNeighborhoodEntries(query, DIRECTORY).map((n) => n.neighborhoodName)
}

describe('normalizeSearchKey', () => {
  it('collapses case, spaces, and hyphens to one key', () => {
    for (const variant of ['River West', 'RiverWest', 'riverwest', 'RIVER WEST', 'river-west', ' river  west ']) {
      expect(normalizeSearchKey(variant), variant).toBe('riverwest')
    }
  })

  it('handles null / undefined / empty without throwing', () => {
    expect(normalizeSearchKey(null)).toBe('')
    expect(normalizeSearchKey(undefined)).toBe('')
    expect(normalizeSearchKey('   ')).toBe('')
  })

  it('keeps digits and drops punctuation', () => {
    expect(normalizeSearchKey("O'Neil District 3")).toBe('oneildistrict3')
  })
})

describe('matchNeighborhoodEntries — the RiverWest class', () => {
  it.each(['RiverWest', 'river west', 'Riverwest', 'RIVER WEST', 'River West', 'river-west'])(
    'surfaces River West for %s',
    (query) => {
      const matched = matchNeighborhoodEntries(query, DIRECTORY)
      expect(matched[0]).toMatchObject({
        neighborhoodName: 'River West',
        neighborhoodSlug: 'river-west',
        citySlug: 'bend',
      })
    }
  )

  it('does NOT match a different place that merely shares a prefix', () => {
    // "Riverside" is not River West. A fuzzy rule that returned it here would
    // send a buyer to the wrong neighborhood page.
    expect(names('Riverside')).toEqual([])
    expect(names('Sunriver')).toEqual([])
    expect(names('Tetherow')).toEqual([])
  })

  it('matches a city-qualified query', () => {
    expect(names('bend river west')[0]).toBe('River West')
    expect(names('BendRiverWest')[0]).toBe('River West')
    expect(names('bend mountain view')).toEqual(['Mountain View'])
  })

  it('treats a bare city name as a city query, not "every district in Bend"', () => {
    // Only the districts whose own NAME carries "bend" come back. Without this
    // the city-qualified rule would return all 13 Bend districts for "bend".
    expect(names('bend')).toEqual(['Southwest Bend'])
  })

  it('ranks an exact name above a partial, then alphabetically', () => {
    // "west" is a substring of four districts; none is exact, so the tie breaks
    // alphabetically and the order is stable.
    expect(names('west')).toEqual(['Century West', 'River West', 'Southwest Bend', 'Summit West'])
    // An exact key wins outright.
    expect(names('centurywest')[0]).toBe('Century West')
  })

  it('matches a partial prefix the way an autocomplete must', () => {
    expect(names('mountainv')).toEqual(['Mountain View'])
    expect(names('oldfarm')).toEqual(['Old Farm District'])
    expect(names('awbrey')).toEqual(['Awbrey Butte'])
  })

  it('returns nothing for a key under the 2-character floor or an empty directory', () => {
    expect(names('r')).toEqual([])
    expect(names('-')).toEqual([])
    expect(matchNeighborhoodEntries('river west', [])).toEqual([])
  })

  it('respects the limit', () => {
    expect(matchNeighborhoodEntries('west', DIRECTORY, 2)).toHaveLength(2)
  })

  it('skips rows with no usable name or slug', () => {
    const dirty: NeighborhoodDirectoryEntry[] = [
      { neighborhoodName: '', neighborhoodSlug: '', cityName: 'Bend', citySlug: 'bend' },
      ...DIRECTORY,
    ]
    expect(matchNeighborhoodEntries('riverwest', dirty)).toHaveLength(1)
  })
})
