import { describe, expect, it } from 'vitest'
import { listingContactHref, publishListingContactKey } from './publish-listing-contact-key'

describe('publishListingContactKey', () => {
  it('prefers the public MLS number over the Spark key', () => {
    expect(
      publishListingContactKey({
        listNumber: '220222626',
        listingKey: '20260603174052972542000000',
      }),
    ).toBe('220222626')
  })

  it('falls back to ListingKey when MLS is missing', () => {
    expect(
      publishListingContactKey({
        listNumber: null,
        listingKey: '20260603174052972542000000',
      }),
    ).toBe('20260603174052972542000000')
  })

  it('builds a tour href from the published key', () => {
    expect(listingContactHref('220222626', 'tour')).toBe(
      '/contact?listingKey=220222626&intent=tour',
    )
  })
})
