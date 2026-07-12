import { describe, it, expect } from 'vitest'
import { pickMostRecentListing, rowToSubject } from './subject'
import type { CmaListingRow } from '@/lib/data'

/**
 * Locks "CMAs always use the most recent listing's photos + information for the
 * subject" (Matt directive 2026-07-10). The 1204 NW Iowa case: four relistings
 * of one property, all carrying the SAME 2026-02-10 bulk-resync
 * ModificationTimestamp, where the ancient 1998 listing was touched two hours
 * later and so won a last-modified sort — surfacing a 1998 photo and a stale
 * 97701 zip. Subject selection must instead pick the true newest listing by
 * real listing-activity date.
 */

// Real shape from the live 1204 NW Iowa rows.
const IOWA_1998: CmaListingRow = {
  ListingKey: '20200227015856157936000000',
  ListNumber: '9806553',
  StandardStatus: 'Closed',
  PostalCode: '97701',
  ListDate: '1998-11-09T15:38:58+00:00',
  OnMarketDate: '1998-11-09T15:38:58+00:00',
  CloseDate: '1999-02-10T00:00:00+00:00',
  ModificationTimestamp: '2026-02-10T13:42:26+00:00', // newest last-modified (poisoned)
  BedroomsTotal: 3,
  BathroomsTotal: '2',
  TotalLivingAreaSqFt: '2436',
  PhotoURL: 'https://cdn.example/1998.jpg',
  photos_count: 1,
  City: 'Bend',
  StreetNumber: '1204',
  StreetName: 'Iowa',
}
const IOWA_2004: CmaListingRow = {
  ListingKey: '20200227014037847350000000',
  ListNumber: '2401058',
  StandardStatus: 'Closed',
  PostalCode: '97701',
  OnMarketDate: '2004-02-13T19:30:12+00:00',
  CloseDate: '2004-05-04T00:00:00+00:00',
  ModificationTimestamp: '2026-02-10T11:03:01+00:00',
  photos_count: 1,
  StreetNumber: '1204',
  StreetName: 'Iowa',
  City: 'Bend',
}
const IOWA_2011: CmaListingRow = {
  ListingKey: '20200226173300895310000000',
  ListNumber: '201010224',
  StandardStatus: 'Closed',
  PostalCode: '97701',
  OnMarketDate: '2010-11-24T14:21:42+00:00',
  CloseDate: '2011-03-04T00:00:00+00:00',
  ModificationTimestamp: '2026-02-10T11:03:07+00:00',
  photos_count: 14,
  StreetNumber: '1204',
  StreetName: 'Iowa',
  City: 'Bend',
}
const IOWA_2021: CmaListingRow = {
  ListingKey: '20210508004021427311000000',
  ListNumber: '220122207',
  StandardStatus: 'Expired',
  PostalCode: '97703', // correct current zip
  OnMarketDate: '2021-05-08T04:49:56+00:00',
  ListDate: '2021-05-08T04:49:56+00:00',
  ModificationTimestamp: '2026-02-10T11:40:06+00:00',
  BedroomsTotal: 3,
  BathroomsTotal: '3',
  TotalLivingAreaSqFt: '2436',
  PhotoURL: 'https://cdn.example/2021.jpg',
  photos_count: 59,
  StreetNumber: '1204',
  StreetName: 'Iowa',
  City: 'Bend',
}

describe('pickMostRecentListing', () => {
  it('picks the 2021 relisting over an ancient 1998 listing with a newer last-modified', () => {
    const best = pickMostRecentListing([IOWA_1998, IOWA_2004, IOWA_2011, IOWA_2021])
    expect(best.ListNumber).toBe('220122207')
    expect(best.PostalCode).toBe('97703')
    expect(best.photos_count).toBe(59)
  })

  it('is order-independent (does not rely on input ordering)', () => {
    expect(pickMostRecentListing([IOWA_2021, IOWA_1998]).ListNumber).toBe('220122207')
    expect(pickMostRecentListing([IOWA_1998, IOWA_2021]).ListNumber).toBe('220122207')
  })

  it('prefers a currently-on-market listing over an older off-market one', () => {
    const active = { ...IOWA_2011, StandardStatus: 'Active', ListNumber: 'ACTIVE-1', OnMarketDate: '2026-06-01T00:00:00+00:00' }
    const best = pickMostRecentListing([IOWA_2021, IOWA_2011, active])
    expect(best.ListNumber).toBe('ACTIVE-1')
  })

  it('the resolved subject carries the newest listing photo, zip, and bath count', () => {
    const subject = rowToSubject(pickMostRecentListing([IOWA_1998, IOWA_2021]))
    expect(subject.photoUrl).toBe('https://cdn.example/2021.jpg')
    expect(subject.postalCode).toBe('97703')
    expect(subject.baths).toBe(3)
  })
})

describe('saneYearBuilt', () => {
  it('nulls the sqft-in-year-field MLS data-entry error (live 2026-07-11 case)', async () => {
    const { saneYearBuilt } = await import('@/lib/cma/subject')
    expect(saneYearBuilt(2146)).toBeNull()
    expect(saneYearBuilt(1700)).toBeNull()
    expect(saneYearBuilt(2022)).toBe(2022)
    expect(saneYearBuilt(null)).toBeNull()
  })
})
