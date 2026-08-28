import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
// The single shared G52 rule, also used by scripts/check-kb-page-contract.mjs,
// so this contract test and the gate can never drift apart.
import { isResilientMarketFaq } from '../../../scripts/lib/kb-market-faq-resilience.mjs'

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

function stripTsComments(src: string): string {
  return src.replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\/\*[\s\S]*?\*\//g, '')
}

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
 * into `app/<route>/_v3/` rather than re-baseline (PUBLIC_UI.md §3),
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
  it('D74 — primary nav renders at 15px', () => {
    // RE-POINTED 2026-08-27. This asserted `text-[15px]` on MegaMenu.tsx, which was
    // mounted by the deleted SiteHeader — so it read a component no page rendered
    // and passed while the LIVE nav (V3Chrome) ran 0.9rem = 14.4px. The directive
    // had been silently violated since the chrome moved to the barrel. It is a
    // named token now, so it moves with a style template.
    const tokens = readSrc('components/site/v3/tokens.css')
    expect(tokens).toMatch(/--v3-size-nav:\s*0\.9375rem/)   // 15px at a 16px root
    const chrome = readSrc('components/site/v3/V3Chrome.css')
    expect(chrome).toMatch(/\.v3-chrome__group-link[\s\S]{0,400}?font-size: var\(--v3-size-nav\)/)
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
    const src = readSrc('components/site/listing-detail/PhotoGalleryLightbox.tsx')
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
      'ListingActSheet',
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
    // v3 chrome (P9 roll, 2026-08-27): one main mounting the v3 token scope
    // plus the listing register, one V3Footer outside it, no kb chrome left.
    expect(src).toMatch(/V3_ROOT_CLASS\}? listing-detail/)
    expect(src).toMatch(/<V3Footer\b/)
    expect(src).toMatch(/<V3Breadcrumb\b/)
    expect(src).not.toMatch(/kb-root|<KbFooter\b|<KbBreadcrumb\b|<KbSectionTracker\b|SmoothScrollProvider/)
    expect(src).toMatch(/<MetadataBlock\b/)
    // The schema array moved to the sibling builder when the page hit its
    // file-size budget (2026-08-19). Same two payloads, same MetadataBlock.
    expect(src).toMatch(/buildListingJsonLd\(/)
    const ld = readSrc('app/listing/[listingKey]/listing-json-ld.ts')
    expect(ld).toMatch(/type:\s*'realEstateListing'/)
    expect(ld).toMatch(/type:\s*'breadcrumb'/)
    expect(src).toMatch(/<V3SectionTracker[\s/>]/)
    expect(src).toMatch(/<ListingLikeThisAlerts\b/)
    expect(src).toMatch(/<ListingActSheet\b/)
    expect(src).toMatch(/<PriceCtaStrip\b/)
    expect(src).toMatch(/<LivePricingRead\b/)
    const hero = readSrc('components/site/listing-detail/ListingHero.tsx')
    expect(hero).toMatch(/<V3Stage\b/)
    expect(hero).toMatch(/height="frame"/)
    expect(hero).not.toMatch(/videoSrc/)
    expect(hero).toMatch(/View all/)
    expect(hero).not.toMatch(/See all|\+49 more|more photos/)
    const brokerCard = readSrc('components/site/listing-detail/TextMattCTA.tsx')
    expect(brokerCard).not.toMatch(/Schedule a tour/)
    const strip = readSrc('components/site/listing-detail/PriceCtaStrip.tsx')
    expect(strip).not.toMatch(/Schedule a tour/)
    expect(strip).not.toMatch(/Ask a question/)
    expect(strip).not.toMatch(/\/contact\?/)
    const act = readSrc('components/site/listing-detail/ListingActSheet.client.tsx')
    expect(act).toMatch(/id="listing-act"/)
    expect(act).toMatch(/Save this home/)
    const mobile = readSrc('components/site/listing-detail/ListingMobileContactBar.client.tsx')
    expect(mobile).not.toMatch(/Schedule a tour/)
    expect(mobile).not.toMatch(/\/contact\?/)
    // The header stays layout-owned (app/layout.tsx mounts V3Chrome once).
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

  it('D78 — city hero active count is leftover HUD, not tiles or snapshot all-count', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    expect(src).toMatch(/leftoverHudKpis/)
    expect(src).toMatch(/activeCount(?::[^=]*)?=\s*hud\.active/)
    expect(src).not.toMatch(/activeCount(?::[^=]*)?=\s*publishedInventory\.count/)
    expect(src).not.toMatch(/activeCount\s*=\s*snapshot\.activeAllCount/)
    expect(src).not.toMatch(/activeCount(?::[^=]*)?=[\s\S]{0,80}\?\?\s*0\b/)
  })

  it('§0 — neighborhood active count is leftover HUD, never a second population', () => {
    const src = readSrc('app/cities/[slug]/[neighborhoodSlug]/page.tsx')
    expect(src).toMatch(/leftoverHudKpis/)
    expect(src).toMatch(/activeCount(?::[^=]*)?=\s*hud\.active/)
    expect(src).not.toMatch(/inBoundaryCount \?\? pulse\?\.activeCount \?\? neighborhood\.activeCount/)
    expect(src).not.toMatch(/activeCount \?\? mapFeatures\.length/)
    expect(src).not.toMatch(/activeCount\s*=\s*snapshot\.activeAllCount/)
    // Either Result-shaped guard: the boundary read must carry `.ok` so a
    // degraded read can never publish a count. skippableRailResult adds the
    // SSG skip (G70 follow-up) on the same Result contract.
    expect(src).toMatch(
      /(?:withTimeoutFallbackResult|skippableRailResult)\s*\(\s*(?:\(\)\s*=>\s*)?getGeoBoundaryMapData/,
    )
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
    // THE CITY PAGE NO LONGER OWNS A FULL-BLEED HERO (P9, re-landed 2026-08-26):
    // PUBLIC_UI.md's locked City opening is the Field of the city's houses, so
    // there is no hero photo on this route for cityHero() to source. What the
    // route DOES have is place imagery in its ledgers, and that imagery resolves
    // through buildOtherCityItems, which calls cityHero() and renders NO
    // thumbnail for an unverified city — the rule this directive exists for,
    // one level down.
    expect(src).toMatch(/buildOtherCityItems\(/)
    const shared = readSrc('lib/kb/place-sections.ts')
    expect(shared).toMatch(/preferPlaceHero/)
    expect(shared).toMatch(/cityHero\s*\(/)
    expect(shared).toMatch(/hero\.verified \? hero\.src : ''/)
    const index = readSrc('app/cities/page.tsx')
    expect(index).toMatch(/preferPlaceHero/)
    expect(index).toMatch(/cityHero\s*\(/)
    expect(index).toMatch(/preferPlaceHero\(liveHero, fallbackHero\.src\)/)
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
    expect(src).toMatch(/CITY_RESORT_LEDGER_IMG\[c\.slug\]/)
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
    // KbActivity left with the KB register (2026-08-27). The thumbnail is now the
    // V3Ledger row's own media slot, fed by the same imageUrl the shared builder
    // sets (asserted above), and the row shape still declares it.
    const shapes = readSrc('lib/kb/section-shapes.ts')
    expect(shapes).toMatch(/imageUrl\?: string \| null/)
    expect(readSrc('app/cities/[slug]/page.tsx')).toMatch(/activityItems/)
  })

  // D94 RESTORED 2026-08-27, with the four-pattern cap that deleted it.
  //
  // It came back as a LEDGER, not as the old horizontal rail. KbOpenHouses was a
  // strip where clicking a card promoted it into a lead panel; that interaction
  // was the rail's answer to having no room. On the barrel the pattern for "a
  // scannable list of real rows, each row a door" is Ledger, and an open-house
  // list is exactly that — a date, an address, a price, one action — so the
  // promote-into-lead behaviour has nothing left to do.
  //
  // The feed is CITY-scoped (open houses are recorded per listing; no
  // neighbourhood or community feed exists), so every eyebrow names the CITY.
  // That is the D93 mislabel fixed rather than repeated: the KB community page
  // put a Bend-wide feed under Tetherow's name.
  it('D94 — the open-houses section renders on all three place grains', () => {
    const shared = readSrc('lib/kb/place-open-houses.ts')
    expect(shared).toMatch(/export async function readCityOpenHouses/)
    expect(shared).toMatch(/export function openHouseRows/)
    // the ask is published, never raw-formatted (section 0)
    expect(shared).toMatch(/formatPublishedAsk/)
    // and the MLS's literal 'N/A' subdivision never reaches a page
    expect(shared).toContain('unknown|tbd')

    for (const page of [
      'app/cities/[slug]/page.tsx',
      'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
      'app/communities/[slug]/page.tsx',
    ]) {
      const src = readSrc(page)
      expect(src).toMatch(/readCityOpenHouses\(/)
      expect(src).toMatch(/id="open-houses"/)
      // the eyebrow names the city the feed is actually scoped to
      expect(src).toMatch(/This week · \$\{cityName\}/)
    }
  })

  // The community page also lost its activity feed and its blog rail to the same
  // cap; both are back, on the same city-scoped honesty.
  it('the community page carries the activity feed and the guides rail again', () => {
    const src = readSrc('app/communities/[slug]/page.tsx')
    expect(src).toMatch(/id="activity"/)
    expect(src).toMatch(/id="guides"/)
    expect(src).toMatch(/buildActivityItems\(/)
    expect(src).toMatch(/buildArticlePosts\(/)
    expect(src).toMatch(/Live · \$\{cityName\}/)
  })
  it('D91 — market structured data cannot vanish (MARKET_TRUTH D26)', () => {
    const src = readSrc('app/cities/[slug]/page.tsx')
    // This used to pin the spelling `pulse ?? { snapshot.activeSfrCount }`. D26
    // dropped the market-pulse read entirely — a leftover miss OMITS and pulse
    // never fills — so there is no pulse to fall back from. What replaced it is
    // stronger: buildMarketFaq is called unconditionally with an all-nullable
    // leftover input, so the Dataset/FAQPage JSON-LD emits on every render and a
    // miss costs one figure, not the markup. Asserted through the single shared
    // rule so this test and G52 can never drift apart.
    expect(isResilientMarketFaq(src, stripTsComments(src))).toBe(true)
    // and the vanishing shape is still rejected by that same rule
    expect(isResilientMarketFaq(`const f = pulse ? buildMarketFaq(c, pulse) : null`, `const f = pulse ? buildMarketFaq(c, pulse) : null`)).toBe(false)
  })

  // ── Phase 9 wave 2: community page (golf/resort/master-planned) ──────────────
  it('D95 — community page carries the PAGE CONTRACT on the v3 barrel', () => {
    const src = readSrc('app/communities/[slug]/page.tsx')
    // The register moved (P9, re-landed 2026-08-26): the body is
    // components/site/v3, so the token scope is V3_ROOT_CLASS instead of
    // kb-root. Every element of the page contract itself is unchanged.
    expect(src).toMatch(/className=\{V3_ROOT_CLASS\}/)
    expect(src).not.toMatch(/className="kb-root"/)
    expect(src).toMatch(/<CommunityPageTracker/)
    expect(src).toMatch(/<V3SectionTracker/)
    expect(src).toMatch(/<MetadataBlock schemas=\{communitySchemas\}/)
    expect(src).toMatch(/getResortCommunityContent\(resortSlug\)/)
    // FAQPage JSON-LD used to come out of FAQBlock's includeJsonLd. FAQBlock is
    // gone from this route, so the payload must be emitted from the schemas
    // array instead, built from the SAME faqs array the Quiet block renders.
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
    // A compound resort slug still canonicalizes to the bare slug (no duplicate
    // undercounted page) — but NOT from the page body. A redirect thrown after
    // the loading.tsx boundary flushed served 200 with no <h1> for 91 of the 104
    // registry-derived compound slugs (measured on production 2026-08-19), so
    // the hop is a pre-render hop now. The page must NOT redirect.
    expect(src).not.toMatch(/\bredirect\(`\/communities\//)
    expect(src).toMatch(/import \{ notFound \} from 'next\/navigation'/)
    const hops = readSrc('lib/routing/pre-render-hops.ts')
    expect(hops).toMatch(/resolveCanonicalCommunityPath/)
    expect(hops).toMatch(/'\/communities\/\[slug\]'/)
    expect(readSrc('middleware.ts')).toMatch(/resolvePreRenderHop\(pathname\)/)
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
    const cma = readSrc('lib/cma/opinion-pages.ts')
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
    expect(readSrc('lib/cma/comps-price-chart.ts')).toMatch(/from '@\/lib\/charts\/plot'/)
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
    expect(readSrc('lib/cma/opinion-scenes.ts')).toMatch(/from '@\/lib\/cma\/comps-price-chart'/)
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
    expect(nightly).toMatch(/rebuildAnalyticsMarts/)
    expect(weekly).toMatch(/rebuildAnalyticsMarts/)
    expect(nightly).not.toMatch(/\bspawn\b/)
    expect(weekly).not.toMatch(/\bspawn\b/)
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
    const figures = readSrc('app/communities/[slug]/_v3/community-figures.ts')
    // v3 spelling (2026-08-26): every inventory door is placeLinks.browseUrl
    // from getPlaceLinks for THIS community, the counted-set door is the
    // on-page Field (#homes), and the closing edges carry the place-filtered
    // Homes and Market doors by parameter.
    expect(page).toMatch(/getPlaceLinks\(\{\s*\n?\s*type: 'community',/)
    expect(page).toMatch(/const browseHref = placeLinks\.browseUrl/)
    expect(page).toMatch(/href: '#homes'/)
    expect(figures).toMatch(/communityMarketHref/)
    expect(figures).toMatch(/resortItems/)
  })

  // D103/D103b (home-d section objects) retired with the home-d revert
  // (Matt, 2026-08-21): / is back on the homepage-v6 template.

  // D99/D101 (2026-08-28 phone-first homepage). The leftover HUD still feeds
  // the Field count. The market report and chart live on /housing-market.
  it('D99 — homepage leftover count is the live leftover pile, not a cache read (§0)', () => {
    const page = readSrc('app/page.tsx')
    expect(page).toMatch(/leftoverHudKpis/)
    expect(page).not.toMatch(/leftoverMarketFigures\(hud/)
    expect(page).not.toMatch(/getMarketStatsCacheRowForGeo/)
    expect(page).not.toMatch(/<KbMarketHud/)
    const charts = readSrc('app/housing-market/_v3/market-charts.ts')
    expect(charts).toMatch(/Median sale price by month, recent years/)
  })

  it('D101 — homepage does not mount a market chart. /housing-market owns the report', () => {
    const page = readSrc('app/page.tsx')
    expect(page).not.toMatch(/placeMedianChart\(/)
    expect(page).not.toMatch(/buildRegionMedianChart/)
    expect(page).toMatch(/id="market"/)
    expect(page).toMatch(/\/housing-market/)
  })

  it('D102 — KbFeatured has no remaining page mount (E-CUT retired /area-guides)', () => {
    const areaGuides = readSrc('app/area-guides/page.tsx')
    expect(areaGuides).toMatch(/permanentRedirect\(['"]\/cities['"]\)/)
    expect(areaGuides).not.toMatch(/<KbFeatured\b/)
  })

  it('D100 — community page RENDERS rich resort content (amenities/golf/membership/builders)', () => {
    // v3 spelling (2026-08-26): the SAME config renders through
    // buildPlaceKnowledge — overview prose, at-a-glance, drive times,
    // amenities by category, the course, membership, builders — into the
    // belonging Quiet. A page that fetches the config and renders nothing
    // still fails ci:resort-definitions' renders-resort-content arm.
    const src = readSrc('app/communities/[slug]/page.tsx')
    expect(src).toMatch(/getResortCommunityContent\(resortSlug\)/)
    expect(src).toMatch(/buildPlaceKnowledge\(\{/)
    expect(src).toMatch(/knowledgeItems/)
    const knowledge = readSrc('app/communities/[slug]/_v3/place-knowledge.ts')
    expect(knowledge).toMatch(/amenities|At a glance|Membership|Builders/i)
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
    expect(src).toMatch(/\.v3 section\[id\]/)
    // The second register's root scope went with it (2026-08-27). Asserted on
    // COMMENT-STRIPPED source: a gate that reads prose fires on its own
    // explanation, which this repo has now shipped three times.
    expect(stripTsComments(src)).not.toMatch(/kb-root/)
    expect(src).toMatch(/intersectionRatio >= 0\.55/)
    expect(src).toMatch(/location\.href/)
    expect(src).toMatch(/trackEvent\('section_view'/)
    expect(src).toMatch(/\/api\/visitors\/track/)
    expect(src).toMatch(/milestones = \[25, 50, 75, 100\]/)
    expect(src).toMatch(/pageTypeFromPath/)
  })
})

describe('place-family indexes', () => {
  it('neighborhoods and subdivisions indexes exist and carry a breadcrumb, their SoR read, and real doors', () => {
    const neighborhoods = readSrc('app/neighborhoods/page.tsx')
    const subdivisions = readSrc('app/subdivisions/page.tsx')
    expect(neighborhoods).toMatch(/from '@\/lib\/data'/)
    expect(neighborhoods).toMatch(/getBendNeighborhoodLedger/)
    // Either register's breadcrumb satisfies the contract, the same allowance
    // check-breadcrumb.mjs makes. Both indexes moved to components/site/v3 on
    // 2026-08-26; what is locked here is that the page renders a trail at all,
    // not which visual language draws it.
    expect(neighborhoods).toMatch(/KbBreadcrumb|V3Breadcrumb/)
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

  it('neighborhood detail generateStaticParams is not an empty stub', () => {
    const neighborhood = readSrc('app/cities/[slug]/[neighborhoodSlug]/page.tsx')
    expect(neighborhood).toMatch(/BEND_NEIGHBORHOOD_DISTRICTS/)
    expect(neighborhood).not.toMatch(/generateStaticParams[\s\S]{0,200}return\s*\[\s*\]/)
  })

  it('plat detail holds the G70 zero build-time fan-out and still serves every slug', () => {
    // Deliberately inverted from the neighborhood contract above: build-time
    // prerender of ~100 plat pages was the top Vercel build cost and baked
    // empty rails into deployed HTML (ci:ssg-budget). On-demand ISR needs the
    // resolution path + dynamicParams, so those stay asserted.
    const plat = readSrc('app/subdivisions/[slug]/page.tsx')
    expect(plat).toMatch(/resolveSubdivisionAreaRedirect/)
    expect(plat).toMatch(/export const dynamicParams = true/)
    expect(plat).toMatch(/export const revalidate = 60/)
    expect(plat).toMatch(/generateStaticParams[\s\S]{0,80}return\s*\[\s*\]/)
  })
})

