import { describe, expect, it } from 'vitest'
import { listingDocumentTitle } from './listing-document-title'
import { TITLE_BUDGET } from '@/lib/site/page-metadata'

describe('listingDocumentTitle', () => {
  it('leads an active home with its address, then beds/baths when they fit', () => {
    expect(listingDocumentTitle({ addressTitle: '60936 SE Apollo Place, Bend', beds: 4, baths: 3 })).toBe(
      '60936 SE Apollo Place, Bend · 4 bed, 3 bath',
    )
  })

  it('keeps the status word first so a sold home never reads as for sale', () => {
    expect(listingDocumentTitle({ statusWord: 'Sold', addressTitle: '1 Oak, Bend', beds: 3, baths: 2.5 })).toBe(
      'Sold · 1 Oak, Bend · 3 bed, 2.5 bath',
    )
  })

  it('drops beds/baths rather than push the address past the budget', () => {
    const address = '61288 King Saul Avenue, Bend, OR 97702'
    const t = listingDocumentTitle({ addressTitle: address, beds: 5, baths: 4 })
    expect(t).toBe(address)
    expect(t.length).toBeLessThanOrEqual(TITLE_BUDGET)
  })

  it('never drops the status word or the address, even when they alone run long', () => {
    const address = '13375 SW Forest Service Cabin 27 Road, Camp Sherman, OR 97730'
    expect(listingDocumentTitle({ statusWord: 'Off market', addressTitle: address, beds: 3, baths: 3 })).toBe(
      `Off market · ${address}`,
    )
  })

  it('omits a missing fact instead of inventing one', () => {
    expect(listingDocumentTitle({ statusWord: 'Sold', addressTitle: '1 Oak', beds: 3, baths: null })).toBe('Sold · 1 Oak · 3 bed')
  })

  it('falls back to the street alone when there is no status and no facts', () => {
    expect(listingDocumentTitle({ addressTitle: 'Listing abc' })).toBe('Listing abc')
  })
})
