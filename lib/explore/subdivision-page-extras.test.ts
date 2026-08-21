import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { placeListShowingLabel } from './place-list-showing'
import {
  CITY_PLACE_LIST_CAP,
  peerPlatsForResort,
  splitRowsFromTiles,
} from './subdivision-page-extras'

function tile(
  listingKey: string,
  price: number,
  extras: { lat?: number | null; subdivisionName?: string; propertySubType?: string | null } = {},
) {
  return {
    listingKey,
    listNumber: listingKey,
    propertySubType: extras.propertySubType ?? 'Single Family Residence',
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

  it('prints Moonshadow Court without a leading 0', () => {
    const rows = splitRowsFromTiles([
      {
        listingKey: 'moon',
        listNumber: '220221237',
        propertySubType: 'Single Family Residence',
        listPrice: 2_825_000,
        beds: 4,
        baths: 4,
        streetNumber: '0',
        streetName: 'Moonshadow',
        streetSuffix: 'Court',
        city: 'Bend',
        subdivisionName: 'Awbrey Butte',
        photoUrl: null,
        lat: 44.08,
        lng: -121.33,
      },
    ])
    expect(rows[0]?.title).toBe('Moonshadow Court')
    expect(rows[0]?.title).not.toMatch(/^0\s/)
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
    const kb = readFileSync('components/site/community/CommunityKbView.tsx', 'utf8')
    expect(src).toContain('homesHref="#homes"')
    expect(kb).toContain('viewAllHref="#homes"')
    expect(kb).toContain("href: '#homes'")
  })
})

describe('splitRowsFromTiles carries what the row needs to label a share', () => {
  it('passes the fractional subject through to the row', () => {
    // /cities/camp-sherman published "$249,000 · 13375 Forest Service Road ·
    // 3 bd · 3 ba" over ten quarter shares at Lake Creek Lodge, unlabelled,
    // because the row shape carried a price and no way to ask what it buys.
    const [row] = splitRowsFromTiles([
      {
        listingKey: '20260421160801623637000000',
        listNumber: '220220877',
        propertySubType: 'Tenancy in Common',
        listPrice: 249_000,
        beds: 3,
        baths: 3,
        streetNumber: '13375',
        streetName: 'Forest Service',
        streetSuffix: 'Road',
        city: 'Camp Sherman',
        subdivisionName: 'Lake Creek Lodge',
        photoUrl: null,
        lat: 44.46,
        lng: -121.64,
      },
    ])
    expect(row?.propertySubType).toBe('Tenancy in Common')
    expect(row?.subdivisionName).toBe('Lake Creek Lodge')
    expect(row?.city).toBe('Camp Sherman')
    expect(row?.listNumber).toBe('220220877')
  })
})
