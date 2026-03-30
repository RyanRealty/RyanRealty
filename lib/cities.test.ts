import { describe, it, expect } from 'vitest'
import {
  isPrimaryCityName,
  getPrimaryCityRank,
  sortCitiesWithPrimaryFirst,
  filterToPrimaryCitiesOnly,
  getHomePopularCitiesOrdered,
  PRIMARY_CITIES,
  type CityForIndex,
} from './cities'

function makeCity(name: string, activeCount = 100): CityForIndex {
  return {
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    activeCount,
    medianPrice: 500000,
    communityCount: 5,
    heroImageUrl: null,
  }
}

describe('cities', () => {
  describe('isPrimaryCityName', () => {
    it('returns true for primary cities', () => {
      expect(isPrimaryCityName('Bend')).toBe(true)
      expect(isPrimaryCityName('Redmond')).toBe(true)
      expect(isPrimaryCityName('Sisters')).toBe(true)
    })

    it('is case-insensitive', () => {
      expect(isPrimaryCityName('bend')).toBe(true)
      expect(isPrimaryCityName('BEND')).toBe(true)
    })

    it('matches aliases', () => {
      expect(isPrimaryCityName('Lapine')).toBe(true)
      expect(isPrimaryCityName('La Pine')).toBe(true)
      expect(isPrimaryCityName('Sun River')).toBe(true)
      expect(isPrimaryCityName('Sunriver')).toBe(true)
    })

    it('returns false for non-primary cities', () => {
      expect(isPrimaryCityName('Portland')).toBe(false)
      expect(isPrimaryCityName('Eugene')).toBe(false)
    })

    it('trims whitespace', () => {
      expect(isPrimaryCityName('  Bend  ')).toBe(true)
    })
  })

  describe('getPrimaryCityRank', () => {
    it('returns 0 for Bend (first primary city)', () => {
      expect(getPrimaryCityRank('Bend')).toBe(0)
    })

    it('returns correct index for other primary cities', () => {
      expect(getPrimaryCityRank('Redmond')).toBe(1)
      expect(getPrimaryCityRank('Sisters')).toBe(3)
    })

    it('returns correct index for aliases', () => {
      expect(getPrimaryCityRank('Lapine')).toBe(2) // Lapine alias for La Pine
      expect(getPrimaryCityRank('La Pine')).toBe(2)
    })

    it('returns -1 for non-primary cities', () => {
      expect(getPrimaryCityRank('Portland')).toBe(-1)
    })
  })

  describe('sortCitiesWithPrimaryFirst', () => {
    it('puts primary cities first in PRIMARY_CITIES order', () => {
      const cities = [
        makeCity('Portland', 200),
        makeCity('Bend', 150),
        makeCity('Sisters', 50),
        makeCity('Redmond', 100),
      ]
      const sorted = sortCitiesWithPrimaryFirst(cities)
      expect(sorted[0]!.name).toBe('Bend')
      expect(sorted[1]!.name).toBe('Redmond')
      expect(sorted[2]!.name).toBe('Sisters')
      // Portland is last (non-primary)
      expect(sorted[3]!.name).toBe('Portland')
    })

    it('sorts non-primary by activeCount descending', () => {
      const cities = [
        makeCity('Eugene', 50),
        makeCity('Portland', 200),
        makeCity('Salem', 100),
      ]
      const sorted = sortCitiesWithPrimaryFirst(cities)
      expect(sorted[0]!.name).toBe('Portland')
      expect(sorted[1]!.name).toBe('Salem')
      expect(sorted[2]!.name).toBe('Eugene')
    })

    it('sorts non-primary by name when activeCount is equal', () => {
      const cities = [
        makeCity('Zebra City', 50),
        makeCity('Alpha City', 50),
      ]
      const sorted = sortCitiesWithPrimaryFirst(cities)
      expect(sorted[0]!.name).toBe('Alpha City')
      expect(sorted[1]!.name).toBe('Zebra City')
    })
  })

  describe('filterToPrimaryCitiesOnly', () => {
    it('only returns primary cities', () => {
      const cities = [
        makeCity('Portland'),
        makeCity('Bend'),
        makeCity('Eugene'),
        makeCity('Sisters'),
      ]
      const filtered = filterToPrimaryCitiesOnly(cities)
      expect(filtered).toHaveLength(2)
      expect(filtered.map((c) => c.name)).toContain('Bend')
      expect(filtered.map((c) => c.name)).toContain('Sisters')
      expect(filtered.map((c) => c.name)).not.toContain('Portland')
    })
  })

  describe('getHomePopularCitiesOrdered', () => {
    it('returns cities in home popular order', () => {
      const cities = [
        makeCity('Sisters'),
        makeCity('Bend'),
        makeCity('Redmond'),
        makeCity('Portland'),
      ]
      const result = getHomePopularCitiesOrdered(cities)
      expect(result[0]!.name).toBe('Bend')
      expect(result[1]!.name).toBe('Redmond')
      expect(result[2]!.name).toBe('Sisters')
      // Portland not in the popular list
      expect(result.map((c) => c.name)).not.toContain('Portland')
    })

    it('handles alias matching for Sun River / Sunriver', () => {
      const cities = [makeCity('Sun River')]
      const result = getHomePopularCitiesOrdered(cities)
      expect(result).toHaveLength(1)
      expect(result[0]!.name).toBe('Sun River')
    })

    it('handles alias matching for Lapine / La Pine', () => {
      const cities = [makeCity('Lapine')]
      const result = getHomePopularCitiesOrdered(cities)
      expect(result).toHaveLength(1)
    })
  })

  describe('PRIMARY_CITIES', () => {
    it('has 9 cities', () => {
      expect(PRIMARY_CITIES).toHaveLength(9)
    })

    it('starts with Bend', () => {
      expect(PRIMARY_CITIES[0]).toBe('Bend')
    })
  })
})
