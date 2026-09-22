import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildGeoMarketSchemas } from './geo-schemas'

const PAGE = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')

const home = {
  href: '/homes-for-sale/bend/1-main-st-2201',
  addressLine: '1 Main St',
  price: 625000,
  propertyType: 'Residential',
  photoUrl: 'https://example.com/a.jpg',
}

function schemas(homes = [home]) {
  return buildGeoMarketSchemas({
    geoName: 'Bend',
    cityName: 'Bend',
    citySlug: 'bend',
    canonicalPath: '/housing-market/bend',
    datasetVariables: [],
    insightVariables: [],
    asOfIso: null,
    asOfLabel: null,
    refreshedAt: null,
    faqs: [],
    homes,
  })
}

describe('buildGeoMarketSchemas live-home ItemList (SITE-176)', () => {
  it('emits ItemList of photographed city homes', () => {
    const list = schemas().find((schema) => schema.type === 'itemList')
    expect(list).toMatchObject({
      type: 'itemList',
      name: 'Homes for sale in Bend',
      items: [{ name: '$625,000 · 1 Main St', url: '/homes-for-sale/bend/1-main-st-2201' }],
    })
  })

  it('withholds the list when inventory is empty', () => {
    expect(schemas([]).some((schema) => schema.type === 'itemList')).toBe(false)
  })

  it('the route feeds the same homes the city view photographs', () => {
    expect(PAGE).toMatch(/buildGeoMarketSchemas/)
    expect(PAGE).toMatch(/homes,/)
  })
})
