import { describe, expect, it } from 'vitest'
import { buildCommunitySchemas } from './community-metadata'

const home = {
  href: '/homes-for-sale/bend/tetherow/1-tetherow-rd-2201',
  addressLine: '1 Tetherow Rd',
  price: 750000,
  propertyType: 'Residential',
  photoUrl: 'https://example.com/a.jpg',
}

function schemas(homes = [home]) {
  return buildCommunitySchemas({
    slug: 'tetherow',
    name: 'Tetherow',
    cityName: 'Bend',
    citySlug: 'bend',
    hasMap: true,
    datasetVariables: [],
    asOfIso: null,
    asOfLabel: null,
    faqs: [],
    homes,
  })
}

describe('buildCommunitySchemas live-home ItemList (SITE-176)', () => {
  it('emits ItemList of photographed homes', () => {
    const list = schemas().find((schema) => schema.type === 'itemList')
    expect(list).toMatchObject({
      type: 'itemList',
      name: 'Homes for sale in Tetherow',
      items: [
        {
          name: '$750,000 · 1 Tetherow Rd',
          url: '/homes-for-sale/bend/tetherow/1-tetherow-rd-2201',
        },
      ],
    })
  })

  it('withholds the list when inventory is empty', () => {
    expect(schemas([]).some((schema) => schema.type === 'itemList')).toBe(false)
  })

  it('withholds unphotographed homes', () => {
    expect(schemas([{ ...home, photoUrl: null }]).some((schema) => schema.type === 'itemList')).toBe(
      false,
    )
  })
})
