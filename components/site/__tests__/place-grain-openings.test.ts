import { describe, expect, it } from 'vitest'
import { communityImage } from '@/lib/geo-images'
import type { ListingTile } from '@/lib/data/types/listing'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import {
  nbhFieldItems,
  neighborhoodFieldCaption,
  neighborhoodMarketTrace,
} from '@/app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections'
import { dailyLifeRows } from '@/app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-daily-life'
import {
  belongingFigures,
  belongingHeadline,
  communityFieldItems,
  stagePoster,
} from '@/app/communities/[slug]/_v3/community-opening'
import { belongingLine, resortIndexRow } from '@/app/communities/_v3/community-index-rows'
import { homesLedgerTrace } from '@/app/subdivisions/[slug]/_v3/subdivision-traces'
import { platHomesMode, toLedgerRows, type FieldEntry } from '@/app/subdivisions/[slug]/_v3/subdivision-rows'

const links = {
  browse: '/homes-for-sale/bend',
  cityReport: '/housing-market/bend',
  monthsOfSupply: '/months-of-supply',
}

function tile(partial: Partial<ListingTile> & Pick<ListingTile, 'listingKey'>): ListingTile {
  return {
    listNumber: '220000001',
    listPrice: 500000,
    streetNumber: '100',
    streetName: 'Main',
    streetSuffix: 'St',
    city: 'Bend',
    photoUrl: null,
    lat: 44.05,
    lng: -121.3,
    beds: 3,
    baths: 2,
    sqft: 1800,
    subdivisionName: 'Tetherow',
    ...partial,
  } as ListingTile
}

describe('neighborhood pace', () => {
  // The pulse-figure builders (liveFigures, liveFallbackFigures) are gone with
  // the 2026-08-26 barrel migration: neighborhood is a sold-attribution
  // UNTRUSTED grain (lib/market/geo-grain-trust.ts), so every market figure
  // now comes off leftoverHudKpis through the shared leftoverMarketFigures
  // builder, whose MoS is already publish-gated upstream. What is tested here
  // is what stayed neighborhood-shaped: the Field rows, the caption's grain,
  // and the trace's clause discipline.

  it('caption names the neighborhood and states the cap when it binds', () => {
    expect(
      neighborhoodFieldCaption({ placeName: 'Awbrey Butte', count: 24, totalQualifying: 62 }),
    ).toBe('The 24 highest-priced single-family listings in Awbrey Butte')
    expect(
      neighborhoodFieldCaption({ placeName: 'Awbrey Butte', count: 9, totalQualifying: 9 }),
    ).toBe('9 single-family homes for sale in Awbrey Butte')
    expect(neighborhoodFieldCaption({ placeName: 'Awbrey Butte', count: 0, totalQualifying: 0 })).toBeNull()
  })

  it('recites the MoS clauses only beside a published supply figure', () => {
    const withMos = neighborhoodMarketTrace('Awbrey Butte', true)
    const withoutMos = neighborhoodMarketTrace('Awbrey Butte', false)
    expect(withMos).toMatch(/Months of supply/)
    expect(withoutMos).not.toMatch(/seller's|buyer's|balanced|threshold/)
    expect(withoutMos).toMatch(/Awbrey Butte/)
  })

  it('keeps the counted set even when a tile has no photograph', () => {
    const items = nbhFieldItems([
      {
        listingKey: 'a',
        listNumber: '1',
        listPrice: 800_000,
        beds: 3,
        baths: 2,
        sqft: 1800,
        streetNumber: '10',
        streetName: 'Pine',
        city: 'Bend',
        subdivisionName: 'Awbrey Butte',
        photoUrl: 'https://img.example/house.jpg',
        lat: 44.1,
        lng: -121.3,
      },
      {
        listingKey: 'b',
        listNumber: '2',
        listPrice: 900_000,
        beds: 4,
        baths: 3,
        sqft: 2200,
        streetNumber: '11',
        streetName: 'Pine',
        city: 'Bend',
        subdivisionName: 'Awbrey Butte',
        photoUrl: null,
        lat: 44.1,
        lng: -121.3,
      },
    ])
    // Both qualify (price + street). Highest price first; the photo rides when
    // it exists and its absence never drops a counted home.
    expect(items).toHaveLength(2)
    expect(items[0]?.title).toBe('11 Pine, Bend')
    expect(items[0]?.photoSrc).toBeUndefined()
    expect(items[1]?.photoSrc).toBe('https://img.example/house.jpg')
    expect(items[1]?.title).toBe('10 Pine, Bend')
  })

  it('drops a home with no list price or no street', () => {
    const items = nbhFieldItems([
      {
        listingKey: 'a',
        listNumber: '1',
        listPrice: null,
        beds: 3,
        baths: 2,
        sqft: 1800,
        streetNumber: '10',
        streetName: 'Pine',
        city: 'Bend',
        subdivisionName: 'Awbrey Butte',
        photoUrl: null,
        lat: 44.1,
        lng: -121.3,
      },
    ])
    expect(items).toEqual([])
  })
})

describe('neighborhood daily life', () => {
  it('opens Awbrey Butte on schools and parks, not golf membership', async () => {
    const content = await getResortCommunityContent('bend-awbrey-butte')
    const rows = dailyLifeRows(content, 'Bend')
    const names = rows.map((row) => String(row.what))
    expect(names).toContain('High Lakes Elem')
    expect(names).toContain('Cascade Middle')
    expect(names).toContain('Summit High')
    expect(names).toContain('Sylvan Park')
    expect(names).toContain('Summit Park')
    expect(names.some((name) => /golf|membership/i.test(name))).toBe(false)
    expect(rows.find((row) => String(row.what) === 'Sylvan Park')?.href).toBe('/parks')
    expect(rows.find((row) => String(row.what) === 'High Lakes Elem')?.href).toBe('/schools/high-lakes-elem')
  })
})

describe('master-plan opening', () => {
  const content = {
    membershipTiers: [{ name: 'Golf' }, { name: 'Social' }],
    hoaMasterAnnual: 2400,
    acres: 700,
    amenities: [{ name: 'Golf course' }],
  } as ResortCommunityContent

  it('uses the owned Tetherow aerial, never an invented photo', () => {
    const owned = communityImage('tetherow')
    expect(owned).toBeTruthy()
    expect(owned).toMatch(/tetherow/)
    expect(stagePoster('tetherow')).toBe(owned)
    expect(stagePoster('no-such-community')).toBeNull()
    expect(stagePoster('tetherow', 'https://cdn.example/live.jpg')).toBe('https://cdn.example/live.jpg')
    expect(stagePoster('no-such-community', 'https://cdn.example/live.jpg')).toBe(
      'https://cdn.example/live.jpg',
    )
    expect(stagePoster('tetherow', null, 'https://cdn.example/library.jpg')).toBe(
      'https://cdn.example/library.jpg',
    )
    expect(stagePoster('tetherow', 'https://cdn.example/live.jpg', 'https://cdn.example/library.jpg')).toBe(
      'https://cdn.example/live.jpg',
    )
    expect(
      stagePoster(
        'tetherow',
        'https://cdn.example/etherow-monument-crop.jpg',
        'https://cdn.example/imagine-place-community-tetherow.png',
      ),
    ).toBe('https://cdn.example/imagine-place-community-tetherow.png')
  })

  it('names the place in the heading and leaves belonging to the figures', () => {
    // The H1 is the community's name, the same shape every other place grain
    // uses. It must never be a belonging fact: this page headlined "Master HOA
    // is $4,380 a year." on Caldera Springs and "Membership is separate from
    // the home." on Tetherow and Black Butte Ranch, live (Matt 2026-08-27).
    expect(belongingHeadline('Tetherow', content)).toBe('Tetherow homes for sale')
    expect(belongingHeadline('Caldera Springs', content)).toBe('Caldera Springs homes for sale')
    expect(belongingHeadline('Black Butte Ranch', null)).toBe('Black Butte Ranch homes for sale')
    // the belonging facts are still published — beside the heading, as figures
    expect(belongingFigures(content).map((figure) => figure.label)).toEqual([
      'master HOA a year',
      'membership tiers',
      'acres',
    ])
  })

  it('keeps the counted set even when a tile has no photograph', () => {
    const items = communityFieldItems(
      [tile({ listingKey: 'a', photoUrl: null }), tile({ listingKey: 'b', photoUrl: 'https://img.example/h.jpg' })],
      24,
    )
    expect(items).toHaveLength(2)
    expect(items[0]?.photoSrc).toBeUndefined()
    expect(items[1]?.photoSrc).toBe('https://img.example/h.jpg')
  })
})

describe('communities index rows', () => {
  it('puts belonging in the row, not a home count', () => {
    const content = {
      membershipTiers: [{ name: 'Golf membership' }],
      amenities: [{ name: '18-hole course' }],
    } as ResortCommunityContent
    expect(belongingLine(content)).toBe('Golf membership. 18-hole course.')
    const row = resortIndexRow({
      slug: 'tetherow',
      name: 'Tetherow',
      city: 'Bend',
      belonging: belongingLine(content),
      photoSrc: communityImage('tetherow'),
    })
    expect(row?.what).toBe('Tetherow')
    expect(row?.detail).toBe('Golf membership. 18-hole course.')
    expect(row?.href).toBe('/communities/tetherow')
    expect(row && 'value' in row).toBe(false)
  })
})

describe('subdivision ledger', () => {
  it('treats a timed-out count as unknown, not a giant zero', () => {
    expect(platHomesMode({ activeCount: null, homeRows: 0, pinCount: 0 })).toBe('unknown')
    expect(platHomesMode({ activeCount: 0, homeRows: 0, pinCount: 0 })).toBe('empty')
    expect(platHomesMode({ activeCount: 6, homeRows: 6, pinCount: 6 })).toBe('field')
    expect(platHomesMode({ activeCount: 2, homeRows: 2, pinCount: 2 })).toBe('ledger')
  })

  it('keeps address and price as the row, with a photo when one exists', () => {
    const item: FieldEntry = {
      id: 'a',
      href: '/homes-for-sale/listing/1',
      title: '12 Sunrise Loop',
      priceLabel: '$895,000',
      meta: '3 bd · 2 ba',
      photoSrc: 'https://img.example/h.jpg',
      lat: 44.1,
      lng: -121.3,
    }
    const [row] = toLedgerRows([item])
    expect(row?.what).toBe('12 Sunrise Loop')
    expect(row?.value).toBe('$895,000')
    expect(row?.media?.src).toBe('https://img.example/h.jpg')
  })

  it('keeps the homes trace to one line without methodology thresholds', () => {
    const trace = homesLedgerTrace({ kind: 'boundary', displayName: 'Sunrise Village' })
    expect(trace).toMatch(/Sunrise Village/)
    expect(trace.split('.').length).toBeLessThanOrEqual(3)
    expect(trace).not.toMatch(/methodology|threshold|seller's|buyer's/)
  })
})
