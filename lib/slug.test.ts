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
  listingCanonicalHref,
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

  it('drops N/A / na subdivision so listing URLs never include /na/', () => {
    expect(
      listingDetailPath(
        'spark-key-la-pine',
        {
          streetNumber: '50490',
          streetName: 'Hwy 31',
          city: 'La Pine',
          state: 'OR',
          postalCode: '97739',
        },
        {
          city: 'La Pine',
          subdivision: 'N/A',
        },
        { mlsNumber: '220223831' }
      )
    ).toBe('/homes-for-sale/la-pine/50490-hwy-31-220223831')
  })

  it("never emits the boundary classifier's 'Outside Boundaries' sentinel as a URL segment", () => {
    // Callers pass `boundaryCity ?? city`; a home outside every polygon carries
    // the display-cased sentinel there. The canonical must fall back to the MLS
    // city — /homes-for-sale/outside-boundaries/... went out indexed once.
    expect(
      listingDetailPath(
        'spark-key-palla',
        {
          streetNumber: '63435',
          streetName: 'Palla',
          city: 'Bend',
          state: 'OR',
          postalCode: '97703',
        },
        {
          city: 'Outside Boundaries',
          neighborhood: 'outside-boundaries',
          subdivision: 'Lakes At Tanager PUD',
        },
        { mlsNumber: '220225078' }
      )
    ).toBe('/homes-for-sale/bend/lakes-at-tanager-pud/63435-palla-220225078')
  })

  it('SITE-23: a Brasada Ranch home resolves to Powell Butte, from its own boundary fields', () => {
    // 220193364, 17938 Chaparral, Brasada Ranch — one of the 45 listing pages
    // Search Console had indexed under /homes-for-sale/outside-boundaries/
    // brasada-ranch/. The sentinel fired because `boundaries` held no polygon
    // for Powell Butte at any geo_type, so the classifier had nothing to put in
    // boundary_city; the Brasada Ranch neighbourhood polygon was there the whole
    // time and the home's point is inside it. Migration 20260908210000 added the
    // Powell Butte CCD polygon and re-classified the row, so these are the values
    // the row now carries — read live 2026-09-08, boundary_city 'Powell Butte',
    // boundary_neighborhood 'Brasada Ranch'.
    //
    // The test above proves the URL builder REFUSES the sentinel. This one pins
    // the other half: that a real registry community's home names its city and
    // its community, rather than falling through to the MLS city with no
    // community and no polygon behind it.
    expect(
      listingDetailPath(
        '20241121235215245034000000',
        {
          streetNumber: '17938',
          streetName: 'Chaparral',
          city: 'Powell Butte',
          state: 'OR',
          postalCode: '97753',
        },
        {
          city: 'Powell Butte',
          neighborhood: 'Brasada Ranch',
          subdivision: 'Brasada Ranch',
        },
        { mlsNumber: '220193364' }
      )
    ).toBe('/homes-for-sale/powell-butte/brasada-ranch/17938-chaparral-220193364')
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

  it('withholds placeholder street number 0 from the Moonshadow listing segment', () => {
    expect(
      listingDetailPath(
        'spark-moonshadow',
        {
          streetNumber: '0',
          streetName: 'Moonshadow Court',
          city: 'Bend',
          state: 'OR',
          postalCode: '97701',
        },
        { city: 'Bend' },
        { mlsNumber: '220221237' }
      )
    ).toBe('/homes-for-sale/bend/moonshadow-court-220221237')
    expect(
      listingTileHref({
        listingKey: 'spark-moonshadow',
        listNumber: '220221237',
        streetNumber: '0',
        streetName: 'Moonshadow Court',
        city: 'Bend',
      }),
    ).toBe('/homes-for-sale/bend/moonshadow-court-220221237')
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

  /*
   * SITE-22 — the two retired canonical SHAPES, asserted on fixtures on purpose.
   *
   * Both still sit in Search Console as duplicate URLs for live listings:
   * /homes-for-sale/outside-boundaries/... from before the sentinel fix in
   * lib/slug.ts, and /homes-for-sale/jacksonville/na/... from before the N/A
   * filter. Neither can be caught by sampling live URLs — the sitemap's 7,506
   * listing rows contain zero of either, so a live sample would stay green for
   * the wrong reason and prove only that the corpus has moved on. A fixture
   * asserts the RULE, which is what a regression would break.
   */
  it('SITE-22: listingTileHref never emits the outside-boundaries sentinel, in either slot', () => {
    // The sentinel arrives display-cased in boundary_city (verified against
    // listing_tile_mv for 220225078) and slug-cased in boundary_neighborhood.
    expect(
      listingTileHref({
        listingKey: 'spark-key-palla',
        listNumber: '220225078',
        streetNumber: '63435',
        streetName: 'Palla',
        city: 'Bend',
        boundaryCity: 'Outside Boundaries',
        boundaryNeighborhood: 'outside-boundaries',
        subdivisionName: 'Lakes At Tanager PUD',
      }),
    ).toBe('/homes-for-sale/bend/lakes-at-tanager-pud/63435-palla-220225078')

    for (const sentinel of ['Outside Boundaries', 'outside-boundaries', 'OUTSIDE BOUNDARIES', 'Outside  Boundaries']) {
      const href = listingTileHref({
        listingKey: 'k',
        listNumber: '220000001',
        streetNumber: '1',
        streetName: 'Main St',
        city: 'Bend',
        boundaryCity: sentinel,
        boundaryNeighborhood: sentinel,
      })
      expect(href).not.toContain('outside')
      expect(href).toBe('/homes-for-sale/bend/1-main-st-220000001')
    }
  })

  it('SITE-22: listingTileHref never emits an /na/ segment from an MLS N/A', () => {
    // The Jacksonville shape: a literal "N/A" SubdivisionName slugified into a
    // place segment that is not a place.
    for (const noise of ['N/A', 'n/a', 'N/a', 'None']) {
      const href = listingTileHref({
        listingKey: 'k',
        listNumber: '220000002',
        streetNumber: '500',
        streetName: 'Oregon St',
        city: 'Jacksonville',
        boundaryCity: 'Jacksonville',
        subdivisionName: noise,
      })
      expect(href).toBe('/homes-for-sale/jacksonville/500-oregon-st-220000002')
      expect(href).not.toMatch(/\/(na|none)\//)
    }
  })

  it('SITE-22: listingCanonicalHref and listingTileHref are the same URL for one listing', () => {
    // The whole item in one assertion: the canonical the detail page publishes
    // and the href an index links with are one expression, not two copies.
    const listing = {
      listingKey: '20260418234131878480000000',
      listNumber: '220219603',
      streetNumber: '55550',
      streetName: 'Heidi',
      city: 'Bend',
      boundaryCity: 'Bend',
      boundaryNeighborhood: null,
      subdivisionName: 'N/A',
    }
    expect(listingCanonicalHref(listing)).toBe(listingTileHref(listing))
    expect(listingCanonicalHref(listing)).toBe('/homes-for-sale/bend/55550-heidi-220219603')
  })

  it('SITE-22: a row with no MLS number falls back to the key, and that is the URL to avoid', () => {
    // 885 URLs / 3,348 impressions in GSC 2026-06-08..2026-09-05 look like this,
    // because buildActivityItems passed no listNumber. The fallback is correct
    // and still valid; the fix is that callers pass the fields.
    const key = '20260418234131878480000000'
    expect(
      listingTileHref({ listingKey: key, streetNumber: '55550', streetName: 'Heidi', city: 'Bend' }),
    ).toBe(`/homes-for-sale/bend/55550-heidi-${key}`)
    expect(
      listingTileHref({
        listingKey: key,
        listNumber: '220219603',
        streetNumber: '55550',
        streetName: 'Heidi',
        city: 'Bend',
      }),
    ).toBe('/homes-for-sale/bend/55550-heidi-220219603')
  })
})
