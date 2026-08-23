import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { collapseCitySegmentRows, type RawSegmentCell } from '@/lib/data/market-truth/city-segment-collapse'
import {
  PUBLIC_PLACE_SEGMENTS,
  publicSegmentBrowseHref,
  publicSegmentDisplayBits,
  publicSegmentNoun,
} from '@/lib/data/market-truth/public-segments'

const SRC = readFileSync(resolve('lib/data/market-truth/public-segments.ts'), 'utf8')

describe('getPublicPlaceSegments', () => {
  it('reads publishable market_metric condo and townhome cells', () => {
    expect(SRC).toMatch(/from\('market_metric'\)/)
    expect(SRC).toMatch(/is_publishable/)
    expect(SRC).toMatch(/'condo'/)
    expect(SRC).toMatch(/'townhome'/)
    expect([...PUBLIC_PLACE_SEGMENTS]).toEqual(['condo', 'townhome'])
    expect(SRC).not.toMatch(/market_pulse_live/)
    expect(SRC).not.toMatch(/commercial_lease/)
    expect(SRC).not.toMatch(/'neighborhood'/)
    expect(SRC).not.toMatch(/'land'/)
    expect(SRC).not.toMatch(/manufactured/)
  })

  it('omits a miss instead of printing 0', () => {
    expect(SRC).toMatch(/activeCount == null \|\| row.activeCount <= 0/)
    expect(SRC).toMatch(/propertySubTypes/)
  })

  it('names browse URLs and display bits without fabricating 0', () => {
    expect(publicSegmentBrowseHref('bend', 'condo')).toBe(
      '/homes-for-sale/bend?propertySubTypes=Condominium',
    )
    expect(publicSegmentBrowseHref('la-pine', 'townhome')).toBe(
      '/homes-for-sale/la-pine?propertySubTypes=Townhouse',
    )
    expect(publicSegmentBrowseHref(null, 'condo')).toBe(
      '/homes-for-sale?propertySubTypes=Condominium',
    )
    expect(publicSegmentNoun('condo', 1)).toBe('condo')
    expect(publicSegmentNoun('condo', 66)).toBe('condos')
    expect(publicSegmentNoun('townhome', 78)).toBe('townhomes')
    expect(publicSegmentDisplayBits({
      medianList: 326000,
      monthsOfSupply: 12.8,
      verdict: 'buyer',
    })).toEqual(['$326,000', '12.8 months', "buyer's"])
    expect(publicSegmentDisplayBits({
      medianList: null,
      monthsOfSupply: null,
      verdict: null,
    })).toEqual([])
  })

  it('collapse with public segments does not emit farm or detached rows', () => {
    const cell = (
      partial: Partial<RawSegmentCell> & Pick<RawSegmentCell, 'segment' | 'stat_id' | 'value'>,
    ): RawSegmentCell => ({
      value_text: null,
      sample_n: 40,
      window_months: 0,
      period_end: '2026-08-23',
      computed_at: '2026-08-23T01:00:00Z',
      complete_through: '2026-08-22',
      is_publishable: true,
      ...partial,
    })
    const rows = collapseCitySegmentRows(
      [
        cell({ segment: 'detached', stat_id: 'active_count', value: 774 }),
        cell({ segment: 'condo', stat_id: 'active_count', value: 66 }),
        cell({ segment: 'farm', stat_id: 'active_count', value: 12 }),
      ],
      { segments: PUBLIC_PLACE_SEGMENTS },
    )
    expect(rows.map((row) => row.segment)).toEqual(['condo', 'townhome'])
    expect(rows.find((row) => row.segment === 'condo')?.activeCount).toBe(66)
    expect(rows.find((row) => row.segment === 'townhome')?.activeCount).toBeNull()
  })
})

describe('public place pages', () => {
  it('city and housing-market city pages read getPublicPlaceSegments', () => {
    const city = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
    const strip = readFileSync(resolve('app/cities/[slug]/PublicProductTypes.tsx'), 'utf8')
    const market = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')
    const figures = readFileSync(
      resolve('app/housing-market/[...slug]/_v3/geo-figures.ts'),
      'utf8',
    )
    const hub = readFileSync(resolve('app/housing-market/page.tsx'), 'utf8')
    expect(city).toMatch(/getPublicPlaceSegments/)
    expect(city).toMatch(/PublicProductTypes/)
    expect(strip).toMatch(/publicSegmentBrowseHref/)
    expect(strip).toMatch(/publicSegmentDisplayBits/)
    expect(market).toMatch(/getPublicPlaceSegments/)
    expect(figures).toMatch(/buildPublicSegmentFigures/)
    expect(figures).toMatch(/publicSegmentBrowseHref/)
    expect(hub).toMatch(/getPublicPlaceSegments/)
    expect(hub).toMatch(/publicSegmentDisplayBits/)
    expect(city).not.toMatch(/geo_type['"]\s*,\s*['"]neighborhood/)
    expect(strip).not.toMatch(/geo_type['"]\s*,\s*['"]neighborhood/)
  })
})
