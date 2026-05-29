import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Primitive contract tests. Each test asserts that a specific design
 * directive is baked into the source code of its lowest reusable unit
 * (a primitive component). When the test passes, every consumer of
 * that primitive inherits the rule automatically.
 *
 * These tests give G25 (the design-directive registry gate) a real
 * gate to reference for component-contract directives that are not
 * naturally caught by ESLint or `lint-design-tokens.js`.
 */

function readSrc(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

describe('design directive contracts', () => {
  it('D74 — SiteHeader nav renders at 15px (text-[15px])', () => {
    const src = readSrc('components/site/SiteHeader.tsx')
    expect(src).toMatch(/text-\[15px\]/)
  })

  it('D74 — design-system mockup CSS sets nav font to 15px', () => {
    const css = readSrc('design_system/ryan-realty/ui_kits/_shared/site-mockup.css')
    expect(css).toMatch(/\.nav a \{[^}]*font-size:\s*15px/)
  })

  it("D76 — PropertyHistory `mode` prop defaults to 'all'", () => {
    const src = readSrc('components/site/listing-detail/PropertyHistory.tsx')
    expect(src).toMatch(/mode\s*=\s*['"]all['"]/)
  })

  it('D76 — PropertyHistory filters only when mode === meaningful-only', () => {
    const src = readSrc('components/site/listing-detail/PropertyHistory.tsx')
    expect(src).toMatch(/mode\s*===\s*['"]meaningful-only['"]/)
  })

  it('D75 — PhotoGalleryLightbox primitive exists with the four nav features', () => {
    const src = readSrc('components/site/PhotoGalleryLightbox.tsx')
    expect(src).toMatch(/thumbnail/i)
    expect(src).toMatch(/onTouchStart/)
    expect(src).toMatch(/ArrowRight/)
    expect(src).toMatch(/of\s+\{count\}/)
  })

  it('D77 — listing-detail page imports the three Showcase-parity components', () => {
    const src = readSrc('app/listing/[listingKey]/page.tsx')
    expect(src).toMatch(/import\s*\{\s*ClimateRiskBlock\s*\}/)
    expect(src).toMatch(/import\s*\{\s*VacationRentalPotential\s*\}/)
    expect(src).toMatch(/import\s*\{\s*TransparentCMASummary\s*\}/)
  })

  it('D78 — city hero active count comes from getMarketPulse, not geo_snapshot all-count', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // Hero activeCount must derive from the market pulse (same source as
    // the MarketSnapshot card), never from snapshot.activeAllCount.
    expect(src).toMatch(/getMarketPulse\s*\(/)
    expect(src).toMatch(/activeCount\s*=\s*pulse\?\.activeCount/)
    expect(src).not.toMatch(/activeCount\s*=\s*snapshot\.activeAllCount/)
  })

  it('D83/D85 — defined neighborhoods section sources designated Bend polygons only', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    expect(src).toMatch(/bendNeighborhoodPolygons/)
    expect(src).toMatch(/items=\{bendNeighborhoodItems\}/)
  })

  it('D85 — golf & master-planned communities are a SEPARATE section from neighborhoods', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // distinct item list + its own RelatedAreas section
    expect(src).toMatch(/golfCommunityItems/)
    expect(src).toMatch(/items=\{golfCommunityItems\}/)
    expect(src).toMatch(/master-planned/)
    // the old combined "neighborhoods and communities" list must be gone
    expect(src).not.toMatch(/withinCityItems/)
  })

  it('D86 — area tiles source imagery from the canonical helpers', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    expect(src).toMatch(/getGeoTileImages/)
    expect(src).toMatch(/golfCommunityImage|GOLF_COMMUNITY_IMAGES/)
    // never hardcode a landing-page image path in the page
    expect(src).not.toMatch(/['"`]\/lp\/[^'"`]*\.(jpg|jpeg|png|webp)/)
  })

  it('D80 — city page surfaces a blog/guides section from real posts', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    expect(src).toMatch(/getRecentBlogPosts/)
    expect(src).toMatch(/ArticleGrid/)
  })

  it('D84 — city page has a separate "Explore other cities" section', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    expect(src).toMatch(/otherCityItems/)
    expect(src).toMatch(/Explore other cities/)
  })

  it('D87 — multi-word city geo_keys are slugified (La Pine, Powell Butte not dropped)', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // geo_key spaces normalized before the service-area match + in the href
    expect(src).toMatch(/replace\(\/\\s\+\/g, '-'\)/)
    expect(src).toMatch(/'la-pine'/)
  })
})
