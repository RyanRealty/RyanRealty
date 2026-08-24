import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(resolve('app/lp/bend/page.tsx'), 'utf8')

describe('lp/bend leftover overlay', () => {
  it('reads city leftover for 12-month sold / median / SLT', () => {
    expect(SRC).toMatch(/getPublicDetachedPace/)
    expect(SRC).toMatch(/geoType:\s*'city'/)
    expect(SRC).toMatch(/geoSlug:\s*'bend'/)
    expect(SRC).toMatch(/leftover\.closedCount/)
    expect(SRC).toMatch(/leftover\.medianClose/)
    expect(SRC).toMatch(/leftover\.saleToOriginal/)
  })

  it('reads neighborhood leftover for community-card sold / median', () => {
    expect(SRC).toMatch(/geoType:\s*'neighborhood'/)
    expect(SRC).toMatch(/readLeftoverPace\('neighborhood'/)
  })

  it('does not map leftover or pulse DTP onto median DOM', () => {
    expect(SRC).not.toMatch(/daysToContract/)
    expect(SRC).not.toMatch(/market_pulse_live/)
    expect(SRC).not.toMatch(/median_dom:\s*leftover/)
  })

  it('omits leftover miss instead of keeping cache sold / median / SLT', () => {
    expect(SRC).toMatch(/sold_count: overlay\.sold_count/)
    expect(SRC).toMatch(/median_sale_price: overlay\.median_sale_price/)
    expect(SRC).toMatch(/avg_sale_to_list_ratio: overlay\.avg_sale_to_list_ratio/)
    expect(SRC).not.toMatch(/sold_count:\s*cache\?\.sold_count/)
    expect(SRC).not.toMatch(/median_sale_price:\s*cache\?\.median_sale_price/)
    expect(SRC).not.toMatch(/avg_sale_to_list_ratio:\s*cache\?\.avg_sale_to_list_ratio/)
  })
})
