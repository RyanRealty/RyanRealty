import { describe, expect, it } from 'vitest'
import { citySlugForMart, martYearTypeLabel } from '@/lib/cma/market-board-mart'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('CMA market-board mart helpers', () => {
  it('slugifies city names the same way the rebuild writes geo_slug', () => {
    expect(citySlugForMart('Bend')).toBe('bend')
    expect(citySlugForMart('La Pine')).toBe('la-pine')
    expect(citySlugForMart('Powell Butte')).toBe('powell-butte')
  })

  it('labels city grain as all property types and region as Central Oregon', () => {
    expect(martYearTypeLabel('city', 2024)).toBe('all property types, 2024')
    expect(martYearTypeLabel('region', 2024)).toBe('Central Oregon 2024, all types')
  })

  it('does not scan listings', () => {
    const src = readFileSync(resolve('lib/cma/market-board-mart.ts'), 'utf8')
    expect(src).not.toMatch(/from\('listings'\)/)
    expect(src).toMatch(/getCoMarketAnnualCity/)
    expect(src).toMatch(/getCoMarketAnnual/)
    expect(src).toMatch(/analytics_mart_market_annual/)
  })
})
