/**
 * Reader review 2026-10-09, 1355 Jacksonville, "What happened": "River West
 * single-family homes listed October 8, 2025 through October 8, 2026, 139
 * homes." and "139 homes were listed. 21 of them came off ..." The count
 * (rowsToPlacePricingStory) holds every address whose listing was listed, went
 * on the market, came off or closed in the window, and the home's own listing
 * with them: 1355 Jacksonville, listed Sep 23 and withdrawn Sep 28 in River
 * West (listings row 20260923221358552279000000, boundary_neighborhood River
 * West, off_market_date 2026-09-28, no close), is one of the 139 and one of
 * the 21. The words now say exactly that; the numbers are the stored ones.
 */
import { describe, expect, it } from 'vitest'
import {
  homeInPlaceCount,
  placePricingStoryHtml,
  placeSourceNote,
  type PlaceStoryHome,
} from '@/lib/cma/place-pricing-story'
import type { PlacePricingStory } from '@/lib/cma/place-pricing-types'

const RIVER_WEST: PlacePricingStory = {
  placeName: 'River West',
  placeKind: 'neighborhood',
  windowMonths: 12,
  asOf: '2026-10-08',
  listedHomes: 139,
  didNotSell: 21,
  droppedPrice: 70,
  typicalCutShare: 0.06541795736857846,
  gaveConcessions: 37,
  typicalConcessionShare: 0.005005005005005005,
  heldAskCount: 50,
  heldAskMedianDays: 3.5,
  cutPriceCount: 36,
  cutPriceMedianDays: 66.5,
  sourceNote: 'River West single-family homes listed October 8, 2025 through October 8, 2026, 139 homes.',
}

/** 1355 Jacksonville as its stored render_args carry it. */
const JACKSONVILLE: PlaceStoryHome = {
  subdivision: 'Northwest Townsite',
  city: 'Bend',
  latitude: 44.058868,
  longitude: -121.331289,
  status: 'Withdrawn',
  listDate: '2026-09-23T23:33:01+00:00',
  onMarketDate: '2026-09-23',
  offMarketDate: null,
}

describe('the place count says what it counts', () => {
  it('names listed, sold or taken off the market, and the home itself when it is one of them', () => {
    const html = placePricingStoryHtml(RIVER_WEST, 'letter', JACKSONVILLE)
    expect(html).toContain(
      '139 homes were listed, sold or taken off the market, yours among them. 21 of them came off the market without selling, yours included.',
    )
    expect(html).not.toContain('139 homes were listed.')
    expect(html).toContain(
      'River West single-family homes listed, sold or taken off the market between October 8, 2025 and October 8, 2026: 139 homes, each address counted once.',
    )
    expect(html).not.toMatch(/[—–]/)
  })

  it('says nothing about the home when its own listing is outside the window', () => {
    const old = { ...JACKSONVILLE, listDate: '2024-03-01', onMarketDate: '2024-03-01', offMarketDate: '2024-06-01' }
    expect(homeInPlaceCount(RIVER_WEST, old)).toEqual({ counted: false, didNotSell: false })
    const html = placePricingStoryHtml(RIVER_WEST, 'letter', old)
    expect(html).toContain('139 homes were listed, sold or taken off the market. 21 of them came off')
    expect(html).not.toContain('yours')
  })

  it('counts a home still for sale among the listed, not among the ones that came off', () => {
    const active = { ...JACKSONVILLE, status: 'Active' }
    expect(homeInPlaceCount(RIVER_WEST, active)).toEqual({ counted: true, didNotSell: false })
    const html = placePricingStoryHtml(RIVER_WEST, 'letter', active)
    expect(html).toContain('yours among them')
    expect(html).not.toContain('yours included')
  })

  it('makes no claim about a home outside the place', () => {
    // Downtown Redmond: not in River West's polygon.
    const away = { ...JACKSONVILLE, latitude: 44.2726, longitude: -121.1739 }
    expect(homeInPlaceCount(RIVER_WEST, away)).toEqual({ counted: false, didNotSell: false })
    expect(homeInPlaceCount(RIVER_WEST, null)).toEqual({ counted: false, didNotSell: false })
  })

  it('restates a stored source line in its own figures, and leaves any other line alone', () => {
    expect(placeSourceNote('Old Farm townhouses listed March 1, 2025 through March 1, 2026, 1 home.')).toBe(
      'Old Farm townhouses listed, sold or taken off the market between March 1, 2025 and March 1, 2026: 1 home, each address counted once.',
    )
    const other = 'Old Farm single-family homes listed 2025-10-01 through 2026-09-30, 48 homes, Oregon Data Share MLS.'
    expect(placeSourceNote(other)).toBe(other)
  })
})
