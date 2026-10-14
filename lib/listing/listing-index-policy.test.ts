import { describe, expect, it } from 'vitest'
import {
  listingHubCanonicalPath,
  listingIndexPolicy,
  listingIsStaleOffMarket,
  listingOffMarketAnchor,
  listingOffMarketAgeMs,
  OFF_MARKET_NOINDEX_AFTER_DAYS,
} from './listing-index-policy'
import { isPublicOffMarketStatus } from '@/lib/listing-status-public'
import { LISTING_SITEMAP_STATUSES } from '@/lib/listing-status-public'
import { resolvePlaceContextFromListing } from '@/lib/data/geo/resolvePlaceContext'
import { listingCommunityDoor } from './listing-community-door'

const BRASADA_LISTING =
  '/homes-for-sale/powell-butte/brasada-ranch/16951-sw-century-dr-220219000'
const BEND_LISTING = '/homes-for-sale/bend/old-bend/1-main-220000001'
const NOW = new Date('2026-10-13T12:00:00.000Z')

describe('listingIndexPolicy — status-to-robots mapping', () => {
  it('indexes Active, Active Under Contract, and Pending on the listing URL', () => {
    for (const status of ['Active', 'Active Under Contract', 'Pending']) {
      expect(
        listingIndexPolicy({
          status,
          listingPath: BRASADA_LISTING,
          communityHref: '/communities/brasada-ranch',
          cityHref: '/cities/powell-butte',
          offMarketAt: '2020-01-01',
          now: NOW,
        }),
      ).toEqual({ noindex: false, canonicalPath: BRASADA_LISTING })
    }
  })

  it('noindexes Closed, Expired, Canceled, and Withdrawn older than 90 days', () => {
    for (const status of ['Closed', 'Expired', 'Canceled', 'Withdrawn']) {
      expect(isPublicOffMarketStatus(status)).toBe(true)
      const policy = listingIndexPolicy({
        status,
        listingPath: BRASADA_LISTING,
        communityHref: null,
        cityHref: null,
        offMarketAt: '2026-06-01T00:00:00.000Z',
        now: NOW,
      })
      expect(policy.noindex).toBe(true)
      expect(policy.canonicalPath).toBe(BRASADA_LISTING)
    }
  })

  it('keeps a recent Closed / Expired / Withdrawn page indexed on itself', () => {
    for (const status of ['Closed', 'Expired', 'Withdrawn', 'Canceled']) {
      expect(
        listingIndexPolicy({
          status,
          listingPath: BRASADA_LISTING,
          communityHref: '/communities/brasada-ranch',
          cityHref: '/cities/powell-butte',
          offMarketAt: '2026-08-01T00:00:00.000Z',
          now: NOW,
        }),
      ).toEqual({ noindex: false, canonicalPath: BRASADA_LISTING })
    }
  })

  it('indexes a home that left the market exactly 90 days ago, and noindexes the day after', () => {
    const atNinety = listingIndexPolicy({
      status: 'Closed',
      listingPath: BEND_LISTING,
      offMarketAt: '2026-07-15T12:00:00.000Z',
      now: NOW,
    })
    expect(atNinety).toEqual({ noindex: false, canonicalPath: BEND_LISTING })

    const afterNinety = listingIndexPolicy({
      status: 'Closed',
      listingPath: BEND_LISTING,
      offMarketAt: '2026-07-14T12:00:00.000Z',
      now: NOW,
    })
    expect(afterNinety.noindex).toBe(true)
  })

  it('treats a missing off-market date as stale so an undated Closed page cannot stay indexed', () => {
    expect(
      listingIndexPolicy({
        status: 'Closed',
        listingPath: BEND_LISTING,
        now: NOW,
      }).noindex,
    ).toBe(true)
    expect(listingIsStaleOffMarket(null, NOW)).toBe(true)
    expect(listingIsStaleOffMarket('not-a-date', NOW)).toBe(true)
  })

  it('points a stale Brasada listing at the Brasada Ranch community page', () => {
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
        cityHref: ctx.city?.href,
        offMarketAt: '2026-01-01',
        now: NOW,
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
        cityHref: ctx.city?.href,
        offMarketAt: '2026-01-01',
        now: NOW,
      }).canonicalPath,
    ).toBe('/communities/brasada-ranch')
  })

  it('falls back to the city hub when there is no community page', () => {
    expect(
      listingIndexPolicy({
        status: 'Withdrawn',
        listingPath: BEND_LISTING,
        communityHref: null,
        cityHref: '/cities/bend',
        offMarketAt: '2026-01-01',
        now: NOW,
      }),
    ).toEqual({
      noindex: true,
      canonicalPath: '/cities/bend',
    })
  })

  it('does not let a community or city href move an on-market listing canonical', () => {
    expect(
      listingIndexPolicy({
        status: 'Active',
        listingPath: BRASADA_LISTING,
        communityHref: '/communities/brasada-ranch',
        cityHref: '/cities/powell-butte',
      }).canonicalPath,
    ).toBe(BRASADA_LISTING)
  })

  it('does not treat Pending as off market', () => {
    expect(
      listingIndexPolicy({
        status: 'Pending',
        listingPath: '/homes-for-sale/bend/tetherow/1-main-220000001',
        communityHref: '/communities/tetherow',
        offMarketAt: '2020-01-01',
        now: NOW,
      }),
    ).toEqual({
      noindex: false,
      canonicalPath: '/homes-for-sale/bend/tetherow/1-main-220000001',
    })
  })

  it('keeps listings.xml on Active, Active Under Contract, and Pending only', () => {
    expect([...LISTING_SITEMAP_STATUSES].sort()).toEqual([
      'Active',
      'Active Under Contract',
      'Pending',
    ])
    for (const status of ['Closed', 'Expired', 'Canceled', 'Withdrawn', 'Coming Soon']) {
      expect(LISTING_SITEMAP_STATUSES).not.toContain(status)
    }
  })
})

describe('listingOffMarketAnchor + age helpers', () => {
  it('prefers CloseDate and falls back to ModificationTimestamp', () => {
    expect(
      listingOffMarketAnchor({ closeDate: '2026-05-01', modifiedAt: '2026-09-01' }),
    ).toBe('2026-05-01')
    expect(listingOffMarketAnchor({ closeDate: null, modifiedAt: '2026-09-01' })).toBe('2026-09-01')
    expect(listingOffMarketAnchor({ closeDate: null, modifiedAt: null })).toBeNull()
  })

  it('counts age from the off-market date and holds the 90-day constant', () => {
    expect(OFF_MARKET_NOINDEX_AFTER_DAYS).toBe(90)
    expect(listingOffMarketAgeMs('2026-07-14T12:00:00.000Z', NOW)).toBe(91 * 24 * 60 * 60 * 1000)
    expect(listingIsStaleOffMarket('2026-07-15T12:00:00.000Z', NOW)).toBe(false)
    expect(listingIsStaleOffMarket('2026-07-14T12:00:00.000Z', NOW)).toBe(true)
  })

  it('prefers a community hub over a city hub', () => {
    expect(
      listingHubCanonicalPath({
        listingPath: BEND_LISTING,
        communityHref: '/communities/tetherow',
        cityHref: '/cities/bend',
      }),
    ).toBe('/communities/tetherow')
  })
})
