import { describe, it, expect } from 'vitest'
import {
  SERVICE_AREA_CITIES_LOWER,
  SERVICE_AREA_CITIES_PROPER,
  isServiceAreaCity,
} from './service-area'
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'

describe('service-area (audit P0-3)', () => {
  describe('SERVICE_AREA_CITIES_LOWER', () => {
    it('derives 1:1 from the canonical slug set in lib/central-oregon.ts', () => {
      expect(SERVICE_AREA_CITIES_LOWER.length).toBe(CENTRAL_OREGON_CITY_SLUGS.size)
    })

    it('matches listing_tile_mv.city_lower values verified live 2026-06-10', () => {
      // City spellings confirmed against lower("City") of active listings.
      for (const city of [
        'bend',
        'redmond',
        'sisters',
        'sunriver',
        'la pine',
        'prineville',
        'madras',
        'terrebonne',
        'tumalo',
        'powell butte',
        'culver',
        'crooked river ranch',
        'black butte ranch',
        'camp sherman',
        'metolius',
        'brothers',
      ]) {
        expect(SERVICE_AREA_CITIES_LOWER).toContain(city)
      }
    })

    it('contains no slugs (hyphens) and no uppercase', () => {
      for (const city of SERVICE_AREA_CITIES_LOWER) {
        expect(city).not.toMatch(/-/)
        expect(city).toBe(city.toLowerCase())
      }
    })
  })

  describe('SERVICE_AREA_CITIES_PROPER', () => {
    it('title-cases every word to match listings."City" display case', () => {
      expect(SERVICE_AREA_CITIES_PROPER).toContain('Bend')
      expect(SERVICE_AREA_CITIES_PROPER).toContain('La Pine')
      expect(SERVICE_AREA_CITIES_PROPER).toContain('Powell Butte')
      expect(SERVICE_AREA_CITIES_PROPER).toContain('Black Butte Ranch')
      expect(SERVICE_AREA_CITIES_PROPER).toContain('Crooked River Ranch')
    })

    it('is a superset of the open-houses DAL list it replaced', () => {
      // The hand-typed list that lived in getUpcomingOpenHouses.ts before
      // 2026-06-10 — replacing it must never narrow that surface.
      const legacy = [
        'Bend', 'Redmond', 'Sisters', 'La Pine', 'Sunriver', 'Madras',
        'Prineville', 'Culver', 'Terrebonne', 'Tumalo', 'Powell Butte',
      ]
      for (const city of legacy) {
        expect(SERVICE_AREA_CITIES_PROPER).toContain(city)
      }
    })

    it('is index-aligned with the lowercase list', () => {
      expect(SERVICE_AREA_CITIES_PROPER.length).toBe(SERVICE_AREA_CITIES_LOWER.length)
      SERVICE_AREA_CITIES_PROPER.forEach((proper, i) => {
        expect(proper.toLowerCase()).toBe(SERVICE_AREA_CITIES_LOWER[i])
      })
    })
  })

  describe('isServiceAreaCity', () => {
    it('keeps Central Oregon cities (any case, padded)', () => {
      expect(isServiceAreaCity('Bend')).toBe(true)
      expect(isServiceAreaCity('bend')).toBe(true)
      expect(isServiceAreaCity('  La Pine  ')).toBe(true)
      expect(isServiceAreaCity('REDMOND')).toBe(true)
      expect(isServiceAreaCity('Crooked River Ranch')).toBe(true)
    })

    it('excludes the leaked Southern Oregon cities from the P0-3 audit', () => {
      // Grants Pass (Josephine), Ashland/Medford (Jackson), Klamath Falls
      // (Klamath), Winston (Douglas) — all live in the feed, all out of area.
      expect(isServiceAreaCity('Grants Pass')).toBe(false)
      expect(isServiceAreaCity('Ashland')).toBe(false)
      expect(isServiceAreaCity('Medford')).toBe(false)
      expect(isServiceAreaCity('Klamath Falls')).toBe(false)
      expect(isServiceAreaCity('Winston')).toBe(false)
      expect(isServiceAreaCity('Portland')).toBe(false)
      expect(isServiceAreaCity('Eugene')).toBe(false)
      expect(isServiceAreaCity('Roseburg')).toBe(false)
      expect(isServiceAreaCity('Chiloquin')).toBe(false)
    })

    it('returns false for null / undefined / empty', () => {
      expect(isServiceAreaCity(null)).toBe(false)
      expect(isServiceAreaCity(undefined)).toBe(false)
      expect(isServiceAreaCity('')).toBe(false)
    })
  })
})
