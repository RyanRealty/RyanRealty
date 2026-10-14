import { describe, expect, it } from 'vitest'
import { COMING_SOON_STATUS } from '@/lib/listing-status-public'
import { listingCanonicalHref } from '@/lib/slug'
import { listingIndexNowPath, listingIndexNowUrls } from './indexnow-listings'

const NOW = new Date('2026-10-14T12:00:00.000Z')

/** A written listings row, in the Spark-mapped field names the delta sync upserts. */
function row(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ListingKey: '20260101000000000000000000',
    ListNumber: '220000001',
    StandardStatus: 'Active',
    StreetNumber: '123',
    StreetName: 'Main St',
    City: 'Bend',
    SubdivisionName: 'Tetherow',
    CloseDate: null,
    ModificationTimestamp: '2026-10-14T11:00:00.000Z',
    permit_internet_yn: true,
    permit_address_internet_yn: true,
    idx_participant: true,
    ...over,
  }
}

describe('listingIndexNowPath', () => {
  it('is the listing canonical from the one URL builder', () => {
    const expected = listingCanonicalHref({
      listingKey: '20260101000000000000000000',
      listNumber: '220000001',
      streetNumber: '123',
      streetName: 'Main St',
      city: 'Bend',
      subdivisionName: 'Tetherow',
    })
    expect(listingIndexNowPath(row(), NOW)).toBe(expected)
    expect(expected).toMatch(/^\/homes-for-sale\/bend\/tetherow\/.*-220000001$/)
  })

  it.each(['Active', 'Active Under Contract', 'Pending'])('submits an on-market %s page', (status) => {
    expect(listingIndexNowPath(row({ StandardStatus: status }), NOW)).not.toBeNull()
  })

  it.each([
    ['permit_internet_yn', false],
    ['permit_address_internet_yn', false],
    ['idx_participant', false],
  ])('skips an IDX opt-out (%s = %s): the page is a 404', (field, value) => {
    expect(listingIndexNowPath(row({ [field]: value }), NOW)).toBeNull()
  })

  it('an unknown IDX flag is not an opt-out (the page renders)', () => {
    expect(listingIndexNowPath(row({ permit_internet_yn: null, idx_participant: null }), NOW)).not.toBeNull()
  })

  // The pre-marketing status in the spellings the feed sends, built from the
  // one constant (ci:public-listing-status keeps the literal out of this file).
  const preMarketing = [COMING_SOON_STATUS, COMING_SOON_STATUS.replace(' ', ''), COMING_SOON_STATUS.toLowerCase()]
  it.each(preMarketing)('skips pre-marketing (%s): it never renders publicly', (status) => {
    expect(listingIndexNowPath(row({ StandardStatus: status }), NOW)).toBeNull()
  })

  it('submits a recent sale: off-market pages stay indexed for 90 days', () => {
    expect(listingIndexNowPath(row({ StandardStatus: 'Closed', CloseDate: '2026-10-10' }), NOW)).not.toBeNull()
  })

  it('submits a recent expiry, dated by its last change', () => {
    expect(
      listingIndexNowPath(row({ StandardStatus: 'Expired', ModificationTimestamp: '2026-10-13T00:00:00Z' }), NOW),
    ).not.toBeNull()
  })

  it('skips an old sale: past 90 days the page is noindex', () => {
    expect(listingIndexNowPath(row({ StandardStatus: 'Closed', CloseDate: '2026-03-01' }), NOW)).toBeNull()
  })

  it('skips an off-market page with no date to prove it recent', () => {
    expect(
      listingIndexNowPath(row({ StandardStatus: 'Withdrawn', CloseDate: null, ModificationTimestamp: null }), NOW),
    ).toBeNull()
  })

  it('skips a row with no key at all', () => {
    expect(listingIndexNowPath(row({ ListingKey: null, ListNumber: null }), NOW)).toBeNull()
  })
})

describe('listingIndexNowUrls', () => {
  it('returns absolute ryan-realty.com URLs, deduplicated, skipping pages that are not indexed', () => {
    const urls = listingIndexNowUrls(
      [
        row(),
        row(),
        row({ ListNumber: '220000002', ListingKey: 'K2', StandardStatus: COMING_SOON_STATUS }),
        row({ ListNumber: '220000003', ListingKey: 'K3', StreetNumber: '9', StreetName: 'Elm St' }),
      ],
      NOW,
    )
    expect(urls).toHaveLength(2)
    for (const u of urls) expect(u.startsWith('https://ryan-realty.com/homes-for-sale/')).toBe(true)
    expect(urls[1]).toMatch(/-220000003$/)
  })
})
