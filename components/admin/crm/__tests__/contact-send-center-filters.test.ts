import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * ContactSendCenter "Listing matches" filter-vocabulary contract (W7.5).
 *
 * A broker-built listing alert must be able to be as precise as a self-serve
 * /search alert — the broker form used to expose only ~9 keys while consumers
 * had the full vocabulary, so a broker couldn't set year-built, lot size,
 * amenities, etc. Per "gates not prose," pin that the broker form now maps the
 * full vocabulary into the filters object it sends. A future edit that drops a
 * key fails CI instead of silently narrowing what a broker can target.
 */
const src = readFileSync(resolve('components/admin/crm/ContactSendCenter.tsx'), 'utf8')

// The narrowing keys getSearchListings honors that a broker builds an alert
// from. (Sort/view/page/pagination are not alert filters; multi-city, postal,
// and registry-only flags aren't part of the quick broker form.)
const REQUIRED_FILTER_KEYS = [
  'city', 'subdivision',
  'minPrice', 'maxPrice',
  'beds', 'baths',
  'minSqFt', 'maxSqFt',
  'yearBuiltMin', 'yearBuiltMax',
  'lotAcresMin', 'lotAcresMax',
  'garageMin', 'keywords',
  'propertyType', 'propertySubType',
  'statusFilter',
  'hasPool', 'hasView', 'hasWaterfront', 'hasFireplace', 'hasGolfCourse',
]

describe('broker Listing-matches form carries the full consumer filter vocabulary', () => {
  for (const key of REQUIRED_FILTER_KEYS) {
    it(`writes filters.${key}`, () => {
      // Each key is assigned into the `filters` object that sendListings() sends.
      expect(src).toMatch(new RegExp(`filters\\.${key}\\s*=`))
    })
  }

  it('renders a control for every non-geo new filter (year built, lot acres, garage, keywords, amenities)', () => {
    expect(src).toMatch(/id="sc-maxsqft"/)
    expect(src).toMatch(/id="sc-ybmin"/)
    expect(src).toMatch(/id="sc-ybmax"/)
    expect(src).toMatch(/id="sc-lotmin"/)
    expect(src).toMatch(/id="sc-lotmax"/)
    expect(src).toMatch(/id="sc-garage"/)
    expect(src).toMatch(/id="sc-keywords"/)
    expect(src).toMatch(/id="sc-subtype"/)
    // The five amenity toggles.
    expect(src).toMatch(/\['Pool', hasPool, setHasPool\]/)
    expect(src).toMatch(/\['Golf course', hasGolfCourse, setHasGolfCourse\]/)
  })
})

describe('the stale frequency cast is gone (W7.5 cleanup)', () => {
  it('passes freq straight through sendDeliverable — no cast bridge', () => {
    // Routed via sendDeliverable override (G56 burn); freq is still uncast.
    expect(src).toMatch(/frequency:\s*freq/)
    expect(src).toMatch(/sendDeliverable\(/)
    // The old "cast is a bridge" comment + `freq as 'daily' | 'weekly'` are gone.
    expect(src).not.toMatch(/freq as 'daily' \| 'weekly'/)
    expect(src).not.toMatch(/cast is a bridge until the action signature widens/)
  })
})
