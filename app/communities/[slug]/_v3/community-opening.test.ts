import { describe, expect, it } from 'vitest'
import type { ListingTile } from '@/lib/data/types/listing'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { EMPTY_PUBLIC_PACE } from '@/lib/data/market-truth/public-pace'
import { publishPlaceFace } from '@/lib/market/publish-place-face'
import {
  communityFieldItems,
  communitySchoolCity,
  communitySplitListings,
  communityTypeStripItems,
  firstAboutParagraph,
  leftoverSoldHistoryFigures,
} from './community-opening'

function tile(listingKey: string, price: number): ListingTile {
  return {
    listingKey,
    listNumber: listingKey,
    listPrice: price,
    streetNumber: '1',
    streetName: 'Fairway',
    streetSuffix: 'Dr',
    city: 'Bend',
    photoUrl: null,
    lat: 44.03,
    lng: -121.36,
    beds: 3,
    baths: 2,
    sqft: 2000,
    subdivisionName: 'Tetherow',
  } as ListingTile
}

describe('master-plan Field see-all', () => {
  it('lists the counted set, not a 24-home slice', () => {
    const tiles = Array.from({ length: 36 }, (_, i) => tile(`k${i}`, 1_000_000 + i))
    const items = communityFieldItems(tiles)
    expect(items).toHaveLength(36)
  })
})

describe('community leftover face vs alias tiles', () => {
  const leftoverHud: LeftoverHudKpis = {
    active: 16,
    pending: 4,
    closed30: 2,
    new30: null,
    medianList: 2_372_500,
    saleToList: 95,
    daysToPending: 51,
    monthsSupply: 4.6,
    sold12mo: 22,
  }

  it('face prints leftover 16, not alias length 25, and withholds MOS', () => {
    const face = publishPlaceFace({ grain: 'community', hud: leftoverHud })
    expect(face.stats.find((s) => s.id === 'active')?.value).toBe('16')
    expect(face.stats.map((s) => s.id)).toEqual(['active', 'medianList'])
    expect(face.monthsOfSupply).toBeNull()
    expect(face.verdict).toBeNull()
    const alias = publishPlaceFace({ grain: 'community', hud: leftoverHud, active: 25 })
    expect(alias.stats.find((s) => s.id === 'active')?.value).toBe('25')
  })

  it('sold history is leftover close / sold / DTP, never MOS', () => {
    const figures = leftoverSoldHistoryFigures(leftoverHud, {
      ...EMPTY_PUBLIC_PACE,
      medianClose: 2_384_500,
      closedCount: 22,
      daysToPending90d: 51,
    })
    expect(figures.map((f) => String(f.label))).toEqual([
      'median close · 12 months',
      'sold · 12 months',
      'median to pending · 90 days',
    ])
    expect(figures.map((f) => String(f.value))).toEqual(['$2,384,500', '22', '51'])
    expect(figures.some((f) => String(f.label).includes('months of supply'))).toBe(false)
  })

  it('omits a leftover miss rather than filling alias 25', () => {
    const face = publishPlaceFace({
      grain: 'community',
      hud: { ...leftoverHud, active: null, medianList: null },
    })
    expect(face.stats).toEqual([])
  })

  it('type strip is count + noun, not MOS H2s', () => {
    const items = communityTypeStripItems(
      [
        { segment: 'townhome', activeCount: 3 },
        { segment: 'condo', activeCount: null },
      ],
      'bend',
    )
    expect(items).toEqual([
      { key: 'townhome', href: '/homes-for-sale/bend/townhomes', label: '3 townhomes' },
    ])
    expect(items[0]?.label).not.toMatch(/months/)
  })

  it('uses one about paragraph and Redmond 2J for Eagle Crest', () => {
    expect(firstAboutParagraph(['  Tetherow sits west of Bend. ', 'Second.'])).toBe(
      'Tetherow sits west of Bend.',
    )
    expect(communitySchoolCity('eagle-crest', 'Bend')).toBe('Redmond')
    expect(communitySchoolCity('tetherow', 'Bend')).toBe('Bend')
  })

  it('split rows keep alias tiles off the leftover face count', () => {
    const rows = communitySplitListings(Array.from({ length: 25 }, (_, i) => tile(`k${i}`, 1_000_000)))
    expect(rows).toHaveLength(25)
    const face = publishPlaceFace({ grain: 'community', hud: leftoverHud })
    expect(face.stats.find((s) => s.id === 'active')?.value).toBe('16')
    expect(Number(face.stats.find((s) => s.id === 'active')?.value)).not.toBe(rows.length)
  })
})
