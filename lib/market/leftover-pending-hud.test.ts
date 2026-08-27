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
    // The KB spelling: `pending: hud.pending` inside the KbMarketData literal.
    for (const [name, src] of Object.entries({
      home: files.home,
      community: files.community,
    })) {
      expect(src, name).toMatch(/pending:\s*hud\.pending/)
      expect(src, name).not.toMatch(/pending:\s*pulse/)
    }
    // The v3 spelling for the city page, MOVED not dropped (2026-08-26): the
    // market Instrument's figures are built in _v3/city-sections.ts off the
    // same leftover pile, so the rule is asserted where the figure is built.
    const citySections = readFileSync(
      resolve('app/cities/[slug]/_v3/city-sections.ts'),
      'utf8',
    )
    expect(citySections).toMatch(/hud\.pending/)
    expect(citySections).toMatch(/label: v3Text\('pending · now'\)/)
    expect(files.city, 'city').not.toMatch(/pending:\s*pulse/)
    expect(files.city, 'city').not.toMatch(/getMarketPulse/)
    // Same v3 rule for the neighborhood page (2026-08-26): its figures come
    // from the same shared builder, and no pulse read exists to fill from.
    expect(files.nbh, 'nbh').toMatch(/leftoverMarketFigures/)
    expect(files.nbh, 'nbh').not.toMatch(/pending:\s*pulse/)
    expect(files.nbh, 'nbh').not.toMatch(/getMarketPulse/)
    // The v3 spelling, MOVED not dropped (2026-08-26). /zip/[zip] left the KB
    // register: there is no KbMarketData literal to key, so the same rule is
    // asserted on the figure the market Instrument actually prints — the value
    // is the leftover HUD's pending count and it carries the same label the KB
    // KPI row used. A pulse fill reaching this figure still fails.
    expect(files.zip, 'zip').toMatch(/hud\.pending/)
    expect(files.zip, 'zip').toMatch(/label: v3Text\('pending · now'\)/)
    expect(files.zip, 'zip').not.toMatch(/pending:\s*pulse/)
    expect(files.zip, 'zip').not.toMatch(/getMarketPulse/)
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

describe('D26 leftover housing instrument and leftover as-of', () => {
  it('housing-market geo instrument is leftover HUD, not pulse fill', () => {
    const geo = readFileSync(resolve('app/housing-market/[...slug]/page.tsx'), 'utf8')
    const figures = readFileSync(resolve('app/housing-market/[...slug]/_v3/geo-figures.ts'), 'utf8')
    expect(geo).toMatch(/leftoverHudPublishes/)
    expect(geo).not.toMatch(/getMarketPulse\(/)
    expect(figures).toMatch(/leftover membership/)
    expect(figures).toMatch(/pending · now/)
    expect(figures).not.toMatch(/live MLS through Oregon Data Share/)
  })

  it('city HUD as-of is leftover stamp, not pulse fill', () => {
    const city = readFileSync(resolve('app/cities/[slug]/page.tsx'), 'utf8')
    // v3 spelling (2026-08-26): the Instrument's `updated` stamp is the
    // leftover membership computed_at, formatted once. Pulse cannot fill it.
    expect(city).toMatch(/updated=\{leftoverStamp \? v3Text\(formatDate\(leftoverStamp\)\)/)
    expect(city).toMatch(/detached\?\.computedAt \?\? detachedInv\?\.computedAt/)
    expect(city).not.toMatch(/asOf=\{pulse\?\.refreshedAt/)
    expect(city).not.toMatch(/updated=\{pulse/)
  })
})
