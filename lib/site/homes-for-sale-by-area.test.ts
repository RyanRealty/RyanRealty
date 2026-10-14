import { describe, expect, it } from 'vitest'
import {
  HOMES_FOR_SALE_BY_AREA_HEADING,
  HOMES_FOR_SALE_CITY_HUBS,
  HOMES_FOR_SALE_COMMUNITY_HUBS,
  cityHubForLabel,
  cityHubForSlug,
} from './homes-for-sale-by-area'

describe('homes-for-sale-by-area', () => {
  it('lists the five city search doors with exact-match anchors', () => {
    expect(HOMES_FOR_SALE_BY_AREA_HEADING).toBe('Homes for sale by area')
    expect(HOMES_FOR_SALE_CITY_HUBS.map((h) => [h.anchor, h.href])).toEqual([
      ['Bend homes for sale', '/homes-for-sale/bend'],
      ['Redmond homes for sale', '/homes-for-sale/redmond'],
      ['Sisters homes for sale', '/homes-for-sale/sisters'],
      ['Sunriver homes for sale', '/homes-for-sale/sunriver'],
      ['La Pine homes for sale', '/homes-for-sale/la-pine'],
    ])
  })

  it('lists eight community hubs with exact-match anchors', () => {
    expect(HOMES_FOR_SALE_COMMUNITY_HUBS).toHaveLength(8)
    expect(HOMES_FOR_SALE_COMMUNITY_HUBS.map((h) => [h.anchor, h.href])).toEqual([
      ['Tetherow homes for sale', '/communities/tetherow'],
      ['Broken Top homes for sale', '/communities/broken-top'],
      ['NorthWest Crossing homes for sale', '/communities/northwest-crossing'],
      ['Eagle Crest homes for sale', '/communities/eagle-crest'],
      ['Black Butte Ranch homes for sale', '/communities/black-butte-ranch'],
      ['Juniper Preserve homes for sale', '/communities/juniper-preserve'],
      ['Brasada Ranch homes for sale', '/communities/brasada-ranch'],
      ['Caldera Springs homes for sale', '/communities/caldera-springs'],
    ])
  })

  it('does not repeat Sunriver as a community hub', () => {
    expect(HOMES_FOR_SALE_COMMUNITY_HUBS.some((h) => h.slug === 'sunriver')).toBe(false)
  })

  it('resolves a city hub from slug or label', () => {
    expect(cityHubForSlug('bend')?.href).toBe('/homes-for-sale/bend')
    expect(cityHubForLabel('La Pine')?.href).toBe('/homes-for-sale/la-pine')
    expect(cityHubForSlug('medford')).toBeNull()
    expect(cityHubForLabel(null)).toBeNull()
  })
})
