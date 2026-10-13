import { describe, expect, it } from 'vitest'
import { listingIndexPolicy } from './listing-index-policy'
import { isPublicOffMarketStatus, PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'
import { resolvePlaceContextFromListing } from '@/lib/data/geo/resolvePlaceContext'
import { listingCommunityDoor } from './listing-community-door'

const BRASADA_LISTING =
  '/homes-for-sale/powell-butte/brasada-ranch/16951-sw-century-dr-220219000'

describe('listingIndexPolicy', () => {
  it('indexes Active, Active Under Contract, and Pending on the listing URL', () => {
    for (const status of ['Active', 'Active Under Contract', 'Pending']) {
      expect(
        listingIndexPolicy({
          status,
          listingPath: BRASADA_LISTING,
          communityHref: '/communities/brasada-ranch',
        }),
      ).toEqual({ noindex: false, canonicalPath: BRASADA_LISTING })
    }
  })

  it('noindexes Closed, Expired, Canceled, and Withdrawn', () => {
    for (const status of ['Closed', 'Expired', 'Canceled', 'Withdrawn']) {
      expect(isPublicOffMarketStatus(status)).toBe(true)
      const policy = listingIndexPolicy({
        status,
        listingPath: BRASADA_LISTING,
        communityHref: null,
      })
      expect(policy.noindex).toBe(true)
      expect(policy.canonicalPath).toBe(BRASADA_LISTING)
    }
  })

  it('points an off-market Brasada listing at the Brasada Ranch community page', () => {
    const ctx = resolvePlaceContextFromListing({
      city: 'Powell Butte',
      citySlug: 'powell-butte',
      subdivisionName: 'Brasada Ranch',
      subdivisionSlug: 'brasada-ranch',
    })
    expect(ctx.curatedCommunity?.href).toBe('/communities/brasada-ranch')
    expect(
      listingIndexPolicy({
        status: 'Closed',
        listingPath: BRASADA_LISTING,
        communityHref: ctx.curatedCommunity?.href,
      }),
    ).toEqual({
      noindex: true,
      canonicalPath: '/communities/brasada-ranch',
    })
    expect(
      listingIndexPolicy({
        status: 'Expired',
        listingPath: BRASADA_LISTING,
        communityHref: listingCommunityDoor(ctx.curatedCommunity)?.href,
      }).canonicalPath,
    ).toBe('/communities/brasada-ranch')
  })

  it('does not let a community href move an on-market listing canonical', () => {
    expect(
      listingIndexPolicy({
        status: 'Active',
        listingPath: BRASADA_LISTING,
        communityHref: '/communities/brasada-ranch',
      }).canonicalPath,
    ).toBe(BRASADA_LISTING)
  })

  it('does not treat Pending as off market', () => {
    expect(
      listingIndexPolicy({
        status: 'Pending',
        listingPath: '/homes-for-sale/bend/tetherow/1-main-220000001',
        communityHref: '/communities/tetherow',
      }),
    ).toEqual({
      noindex: false,
      canonicalPath: '/homes-for-sale/bend/tetherow/1-main-220000001',
    })
  })

  it('keeps listings.xml on Active and Active Under Contract only', () => {
    expect([...PUBLIC_ACTIVE_STATUSES].sort()).toEqual(['Active', 'Active Under Contract'])
    for (const status of ['Closed', 'Expired', 'Canceled', 'Withdrawn', 'Pending']) {
      expect(PUBLIC_ACTIVE_STATUSES).not.toContain(status)
    }
  })
})
