import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cityBuyerFigures, soldRows } from './city-sections'
import type { ListingTile } from '@/lib/data/types/listing'
import type { LeftoverHudKpis } from '@/lib/market/publish-leftover-hud'

const PAGE = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
const SEARCH = readFileSync(resolve('app/cities/[slug]/_v3/CityHeroSearch.client.tsx'), 'utf8')

describe('city restyle contract', () => {
  it('opens Stage with the money H1, live hero, and type-and-go search', () => {
    expect(PAGE).toMatch(/<V3Stage/)
    expect(PAGE).toMatch(/id="hero"/)
    expect(PAGE).toMatch(/`\$\{cityName\} homes for sale/)
    expect(PAGE).toMatch(/preferPlaceHero\(indexCities\[slug\], cityHero\(slug\)\.src\)/)
    expect(PAGE).toMatch(/<CityHeroSearch/)
    expect(SEARCH).toContain("from '@/components/search/SearchSuggest'")
    expect(SEARCH).toContain('citySearchHref')
    expect(SEARCH).toContain('Property type')
  })

  it('does not print warehouse copy or nine type H2s on the face', () => {
    expect(PAGE).not.toMatch(/V3PlacePropertyTypes/)
    expect(PAGE).not.toMatch(/Market Truth leftover/)
    expect(PAGE).not.toMatch(/city_quarter_sale_to_ask/)
    expect(PAGE).not.toMatch(/foldAfter=\{5\}/)
    expect(PAGE).not.toMatch(/buildPublicMixFigures/)
  })

  it('mounts Chart Room Time/Relate/Rank mid-page', () => {
    expect(PAGE).toMatch(/cityChartRoomCards/)
    expect(PAGE).toMatch(/id="market"/)
    expect(PAGE.indexOf('id="hero"')).toBeLessThan(PAGE.indexOf('id="market"'))
  })
})

describe('cityBuyerFigures', () => {
  it('keeps three buyer HUD cells and drops the long tail', () => {
    const hud = {
      active: 10,
      medianList: 400000,
      pending: 4,
      closed30: 3,
      new30: 2,
      saleToList: 98.1,
      daysToPending: 18,
      monthsSupply: 4.2,
      sold12mo: 120,
    } as LeftoverHudKpis
    const figures = cityBuyerFigures(hud, { browse: '/homes-for-sale/redmond', monthsOfSupply: '/months-of-supply' })
    expect(figures.map((f) => String(f.label))).toEqual([
      'detached homes for sale',
      'median list price',
      'median to pending · 90 days',
    ])
  })
})

describe('soldRows', () => {
  it('drops a close with no price or address and prints close price', () => {
    const sold = {
      listingKey: 's1',
      listNumber: '1',
      listPrice: 500000,
      closePrice: 490000,
      closeDate: '2026-08-01',
      streetNumber: '10',
      streetName: 'Oak',
      streetSuffix: 'St',
      city: 'Redmond',
      photoUrl: null,
    } as ListingTile
    const rows = soldRows([sold, { ...sold, listingKey: 's2', closePrice: null }])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.value).toMatch(/490,000|\$490K|\$490,000/)
  })
})
