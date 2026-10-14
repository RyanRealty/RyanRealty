import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { listingIdFromRequestPath } from '@/lib/routing/listing-canonical-hop'
import { pageMetadata } from '@/lib/site/page-metadata'
import {
  listingHasSharePhoto,
  listingOgImagePath,
  listingShareCardLines,
  listingShareOgTitle,
} from '@/lib/og/listing-share'

const EVIE = {
  listingKey: '20260824231914656196000000',
  listNumber: '220227635',
  status: 'Active',
  listPrice: 634_900,
  closePrice: null,
  propertyType: 'A',
  propertySubType: 'Single Family Residence',
  subdivisionName: 'Acapella',
  city: 'Bend',
  postalCode: '97702',
  streetNumber: '61637',
  streetDirPrefix: 'SE',
  streetName: 'Evie',
  streetSuffix: 'Drive',
  beds: 4,
  baths: 3,
  photoUrl: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/hero.jpg',
}

describe('listingShareOgTitle', () => {
  it('is address · price · beds/baths for an active home', () => {
    expect(listingShareOgTitle(EVIE)).toBe(
      '61637 SE Evie Drive, Bend, OR 97702 · $634,900 · 4 bed, 3 bath',
    )
  })

  it('leads a sold home with Sold and the close price, never the ask', () => {
    expect(
      listingShareOgTitle({
        ...EVIE,
        status: 'Closed',
        listPrice: 1_250_000,
        closePrice: 1_100_000,
        addressTitle: '55550 Heidi Court, Bend, OR 97701',
        beds: 3,
        baths: 3,
      }),
    ).toBe('Sold · 55550 Heidi Court, Bend, OR 97701 · $1,100,000 · 3 bed, 3 bath')
  })

  it('omits a missing price or room instead of inventing one', () => {
    expect(
      listingShareOgTitle({
        ...EVIE,
        listPrice: null,
        beds: null,
        baths: 2,
      }),
    ).toBe('61637 SE Evie Drive, Bend, OR 97702 · 2 bath')
  })
})

describe('listing share card + image', () => {
  it('puts the street on the card and the price on the second line', () => {
    expect(listingShareCardLines(EVIE)).toEqual({
      title: '61637 SE Evie Drive',
      subtitle: '$634,900 · 4 bed, 3 bath',
    })
  })

  it('emits a listing og:image only when the listing has a hero photo', () => {
    expect(listingHasSharePhoto(EVIE.photoUrl)).toBe(true)
    expect(listingOgImagePath(EVIE)).toBe(
      `/api/og?type=listing&id=${encodeURIComponent(EVIE.listingKey)}`,
    )
    expect(listingHasSharePhoto(null)).toBe(false)
    expect(listingOgImagePath({ listingKey: EVIE.listingKey, photoUrl: null })).toBeUndefined()
  })

  it('pageMetadata uses the listing card, not the default aerial, when a photo exists', () => {
    const meta = pageMetadata({
      title: '61637 SE Evie Drive, Bend, OR 97702',
      ogTitle: listingShareOgTitle(EVIE),
      description: '$634,900 · 4 bed, 3 bath · Acapella, Bend.',
      path: '/homes-for-sale/bend/acapella/61637-evie-220227635',
      ogImage: listingOgImagePath(EVIE),
    })
    const image = Array.isArray(meta.openGraph?.images) ? meta.openGraph.images[0] : null
    const url = image && typeof image === 'object' && 'url' in image ? String(image.url) : ''
    expect(url).toMatch(/^https:\/\/ryan-realty\.com\/api\/og\?type=listing&id=20260824231914656196000000/)
    expect(url).not.toMatch(/type=default/)
    expect(meta.openGraph?.title).toBe(
      '61637 SE Evie Drive, Bend, OR 97702 · $634,900 · 4 bed, 3 bath',
    )
    expect(meta.twitter && 'title' in meta.twitter ? meta.twitter.title : '').toBe(
      '61637 SE Evie Drive, Bend, OR 97702 · $634,900 · 4 bed, 3 bath',
    )
  })

  it('pageMetadata falls back to the default card only when the listing has no photo', () => {
    const meta = pageMetadata({
      title: '1 Oak, Bend',
      description: 'A home with no MLS photo.',
      path: '/listing/220000001',
      ogImage: listingOgImagePath({ listingKey: 'k', photoUrl: null }),
    })
    const image = Array.isArray(meta.openGraph?.images) ? meta.openGraph.images[0] : null
    const url = image && typeof image === 'object' && 'url' in image ? String(image.url) : ''
    expect(url).toMatch(/\/api\/og\?type=default/)
  })
})

describe('listing URL shapes and social crawlers', () => {
  it('reads the listing id from every public listing URL shape', () => {
    expect(listingIdFromRequestPath('/listing/220227635')).toBe('220227635')
    expect(listingIdFromRequestPath('/listing/20260824231914656196000000')).toBe(
      '20260824231914656196000000',
    )
    expect(listingIdFromRequestPath('/listing/by-address/bend/acapella/61637-evie-220227635')).toBe(
      '220227635',
    )
    expect(listingIdFromRequestPath('/homes-for-sale/bend/acapella/61637-evie-220227635')).toBe(
      '220227635',
    )
    expect(listingIdFromRequestPath('/homes-for-sale/bend/61637-evie-220227635')).toBe('220227635')
  })

  it('lets facebookexternalhit and the other social unfurlers through the bot screen', () => {
    const middleware = readFileSync('middleware.ts', 'utf8')
    expect(middleware).toMatch(/const GOOD_BOT_RE =/)
    for (const ua of [
      'facebookexternalhit',
      'facebookcatalog',
      'twitterbot',
      'linkedinbot',
      'slackbot',
      'whatsapp',
      'discordbot',
      'applebot',
    ]) {
      expect(middleware, ua).toMatch(new RegExp(ua, 'i'))
    }
    expect(middleware).toMatch(/if \(GOOD_BOT_RE\.test\(ua\)\) return null/)
    expect(middleware).toMatch(/Bot \/ geo screening/)
    expect(middleware).toMatch(/Listing canonical hop/)
  })

  it('listing generateMetadata and /api/og resolve ListNumber or ListingKey and require a photo', () => {
    const page = readFileSync('app/listing/[listingKey]/page.tsx', 'utf8')
    const route = readFileSync('app/api/og/route.tsx', 'utf8')
    expect(page).toContain('listingShareOgTitle')
    expect(page).toContain('listingOgImagePath')
    expect(page).not.toMatch(/ogImage: `\/api\/og\?type=listing/)
    expect(route).toContain('getListingLookup')
    expect(route).toContain('listingHasSharePhoto')
    expect(route).toContain('listingShareCardLines')
    expect(route).not.toContain('getListingTiles')
  })
})
