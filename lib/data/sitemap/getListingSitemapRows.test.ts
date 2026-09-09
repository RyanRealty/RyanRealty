import { describe, expect, it } from 'vitest'
import { serviceAreaSitemapTiles } from './getListingSitemapRows'
import { assembleListingSitemapRows, type ListingSitemapTile } from './listing-sitemap-path'

/**
 * SITE-33 — a noindexed URL does not belong in a sitemap (Matt 2026-09-08).
 *
 * The out-of-area listing detail page renders "noindex, follow"; its row must
 * therefore leave listings.xml. Fixtures are real rows, resolved live from
 * listing_tile_mv on 2026-09-09 (Active, one per city).
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

describe('serviceAreaSitemapTiles (SITE-33)', () => {
  it('drops the out-of-area rows and keeps the Central Oregon ones', () => {
    const kept = serviceAreaSitemapTiles([BEND, MEDFORD, GRANTS_PASS, KLAMATH])
    expect(kept.map((t) => t.city)).toEqual(['Bend'])
  })

  it('keeps every service-area city, whatever case the feed spells it in', () => {
    const rows = [
      tile({ listing_key: 'a', city: 'Bend' }),
      tile({ listing_key: 'b', city: 'redmond' }),
      tile({ listing_key: 'c', city: 'LA PINE' }),
      tile({ listing_key: 'd', city: 'Sunriver' }),
      tile({ listing_key: 'e', city: 'Crooked River Ranch' }),
    ]
    expect(serviceAreaSitemapTiles(rows)).toHaveLength(rows.length)
  })

  it('drops a row with no city rather than submitting an unplaceable URL', () => {
    expect(serviceAreaSitemapTiles([tile({ city: null })])).toHaveLength(0)
    expect(serviceAreaSitemapTiles([tile({ city: '' })])).toHaveLength(0)
  })

  it('is applied BEFORE assembly, so no out-of-area loc reaches listings.xml', () => {
    const now = new Date('2026-09-09T00:00:00.000Z')
    const rows = assembleListingSitemapRows(
      serviceAreaSitemapTiles([BEND, MEDFORD, GRANTS_PASS, KLAMATH]),
      now,
    )
    expect(rows).toHaveLength(1)
    for (const row of rows) {
      expect(row.path).not.toMatch(/\/medford\//)
      expect(row.path).not.toMatch(/\/grants-pass\//)
      expect(row.path).not.toMatch(/\/klamath-falls\//)
    }
  })

  it('does not otherwise change the assembled rows', () => {
    const now = new Date('2026-09-09T00:00:00.000Z')
    expect(assembleListingSitemapRows(serviceAreaSitemapTiles([BEND]), now)).toEqual(
      assembleListingSitemapRows([BEND], now),
    )
  })
})
