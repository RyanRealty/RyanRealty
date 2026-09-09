import { describe, it, expect } from 'vitest'
import {
  SERVICE_AREA_CITIES_LOWER,
  SERVICE_AREA_CITIES_PROPER,
  isServiceAreaCity,
  outOfAreaListingPolicy,
} from './service-area'
import { isOutOfAreaCityKey, outOfAreaCitySlug } from '@/lib/out-of-area-cities'
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

  /**
   * SITE-33 — THE LISTING TIER (Matt 2026-09-08). Removing
   * `outOfAreaListingPolicy` from service-area.ts fails this block: the import
   * above stops resolving, so the whole file fails rather than passing quietly
   * with the branch gone. That is the point of testing it here and not beside
   * the component — this predicate is what the robots directive, the visible
   * honesty block and the sitemap row all read.
   */
  describe('outOfAreaListingPolicy (the listing tier)', () => {
    it('returns null for every Central Oregon city, so an in-area page is untouched', () => {
      for (const city of ['Bend', 'Redmond', 'Sisters', 'Sunriver', 'La Pine', 'Crooked River Ranch']) {
        expect(outOfAreaListingPolicy(city)).toBeNull()
      }
      // Case and padding are the feed's, not ours.
      expect(outOfAreaListingPolicy('  bend ')).toBeNull()
      expect(outOfAreaListingPolicy('REDMOND')).toBeNull()
    })

    it('returns the referral policy for the three measured Southern Oregon markets', () => {
      // The cities named on SITE-33's live 2026-09-08 sitemap measurement.
      expect(outOfAreaListingPolicy('Medford')).toEqual({
        cityName: 'Medford',
        citySlug: 'medford',
        referralHref: '/oregon/medford',
      })
      expect(outOfAreaListingPolicy('Grants Pass')).toEqual({
        cityName: 'Grants Pass',
        citySlug: 'grants-pass',
        referralHref: '/oregon/grants-pass',
      })
      expect(outOfAreaListingPolicy('Klamath Falls')).toEqual({
        cityName: 'Klamath Falls',
        citySlug: 'klamath-falls',
        referralHref: '/oregon/klamath-falls',
      })
    })

    it('agrees with the CITY tier on every city, so the two tiers cannot diverge', () => {
      // The listing tier's answer must be the city tier's answer. isOutOfAreaCityKey
      // is what /oregon/[city] and the sitemap emitter decide membership with.
      for (const city of [
        'Bend', 'Redmond', 'Sisters', 'Sunriver', 'La Pine', 'Prineville', 'Madras',
        'Medford', 'Grants Pass', 'Klamath Falls', 'Ashland', 'Chiloquin',
        'Eagle Point', 'Central Point', 'Portland', 'Eugene', 'Winston',
      ]) {
        expect(outOfAreaListingPolicy(city) !== null).toBe(isOutOfAreaCityKey(city))
      }
    })

    it('builds the href on the city tier’s own slugger, so /oregon answers on it', () => {
      const policy = outOfAreaListingPolicy('Klamath Falls')
      expect(policy?.citySlug).toBe(outOfAreaCitySlug('Klamath Falls'))
      expect(policy?.referralHref).toBe(`/oregon/${outOfAreaCitySlug('Klamath Falls')}`)
    })

    it('makes NO claim about a row with no city', () => {
      // §0: absence of a city is not evidence a home is outside our market.
      // The honest failure mode is silence, not a false disclosure.
      expect(outOfAreaListingPolicy(null)).toBeNull()
      expect(outOfAreaListingPolicy(undefined)).toBeNull()
      expect(outOfAreaListingPolicy('   ')).toBeNull()
    })
  })
})
