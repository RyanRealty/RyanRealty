import { describe, it, expect } from 'vitest'
import {
  listingIsOffMarket,
  listingPublishesClosePrice,
  publishListingPublishedPrice,
  publishListingPublishedWholePropertyPrice,
  publishListingSchemaAvailability,
  publishListingStatusWord,
} from './publish-listing-published-price'

const HEIDI = {
  // 55550 Heidi Court, Bend — MLS 220219603, the founding case.
  status: 'Closed' as const,
  listPrice: 1_250_000,
  closePrice: 1_100_000,
  propertyType: 'A',
}

describe('publishListingPublishedPrice', () => {
  it('publishes the CLOSE price for a Closed listing (the founding case)', () => {
    expect(publishListingPublishedPrice(HEIDI)).toBe(1_100_000)
  })

  it('publishes the ask for an Active listing and ignores a stray close price', () => {
    expect(
      publishListingPublishedPrice({
        status: 'Active',
        listPrice: 1_250_000,
        closePrice: 1_100_000,
        propertyType: 'A',
      }),
    ).toBe(1_250_000)
  })

  it.each(['Pending', 'Active Under Contract'])(
    'publishes the ask on %s — the home is still on market',
    (status) => {
      expect(
        publishListingPublishedPrice({
          status,
          listPrice: 900_000,
          closePrice: null,
          propertyType: 'A',
        }),
      ).toBe(900_000)
    },
  )

  it.each(['Expired', 'Canceled', 'Withdrawn'])(
    'publishes the last ask on %s — nothing closed, so there is no sale price',
    (status) => {
      expect(
        publishListingPublishedPrice({
          status,
          listPrice: 750_000,
          closePrice: null,
          propertyType: 'A',
        }),
      ).toBe(750_000)
    },
  )

  it('withholds rather than falling back to the ask when a Closed row has no ClosePrice', () => {
    expect(
      publishListingPublishedPrice({
        status: 'Closed',
        listPrice: 1_250_000,
        closePrice: null,
        propertyType: 'A',
      }),
    ).toBeNull()
  })

  it('withholds a commercial lease rate whatever the status', () => {
    expect(
      publishListingPublishedPrice({
        status: 'Closed',
        listPrice: 2.5,
        closePrice: 2.5,
        propertyType: 'G',
      }),
    ).toBeNull()
    expect(
      publishListingPublishedPrice({
        status: 'Active',
        listPrice: 2.5,
        closePrice: null,
        propertyType: 'G',
      }),
    ).toBeNull()
  })

  it('withholds a non-positive or absent figure', () => {
    expect(
      publishListingPublishedPrice({ status: 'Active', listPrice: 0, closePrice: null, propertyType: 'A' }),
    ).toBeNull()
    expect(
      publishListingPublishedPrice({ status: 'Active', listPrice: null, closePrice: null, propertyType: 'A' }),
    ).toBeNull()
  })

  it('reads a status the feed padded with whitespace', () => {
    expect(publishListingPublishedPrice({ ...HEIDI, status: ' Closed ' })).toBe(1_100_000)
  })
})

describe('publishListingPublishedWholePropertyPrice', () => {
  const subject = {
    propertySubType: 'Single Family Residence',
    subdivisionName: 'River Meadows',
    city: 'Bend',
    listNumber: '220219603',
  }

  it('publishes the close price for a Closed whole-property row', () => {
    expect(publishListingPublishedWholePropertyPrice({ ...HEIDI, ...subject })).toBe(1_100_000)
  })

  it('withholds a fractional interest even when it closed', () => {
    expect(
      publishListingPublishedWholePropertyPrice({
        status: 'Closed',
        listPrice: 35_000,
        closePrice: 30_000,
        propertyType: 'A',
        propertySubType: 'Tenancy in Common',
        subdivisionName: 'The Ridge',
        city: 'Sunriver',
        listNumber: '220185746',
      }),
    ).toBeNull()
  })
})

describe('publishListingStatusWord', () => {
  it('says Sold for Closed', () => {
    expect(publishListingStatusWord('Closed')).toBe('Sold')
  })

  it.each(['Expired', 'Canceled', 'Withdrawn'])('says Off market for %s', (status) => {
    expect(publishListingStatusWord(status)).toBe('Off market')
  })

  it.each(['Active', 'Active Under Contract', 'Pending', '', null, undefined])(
    'says nothing for %s',
    (status) => {
      expect(publishListingStatusWord(status)).toBeNull()
    },
  )
})

describe('publishListingSchemaAvailability', () => {
  it('states SoldOut on the node for a Closed listing, so dropping the Offer does not drop the fact', () => {
    expect(publishListingSchemaAvailability('Closed')).toBe('https://schema.org/SoldOut')
  })

  it.each(['Expired', 'Canceled', 'Withdrawn'])('states OutOfStock for %s', (status) => {
    expect(publishListingSchemaAvailability(status)).toBe('https://schema.org/OutOfStock')
  })

  it('mirrors buildOffer on the on-market statuses', () => {
    expect(publishListingSchemaAvailability('Active')).toBe('https://schema.org/InStock')
    expect(publishListingSchemaAvailability('Active Under Contract')).toBe(
      'https://schema.org/PreOrder',
    )
  })

  it('states nothing for Pending — schema.org has no honest value for under contract', () => {
    expect(publishListingSchemaAvailability('Pending')).toBeNull()
  })

  it('states nothing for Coming Soon, which never reaches a public surface', () => {
    expect(publishListingSchemaAvailability('Coming Soon')).toBeNull()
  })
})

describe('the status predicates', () => {
  it('knows only Closed publishes a close price', () => {
    expect(listingPublishesClosePrice('Closed')).toBe(true)
    for (const s of ['Active', 'Pending', 'Expired', 'Canceled', 'Withdrawn', null]) {
      expect(listingPublishesClosePrice(s)).toBe(false)
    }
  })

  it('knows the four off-market statuses and keeps Pending on market', () => {
    for (const s of ['Closed', 'Expired', 'Canceled', 'Withdrawn']) {
      expect(listingIsOffMarket(s)).toBe(true)
    }
    for (const s of ['Active', 'Active Under Contract', 'Pending', null]) {
      expect(listingIsOffMarket(s)).toBe(false)
    }
  })
})
