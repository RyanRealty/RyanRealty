import { describe, expect, it } from 'vitest'
import { buildNeighborhoodSchemas } from './neighborhood-schemas'

const home = {
  href: '/homes-for-sale/bend/awbrey-butte/1-panorama-dr-2201',
  addressLine: '1 Panorama Dr',
  price: 890000,
  propertyType: 'Residential',
  photoUrl: 'https://example.com/a.jpg',
}

function schemas(homes = [home]) {
  return buildNeighborhoodSchemas({
    neighborhoodName: 'Awbrey Butte',
    neighborhoodSlug: 'awbrey-butte',
    cityName: 'Bend',
    citySlug: 'bend',
    hasMap: true,
    datasetVariables: [],
    asOfIso: null,
    asOfLabel: null,
    homes,
  })
}

describe('buildNeighborhoodSchemas live-home ItemList (SITE-176)', () => {
  it('emits ItemList of photographed homes', () => {
    const list = schemas().find((schema) => schema.type === 'itemList')
    expect(list).toMatchObject({
      type: 'itemList',
      name: 'Homes for sale in Awbrey Butte',
      items: [
        {
          name: '$890,000 · 1 Panorama Dr',
          url: '/homes-for-sale/bend/awbrey-butte/1-panorama-dr-2201',
        },
      ],
    })
  })

  it('withholds the list when inventory is empty', () => {
    expect(schemas([]).some((schema) => schema.type === 'itemList')).toBe(false)
  })
})
