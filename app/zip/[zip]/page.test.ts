import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const PAGE = readFileSync(join(HERE, 'page.tsx'), 'utf8')
const SELL_SHEET = readFileSync(join(HERE, '_v3/ZipSellSheet.client.tsx'), 'utf8')
const ALERTS_SHEET = readFileSync(join(HERE, '_v3/ZipAlertsSheet.client.tsx'), 'utf8')

/**
 * The ZIP route moved to the components/site/v3 barrel on 2026-08-26. Every
 * assertion below that used to name a KB component now names what carries the
 * same contract, so nothing this file protected stopped being protected: the
 * rule is MOVED, not dropped.
 */
describe('ZIP page Market Truth overlay', () => {
  it('imports getMetric and reads zip detached cells', () => {
    expect(PAGE).toContain('getMetric')
    expect(PAGE).toContain("from '@/lib/data/market-truth/getMetric'")
    expect(PAGE).toMatch(/geoType:\s*'zip'/)
    expect(PAGE).toMatch(/segment:\s*'detached'/)
    expect(PAGE).toContain('active_count')
    expect(PAGE).toContain('median_list_active')
    expect(PAGE).toContain('months_of_supply')
  })

  it('does not call getDetachedMarket (city/region only)', () => {
    expect(PAGE).not.toMatch(/getDetachedMarket/)
    expect(PAGE).not.toMatch(/getCityDetachedMarket/)
  })

  it('uses a cell only when publishable with a value', () => {
    expect(PAGE).toContain('metric != null && metric.isPublishable && metric.value != null')
  })

  it('miss path does not assign activeCount = 0 from overlay', () => {
    expect(PAGE).toMatch(
      /const activeCount: number \| null = mtHit \? mtActiveRounded : tileActiveCount/,
    )
    const overlayStart = PAGE.indexOf('Headline HIT')
    // The overlay block ends where the market section starts. Both markers are
    // asserted to exist so a rename cannot silently widen the slice to the
    // whole file, which is how this check would pass while reading nothing.
    const overlayEnd = PAGE.indexOf('── THE MARKET SECTION')
    expect(overlayStart).toBeGreaterThan(-1)
    expect(overlayEnd).toBeGreaterThan(overlayStart)
    const overlay = PAGE.slice(overlayStart, overlayEnd)
    expect(overlay).not.toMatch(/activeCount\s*=\s*0/)
    expect(overlay).not.toMatch(/\?\?\s*0/)
    expect(overlay).toMatch(/tileActiveCount/)
    expect(overlay).toContain('!(mtActiveRounded === 0 && tiles.length > 0)')
  })

  it('does not print 12-month new_listings as New · 30 days', () => {
    expect(PAGE).toMatch(/leftoverHudKpis/)
    // The 30-day figure comes from the leftover HUD's own 30-day cell.
    expect(PAGE).toMatch(/hud\.new30/)
    expect(PAGE).toMatch(/label: v3Text\('newly listed, last 30 days'\)/)
    expect(PAGE).not.toMatch(/mtNewVal/)
    expect(PAGE).not.toMatch(/publishedNew30/)
    // ONE ANSWER PER QUESTION. The KB page counted its Dataset's 30-day new
    // listings from the tiles while its HUD showed the leftover 30-day cell, so
    // one page published two different numbers under one name — one visible,
    // one machine-readable. The leftover cell is the one on screen, so it is the
    // one in the payload, and the tile derivation is gone.
    expect(PAGE).toMatch(/New listings last 30 days/)
    expect(PAGE).not.toMatch(/tileNew30/)
    const datasetNew30 = PAGE.slice(
      PAGE.indexOf("name: 'New listings last 30 days'") - 120,
      PAGE.indexOf("name: 'New listings last 30 days'") + 120,
    )
    expect(datasetNew30).toMatch(/hud\.new30/)
    expect(PAGE).toMatch(/getPublicDetachedPace/)
    expect(PAGE).toMatch(/getPublicPlaceSegments/)
    expect(PAGE).toMatch(/getPublicDetachedMix/)
    // The leftover pace items and the detached mix reach the page as figures.
    expect(PAGE).toMatch(/publicPaceItems/)
    expect(PAGE).toMatch(/buildPublicMixFigures/)
    // The property-type run is the barrel's enumeration, scoped by postalCode
    // so each door carries this page's population.
    expect(PAGE).toMatch(/V3PlacePropertyTypes/)
    expect(PAGE).toMatch(/postalCode=\{zip\}/)
    expect(PAGE).toMatch(/geoType: 'zip'/)
  })
})

describe('ZIP page is on the v3 barrel', () => {
  it('renders the barrel and reaches into no other design register', () => {
    expect(PAGE).toMatch(/from '@\/components\/site\/v3'/)
    expect(PAGE).toMatch(/V3_ROOT_CLASS/)
    expect(PAGE).toMatch(/<V3Footer/)
    expect(PAGE).toMatch(/<V3SectionTracker/)
    expect(PAGE).toMatch(/<V3Breadcrumb/)
    expect(PAGE).not.toMatch(/components\/site\/kb/)
    expect(PAGE).not.toMatch(/components\/site\/explore/)
    expect(PAGE).not.toMatch(/components\/site\/primitives/)
    expect(PAGE).not.toMatch(/kb-root/)
    // MetadataBlock is the one legacy import that stays. It is JSON-LD wiring,
    // not visual language, and ci:ai-structured-data pins this route to it.
    expect(PAGE).toMatch(/from '@\/components\/site\/MetadataBlock'/)
  })

  it('carries the page contract across unchanged', () => {
    expect(PAGE).toMatch(/export const dynamicParams = false/)
    expect(PAGE).toMatch(/export const revalidate = 60/)
    expect(PAGE).toMatch(/export async function generateStaticParams/)
    expect(PAGE).toMatch(/CANONICAL_ZIPS/)
    expect(PAGE).toMatch(/title: 'ZIP not found · Ryan Realty'/)
    expect(PAGE).toMatch(/Homes for sale in \$\{zip\} · \$\{area\}, Oregon/)
    // The same three JSON-LD payloads.
    expect(PAGE).toMatch(/type: 'breadcrumb'/)
    expect(PAGE).toMatch(/type: 'place'/)
    expect(PAGE).toMatch(/type: 'dataset'/)
    for (const variable of [
      'Median list price',
      'Median price per sq ft',
      'Median days on market',
      'New listings last 30 days',
    ]) {
      expect(PAGE).toContain(variable)
    }
    // The days figure reaches the payload at the grain the page prints it,
    // not integer-rounded past the visible 59.5 (migration recipe §3.5).
    expect(PAGE).toMatch(/Math\.round\(medianDom \* 10\) \/ 10/)
  })

  it('leads the market section with the question heading (Matt, 2026-08-26)', () => {
    // The KB HUD templated `Is ${geoName} a buyer's or seller's market?` on
    // this page (geoName `ZIP ${zip}`), and Matt ruled the question stays on
    // all five place grains. In v3 idiom it is the market Instrument's
    // headline; the verdict sentence beneath it is the answer. Family-wide
    // consistency is gated by ci:market-question; this pin holds the route's
    // exact template and its §0 fallback.
    expect(PAGE).toContain("`Is ZIP ${zip} a buyer's or seller's market?`")
    // A question with no answer under it is worse than a label (§0): no
    // publishable verdict falls back to the homes-for-sale headline.
    expect(PAGE).toMatch(
      /const marketHeadline =\s*\n\s*verdict && mosText != null\s*\n\s*\? `Is ZIP \$\{zip\} a buyer's or seller's market\?`\s*\n\s*: `Homes for sale in \$\{zip\}`/,
    )
    expect(PAGE).toMatch(/headline=\{v3Text\(marketHeadline\)\}/)
  })

  it('keeps both capture contracts byte for byte', () => {
    // Alerts: same server action, same filter map, same honeypot key.
    expect(ALERTS_SHEET).toMatch(/submitSearchAlertSignup/)
    expect(ALERTS_SHEET).toMatch(/propertyType: 'A', postalCode: zip/)
    expect(ALERTS_SHEET).toMatch(/trap=\{\{ name: 'company'/)
    // Sell: same valuation navigation, and `from` still names the surface that
    // converted (2026-07-15 conversion audit).
    expect(SELL_SHEET).toMatch(/valuationPath\(\)/)
    expect(SELL_SHEET).toMatch(/params\.set\('address', typed\)/)
    expect(SELL_SHEET).toMatch(/params\.set\('from', pathname\)/)
  })
})
