import { describe, expect, it } from 'vitest'
import { listingDocumentTitle } from './listing-document-title'

describe('listingDocumentTitle', () => {
  it('leads with status, then beds/baths, then the street', () => {
    expect(
      listingDocumentTitle({
        statusWord: 'Active',
        addressTitle: '60936 SE Apollo Place',
        beds: 4,
        baths: 3,
      }),
    ).toBe('Active · 4 bed, 3 bath · 60936 SE Apollo Place')
  })

  it('keeps a half bath as written', () => {
    expect(
      listingDocumentTitle({
        statusWord: 'Pending',
        addressTitle: '12 Pine',
        beds: 3,
        baths: 2.5,
      }),
    ).toBe('Pending · 3 bed, 2.5 bath · 12 Pine')
  })

  it('omits a missing fact instead of inventing one', () => {
    expect(
      listingDocumentTitle({
        statusWord: 'Sold',
        addressTitle: '1 Oak',
        beds: 3,
        baths: null,
      }),
    ).toBe('Sold · 3 bed · 1 Oak')
  })

  it('falls back to the street when there is no status and no facts', () => {
    expect(listingDocumentTitle({ addressTitle: 'Listing abc' })).toBe('Listing abc')
  })
})
