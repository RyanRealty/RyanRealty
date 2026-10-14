import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpcomingOpenHouseRow } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'

const dal = vi.hoisted(() => ({
  getUpcomingOpenHouses: vi.fn(),
  getListingTiles: vi.fn(),
}))

vi.mock('@/lib/data', () => dal)

import {
  OH_WINDOW_DAYS_AHEAD,
  canonicalOpenHouseWindow,
  loadIndexableOpenHouseCitySlugs,
  openHouseCityDecision,
} from './oh-city-indexable'

function row(listingKey: string, over: Partial<UpcomingOpenHouseRow> = {}): UpcomingOpenHouseRow {
  return {
    id: `${listingKey}-2026-10-17-10:00:00`,
    open_house_key: `${listingKey}-2026-10-17`,
    listing_key: listingKey,
    event_date: '2026-10-17',
    start_time: '10:00:00',
    end_time: '12:00:00',
    host_agent_name: null,
    remarks: null,
    rsvp_count: 0,
    ...over,
  }
}

function tile(listingKey: string, city: string | null): ListingTile {
  return {
    listingKey,
    listNumber: `2200${listingKey.replace(/\D/g, '')}`,
    status: 'Active',
    listPrice: 650_000,
    closePrice: null,
    closeDate: null,
    beds: 3,
    baths: 2,
    sqft: 1_900,
    streetNumber: '123',
    streetName: 'Pine',
    city,
    citySlug: null,
    postalCode: null,
    subdivisionName: null,
    subdivisionSlug: null,
    lat: null,
    lng: null,
    photoUrl: null,
    propertyType: 'A',
    propertySubType: null,
    onMarketDate: null,
    modifiedAt: null,
    pricePerSqft: null,
    lotSizeAcres: null,
    yearBuilt: null,
    garageSpaces: null,
    poolYn: null,
    hasVirtualTour: null,
    tourUrl: null,
    dom: null,
    priceDropCount: null,
    addressSlug: null,
    boundaryCity: null,
    boundaryNeighborhood: null,
    boundarySubdivision: null,
  } as unknown as ListingTile
}

const NO_HEROES = new Map<string, string>()

beforeEach(() => {
  dal.getUpcomingOpenHouses.mockReset()
  dal.getListingTiles.mockReset()
})

describe('canonicalOpenHouseWindow', () => {
  it('is today through six days out', () => {
    expect(OH_WINDOW_DAYS_AHEAD).toBe(6)
    expect(canonicalOpenHouseWindow('2026-10-14')).toEqual({
      dateFromIso: '2026-10-14',
      dateToIso: '2026-10-20',
      todayIso: '2026-10-14',
    })
  })

  it('rolls across a month and a year', () => {
    expect(canonicalOpenHouseWindow('2026-10-28').dateToIso).toBe('2026-11-03')
    expect(canonicalOpenHouseWindow('2026-12-29').dateToIso).toBe('2027-01-04')
  })
})

describe('openHouseCityDecision', () => {
  const rows = [row('L1'), row('L2'), row('L3')]
  const tiles = [tile('L1', 'Bend'), tile('L2', 'Bend'), tile('L3', 'Redmond')]

  it('counts the open houses whose tile is in the city and calls it indexable', () => {
    expect(openHouseCityDecision(rows, tiles, NO_HEROES, 'Bend')).toEqual({ count: 2, indexable: true })
    expect(openHouseCityDecision(rows, tiles, NO_HEROES, 'Redmond')).toEqual({ count: 1, indexable: true })
  })

  it('is not indexable for a city with no open house in the rows', () => {
    expect(openHouseCityDecision(rows, tiles, NO_HEROES, 'Brothers')).toEqual({ count: 0, indexable: false })
    expect(openHouseCityDecision([], [], NO_HEROES, 'Bend')).toEqual({ count: 0, indexable: false })
  })

  it('does not count a row whose tile is missing or has no city', () => {
    expect(openHouseCityDecision([row('L9')], [], NO_HEROES, 'Bend').indexable).toBe(false)
    expect(openHouseCityDecision([row('L9')], [tile('L9', null)], NO_HEROES, 'Bend').indexable).toBe(false)
  })

  it('does not let heroes change the answer', () => {
    const heroes = new Map([['L1', 'https://cdn.example/l1.jpg']])
    expect(openHouseCityDecision(rows, tiles, heroes, 'Bend')).toEqual(
      openHouseCityDecision(rows, tiles, NO_HEROES, 'Bend'),
    )
  })

  it('matches the city name exactly, as the page filter does', () => {
    expect(openHouseCityDecision(rows, tiles, NO_HEROES, 'bend').indexable).toBe(false)
  })
})

describe('loadIndexableOpenHouseCitySlugs', () => {
  it('reads the region once, for the canonical window, with no city argument', async () => {
    dal.getUpcomingOpenHouses.mockResolvedValue([row('L1'), row('L2')])
    dal.getListingTiles.mockResolvedValue([tile('L1', 'Bend'), tile('L2', 'La Pine')])

    const slugs = await loadIndexableOpenHouseCitySlugs('2026-10-14')

    expect(dal.getUpcomingOpenHouses).toHaveBeenCalledTimes(1)
    expect(dal.getUpcomingOpenHouses).toHaveBeenCalledWith({
      dateFromIso: '2026-10-14',
      dateToIso: '2026-10-20',
      todayIso: '2026-10-14',
    })
    expect(dal.getListingTiles).toHaveBeenCalledTimes(1)
    expect(dal.getListingTiles).toHaveBeenCalledWith({
      listingKeys: ['L1', 'L2'],
      status: 'all',
      limit: 500,
    })
    expect([...slugs].sort()).toEqual(['bend', 'la-pine'])
  })

  it('lists a city only when it has an open house, so Brothers and Black Butte Ranch are out', async () => {
    dal.getUpcomingOpenHouses.mockResolvedValue([row('L1')])
    dal.getListingTiles.mockResolvedValue([tile('L1', 'Bend')])

    const slugs = await loadIndexableOpenHouseCitySlugs('2026-10-14')

    expect(slugs.has('bend')).toBe(true)
    expect(slugs.has('brothers')).toBe(false)
    expect(slugs.has('black-butte-ranch')).toBe(false)
  })

  it('slugs a multi-word city the way the sitemap slugs its cities', async () => {
    dal.getUpcomingOpenHouses.mockResolvedValue([row('L1')])
    dal.getListingTiles.mockResolvedValue([tile('L1', 'Black Butte Ranch')])

    expect([...(await loadIndexableOpenHouseCitySlugs('2026-10-14'))]).toEqual(['black-butte-ranch'])
  })

  it('returns nothing, and reads no tiles, when no open house is in the window', async () => {
    dal.getUpcomingOpenHouses.mockResolvedValue([])

    expect((await loadIndexableOpenHouseCitySlugs('2026-10-14')).size).toBe(0)
    expect(dal.getListingTiles).not.toHaveBeenCalled()
  })

  it('returns nothing when the tile read came back empty (a failed read is not indexable)', async () => {
    dal.getUpcomingOpenHouses.mockResolvedValue([row('L1')])
    dal.getListingTiles.mockResolvedValue([])

    expect((await loadIndexableOpenHouseCitySlugs('2026-10-14')).size).toBe(0)
  })

  it('lets a rejected read reject, so the sitemap leg can fall back to the empty set', async () => {
    dal.getUpcomingOpenHouses.mockRejectedValue(new Error('statement timeout'))

    await expect(loadIndexableOpenHouseCitySlugs('2026-10-14')).rejects.toThrow('statement timeout')
  })

  it('asks for every tile when more than 500 homes have an open house', async () => {
    const rows = Array.from({ length: 730 }, (_, i) => row(`L${i}`))
    dal.getUpcomingOpenHouses.mockResolvedValue(rows)
    dal.getListingTiles.mockResolvedValue(rows.map((r) => tile(r.listing_key, 'Bend')))

    await loadIndexableOpenHouseCitySlugs('2026-10-14')

    const filter = dal.getListingTiles.mock.calls[0]?.[0] as { listingKeys: string[]; limit: number }
    expect(filter.listingKeys).toHaveLength(730)
    expect(filter.limit).toBe(730)
  })

  it('reads each listing key once when a home has several open houses', async () => {
    dal.getUpcomingOpenHouses.mockResolvedValue([row('L1'), row('L1', { id: 'x', event_date: '2026-10-18' })])
    dal.getListingTiles.mockResolvedValue([tile('L1', 'Sisters')])

    await loadIndexableOpenHouseCitySlugs('2026-10-14')

    expect((dal.getListingTiles.mock.calls[0]?.[0] as { listingKeys: string[] }).listingKeys).toEqual(['L1'])
  })

  // The page reads rows for ONE city (getUpcomingOpenHouses({ city })), the
  // sitemap reads the whole region. Same decision function, so for every city
  // the batch must agree with the page's own per-city answer.
  it('agrees with the page decision for every city, city-scoped read or region read', async () => {
    const listingCity: Record<string, string> = {
      L1: 'Bend',
      L2: 'Bend',
      L3: 'Redmond',
      L4: 'Sisters',
    }
    const regionRows = Object.keys(listingCity).map((k) => row(k))
    const regionTiles = Object.entries(listingCity).map(([k, c]) => tile(k, c))
    dal.getUpcomingOpenHouses.mockResolvedValue(regionRows)
    dal.getListingTiles.mockResolvedValue(regionTiles)

    const slugs = await loadIndexableOpenHouseCitySlugs('2026-10-14')

    const cities: Array<[name: string, slug: string]> = [
      ['Bend', 'bend'],
      ['Redmond', 'redmond'],
      ['Sisters', 'sisters'],
      ['Sunriver', 'sunriver'],
      ['Brothers', 'brothers'],
      ['Black Butte Ranch', 'black-butte-ranch'],
    ]
    for (const [name, slug] of cities) {
      // What the page loads: the DAL's `City = name` rows and the tiles for those keys.
      const pageRows = regionRows.filter((r) => listingCity[r.listing_key] === name)
      const pageTiles = regionTiles.filter((t) => t.city === name)
      const page = openHouseCityDecision(pageRows, pageTiles, NO_HEROES, name)
      expect(slugs.has(slug), `${name}: sitemap set vs page decision`).toBe(page.indexable)
    }
  })
})

describe('both callers use the one decision', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

  it('the city page decides robots through openHouseCityDecision, not its own count', () => {
    const page = read('app/open-houses/[city]/page.tsx')
    const metadata = page.slice(page.indexOf('export async function generateMetadata'), page.indexOf('type SearchParams'))
    expect(metadata).toContain('openHouseCityDecision(')
    expect(metadata).not.toContain('assembleOpenHouses(')
    expect(metadata).toContain('canonicalOpenHouseWindow(')
  })

  it('the sitemap asks the batch that runs the same decision, and never seeds the city URLs', () => {
    const sitemap = read('app/sitemap.ts')
    expect(sitemap).toContain('loadIndexableOpenHouseCitySlugs')
    // The only /open-houses/{slug} emission is the one gated on the indexable set.
    const emissions = sitemap.match(/\$\{baseUrl\}\/open-houses\/\$\{\w+\}/g) ?? []
    expect(emissions).toHaveLength(1)
    expect(sitemap).toMatch(/if \(!indexableOpenHouseCities\.has\(slug\)\) continue\n\s+dynamicPages\.push\(\{ url: `\$\{baseUrl\}\/open-houses\/\$\{slug\}`/)
  })
})
