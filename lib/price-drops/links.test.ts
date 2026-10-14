import { describe, expect, it } from 'vitest'
import { foreclosureDoors, priceDropCityDoors, underPriceDoors } from './links'

describe('price-drop city doors', () => {
  it('links only under-$X pages that already exist', () => {
    expect(underPriceDoors('bend').map((d) => d.href)).toEqual([
      '/homes-for-sale/bend/under-400k',
      '/homes-for-sale/bend/under-500k',
    ])
    expect(underPriceDoors('redmond').map((d) => d.href)).toEqual([
      '/homes-for-sale/redmond/under-500k',
    ])
    expect(underPriceDoors('sisters')).toEqual([])
    expect(underPriceDoors('la-pine').map((d) => d.href)).toEqual([
      '/homes-for-sale/la-pine/under-400k',
      '/homes-for-sale/la-pine/under-500k',
    ])
  })

  it('does not invent foreclosure pages or a /deals/bend vanity URL', () => {
    expect(foreclosureDoors('bend')).toEqual([])
    const hrefs = ['bend', 'redmond', 'sisters', 'la-pine'].flatMap((slug) =>
      priceDropCityDoors(slug).map((d) => d.href),
    )
    expect(hrefs.some((href) => /foreclosure/i.test(href))).toBe(false)
    expect(hrefs).not.toContain('/deals/bend')
  })
})
