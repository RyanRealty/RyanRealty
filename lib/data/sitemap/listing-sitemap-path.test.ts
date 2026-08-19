import { describe, expect, it } from 'vitest'
import { assembleListingSitemapRows, listingSitemapPath } from './listing-sitemap-path'

describe('listingSitemapPath', () => {
  it('matches the listing-page canonical (boundary city + neighborhood + MLS tail)', () => {
    expect(
      listingSitemapPath({
        listing_key: 'abc',
        list_number: '220208193',
        street_number: '438',
        street_name: '9th',
        city: 'Bend',
        subdivision_name: '1st Addition Bend Pk',
        boundary_city: 'Bend',
        boundary_neighborhood: 'Orchard District',
      }),
    ).toBe('/homes-for-sale/bend/orchard-district/1st-addition-bend-pk/438-9th-220208193')
  })

  it('drops N/A subdivision and still emits a city + address-MLS path', () => {
    expect(
      listingSitemapPath({
        listing_key: 'abc',
        list_number: '220201234',
        street_number: '123',
        street_name: 'Main',
        city: 'Bend',
        subdivision_name: 'N/A',
      }),
    ).toBe('/homes-for-sale/bend/123-main-220201234')
  })

  it('falls back to /homes-for-sale/listing/{id} when city is missing', () => {
    expect(
      listingSitemapPath({
        listing_key: 'abc',
        list_number: '220208193',
        street_number: '438',
        street_name: '9th',
        city: null,
      }),
    ).toBe('/homes-for-sale/listing/220208193')
  })

  it('returns null when the row has no public id', () => {
    expect(listingSitemapPath({ listing_key: '' })).toBeNull()
  })
})

describe('assembleListingSitemapRows', () => {
  const now = new Date('2026-08-19T13:37:49.262Z')

  it('dedupes by listing_key and skips rows that cannot build a path', () => {
    const rows = assembleListingSitemapRows(
      [
        {
          listing_key: 'a',
          list_number: '220201111',
          street_number: '1',
          street_name: 'Oak',
          city: 'Bend',
        },
        {
          listing_key: 'a',
          list_number: '220201111',
          street_number: '1',
          street_name: 'Oak',
          city: 'Bend',
        },
        { listing_key: '' },
        {
          listing_key: 'b',
          list_number: '220202222',
          street_number: '2',
          street_name: 'Pine',
          city: 'Redmond',
          modified_at: '2026-08-01T00:00:00.000Z',
        },
      ],
      now,
    )
    expect(rows.map((r) => r.listingKey)).toEqual(['a', 'b'])
    expect(rows[0].path).toBe('/homes-for-sale/bend/1-oak-220201111')
    expect(rows[0].lastModified).toBe(now.toISOString())
    expect(rows[1].lastModified).toBe('2026-08-01T00:00:00.000Z')
  })
})
