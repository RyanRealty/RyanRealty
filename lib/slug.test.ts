import { describe, it, expect } from 'vitest'
import {
  slugify,
  cityEntityKey,
  subdivisionEntityKey,
  parseEntityKey,
  listingsBrowsePath,
  teamPath,
  valuationPath,
  listingDetailPath,
  listingTileHref,
  subdivisionListingsPath,
  listingKeyFromSlug,
} from './slug'

describe('slug', () => {
  it('slugify normalizes names', () => {
    expect(slugify('Bend')).toBe('bend')
    expect(slugify('Sunriver')).toBe('sunriver')
    expect(slugify('  La Pine  ')).toBe('la-pine')
    expect(slugify('Broken Top')).toBe('broken-top')
  })

  it('cityEntityKey returns slug', () => {
    expect(cityEntityKey('Bend')).toBe('bend')
  })

  it('subdivisionEntityKey joins city and subdivision', () => {
    expect(subdivisionEntityKey('Bend', 'Sunriver')).toBe('bend:sunriver')
  })

  it('parseEntityKey parses entity key', () => {
    expect(parseEntityKey('bend:sunriver')).toEqual({ city: 'Bend', subdivision: 'Sunriver' })
  })

  it('returns canonical browse and valuation paths', () => {
    expect(listingsBrowsePath()).toBe('/homes-for-sale')
    expect(valuationPath()).toBe('/sell/valuation')
  })

  it('returns canonical team paths', () => {
    expect(teamPath()).toBe('/team')
    expect(teamPath('agent-slug')).toBe('/team/agent-slug')
  })

  it('uses canonical browse fallback when listing key missing', () => {
    expect(listingDetailPath('')).toBe('/homes-for-sale')
  })

  it('builds listing hierarchy path with city and subdivision', () => {
    expect(
      listingDetailPath(
        'spark-key-12345',
        {
          streetNumber: '100',
          streetName: 'Main St',
          city: 'Bend',
          state: 'OR',
          postalCode: '97702',
        },
        {
          city: 'Bend',
          subdivision: 'Northwest Crossing',
        },
        { mlsNumber: '220189456' }
      )
    ).toBe('/homes-for-sale/bend/northwest-crossing/100-main-st-220189456')
  })

  it('includes neighborhood segment before subdivision when provided', () => {
    expect(
      listingDetailPath(
        'spark-key-12345',
        {
          streetNumber: '100',
          streetName: 'Main St',
          city: 'Bend',
          state: 'OR',
          postalCode: '97702',
        },
        {
          city: 'Bend',
          neighborhood: 'Westside',
          subdivision: 'Northwest Crossing',
        },
        { mlsNumber: '220189456' }
      )
    ).toBe('/homes-for-sale/bend/westside/northwest-crossing/100-main-st-220189456')
  })

  it('keeps hierarchy path without address when location is present', () => {
    expect(
      listingDetailPath(
        '12345',
        {
          city: null,
          state: null,
          postalCode: null,
          streetNumber: null,
          streetName: null,
        },
        {
          city: 'Bend',
          subdivision: 'Petrosa',
        }
      )
    ).toBe('/homes-for-sale/bend/petrosa/12345')
  })

  it('builds subdivision listings path with optional neighborhood', () => {
    expect(subdivisionListingsPath('Bend', 'Northwest Crossing')).toBe('/homes-for-sale/bend/northwest-crossing')
    expect(subdivisionListingsPath('Bend', 'Northwest Crossing', 'Westside')).toBe('/homes-for-sale/bend/westside/northwest-crossing')
  })

  it('uses listing key fallback path when hierarchy data missing', () => {
    expect(listingDetailPath('abc-987')).toBe('/homes-for-sale/listing/abc-987')
  })

  it('prefers mls number over listing key for canonical fallback paths', () => {
    expect(
      listingDetailPath(
        'abc-987',
        undefined,
        undefined,
        { mlsNumber: '17133' }
      )
    ).toBe('/homes-for-sale/listing/17133')
  })

  it('extracts mls number from canonical address-mls slug', () => {
    expect(listingKeyFromSlug('2145-nw-cascade-view-dr-220189456')).toBe('220189456')
  })

  it('extracts listing key from legacy tilde slug', () => {
    expect(listingKeyFromSlug('12345~100-main-st-bend-or-97702')).toBe('12345')
  })

  // CONTRACT: every internal listing link must produce the SAME canonical URL as
  // the detail page (generateMetadata) + the sitemap — the full
  // city/neighborhood/subdivision/address-mls hierarchy. A regression to a
  // shorter URL (e.g. dropping the neighborhood segment) fails here.
  it('listingTileHref builds the full city/neighborhood/subdivision/address-mls canonical', () => {
    expect(
      listingTileHref({
        listingKey: 'spark-key-12345',
        listNumber: '220189456',
        streetNumber: '100',
        streetName: 'Main St',
        city: 'Bend',
        boundaryCity: 'Bend',
        boundaryNeighborhood: 'Westside',
        subdivisionName: 'Northwest Crossing',
      }),
    ).toBe('/homes-for-sale/bend/westside/northwest-crossing/100-main-st-220189456')
  })

  it('listingTileHref prefers boundaryCity and drops the N/A subdivision sentinel', () => {
    expect(
      listingTileHref({
        listingKey: 'k',
        listNumber: '220189456',
        streetNumber: '100',
        streetName: 'Main St',
        city: 'Bend',
        boundaryCity: 'Redmond',
        subdivisionName: 'N/A',
      }),
    ).toBe('/homes-for-sale/redmond/100-main-st-220189456')
  })
})
