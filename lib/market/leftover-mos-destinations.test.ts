import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = {
  mos: readFileSync(resolve('app/months-of-supply/page.tsx'), 'utf8'),
  hub: readFileSync(resolve('app/housing-market/page.tsx'), 'utf8'),
  region: readFileSync(resolve('app/housing-market/central-oregon/page.tsx'), 'utf8'),
  annual: readFileSync(resolve('app/housing-market/annual-review/page.tsx'), 'utf8'),
  cities: readFileSync(resolve('app/cities/page.tsx'), 'utf8'),
  snapshot: readFileSync(resolve('components/site/MarketSnapshot.tsx'), 'utf8'),
  home: readFileSync(resolve('app/page.tsx'), 'utf8'),
  reports: readFileSync(resolve('app/housing-market/reports/page.tsx'), 'utf8'),
  expired: readFileSync(resolve('app/lp/expired-listing/page.tsx'), 'utf8'),
  buyer: readFileSync(resolve('app/lp/buyer-listing-alerts/page.tsx'), 'utf8'),
  listing: readFileSync(resolve('app/listing/[listingKey]/page.tsx'), 'utf8'),
  searchOg: readFileSync(resolve('app/search/og/[...slug]/route.tsx'), 'utf8'),
  housingOg: readFileSync(resolve('app/housing-market/og/[...slug]/route.tsx'), 'utf8'),
}

describe('D21 leftover MOS destinations and leftover remainder', () => {
  it('gates remaining public MOS destinations through leftoverHudKpis', () => {
    for (const [name, src] of Object.entries(files)) {
      expect(src, name).toMatch(/leftoverHudKpis/)
    }
  })

  it('homepage remainder uses leftover region HUD, not pulse fill', () => {
    expect(files.home).toMatch(/regionActive:\s*hud\.active/)
    expect(files.home).not.toMatch(/regionActive:\s*pulse\?\.activeCount/)
  })

  it('MOS page does not fetch pulse for the published MOS figures', () => {
    expect(files.mos).not.toMatch(/getRegionPulse/)
    expect(files.mos).not.toMatch(/getMarketPulseCitySnapshots/)
  })

  it('listing place market is leftover HUD, not pulse fill', () => {
    expect(files.listing).toMatch(/leftoverHudKpis/)
    expect(files.listing).toMatch(/leftoverListingGrains/)
    expect(files.listing).not.toMatch(/getMarketPulse\(/)
  })
})
