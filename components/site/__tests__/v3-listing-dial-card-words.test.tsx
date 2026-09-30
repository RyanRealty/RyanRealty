/**
 * What a dial card SAYS about a listing, held to the listing's own row
 * (CLAUDE.md section 0), from the 2026-09-25 integration of the dial rollout.
 *
 * 1. The tour control. Every dial card read "3D Walkthrough", the in-card
 *    tour's hard-coded default, including a listing whose tour URL is a Vimeo
 *    walkthrough reel. The card now reads the tour type off the URL with the
 *    listing page's own classifier and prints the listing page's own words
 *    (its gallery pills): "Video Tour" for a walkthrough, "3D" for a 3D tour.
 * 2. The status word. The homepage shelves called Active Under Contract
 *    "Pending" while the place cards and the counts over them said "under
 *    contract". Every dial card prints publicCardStatusLabel now.
 * 3. The first paint. `priority` makes the first card's photograph eager
 *    (only where the dial is the page's first large image); without it every
 *    photograph in a dial is lazy.
 *
 * Server markup (renderToStaticMarkup): what a crawler and a first paint get.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3ListingDial, type V3ListingDialItem } from '@/components/site/v3/V3ListingDial.client'
import {
  LISTING_3D_TOUR_LABEL,
  LISTING_VIDEO_TOUR_LABEL,
  publishListingTourLabel,
  publishTourEmbedFromUrl,
} from '@/lib/listing/publish-listing-hero-video'
import { publishListingGalleryMobilePills } from '@/lib/listing/publish-listing-mosaic-pills'
import { publicCardStatusLabel, publicCountState } from '@/lib/listing-status-public'
import { publishListingStatusBadge } from '@/lib/search/publish-search-status'
import { homeRailRows, listingRowFromRailCard, railCardFromListingRow } from '@/app/_v3/home-rail-items'
import { placeStockRowFromTile } from '@/lib/place/place-inventory-stock'
import type { ListingTile } from '@/lib/data/types/listing'

const VIMEO_WALKTHROUGH = 'https://vimeo.com/1012345678/abcdef1234'
const YOUTUBE_WALKTHROUGH = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const MP4_WALKTHROUGH = 'https://cdn.example.com/walkthrough.mp4'
const MATTERPORT = 'https://my.matterport.com/show/?m=AbCdEf12345'
const ZILLOW_3D = 'https://www.zillow.com/view-imx/eef1afae-a710-4791-92a6-49dafe8d75d3?initialViewType=pano'

function item(over: Partial<V3ListingDialItem> & Pick<V3ListingDialItem, 'listingKey'>): V3ListingDialItem {
  return {
    href: `/homes-for-sale/bend/${over.listingKey}`,
    photoUrl: `https://cdn.resize.sparkplatform.com/ore/800x600/true/${over.listingKey}-o.jpg`,
    price: 649_000,
    addressLine: '1234 NW Portland Ave',
    cityLine: 'Bend 97703',
    beds: 3,
    baths: 2,
    sqft: 1_850,
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    subdivisionName: null,
    city: 'Bend',
    listNumber: '220200001',
    ...over,
  }
}

function tourLabelIn(html: string): string | null {
  return html.match(/class="v3-lrow__tour-label">([^<]*)</)?.[1] ?? null
}

function dial(listings: V3ListingDialItem[], extra: { priority?: boolean } = {}) {
  return renderToStaticMarkup(<V3ListingDial id="d" label="Homes" listings={listings} {...extra} />)
}

describe('the tour control names the listing’s own tour type, in the listing page’s words', () => {
  it.each([
    [VIMEO_WALKTHROUGH, LISTING_VIDEO_TOUR_LABEL],
    [YOUTUBE_WALKTHROUGH, LISTING_VIDEO_TOUR_LABEL],
    [MP4_WALKTHROUGH, LISTING_VIDEO_TOUR_LABEL],
    [MATTERPORT, LISTING_3D_TOUR_LABEL],
    [ZILLOW_3D, LISTING_3D_TOUR_LABEL],
  ])('%s reads "%s" on the card', (url, label) => {
    expect(publishListingTourLabel(url)).toBe(label)
    expect(tourLabelIn(dial([item({ listingKey: 'a', tourUrl: url, hasTour: true })]))).toBe(label)
  })

  it('prints exactly the words the listing page’s gallery pill prints for the same tour', () => {
    for (const url of [VIMEO_WALKTHROUGH, MP4_WALKTHROUGH, MATTERPORT, ZILLOW_3D]) {
      const pills = publishListingGalleryMobilePills({ photoCount: 1, videos: [publishTourEmbedFromUrl(url)!] })
      const media = pills.filter((p) => p.id === 'video' || p.id === 'tour').map((p) => p.label)
      expect(media).toEqual([publishListingTourLabel(url)])
    }
  })

  it('never calls a walkthrough a 3D tour, and prints no tour control without a tour', () => {
    const walkthrough = dial([item({ listingKey: 'a', tourUrl: VIMEO_WALKTHROUGH, hasTour: true })])
    expect(walkthrough).not.toContain('3D Walkthrough')
    expect(walkthrough).not.toMatch(/v3-lrow__tour-label">3D</)
    expect(publishListingTourLabel(null)).toBeNull()
    expect(publishListingTourLabel('  ')).toBeNull()
    expect(tourLabelIn(dial([item({ listingKey: 'a' })]))).toBeNull()
  })

  it('a row that carries its label keeps it; the rail cards carry the derived one to the dial', () => {
    expect(tourLabelIn(dial([item({ listingKey: 'a', tourUrl: MATTERPORT, hasTour: true, tourLabel: 'Tour' })]))).toBe(
      'Tour',
    )
    const card = railCardFromListingRow(item({ listingKey: 'a', tourUrl: VIMEO_WALKTHROUGH, hasTour: true }))
    expect(card.tourLabel).toBe(LISTING_VIDEO_TOUR_LABEL)
    expect(listingRowFromRailCard(card).tourLabel).toBe(LISTING_VIDEO_TOUR_LABEL)
  })
})

function tile(over: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: '220000001',
    status: 'Active',
    listPrice: 500_000,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1_600,
    streetNumber: '100',
    streetName: 'Main',
    streetSuffix: 'St',
    city: 'Bend',
    citySlug: 'bend',
    postalCode: '97701',
    subdivisionName: null,
    subdivisionSlug: null,
    lat: 44.05,
    lng: -121.3,
    photoUrl: 'https://cdn.resize.sparkplatform.com/ore/800x600/true/a-o.jpg',
    propertyType: 'A',
    propertySubType: 'Single Family Residence',
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: 300,
    lotSizeAcres: null,
    yearBuilt: 2000,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: false,
    tourUrl: null,
    dom: 3,
    priceDropCount: 0,
    addressSlug: null,
    ...over,
  } as ListingTile
}

describe('one status word on every dial card', () => {
  it('publicCardStatusLabel names only what the public count holds', () => {
    expect(publicCardStatusLabel('Active')).toBeNull()
    expect(publicCardStatusLabel('Active Under Contract')).toBe('Under contract')
    expect(publicCardStatusLabel('Pending')).toBe('Pending')
    expect(publicCardStatusLabel('Closed')).toBe('Sold')
    for (const s of ['Coming Soon', 'Expired', 'Withdrawn', 'Canceled', '', null, undefined]) {
      expect(publicCardStatusLabel(s)).toBeNull()
    }
    // A word only for a listing the count puts under contract or sold.
    for (const s of ['Active', 'Active Under Contract', 'Pending', 'Closed', 'Coming Soon']) {
      expect(publicCardStatusLabel(s) != null).toBe(publicCountState(s) === 'under-contract' || publicCountState(s) === 'sold')
    }
  })

  it('agrees with the status badge on the photograph for every MLS status', () => {
    for (const s of ['Active', 'Active Under Contract', 'Pending', 'Closed']) {
      expect(publicCardStatusLabel(s)).toBe(publishListingStatusBadge(s)?.label ?? null)
    }
  })

  it('the homepage shelf and the place card print "Under contract" for Active Under Contract, never "Pending"', () => {
    const tiles = ['a', 'b', 'c'].map((k, i) =>
      tile({ listingKey: k, streetNumber: String(100 + i), status: i === 1 ? 'Active Under Contract' : 'Active' }),
    )
    const rows = homeRailRows(tiles, {
      nowMs: Date.now(),
      regionalHref: '/r',
      bendHref: '/b',
      priceCutsHref: '/p',
      newHref: '/n',
    })
    const shelfCard = rows.flatMap((r) => r.cards).find((c) => c.listingKey === 'b')!
    expect(shelfCard.statusLabel).toBe('Under contract')
    const placeRow = placeStockRowFromTile(tile({ listingKey: 'b', status: 'Active Under Contract' }))!
    expect(placeRow.statusLabel).toBe(shelfCard.statusLabel)

    const html = dial([
      listingRowFromRailCard(rows[0]!.cards.find((c) => c.listingKey !== 'b')!),
      listingRowFromRailCard(shelfCard),
    ])
    expect(html).not.toContain('Pending')
    const shown = renderToStaticMarkup(
      <V3ListingDial id="d" label="Homes" listings={[listingRowFromRailCard(shelfCard)]} />,
    )
    expect(shown).toContain('Under contract')
    expect(shown).not.toContain('Pending')
  })
})

describe('priority is the first card’s photograph only, and only when asked', () => {
  const listings = [item({ listingKey: 'a' }), item({ listingKey: 'b' }), item({ listingKey: 'c' })]

  const imgs = (html: string) => html.match(/<img\b[^>]*>/g) ?? []
  const eager = (html: string) => imgs(html).filter((tag) => !tag.includes('loading="lazy"'))

  it('without it every photograph in the dial is lazy', () => {
    const html = dial(listings)
    expect(imgs(html).length).toBeGreaterThan(1)
    expect(eager(html)).toEqual([])
  })

  it('with it the first card’s photograph alone is eager (next/image priority), the thumbnails stay lazy', () => {
    const html = dial(listings, { priority: true })
    const lead = eager(html)
    expect(lead).toHaveLength(1)
    expect(lead[0]).toContain('alt="1234 NW Portland Ave"')
    expect(lead[0]).toContain('/800x600/')
    for (const thumb of html.match(/<img class="v3-dial__thumb-img"[^>]*>/g) ?? []) {
      expect(thumb).toContain('loading="lazy"')
    }
  })
})
