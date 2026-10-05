import { describe, expect, it } from 'vitest'
import { assembleListingSitemapRows, type ListingSitemapTile } from './listing-sitemap-path'

/**
 * SITE-33 REVERTED (Matt 2026-10-05, "Undo it"). Out-of-area listing pages are
 * index, follow again, so their rows are back in listings.xml: the 2026-09-09
 * noindex cost about 36% of the Search Console impression drop since Sep 12.
 * Fixtures are real rows, resolved live from listing_tile_mv on 2026-09-09
 * (Active, one per city).
 */
const tile = (over: Partial<ListingSitemapTile>): ListingSitemapTile => ({
  listing_key: '20260101000000000000000000',
  list_number: '220000000',
  street_number: '1',
  street_name: 'Main',
  city: 'Bend',
  subdivision_name: null,
  boundary_city: 'Bend',
  boundary_neighborhood: null,
  modified_at: '2026-09-01T00:00:00.000Z',
  ...over,
})

const BEND = tile({
  listing_key: '20260721161730408210000000',
  list_number: '220225832',
  street_number: '20339',
  street_name: 'Jack Benny',
  city: 'Bend',
  subdivision_name: '1925 Townhomes',
  boundary_city: 'Bend',
  boundary_neighborhood: 'Southeast Bend',
})
const MEDFORD = tile({
  listing_key: '20260630182345558785000000',
  list_number: '220226395',
  street_number: '3655',
  street_name: 'Aerial Heights',
  city: 'Medford',
  subdivision_name: 'Aerial Heights',
  boundary_city: 'Outside Boundaries',
  boundary_neighborhood: null,
})
const GRANTS_PASS = tile({
  listing_key: '20260803155739500483000000',
  list_number: '220226382',
  street_number: '1628',
  street_name: 'Terrace',
  city: 'Grants Pass',
  subdivision_name: 'N/A',
  boundary_city: 'Outside Boundaries',
  boundary_neighborhood: null,
})
const KLAMATH = tile({
  listing_key: '20260701151303961479000000',
  list_number: '220224565',
  street_number: '2611',
  street_name: 'Chantal',
  city: 'Klamath Falls',
  subdivision_name: 'N/A',
  boundary_city: 'Outside Boundaries',
  boundary_neighborhood: null,
})

describe('listings.xml assembly keeps out-of-area homes (SITE-33 reverted 2026-10-05)', () => {
  it('assembles a loc for every city, in-area and out', () => {
    const now = new Date('2026-10-05T00:00:00.000Z')
    const rows = assembleListingSitemapRows([BEND, MEDFORD, GRANTS_PASS, KLAMATH], now)
    expect(rows.map((r) => r.listingKey)).toEqual(
      [BEND, MEDFORD, GRANTS_PASS, KLAMATH].map((t) => t.listing_key),
    )
    expect(rows.some((r) => /\/medford\//.test(r.path))).toBe(true)
    expect(rows.some((r) => /\/grants-pass\//.test(r.path))).toBe(true)
    expect(rows.some((r) => /\/klamath-falls\//.test(r.path))).toBe(true)
  })
})
