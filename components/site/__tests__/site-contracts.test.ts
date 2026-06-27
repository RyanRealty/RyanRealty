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
  it('D74 — primary nav renders at 15px (text-[15px])', () => {
    // Nav triggers moved from SiteHeader into the MegaMenu client component
    // (editorial mega-menu redesign, 2026-06-03). The 15px directive is unchanged.
    const src = readSrc('components/site/nav/MegaMenu.tsx')
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
    // Experience System Geo archetype v3.1 uses editorial index rows (no tile
    // RelatedAreas) for neighborhoods — bendNeighborhoodItems still drives the section.
    expect(src).toMatch(/bendNeighborhoodItems/)
  })

  it('D85 — golf & master-planned communities are a SEPARATE section from neighborhoods', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // distinct item list + its own section (editorial index rows, not RelatedAreas tiles)
    expect(src).toMatch(/golfCommunityItems/)
    expect(src).toMatch(/master-planned/)
    // the old combined "neighborhoods and communities" list must be gone
    expect(src).not.toMatch(/withinCityItems/)
  })

  it('D86 — city imagery sources from the VERIFIED cityHero registry (Family 4, 2026-06-10)', () => {
    // v3.2 supersedes the v3.1 tile-imagery contract: the seeded-pool
    // getGeoTileImages/golfCommunityImage path put wrong-city photos on city
    // pages (Tumalo Falls as the Bend hero). Imagery now resolves ONLY
    // through cityHero() — the visually-verified per-city registry — and a
    // city without a verified photo renders the LABELED regional fallback.
    const src = readSrc('app/cities/[slug]/page.tsx')
    expect(src).toMatch(/cityHero\s*\(/)
    expect(src).toMatch(/mediaCaption/)
    expect(src).toMatch(/Regional view/)
    // the unverified seeded-pool resolvers must stay out of this page
    expect(src).not.toMatch(/getGeoTileImages|getSurfaceImage|pickGeoImage/)
    // never hardcode a landing-page image as city HERO/tile imagery. The curated
    // /lp/central-oregon-golf/ set IS a verified golf-community source for the
    // golf-ledger hover photos (RESORT_IMG) — allow only that path.
    const withoutGolf = src.replace(/\/lp\/central-oregon-golf\/[^'"`]*/g, '')
    expect(withoutGolf).not.toMatch(/['"`]\/lp\/[^'"`]*\.(jpg|jpeg|png|webp)/)
  })

  it('D80 — city page surfaces a blog/guides section from real posts', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    expect(src).toMatch(/getRecentBlogPosts/)
    // KB migration (Phase 9): the blog/guides section renders via KbArticles.
    expect(src).toMatch(/KbArticles/)
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

  it('D88 — communities rail renders ALL the city communities (built from cityComms, not a curated 3)', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // rail maps over the full city community set, not CITY_COMMUNITIES[slug] alone
    expect(src).toMatch(/const communityItems: KbCommunityItem\[\] = cityComms/)
    // marquee/video cards float to the front, then by active count
    expect(src).toMatch(/\.sort\(\(a, b\) => \(a\.video \? 0 : 1\)/)
  })

  it('D89 — neighborhood ledger hover photos are boundary-verified (real home inside the polygon)', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    expect(src).toMatch(/assignNeighborhoodPhotos/)
    expect(src).toMatch(/neighborhoodPhotos\.get\(c\.slug\)/)
  })

  it('D90/D92 — resort active counts are ALIAS-AWARE, UNCAPPED, and shared by rail + golf ledger (§0)', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // counted from the registry aliases, not the literal community name (which
    // undercounts every resort — Widgi 0 vs true 48, Tetherow 14 vs true 43)
    expect(src).toMatch(/resortActiveSfrCounts\(slug, resortTiles\)/)
    // sourced from a PAGINATED fetch past the 1000-row cap (Bend has ~1044 SFR)
    expect(src).toMatch(/fetchAllCityActiveSfr\(cityName\)/)
    // golf ledger uses the alias-aware count + is_resort membership (drops Three Rivers)
    expect(src).toMatch(/activeCount: resortSfrCounts\.get\(c\.slug\)/)
    expect(src).toMatch(/golfCommunityItems: KbTownItem\[\] = cityResorts\(slug\)/)
    // the rail card for a resort shows the SAME alias-aware count (no two-number mismatch)
    expect(src).toMatch(/resortSlug \? resortSfrCounts\.get\(resortSlug\)/)
    // golf/master-planned hover photos resolve from the curated resort image map
    expect(src).toMatch(/RESORT_IMG\[c\.slug\]/)
  })

  it('D93 — activity section is "Latest market activity" with per-row listing thumbnails', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    expect(src).toMatch(/heading="Latest market activity"/)
    expect(src).toMatch(/imageUrl: a\.PhotoURL/)
    const act = readSrc('components/site/kb/KbActivity.client.tsx')
    expect(act).toMatch(/act-thumb/)
    expect(act).toMatch(/imageUrl\?: string \| null/)
  })

  it('D94 — open houses rail is interactive (click/hover swaps the lead) and scrollable', () => {
    const oh = readSrc('components/site/kb/KbOpenHouses.client.tsx')
    expect(oh).toMatch(/useState/)
    expect(oh).toMatch(/setActiveIndex/)
    // rail items are buttons that promote into the lead
    expect(oh).toMatch(/<button[\s\S]*?className="oh-rail-card"/)
    expect(oh).toMatch(/onClick=\{\(\) => setActiveIndex\(i\)\}/)
  })

  it('D91 — market structured data survives a getMarketPulse timeout (snapshot fallback)', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // JSON-LD must not vanish on a slow/missing market row — fall back to the snapshot
    expect(src).toMatch(/pulse \?\? \{/)
    expect(src).toMatch(/snapshot\.activeSfrCount/)
  })

  // ── Phase 9 wave 2: community page (golf/resort/master-planned) ──────────────
  it('D95 — community page is the KB stack (reuses the shared library, PAGE CONTRACT)', () => {
    const src = readSrc('app/communities/[slug]/page.tsx')
    expect(src).toMatch(/className="kb-root"/)
    expect(src).toMatch(/<CommunityPageTracker/)
    expect(src).toMatch(/<KbSectionTracker pageType="community"/)
    expect(src).toMatch(/<MetadataBlock schemas=\{communitySchemas\}/)
    // resilient JSON-LD: per-field snapshot/community fallback so the FAQ + Dataset
    // survive a pulse timeout (field-level pattern carries the extra grounded FAQ
    // fields pulse alone lacks — soldCount, subdivisions, HOA).
    expect(src).toMatch(/medianListPrice: pulse\?\.medianListPrice \?\? snapshot/)
  })

  it('D96 — community resort count + listings are ALIAS-AWARE (Widgi shows ~48, not 0) (§0)', () => {
    const src = readSrc('app/communities/[slug]/page.tsx')
    // count matches the city ledger via the same alias-aware helper
    expect(src).toMatch(/resortActiveSfrCounts\(citySlug, citySfrTiles\)/)
    // the map/featured/ticker use the resort's alias-matched tiles, not the empty literal-name set
    expect(src).toMatch(/resortTilesForSlug\(citySlug, resortSlug, citySfrTiles\)/)
    expect(src).toMatch(/const useResortTiles = resortTiles\.length > 0/)
    // a compound resort slug canonicalizes to the bare slug (no duplicate undercounted page)
    expect(src).toMatch(/redirect\(`\/communities\/\$\{resortMatch\.slug\}`\)/)
  })

  it('D97 — community page preserves boundary reliability (no oversized polygon / count)', () => {
    const src = readSrc('app/communities/[slug]/page.tsx')
    expect(src).toMatch(/UNRELIABLE_BOUNDARY_SLUGS/)
    expect(src).toMatch(/isBoundaryReliable\(slug\)/)
    // an unreliable boundary draws NO polygon
    expect(src).toMatch(/!boundaryReliable\s*\n?\s*\?\s*null/)
  })

  it('D99 — Market HUD does not pair a median-SALE delta with the median-LIST headline (§0)', () => {
    const hud = readSrc('components/site/kb/KbMarketHud.client.tsx')
    // the list-price headline block must not render a "median sale" delta pill
    const headlineBlock = hud.slice(hud.indexOf('Median list price'), hud.indexOf('Median list price') + 400)
    expect(headlineBlock).not.toMatch(/median sale/i)
    // the sale-trend change, when shown, is attached to the median-close chart caption
    expect(hud).toMatch(/over the window/)
  })

  it('D101 — market chart is the reusable interactive KbMarketChart (toggle years, axis, a11y)', () => {
    const hud = readSrc('components/site/kb/KbMarketHud.client.tsx')
    expect(hud).toMatch(/<KbMarketChart/)
    const chart = readSrc('components/site/kb/KbMarketChart.client.tsx')
    expect(chart).toMatch(/aria-pressed/) // year toggle chips
    expect(chart).toMatch(/onKeyDown/) // keyboard cursor
    expect(chart).toMatch(/kbmc-sr/) // screen-reader data table
    expect(chart).toMatch(/loading/) // loading state
    expect(chart).toMatch(/Not enough/) // empty state
  })

  it('D102 — featured grid never orphans a tiny tile (count capped to fill the module)', () => {
    const feat = readSrc('components/site/kb/KbFeatured.client.tsx')
    expect(feat).toMatch(/\[12, 9, 6, 3\]\.find/)
    expect(feat).toMatch(/shown\.map/)
  })

  it('D100 — community page RENDERS rich resort content (amenities/golf/membership/builders)', () => {
    const src = readSrc('app/communities/[slug]/page.tsx')
    expect(src).toMatch(/getResortCommunityContent\(resortSlug\)/)
    expect(src).toMatch(/<KbResortOverview/)
    expect(src).toMatch(/content=\{richContent\}/)
    // the overview component carries all the dropped rich sections
    const ov = readSrc('components/site/kb/KbResortOverview.tsx')
    expect(ov).toMatch(/id="overview"/)
    expect(ov).toMatch(/id="amenities"/)
    expect(ov).toMatch(/id="golf"/)
    expect(ov).toMatch(/id="membership"/)
    expect(ov).toMatch(/id="builders"/)
  })

  it('D98 — resort/golf definitions are locked by a gate (registry + alias-aware wiring)', () => {
    const gate = readSrc('scripts/check-resort-definitions.mjs')
    expect(gate).toMatch(/is_resort/)
    expect(gate).toMatch(/subdivision_aliases/)
    expect(gate).toMatch(/resortActiveSfrCounts/)
    // wired into the gate chain
    const pkg = readSrc('package.json')
    expect(pkg).toMatch(/ci:resort-definitions/)
  })
})
