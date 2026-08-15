import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('getCoMarketAnnualCity', () => {
  it('is mart-only city grain with no listings fallback', () => {
    const src = readFileSync(resolve('lib/data/analytics/getCoMarketAnnualCity.ts'), 'utf8')
    expect(src).not.toMatch(/from\('listings'\)/)
    expect(src).not.toMatch(/live_aggregate/)
    expect(src).toMatch(/getCoMarketAnnualAt/)
    expect(src).toMatch(/geoType: 'city'/)
    expect(src).toMatch(/analytics_mart_market_annual/)
    expect(src).toMatch(/source: 'missing'/)
  })
})
