import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
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

function walkTs(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walkTs(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

/**
 * Every source file one route is made of: its page plus its route-local `_v3`
 * modules, concatenated.
 *
 * A design directive binds the ROUTE, not one file inside it. ci:file-size-budget
 * refuses any file under app/ or lib/ at 600 lines and its instruction is to split
 * into `app/<route>/_v3/` rather than re-baseline (migration-recipe.md section 5.1),
 * so a directive asserted against `page.tsx` alone goes red on a sanctioned split —
 * and, the moment someone "fixes" it by narrowing the path, stops asserting the
 * directive at all. app/cities/[slug] moved the designated-Bend-district derivation
 * into _v3/city-places.ts on 2026-08-12 to clear that floor, which is what this
 * helper is for. Not used by the resort directives (D90/D92) on purpose:
 * ci:resort-definitions reads app/cities/[slug]/page.tsx alone for the same four
 * tokens, and the two must keep agreeing about where that wiring lives.
 */
function readRouteSrc(routeDir: string): string {
  const localDir = resolve(routeDir, '_v3')
  const locals = existsSync(localDir)
    ? readdirSync(localDir)
        .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'))
        .sort()
        .map((f) => readSrc(`${routeDir}/_v3/${f}`))
    : []
  return [readSrc(`${routeDir}/page.tsx`), ...locals].join('\n')
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

  it('D77 — listing-detail page carries no permanently-empty section', () => {
    const src = readSrc('app/listing/[listingKey]/page.tsx')
    // Climate risk retired 2026-07-28 (Matt). Its null branch shipped a fixed
    // paragraph citing FEMA/WUI/NOAA sources it never queried, identical on every
    // listing — a §0 violation. Zillow dropped climate scores too.
    expect(src).not.toMatch(/ClimateRiskBlock/)
    // Retired 2026-07-30. Both mounted with a hardcoded null prop and both
    // return null on null, so neither had EVER rendered. VacationRentalPotential
    // has no nightly-rate / occupancy / City-of-Bend-STR-permit source.
    // TransparentCMASummary is blocked on client confidentiality: every
    // public.cmas row is a client document, and the one client-ready CMA tied to
    // an Active listing is our own seller's, priced below their list price.
    // See design_system/ryan-realty/ui_kits/listing-detail/parity.json.
    // Matches an import or a JSX mount, not the prose above that explains why
    // they are gone.
    for (const name of ['VacationRentalPotential', 'TransparentCMASummary']) {
      expect(src).not.toMatch(new RegExp(`import[^\\n]*\\b${name}\\b`))
      expect(src).not.toMatch(new RegExp(`<${name}\\b`))
    }
  })

  it('D88 — listing-detail sections follow the buyer decision sequence', () => {
    const src = readSrc('app/listing/[listingKey]/page.tsx')
    const main = src.slice(src.indexOf('const main = ('), src.indexOf('const sidebar ='))
    const order = [
      'PriceCtaStrip',
      'PropertySpecs',
      'DescriptionBlock',
      'ListingLocationMap',
      'NeighborhoodMarketContext',
      'SchoolsBlock',
      'ParksNearbyBlock',
      'PropertyHistory',
      'MortgageCalculator',
      'RentalAnalysis',
      'ListingAttribution',
    ]
    const positions = order.map((name) => main.indexOf(`<${name}`))
    expect(positions.every((p) => p >= 0)).toBe(true)
    // Facts before prose, money before attribution, strictly increasing.
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('listing-detail chrome: one main, JSON-LD and capture stay', () => {
    const src = readSrc('app/listing/[listingKey]/page.tsx')
    expect(src).toMatch(/className="kb-root"/)
    expect(src).toMatch(/<KbFooter\b/)
    expect(src).toMatch(/<KbBreadcrumb\b/)
    expect(src).toMatch(/<MetadataBlock\b/)
    expect(src).toMatch(/type:\s*'realEstateListing'/)
    expect(src).toMatch(/type:\s*'breadcrumb'/)
    expect(src).toMatch(/<KbSectionTracker[\s/>]/)
    expect(src).toMatch(/<ListingLikeThisAlerts\b/)
    expect(src).toMatch(/<PriceCtaStrip\b/)
    expect(src).toMatch(/<LivePricingRead\b/)
    expect(src).not.toMatch(/<V3Chrome\b/)
  })

  it('ListingDetailShell is layout-only and does not emit JSON-LD', () => {
    const src = readSrc('components/site/listing-detail/ListingDetailShell.tsx')
    expect(src).not.toMatch(/MetadataBlock/)
    expect(src).not.toMatch(/realEstateListing/)
    expect(src).toMatch(/<BackToResults/)
  })

  it('listing like-this sheet keeps the capture contract', () => {
    const src = readSrc('components/site/listing-detail/ListingLikeThisSheet.client.tsx')
    expect(src).toMatch(/submitSearchAlertSignup/)
    expect(src).toMatch(/trap=\{\{\s*name:\s*['"]company['"]/)
    expect(src).toMatch(/company:\s*answers\.company/)
    expect(src).toMatch(/One email per new listing/)
    expect(src).toMatch(/Unsubscribe any time/)
    expect(src).toMatch(/id=["']listing-like-alerts["']/)
    expect(src).not.toMatch(/company:\s*['"]{2}/)
  })

  it('D78 — city hero active count comes from publishCityInventory, not geo_snapshot all-count', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // Complete address-set tiles win when the fetch is under the cap.
    // Empty / timed-out / capped fetches keep the pulse (R-020). Never
    // snapshot.activeAllCount.
    expect(src).toMatch(/getMarketPulse\s*\(/)
    expect(src).toMatch(/publishCityInventory\s*\(/)
    expect(src).toMatch(/activeCount(?::[^=]*)?=\s*publishedInventory\.count/)
    expect(src).not.toMatch(/activeCount\s*=\s*snapshot\.activeAllCount/)
    expect(src).not.toMatch(/activeCount(?::[^=]*)?=[\s\S]{0,80}\?\?\s*0\b/)
  })

  it('§0 — neighborhood active count is the public inventory DAL, never a second population', () => {
    const src = readSrc('app/cities/[slug]/[neighborhoodSlug]/page.tsx')
    expect(src).toMatch(/getNeighborhoodPublicInventory/)
    expect(src).toMatch(/activeCount(?::[^=]*)?=\s*inventory\?\.activeCount\s*\?\?\s*null/)
    expect(src).not.toMatch(/inBoundaryCount \?\? pulse\?\.activeCount \?\? neighborhood\.activeCount/)
    expect(src).not.toMatch(/activeCount \?\? mapFeatures\.length/)
    expect(src).not.toMatch(/activeCount\s*=\s*snapshot\.activeAllCount/)
    expect(src).toMatch(/withTimeoutFallbackResult\s*\(\s*getGeoBoundaryMapData/)
    expect(src).not.toMatch(/activeCount(?::[^=]*)?=[\s\S]{0,80}\?\?\s*0\b/)
  })

  it('§0 — Bend neighborhood index tiles read the same public inventory SoR', () => {
    const ledger = readSrc('lib/data/geo/getBendNeighborhoodLedger.ts')
    expect(ledger).toMatch(/getBendNeighborhoodPublicInventory/)
    expect(ledger).not.toMatch(/\.from\(\s*['"]listing_tile_mv['"]/)
    expect(ledger).not.toMatch(/\.eq\(\s*['"]boundary_neighborhood['"]/)
    const city = readSrc('app/cities/[slug]/page.tsx')
    expect(city).not.toMatch(/live\?\.activeCount \?\? 0/)
    const neighborhoods = readSrc('app/neighborhoods/page.tsx')
    expect(neighborhoods).not.toMatch(/stats\?\.activeCount \?\? 0/)
  })

  it('D83/D85 — defined neighborhoods section sources designated Bend polygons only', () => {
    // Route-wide: the polygon read moved to app/cities/[slug]/_v3/city-places.ts
    // (2026-08-12) to clear the 600-line floor. See readRouteSrc.
    const src = readRouteSrc('app/cities/[slug]')
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
    // THE CITY PAGE NO LONGER OWNS A FULL-BLEED HERO, so the three positive
    // assertions moved to the two files that now hold the behavior (P9, 2026-08-12).
    // PUBLIC_UI.md's locked Places opening is an Instrument and the same section
    // forbids a Stage over a number, so there is no hero photo on this route for
    // cityHero() to source or mediaCaption to caption. What the route DOES have is
    // place imagery in its ledgers, and that imagery resolves through
    // buildOtherCityItems, which calls cityHero() and renders NO thumbnail for an
    // unverified city — the rule this directive exists for, one level down.
    expect(src).toMatch(/cityHero\s*\(/)
    expect(src).toMatch(/const curatedHero = cityHero\(slug\)/)
    const shared = readSrc('lib/kb/place-sections.ts')
    expect(shared).toMatch(/cityHero\s*\(/)
    expect(shared).toMatch(/hero\.verified \? hero\.src : ''/)
    const index = readSrc('app/cities/page.tsx')
    expect(index).toMatch(/cityHero\s*\(/)
    expect(index).toMatch(/hero: cityHero\(slug\)/)
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
    // The RENDERER changed register, the section did not (P9, 2026-08-12). The route
    // moved onto components/site/v3, whose barrel law forbids importing the KB
    // register, so the guides section is a V3Ledger of real posts instead of
    // <KbArticles>. The directive is that the city page surfaces published posts for
    // that city — fetching them and rendering nothing still fails here, which is the
    // defect this contract exists to catch.
    expect(src).toMatch(/buildArticlePosts\(blogPosts\)/)
    expect(src).toMatch(/<KbArticles/)
    expect(src).toMatch(/articlePosts/)
  })

  it('D84 — city page has a separate "Explore other cities" section', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    expect(src).toMatch(/otherCityItems/)
    expect(src).toMatch(/Explore other cities/)
  })

  it('D87 — multi-word city geo_keys are slugified (La Pine, Powell Butte not dropped)', () => {
    // The "explore other cities" ledger moved into the shared place-section
    // module (one copy for city + neighborhood + community), so the slugify +
    // service-area allowlist contract is asserted at its new home. The city page
    // still normalizes geo_key spaces for its own community-snapshot lookup.
    const src = readSrc('app/cities/[slug]/page.tsx')
    expect(src).toMatch(/replace\(\/\\s\+\/g, '-'\)/)
    const shared = readSrc('lib/kb/place-sections.ts')
    // geo_key spaces normalized before the service-area match + in the href
    expect(shared).toMatch(/replace\(\/\\s\+\/g, '-'\)/)
    expect(shared).toMatch(/'la-pine'/)
    expect(shared).toMatch(/href: `\/cities\/\$\{cs\}`/)
  })

  it('D88 — communities rail renders ALL the city communities (built from cityComms, not a curated 3)', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // rail maps over the full city community set, not CITY_COMMUNITIES[slug] alone.
    // The ROW TYPE is route-local now (P9, 2026-08-12): KbCommunityItem is a plain
    // data shape, but importing it puts a components/site/kb module specifier back on
    // a page the roll just took off that register, which ci:public-ui counts as debt
    // on this exact page. CityCommunityItem in app/cities/[slug]/_v3/city-sections.ts
    // carries the same fields. The source of the list — `= cityComms` — is the part
    // this directive is about and it is unchanged.
    expect(src).toMatch(/const communityItems: KbCommunityItem\[\] = cityComms/)
    // marquee/video cards float to the front, then by active count
    expect(src).toMatch(/\.sort\(\(a, b\) => \(a\.video \? 0 : 1\)/)
  })

  it('D89 — neighborhood ledger hover photos are boundary-verified (real home inside the polygon)', () => {
    // Route-wide for the reason in readRouteSrc. The lookup is asserted by its KEY —
    // the polygon's own slug — because that is the directive: a district gets the
    // photo of a real home inside ITS boundary or no photo at all, never a
    // wrong-place one. The local variable holding the map may be called
    // neighborhoodPhotos or photos.
    const src = readRouteSrc('app/cities/[slug]')
    expect(src).toMatch(/assignNeighborhoodPhotos/)
    expect(src).toMatch(/(?:neighborhoodPhotos|photos)\.get\(c\.slug\)/)
    // and no stand-in when the polygon has no in-boundary listing photo
    expect(src).toMatch(/\.get\(c\.slug\) \?\? ''/)
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
    // Route-local row type for the same reason D88 states: KbTownItem is a plain data
    // shape, but importing it re-adds KB register debt to a page the P9 roll just took
    // off that register. CityPlaceItem carries the same fields. `= cityResorts(slug)`
    // — the is_resort registry membership that drops Three Rivers — is unchanged.
    expect(src).toMatch(/golfCommunityItems: KbTownItem\[\] = cityResorts\(slug\)/)
    expect(src).toMatch(/resortSfrCounts = resortActiveSfrCounts\(slug, resortTiles\)/)
    // golf/master-planned hover photos resolve from the curated resort image map
    expect(src).toMatch(/CITY_RESORT_LEDGER_IMG\[c\.slug\]/)
  })

  it('D93 — activity section is "Latest market activity" with per-row listing thumbnails', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // The heading is the same seven characters shorter of a literal: V3Ledger types
    // `heading` as the branded V3Text, so `heading="Latest market activity"` is a
    // compile error on the v3 register and the only spelling that exists is the
    // v3Text() constructor (P9, 2026-08-12). The section name is unchanged.
    expect(src).toMatch(/heading="Latest market activity"/)
    // The row shaping moved into the shared place-section module, so all three
    // place pages (city / neighborhood / community) inherit the thumbnail.
    const shared = readSrc('lib/kb/place-sections.ts')
    expect(shared).toMatch(/imageUrl: a\.PhotoURL/)
    // app/communities/[slug]/page.tsx left this list on 2026-08-12 with the P9
    // migration to components/site/v3. The feed was fetched city-wide there
    // (cities: [cityName]) while the section was labelled with the COMMUNITY's
    // name, so "Live · Tetherow" sat over Bend and Petrosa rows — the label was
    // untrue before the section was cut. The community node now carries a door
    // to the surface that owns the feed instead of a mislabelled copy of it.
    // See design_system/ryan-realty/ui_kits/community/parity.json.
    for (const page of [
      'app/cities/[slug]/page.tsx',
      'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
    ]) {
      expect(readSrc(page)).toMatch(/buildActivityItems\(/)
    }
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
  it('D95 — community page carries the PAGE CONTRACT', () => {
    const src = readSrc('app/communities/[slug]/page.tsx')
    expect(src).toMatch(/className="kb-root"/)
    expect(src).toMatch(/<CommunityPageTracker/)
    expect(src).toMatch(/<KbSectionTracker/)
    expect(src).toMatch(/<MetadataBlock/)
    expect(src).toMatch(/<KbResortOverview/)
    expect(src).toMatch(/getResortCommunityContent\(resortSlug\)/)
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
    expect(src).toMatch(/boundaryReliable/)
    expect(src).toMatch(/resortBoundary \?\? \(boundaryReliable \? boundaryMapData\.polygon : null\)/)
  })

  it('D104 — Field photo caps print price, beds/baths/sqft, and street', () => {
    const src = readSrc('components/site/v3/V3Field.tsx')
    expect(src).toMatch(/v3-field__photo-meta/)
    expect(src).toMatch(/item\.meta/)
    expect(src).not.toMatch(/from\('listings'\)/)
  })

  it('D105 — city/ZIP map first paint is a listing photograph, not cream', () => {
    const src = readSrc('app/central-oregon/_v3/PlaceFieldMap.client.tsx')
    expect(src).toMatch(/v3-field__map-frame/)
    expect(src).toMatch(/v3-field__map-poster/)
    expect(src).toMatch(/props\.posterSrc/)
  })

  it('D107 — closed-sales explorer year picker starts at 1998', () => {
    const src = readSrc('app/housing-market/history/_v3/HistoryFilterSheet.client.tsx')
    expect(src).toMatch(/HISTORY_FROM_YEAR = 1998/)
    expect(src).not.toMatch(/YEAR_OPTIONS = \[2016/)
  })

  it('D106 — public market annual and feature cubes never scan listings', () => {
    const market = readSrc('lib/data/analytics/getCoMarketAnnual.ts')
    const feature = readSrc('lib/data/analytics/getCoFeatureAnnual.ts')
    expect(market).not.toMatch(/from\('listings'\)/)
    expect(market).not.toMatch(/live_aggregate/)
    expect(feature).not.toMatch(/from\('listings'\)/)
    expect(feature).not.toMatch(/live_aggregate/)
  })

  it('D109 — one chart grammar for public, admin, and documents', () => {
    const plot = readSrc('lib/charts/plot.ts')
    const v3 = readSrc('components/site/v3/V3Chart.tsx')
    const admin = readSrc('components/admin/v2/AChart.tsx')
    const adminWrap = readSrc('app/admin/(protected)/analytics/_components/charts.tsx')
    const cma = readSrc('lib/cma/render.ts')
    expect(plot).toMatch(/export function buildLinePlot/)
    expect(plot).toMatch(/export function buildBarPlot/)
    expect(plot).toMatch(/export function buildMixPlot/)
    expect(plot).toMatch(/A cubic would invent/)
    expect(v3).toMatch(/from '@\/lib\/charts\/plot'/)
    expect(v3).not.toMatch(/from ['"]recharts['"]/)
    expect(admin).toMatch(/from '@\/lib\/charts\/plot'/)
    expect(admin).not.toMatch(/from ['"]recharts['"]/)
    expect(adminWrap).not.toMatch(/from ['"]recharts['"]/)
    expect(cma).toMatch(/from '@\/lib\/charts\/plot'/)
    expect(cma).toMatch(/from '@\/lib\/charts\/print-svg'/)
    expect(cma).toMatch(/from '@\/lib\/cma\/seasonality-chart'/)
    const live = [
      'components/market/MarketCoreCharts.tsx',
      'components/reports/SalesReportCharts.tsx',
      'components/tools/EquityProjectionChart.client.tsx',
      'app/admin/(protected)/crm/reporting/agent-activity/AgentActivityChart.tsx',
    ]
    for (const file of live) {
      expect(readSrc(file)).not.toMatch(/from ['"]recharts['"]/)
    }
    expect(readSrc('components/market/MarketCoreCharts.tsx')).toMatch(/from '@\/components\/site\/v3'/)
    expect(readSrc('components/reports/SalesReportCharts.tsx')).toMatch(/<V3Chart/)
    expect(readSrc('components/tools/EquityProjectionChart.client.tsx')).toMatch(/<V3Chart/)
    expect(readSrc('app/admin/(protected)/crm/reporting/agent-activity/AgentActivityChart.tsx')).toMatch(/<AChart/)
    expect(readSrc('app/admin/(protected)/reports/custom/CustomReportBuilder.tsx')).toMatch(/ReportTimeSeriesChart/)
    expect(readSrc('app/admin/(protected)/financials/page.tsx')).toMatch(/<AChart/)
    expect(readSrc('lib/cma/immersive.ts')).toMatch(/from '@\/lib\/cma\/seasonality-chart'/)
    expect(readSrc('lib/cma/seasonality-chart.ts')).toMatch(/from '@\/lib\/charts\/plot'/)
    const rechartsHits = [...walkTs('app'), ...walkTs('components')].filter((file) =>
      /from ['"]recharts['"]/.test(readFileSync(file, 'utf8')),
    )
    expect(rechartsHits).toEqual([])
    expect(readSrc('package.json')).not.toMatch(/"recharts"/)
  })

  it('D108 — weekly full mart rebuild from 1998 and heartbeat on the floor year', () => {
    const weekly = readSrc('app/api/cron/rebuild-analytics-marts-full/route.ts')
    const nightly = readSrc('app/api/cron/rebuild-analytics-marts/route.ts')
    const dal = readSrc('lib/data/analytics/getCoMarketAnnual.ts')
    const vercel = readSrc('vercel.json')
    expect(dal).toMatch(/MART_FLOOR_YEAR = 1998/)
    expect(dal).toMatch(/assertMartFloorYear/)
    expect(weekly).toMatch(/MART_FLOOR_YEAR/)
    expect(weekly).toMatch(/assertMartFloorYear/)
    expect(nightly).toMatch(/assertMartFloorYear/)
    expect(vercel).toMatch(/\/api\/cron\/rebuild-analytics-marts-full/)
  })

  it('D110 — listing map popup is the brand card, not a Google InfoWindow', () => {
    const wrap = readSrc('components/site/listing-detail/ListingLocationMap.tsx')
    const client = readSrc('components/site/listing-detail/ListingLocationMap.client.tsx')
    const page = readSrc('app/listing/[listingKey]/page.tsx')
    expect(wrap).toMatch(/photoUrl/)
    expect(wrap).toMatch(/MapListingPopup|popup=/)
    expect(client).toMatch(/from '@\/components\/search\/MapListingPopup'/)
    expect(client).toMatch(/<MapListingPopup/)
    expect(client).not.toMatch(/<InfoWindow[\s>]/)
    expect(page).toMatch(/photoUrl=\{photos\[0\]/)
    expect(page).toMatch(/href=\{listingHref\}/)
    expect(page).not.toMatch(/from ['"]twilio['"]/)
    expect(page).not.toMatch(/lookingAtWake|sendLookingAt/)
  })

  it('D111 — sentence search writes existing filter params', () => {
    const page = readSrc('app/search/page.tsx')
    const box = readSrc('components/search/SentenceSearch.tsx')
    const parse = readSrc('lib/search/sentence-to-params.ts')
    expect(page).toMatch(/<SentenceSearch/)
    expect(box).toMatch(/sentenceToParams/)
    expect(box).toMatch(/Search listings/)
    expect(parse).toMatch(/parseSearchQuery/)
    expect(parse).toMatch(/ALL_SEARCH_URL_PARAMS/)
  })

  it('D112 — listing HouseMe report is stamp-backed and refuses invention', () => {
    const page = readSrc('app/listing/[listingKey]/page.tsx')
    const live = readSrc('components/site/listing-detail/LivePricingRead.tsx')
    const report = readSrc('components/site/listing-detail/HouseMeReport.tsx')
    expect(page).toMatch(/<LivePricingRead/)
    expect(live).toMatch(/<HouseMeReport/)
    expect(report).toMatch(/listing_pricing_reads/)
    expect(report).not.toMatch(/0-10|0–10|5-year|5 year/)
    expect(report).not.toMatch(/\bAI\b/)
  })

  it('D113 — Continue with Google is the comms door on one card', () => {
    const login = readSrc('components/auth/LoginForm.tsx')
    const signup = readSrc('components/auth/SignupForm.tsx')
    const card = readSrc('components/auth/GoogleCommsCard.tsx')
    const gate = readSrc('lib/cma/register-gate.ts')
    expect(login).toMatch(/<GoogleCommsCard/)
    expect(signup).toMatch(/<GoogleCommsCard/)
    expect(card).toMatch(/Continue with Google/)
    expect(card).toMatch(/SMS_CONSENT_TEXT|SmsConsentDisclosure/)
    expect(gate).toMatch(/Your report on/)
    expect(gate).not.toMatch(/Almost there/)
  })

  it('D114 — community Homes and Market doors keep the place filter', () => {
    const page = readSrc('app/communities/[slug]/page.tsx')
    // Counted-set door is this page's list (#homes). The literal-name browse
    // undercounts alias-aware resorts, so "See every" must not leave the set.
    expect(page).toMatch(/viewAllHref="#homes"/)
    expect(page).toMatch(/href: '#homes'/)
    expect(page).toMatch(/homesForSalePath\(cityName, community\.subdivision\)/)
  })

  it('D103 — homepage opens on photographed homes, towns, and the region map', () => {
    const page = readSrc('app/page.tsx')
    expect(page).not.toMatch(/from ['"]@\/components\/site\/v3\/ArrivalIntent/)
    expect(page).not.toMatch(/<ArrivalIntent/)
    expect(page).not.toMatch(/What are you trying to do/)
    expect(page).toMatch(/<KbHero/)
    expect(page).toMatch(/<KbExploreTowns/)
    expect(page).toMatch(/<KbFeatured/)
    expect(page).toMatch(/<KbListingMap/)
    expect(page).toMatch(/<KbCommunities/)
  })

  it('D103b — town-door photographs are visible at rest (not hover-only)', () => {
    const css = readSrc('components/site/kb/kb.css')
    const fill = css.match(/\.kb-root \.town-fill\{[^}]+\}/)?.[0] ?? ''
    expect(fill).toMatch(/opacity:\s*1/)
    expect(fill).not.toMatch(/opacity:\s*0/)
    expect(css).not.toMatch(/town-row:hover \.town-fill\{opacity:1\}/)
    expect(css).toMatch(/town-row:has\(\.town-fill\)\{background:var\(--navy\)/)
  })

  it('D99 — homepage market HUD is live pulse, not a second sale-series caption (§0)', () => {
    const page = readSrc('app/page.tsx')
    expect(page).toMatch(/from ['"]@\/components\/site\/kb\/KbMarketHud/)
    expect(page).toMatch(/<KbMarketHud/)
    const charts = readSrc('app/housing-market/_v3/market-charts.ts')
    expect(charts).toMatch(/Median sale price by month, recent years/)
  })

  it('D101 — homepage market HUD stays on the live pulse, not a second chart atom', () => {
    const page = readSrc('app/page.tsx')
    expect(page).toMatch(/<KbMarketHud/)
    expect(page).not.toMatch(/buildRegionMedianChart/)
  })

  it('D102 — KbFeatured has no remaining page mount (E-CUT retired /area-guides)', () => {
    const areaGuides = readSrc('app/area-guides/page.tsx')
    expect(areaGuides).toMatch(/permanentRedirect\(['"]\/cities['"]\)/)
    expect(areaGuides).not.toMatch(/<KbFeatured\b/)
  })

  it('D100 — community page RENDERS rich resort content (amenities/golf/membership/builders)', () => {
    const src = readSrc('app/communities/[slug]/page.tsx')
    expect(src).toMatch(/getResortCommunityContent\(resortSlug\)/)
    expect(src).toMatch(/<KbResortOverview/)
    const overview = readSrc('components/site/kb/KbResortOverview.tsx')
    expect(overview).toMatch(/amenities|At a glance|Membership|Builders/)
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

  it('V3SectionTracker is a dual-sink island, not a seventh pattern', () => {
    const src = readSrc('components/site/v3/V3SectionTracker.client.tsx')
    const barrel = readSrc('components/site/v3/index.ts')
    expect(barrel).toMatch(/export \{ V3SectionTracker \} from '\.\/V3SectionTracker\.client'/)
    expect(barrel).toMatch(/not a seventh pattern/)
    expect(src).toMatch(/\.kb-root section\[id\], \.v3 section\[id\]/)
    expect(src).toMatch(/intersectionRatio >= 0\.55/)
    expect(src).toMatch(/location\.href/)
    expect(src).toMatch(/trackEvent\('section_view'/)
    expect(src).toMatch(/\/api\/visitors\/track/)
    expect(src).toMatch(/milestones = \[25, 50, 75, 100\]/)
    expect(src).toMatch(/pageTypeFromPath/)
  })
})

describe('place-family indexes', () => {
  it('neighborhoods and subdivisions indexes exist and use the KB index language', () => {
    const neighborhoods = readSrc('app/neighborhoods/page.tsx')
    const subdivisions = readSrc('app/subdivisions/page.tsx')
    expect(neighborhoods).toMatch(/from '@\/lib\/data'/)
    expect(neighborhoods).toMatch(/getBendNeighborhoodLedger/)
    expect(neighborhoods).toMatch(/KbBreadcrumb/)
    expect(neighborhoods).toMatch(/\/cities\/\$\{n\.citySlug\}\/\$\{n\.slug\}/)
    expect(subdivisions).toMatch(/from '@\/lib\/data'/)
    expect(subdivisions).toMatch(/getRegistryPlatPublicInventory/)
    expect(subdivisions).toMatch(/CommunityIndexBrowser/)
    expect(subdivisions).toMatch(/href: `\/subdivisions\/\$\{/)
  })

  it('Areas nav and footer open both indexes', () => {
    const nav = readSrc('lib/site-nav.ts')
    expect(nav).toMatch(/href: '\/neighborhoods'/)
    expect(nav).toMatch(/href: '\/subdivisions'/)
    expect(nav).toMatch(/label: 'All neighborhoods'/)
    expect(nav).toMatch(/label: 'All subdivisions'/)
  })

  it('neighborhood and plat detail generateStaticParams are not empty stubs', () => {
    const neighborhood = readSrc('app/cities/[slug]/[neighborhoodSlug]/page.tsx')
    const plat = readSrc('app/subdivisions/[slug]/page.tsx')
    expect(neighborhood).toMatch(/BEND_NEIGHBORHOOD_DISTRICTS/)
    expect(neighborhood).not.toMatch(/generateStaticParams[\s\S]{0,200}return\s*\[\s*\]/)
    expect(plat).toMatch(/resolveSubdivisionAreaRedirect/)
    expect(plat).not.toMatch(/generateStaticParams[\s\S]{0,80}return\s*\[\s*\]/)
  })
})

