import { describe, expect, it } from 'vitest'
import { buildCitySchemas } from './city-metadata'

const faq = {
  faqs: [] as Array<{ question: string; answer: string }>,
  datasetVariables: [] as Array<{ name: string; value: string | number }>,
  asOfIso: null,
  asOfLabel: null,
}

describe('buildCitySchemas live-home ItemList (SITE-176)', () => {
  it('emits ItemList of photographed fold cards', () => {
    const schemas = buildCitySchemas({
      cityName: 'Bend',
      slug: 'bend',
      faq,
      hasMap: true,
      homes: [
        { href: '/homes-for-sale/bend/1-main-st-2201', title: '1 Main St', price: '$795k' },
        { href: '/homes-for-sale/bend/2-pine-st-2202', title: '2 Pine St', price: '$410k' },
      ],
    })
    const list = schemas.find((schema) => schema.type === 'itemList')
    expect(list).toMatchObject({
      type: 'itemList',
      name: 'Homes for sale in Bend',
      items: [
        { name: '$795k · 1 Main St', url: '/homes-for-sale/bend/1-main-st-2201' },
        { name: '$410k · 2 Pine St', url: '/homes-for-sale/bend/2-pine-st-2202' },
      ],
    })
  })

  it('withholds the list when inventory is empty', () => {
    const schemas = buildCitySchemas({
      cityName: 'Bend',
      slug: 'bend',
      faq,
      hasMap: true,
      homes: [],
    })
    expect(schemas.some((schema) => schema.type === 'itemList')).toBe(false)
  })
})
