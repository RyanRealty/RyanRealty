import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { placeListShowingLabel } from './place-list-showing'
import {
  CITY_PLACE_LIST_CAP,
  peerPlatsForResort,
  splitRowsFromTiles,
} from './subdivision-page-extras'

function tile(listingKey: string, price: number, extras: { lat?: number | null; subdivisionName?: string } = {}) {
  return {
    listingKey,
    listNumber: listingKey,
    listPrice: price,
    beds: 3,
    baths: 2,
    streetNumber: '1',
    streetName: listingKey,
    streetSuffix: 'Dr',
    city: 'Bend',
    subdivisionName: extras.subdivisionName ?? 'Tetherow',
    photoUrl: null,
    lat: extras.lat === undefined ? 44.03 : extras.lat,
    lng: extras.lat === undefined ? -121.36 : extras.lat == null ? null : -121.36,
  }
}

describe('splitRowsFromTiles', () => {
  it('lists the counted set, not a 24-home slice', () => {
    const tiles = Array.from({ length: 36 }, (_, i) => tile(`k${i}`, 1_000_000 + i))
    expect(splitRowsFromTiles(tiles)).toHaveLength(36)
  })

  it('keeps a tile that has no map pin so the count still matches', () => {
    const rows = splitRowsFromTiles([
      tile('with-pin', 900_000),
      tile('no-pin', 800_000, { lat: null }),
    ])
    expect(rows.map((r) => r.key)).toEqual(['with-pin', 'no-pin'])
  })

  it('caps only when the city page asks for a preview', () => {
    const tiles = Array.from({ length: 40 }, (_, i) => tile(`k${i}`, 1_000_000 + i))
    expect(splitRowsFromTiles(tiles, { cap: CITY_PLACE_LIST_CAP })).toHaveLength(24)
  })

  it('sorts highest price first so a city preview is the top of the set', () => {
    const rows = splitRowsFromTiles([tile('low', 100), tile('high', 900)])
    expect(rows.map((r) => r.key)).toEqual(['high', 'low'])
  })
})

describe('peerPlatsForResort', () => {
  it('withholds MLS abbreviations from More areas', () => {
    const peers = peerPlatsForResort('three-rivers', 'river-meadows')
    const names = peers.map((p) => p.name)
    expect(names).toContain('Sun Dance')
    expect(names).toContain('Deschutes River Recreation Homesites')
    expect(names.some((n) => /oww|drrh|bbr|stoneth/i.test(n))).toBe(false)
  })
})

describe('placeListShowingLabel', () => {
  it('is silent when the list is the counted set', () => {
    expect(placeListShowingLabel(35, 35)).toBeNull()
  })

  it('names the slice when the city preview is shorter than the count', () => {
    expect(placeListShowingLabel(24, 1840)).toBe('Showing 24 of 1,840 homes')
  })
})

describe('place list wiring', () => {
  it('does not silently slice the dual-pane list in the client', () => {
    const src = readFileSync('components/site/explore/PlaceMapListSplit.client.tsx', 'utf8')
    expect(src).not.toMatch(/rows\.slice\(0,\s*24\)/)
    expect(src).toContain("from '@/lib/explore/place-list-showing'")
  })

  it('keeps the city page on an explicit preview cap', () => {
    const src = readFileSync('app/cities/[slug]/page.tsx', 'utf8')
    expect(src).toContain('CITY_PLACE_LIST_CAP')
  })

  it('sends the community counted-set door to the on-page list', () => {
    const src = readFileSync('app/communities/[slug]/page.tsx', 'utf8')
    expect(src).toContain('viewAllHref="#homes"')
    expect(src).toContain("href: '#homes'")
  })
})
