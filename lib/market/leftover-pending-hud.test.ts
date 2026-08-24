import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const files = {
  hud: readFileSync(resolve('components/site/kb/KbMarketHud.client.tsx'), 'utf8'),
  types: readFileSync(resolve('components/site/kb/types.ts'), 'utf8'),
  home: readFileSync(resolve('app/page.tsx'), 'utf8'),
  city: readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8'),
  nbh: readFileSync(resolve('app/cities/[slug]/[neighborhoodSlug]/page.tsx'), 'utf8'),
  community: readFileSync(resolve('app/communities/[slug]/page.tsx'), 'utf8'),
  zip: readFileSync(resolve('app/zip/[zip]/page.tsx'), 'utf8'),
  snapshot: readFileSync(resolve('components/site/MarketSnapshot.tsx'), 'utf8'),
  listing: readFileSync(resolve('components/site/listing-detail/NeighborhoodMarketContext.tsx'), 'utf8'),
  search: readFileSync(resolve('lib/market/search-city-sfr-publish.ts'), 'utf8'),
  event: readFileSync(resolve('lib/data/events/getEventDetail.ts'), 'utf8'),
  golf: readFileSync(resolve('lib/data/golf/getGolfDetail.ts'), 'utf8'),
  trail: readFileSync(resolve('lib/data/trails/getTrailDetail.ts'), 'utf8'),
  venue: readFileSync(resolve('lib/data/venues/getVenueDetail.ts'), 'utf8'),
  dictionary: readFileSync(resolve('lib/market/how-we-get-our-numbers.ts'), 'utf8'),
}

describe('D25 leftover pending HUD and leftover remaining visitor HUD-family', () => {
  it('HUD KPI row prints leftover pending after Active homes', () => {
    expect(files.hud).toMatch(/lbl: 'Active homes'/)
    expect(files.hud).toMatch(/lbl: 'Pending · now'/)
    expect(files.hud.indexOf("lbl: 'Pending · now'")).toBeGreaterThan(files.hud.indexOf("lbl: 'Active homes'"))
    expect(files.types).toMatch(/pending: number \| null/)
  })

  it('place HUDs pass leftover pending, not pulse fill', () => {
    for (const [name, src] of Object.entries({
      home: files.home,
      city: files.city,
      nbh: files.nbh,
      community: files.community,
      zip: files.zip,
    })) {
      expect(src, name).toMatch(/pending:\s*hud\.pending/)
      expect(src, name).not.toMatch(/pending:\s*pulse/)
    }
  })

  it('search snapshot and listing KPI print leftover pending', () => {
    expect(files.snapshot).toMatch(/hud\.pending/)
    expect(files.snapshot).toMatch(/Pending · now/)
    expect(files.listing).toMatch(/hud\.pending/)
    expect(files.listing).toMatch(/Pending · now/)
    expect(files.listing).not.toMatch(/leftover\.pendingCount/)
  })

  it('search city FAQ is leftover HUD, not pulse fill', () => {
    expect(files.search).toMatch(/leftoverHudKpis/)
    expect(files.search).toMatch(/source: 'market-truth'/)
    expect(files.search).not.toMatch(/getMarketPulse/)
  })

  it('event golf trail venue city market is leftover, not pulse', () => {
    for (const [name, src] of Object.entries({
      event: files.event,
      golf: files.golf,
      trail: files.trail,
      venue: files.venue,
    })) {
      expect(src, name).toMatch(/leftoverCityAreaMarket/)
      expect(src, name).not.toMatch(/getMarketPulse/)
    }
  })

  it('dictionary covers Pending · now', () => {
    expect(files.dictionary).toMatch(/'Pending · now': 'pending-now'/)
    expect(files.dictionary).toMatch(/id: 'pending-now'/)
  })
})
