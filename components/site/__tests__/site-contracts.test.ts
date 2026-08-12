import { existsSync, readdirSync, readFileSync } from 'node:fs'
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

  it('D78 — city hero active count comes from getMarketPulse, not geo_snapshot all-count', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // Hero activeCount must derive from the market pulse (same source as
    // the MarketSnapshot card), never from snapshot.activeAllCount. The
    // `: number | null` annotation is required (§0 below), so allow it here.
    expect(src).toMatch(/getMarketPulse\s*\(/)
    expect(src).toMatch(/activeCount(?::[^=]*)?=\s*pulse\?\.activeCount/)
    expect(src).not.toMatch(/activeCount\s*=\s*snapshot\.activeAllCount/)
    // §0 UNKNOWN IS NOT ZERO. `pulse` is a withTimeoutFallback whose fallback is
    // null, so `?? 0` published a fabricated "0 homes for sale" on every timeout.
    expect(src).not.toMatch(/activeCount(?::[^=]*)?=\s*pulse\?\.activeCount\s*\?\?\s*0/)
  })

  it('§0 — neighborhood active count never resolves a degraded read to zero', () => {
    const src = readSrc('app/cities/[slug]/[neighborhoodSlug]/page.tsx')
    // THE SINGLE `activeCount` RESOLUTION IS GONE ON PURPOSE, AND THIS ASSERTION
    // FOLLOWS THE BEHAVIOR RATHER THAN THE VARIABLE (P9, 2026-08-12). One chain
    // ending `inBoundaryCount ?? pulse?.activeCount ?? neighborhood.activeCount`
    // published ONE number for three different populations: the pins are every
    // PropertyType A listing in the polygon (the bucket also holds townhouses and
    // condominiums), the pulse row is the Single Family Residence SUBTYPE of that
    // same polygon, and the neighborhood row is a name match over the whole
    // residential index. Verified live 2026-08-12: bend-southern-crossing is 2
    // single-family against 16 in the bucket. Publishing whichever one answered
    // first under the words "active single-family listings" made it false in the
    // H1, the visible Q&A, the FAQPage and the Dataset. The page now names TWO
    // counts and says why they differ, so the anti-zero rule this test exists for
    // is asserted at both of its new homes instead of on the retired chain.
    //
    // Home 1 — the Instrument's headline count: the pulse row, else the
    // neighborhood row. Neither branch floors to zero, and both are non-empty
    // tuples so the figure is never silently dropped.
    expect(src).toMatch(/liveFigures\(pulse/)
    expect(src).toMatch(/liveFallbackFigures\(neighborhood/)
    // Home 2 — the Field's count publishes ONLY from a read that succeeded, against
    // a polygon that exists, below the RPC row cap. Anything else renders the reason.
    expect(src).toMatch(/countIsHonest\s*=[\s\S]{0,200}boundaryRead\.ok/)
    expect(src).toMatch(/count=\{\s*\n?\s*countIsHonest/)
    expect(src).not.toMatch(/activeCount\s*=\s*snapshot\.activeAllCount/)
    // The boundary pins must come from the `.ok`-reporting variant and be gated
    // on it: a timed-out read yields `{ pins: [] }`, which is indistinguishable
    // from a genuinely empty neighborhood.
    expect(src).toMatch(/withTimeoutFallbackResult\s*\(\s*getGeoBoundaryMapData/)
    expect(src).toMatch(/boundaryRead\.ok/)
    // No zero floor anywhere in the resolution: unknown must stay unknown.
    expect(src).not.toMatch(/activeCount(?::[^=]*)?=[\s\S]{0,200}\?\?\s*0\b/)
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
    expect(src).toMatch(/buildOtherCityItems\(/)
    const shared = readSrc('lib/kb/place-sections.ts')
    expect(shared).toMatch(/cityHero\s*\(/)
    // and blank, not a regional stand-in: a wrong-place photo beside a named place
    // is the exact defect D86 exists to prevent.
    expect(shared).toMatch(/hero\.verified \? hero\.src : ''/)
    // The LABELED regional fallback still ships where a city photo is still full
    // bleed — the cities index — and it is still gated on `verified`.
    const index = readSrc('app/cities/page.tsx')
    expect(index).toMatch(/cityHero\s*\(/)
    expect(index).toMatch(/hero\.verified \? null :/)
    expect(index).toMatch(/Regional view/)
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
    expect(src).toMatch(/articleRows\(articlePosts\)/)
    expect(src).toMatch(/heading=\{v3Text\(`\$\{cityName\} guides`\)\}/)
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
    expect(src).toMatch(/const communityItems: CityCommunityItem\[\] = cityComms/)
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
    expect(src).toMatch(/golfCommunityItems: CityPlaceItem\[\] = cityResorts\(slug\)/)
    // AND THE COUNT MAP IS EMPTY, NOT ZERO-FILLED, WHEN THE UNCAPPED READ DEGRADED
    // (§0, added 2026-08-12). resortActiveSfrCounts seeds every registered resort at
    // 0, so handing it the empty array a TIMEOUT returns produced a full map of
    // zeroes, and `.get(slug) ?? fallback` never reached its fallback: every resort
    // in the city published "0 active" under a live-MLS trace. Gating the map on the
    // read's own `.ok` is what makes the `??` chain below it reachable.
    expect(src).toMatch(/resortRead\.ok\s*\n?\s*\?\s*resortActiveSfrCounts/)
    // the rail card for a resort shows the SAME alias-aware count (no two-number mismatch)
    expect(src).toMatch(/resortSlug \? resortSfrCounts\.get\(resortSlug\)/)
    // golf/master-planned hover photos resolve from the curated resort image map
    expect(src).toMatch(/RESORT_IMG\[c\.slug\]/)
  })

  it('D93 — activity section is "Latest market activity" with per-row listing thumbnails', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // The heading is the same seven characters shorter of a literal: V3Ledger types
    // `heading` as the branded V3Text, so `heading="Latest market activity"` is a
    // compile error on the v3 register and the only spelling that exists is the
    // v3Text() constructor (P9, 2026-08-12). The section name is unchanged.
    expect(src).toMatch(/heading=\{v3Text\('Latest market activity'\)\}/)
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
  it('D95 — community page carries the PAGE CONTRACT on the v3 barrel', () => {
    const src = readSrc('app/communities/[slug]/page.tsx')
    // The register moved on 2026-08-12 (P9): the body is components/site/v3, so
    // the token scope is V3_ROOT_CLASS instead of kb-root. Every element of the
    // page contract itself is unchanged, and each one is asserted below.
    expect(src).toMatch(/className=\{V3_ROOT_CLASS\}/)
    expect(src).not.toMatch(/className="kb-root"/)
    expect(src).toMatch(/<CommunityPageTracker/)
    expect(src).toMatch(/<KbSectionTracker pageType="community"/)
    expect(src).toMatch(/<MetadataBlock schemas=\{communitySchemas\}/)
    // resilient JSON-LD, resolved ONCE. The FAQ + Dataset take the same
    // `medianListPrice` the Instrument renders (shorthand property), so the
    // structured data cannot disagree with the page it describes. This replaced
    // a second, independent fallback chain here that ended at
    // `community.medianPrice` — a median CLOSED SALE price — which put a sale
    // figure in a list-price field in the JSON-LD as well as on the page. (§0)
    expect(src).toMatch(/marketFaqInput: MarketFaqInput = \{[\s\S]*?\n {4}medianListPrice,\n/)
    expect(src).not.toMatch(/medianListPrice: pulse\?\.medianListPrice \?\? snapshot\?\.medianListPrice \?\? community\.medianPrice/)
    // and the ONE resolution still degrades pulse -> snapshot, so a pulse
    // timeout still yields a Dataset rather than a hole.
    expect(src).toMatch(/pulse \?\? \{/)
    expect(src).toMatch(/snapshot\?\.refreshedAt/)
    // FAQPage JSON-LD used to come out of FAQBlock's includeJsonLd. FAQBlock is
    // gone, so the payload must be emitted from the schemas array instead, built
    // from the SAME faqs array the Quiet block renders.
    const schemaBuilder = readSrc('app/communities/[slug]/_v3/community-metadata.ts')
    expect(schemaBuilder).toMatch(/type: 'faqPage', items: input\.faqs/)
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
    // 2026-07-29 (Matt): the county plat union — the TRUE footprint — ALWAYS
    // draws when present; the unreliable-hull baseline gates ONLY the stored
    // boundary polygon. The old ordering nulled both for baseline slugs, so
    // caldera-springs/crosswater/BBR shipped maps with no boundary at all.
    expect(src).toMatch(
      /resortBoundary \?\? \(boundaryReliable \? boundaryMapData\.polygon : null\) \?\? null/,
    )
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
    // The directive is that the content REACHES THE READER, not that one named
    // component draws it (owner: "every resort/golf/planned community needs an
    // overview section… amenities"). On the v3 register the renderer is the
    // route-local builder, which turns the same config into the knowledge rows
    // the closing Quiet blocks render. Fetching it and rendering nothing still
    // fails, which is the defect this contract exists to catch.
    expect(src).toMatch(/buildPlaceKnowledge\(\{/)
    expect(src).toMatch(/content: richContent/)
    // and the builder still carries every area the KB overview section carried
    const kn = readSrc('app/communities/[slug]/_v3/place-knowledge.ts')
    expect(kn).toMatch(/aboutParagraphs/)
    expect(kn).toMatch(/At a glance/)
    expect(kn).toMatch(/Drive times/)
    expect(kn).toMatch(/content\?\.amenities/)
    expect(kn).toMatch(/The course/)
    expect(kn).toMatch(/Membership/)
    expect(kn).toMatch(/Builders/)
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
