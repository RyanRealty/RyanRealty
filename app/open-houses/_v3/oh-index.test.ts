import { describe, it, expect } from 'vitest'
import type { UpcomingOpenHouseRow } from '@/lib/data'
import type { ListingTile } from '@/lib/data/types/listing'
import { citySlugForScope } from '@/lib/central-oregon'
import { assembleOpenHouses } from './oh-listings'
import { citySlugsWithOpenHouses } from './oh-index'

const row = (listing_key: string): UpcomingOpenHouseRow => ({
  id: `${listing_key}-2026-10-18-13:00:00`,
  open_house_key: `${listing_key}-2026-10-18`,
  listing_key,
  event_date: '2026-10-18',
  start_time: '13:00:00',
  end_time: '15:00:00',
  host_agent_name: null,
  remarks: null,
  rsvp_count: 0,
})
const tile = (listingKey: string, city: string | null): ListingTile =>
  ({ listingKey, city, listPrice: 600_000, streetNumber: '1', streetName: 'Pine' }) as ListingTile

// L1 Bend, L2 Black Butte Ranch, L3 has no tile (the page drops it), L4's tile has no city.
const rows = [row('L1'), row('L2'), row('L3'), row('L4')]
const tiles = [tile('L1', 'Bend'), tile('L2', 'Black Butte Ranch'), tile('L4', null)]

describe('citySlugsWithOpenHouses (the sitemap reads the city pages the way they read themselves)', () => {
  it('names each city with an assembled open house, by its route slug', () => {
    expect([...citySlugsWithOpenHouses(rows, tiles)].sort()).toEqual(['bend', 'black-butte-ranch'])
  })

  it("agrees with the page's own count for every city: indexable exactly when the page lists a home", () => {
    const slugs = citySlugsWithOpenHouses(rows, tiles)
    for (const city of ['Bend', 'Black Butte Ranch', 'Brothers', 'Redmond']) {
      const pageCount = assembleOpenHouses(rows, tiles, new Map(), { city }).length
      expect([city, slugs.has(citySlugForScope(city))]).toEqual([city, pageCount > 0])
    }
  })

  it('an empty calendar indexes no city page', () => {
    expect(citySlugsWithOpenHouses([], tiles).size).toBe(0)
  })
})
