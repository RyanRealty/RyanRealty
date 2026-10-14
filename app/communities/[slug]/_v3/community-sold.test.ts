import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data/types/listing'
import {
  COMMUNITY_SOLD_ALIAS_CAP,
  COMMUNITY_SOLD_TABLE_CAP,
  COMMUNITY_SOLD_WINDOW_MONTHS,
  communitySoldAliasList,
  communitySoldLedgerRows,
  communitySoldRows,
  communitySoldWindowStart,
  tileMatchesCommunityName,
} from './community-sold'

function tile(partial: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: partial.listingKey,
    status: 'Closed',
    listPrice: 1_900_000,
    closePrice: 1_850_000,
    closeDate: '2026-08-12',
    beds: 3,
    baths: 2,
    sqft: 2100,
    streetNumber: '1',
    streetName: 'Fairway',
    streetSuffix: 'Dr',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97702',
    subdivisionName: 'Tetherow',
    subdivisionSlug: 'tetherow',
    lat: 44.03,
    lng: -121.36,
    photoUrl: 'https://example.com/a.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: '2026-04-01',
    modifiedAt: '2026-08-12',
    pricePerSqft: 880,
    lotSizeAcres: 0.3,
    yearBuilt: 2018,
    garageSpaces: 2,
    poolYn: false,
    hasVirtualTour: false,
    tourUrl: null,
    dom: 40,
    priceDropCount: 0,
    addressSlug: '1-fairway-dr',
    boundaryCity: 'bend',
    boundaryNeighborhood: 'tetherow',
    boundarySubdivision: 'tetherow',
    ...partial,
  } as ListingTile
}

const WINDOW = { windowStart: '2026-04-13', windowEnd: '2026-10-13', aliases: ['Tetherow', 'Triple'] }

describe('communitySoldAliasList', () => {
  it('dedupes, trims, and caps aliases without inventing a name', () => {
    expect(communitySoldAliasList(['Tetherow', ' tetherow ', 'Triple', ''])).toEqual([
      'Tetherow',
      'Triple',
    ])
    const many = Array.from({ length: COMMUNITY_SOLD_ALIAS_CAP + 4 }, (_, i) => `Plat ${i}`)
    expect(communitySoldAliasList(many)).toHaveLength(COMMUNITY_SOLD_ALIAS_CAP)
  })
})

describe('communitySoldWindowStart', () => {
  it(`is ${COMMUNITY_SOLD_WINDOW_MONTHS} calendar months before the as-of day`, () => {
    expect(communitySoldWindowStart(new Date('2026-10-13T18:00:00.000Z'))).toBe('2026-04-13')
  })
})

describe('tileMatchesCommunityName', () => {
  it('matches the community alias and withholds a foreign plat', () => {
    expect(tileMatchesCommunityName('Tetherow', ['Tetherow', 'Triple'])).toBe(true)
    expect(tileMatchesCommunityName('Triple', ['Tetherow', 'Triple'])).toBe(true)
    expect(tileMatchesCommunityName('Awbrey Glen', ['Tetherow', 'Triple'])).toBe(false)
    expect(tileMatchesCommunityName(null, ['Tetherow'])).toBe(false)
  })
})

describe('communitySoldRows', () => {
  it('keeps a priced close inside the window and drops the rest', () => {
    const rows = communitySoldRows({
      ...WINDOW,
      tiles: [
        tile({ listingKey: 'in-window' }),
        tile({ listingKey: 'too-old', closeDate: '2026-03-01' }),
        tile({ listingKey: 'no-price', closePrice: null }),
        tile({ listingKey: 'zero', closePrice: 0 }),
        tile({ listingKey: 'other-plat', subdivisionName: 'Awbrey Glen' }),
        tile({
          listingKey: 'no-street',
          streetNumber: null,
          streetName: null,
          streetSuffix: null,
          streetDirPrefix: null,
          streetDirSuffix: null,
          listNumber: null,
        }),
      ],
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      listingKey: 'in-window',
      address: '1 Fairway Dr',
      closePriceLabel: '$1,850,000',
      closeDateLabel: 'Aug 12, 2026',
      detail: '3 bd · 2 ba · 2,100 sqft',
    })
    expect(rows[0]?.href).toMatch(/^\/homes-for-sale\//)
  })

  it('returns no rows when the window or the set is empty, never a $0 sale', () => {
    expect(communitySoldRows({ ...WINDOW, tiles: [] })).toEqual([])
    expect(communitySoldRows({ ...WINDOW, windowStart: '', tiles: [tile({ listingKey: 'x' })] })).toEqual(
      [],
    )
    expect(communitySoldLedgerRows([])).toBeNull()
  })

  it('builds ledger figure rows from kept sales only', () => {
    const rows = communitySoldRows({
      ...WINDOW,
      tiles: [tile({ listingKey: 'a' }), tile({ listingKey: 'b', closeDate: '2026-09-01', closePrice: 2_100_000 })],
    })
    const ledger = communitySoldLedgerRows(rows)
    expect(ledger).not.toBeNull()
    expect(ledger?.map((row) => String(row.value))).toEqual(['$2,100,000', '$1,850,000'])
    expect(ledger?.every((row) => String(row.value).startsWith('$'))).toBe(true)
    expect(ledger?.some((row) => String(row.value) === '$0')).toBe(false)
    expect(ledger?.every((row) => row.media == null)).toBe(true)
  })

  it(`caps the sold table at ${COMMUNITY_SOLD_TABLE_CAP} rows`, () => {
    const tiles = Array.from({ length: COMMUNITY_SOLD_TABLE_CAP + 5 }, (_, i) =>
      tile({
        listingKey: `sold-${i}`,
        closeDate: `2026-09-${String((i % 28) + 1).padStart(2, '0')}`,
        closePrice: 1_800_000 + i * 1000,
      }),
    )
    const rows = communitySoldRows({ ...WINDOW, tiles })
    expect(rows).toHaveLength(COMMUNITY_SOLD_TABLE_CAP)
    const ledger = communitySoldLedgerRows(rows)
    expect(ledger).toHaveLength(COMMUNITY_SOLD_TABLE_CAP)
    expect(ledger?.every((row) => row.media == null)).toBe(true)
  })
})
