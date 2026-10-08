import { describe, expect, it } from 'vitest'
import {
  applyRecrawlLastmod,
  assembleListingSitemapRows,
  listingSitemapImageUrl,
  listingSitemapPath,
} from './listing-sitemap-path'

describe('listingSitemapPath', () => {
  // P14 (2026-09-23): the canonical is MLS City + MLS SubdivisionName +
  // address-MLS; the polygon neighborhood (Orchard District) is not a segment.
  it('matches the listing-page canonical (MLS city + MLS subdivision + MLS tail, no polygon segment)', () => {
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
    ).toBe('/homes-for-sale/bend/1st-addition-bend-pk/438-9th-220208193')
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

describe('listingSitemapImageUrl', () => {
  const row = {
    listing_key: 'K1',
    photo_url: 'https://cdn.resize.sparkplatform.com/ore/320x240/true/abc-o.jpg',
  }

  it('lists the lead photo at the 1600x1200 size the listing page loads', () => {
    expect(listingSitemapImageUrl(row, new Set())).toBe(
      'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/abc-o.jpg',
    )
  })

  it('withholds a suppressed listing and a missing or insecure photo', () => {
    expect(listingSitemapImageUrl(row, new Set(['K1']))).toBeNull()
    expect(listingSitemapImageUrl({ listing_key: 'K1', photo_url: null }, new Set())).toBeNull()
    expect(listingSitemapImageUrl({ listing_key: 'K1', photo_url: 'http://x.test/a.jpg' }, new Set())).toBeNull()
  })
})

describe('applyRecrawlLastmod (GSC slide fix 2026-10-05)', () => {
  const NOW = new Date('2026-10-05T12:00:00.000Z')
  const mk = (path: string, lastModified: string) => ({ listingKey: path, path, lastModified, imageUrl: null })
  const rows = [
    mk('/homes-for-sale/bend/providence/1522-locksley-220226356', '2026-08-01T00:00:00.000Z'),
    mk('/homes-for-sale/bend/2-oak-220000002', '2026-08-01T00:00:00.000Z'),
    mk('/homes-for-sale/bend/3-elm-220000003', '2026-10-05T11:00:00.000Z'),
  ]
  const BUMP = '2026-10-05T08:00:00.000Z'

  it('bumps a flagged URL to recrawl_after, matched by path', () => {
    const out = applyRecrawlLastmod(
      rows,
      [{ url: 'https://ryan-realty.com/homes-for-sale/bend/providence/1522-locksley-220226356', listing_number: '220226356', recrawl_after: BUMP }],
      NOW,
    )
    expect(out[0]!.lastModified).toBe(BUMP)
    expect(out[1]).toEqual(rows[1])
  })

  it('matches by MLS number when the canonical moved since the inspection', () => {
    const out = applyRecrawlLastmod(
      rows,
      [{ url: 'https://ryan-realty.com/homes-for-sale/bend/old-sub/2-oak-220000002', listing_number: '220000002', recrawl_after: BUMP }],
      NOW,
    )
    expect(out[1]!.lastModified).toBe(BUMP)
  })

  it('never moves a lastmod backwards or into the future', () => {
    const out = applyRecrawlLastmod(
      rows,
      [
        { url: 'https://ryan-realty.com/homes-for-sale/bend/3-elm-220000003', listing_number: '220000003', recrawl_after: BUMP },
        { url: 'https://ryan-realty.com/homes-for-sale/bend/2-oak-220000002', listing_number: '220000002', recrawl_after: '2026-12-01T00:00:00.000Z' },
      ],
      NOW,
    )
    expect(out[2]!.lastModified).toBe('2026-10-05T11:00:00.000Z')
    expect(out[1]!.lastModified).toBe(NOW.toISOString())
  })

  it('no flags is the identity', () => {
    expect(applyRecrawlLastmod(rows, [], NOW)).toEqual(rows)
  })
})
