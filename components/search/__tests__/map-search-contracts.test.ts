import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Map-search contract tests (search-as-you-move rebuild, 2026-05-30).
 *
 * Per Matt's directive "gates not prose," the search-as-you-move architecture is
 * locked by source assertions, not a handoff note. Each test pins one wire of the
 * feature so a future edit that unwires it fails CI instead of silently shipping
 * the old two-unsynced-fetches behavior.
 */

function readSrc(rel: string): string {
  return readFileSync(resolve(rel), 'utf8')
}

describe('search-as-you-move data layer', () => {
  const listings = readSrc('app/actions/listings.ts')
  const search = readSrc('app/actions/search.ts')

  it('getViewportListings exists and is bbox + polygon aware', () => {
    expect(listings).toMatch(/export async function getViewportListings/)
    expect(listings).toMatch(/getPolygonBounds/)
    expect(listings).toMatch(/isPointInPolygon/)
    expect(listings).toMatch(/bbox:\s*\{/)
  })

  it('getViewportListings returns an honest capped count (no fabricated exact totals)', () => {
    expect(listings).toMatch(/capped:\s*boolean/)
    expect(listings).toMatch(/let capped = rows\.length > cap/)
    // When the tile fetch caps, the exact header total must come from a REAL
    // uncapped count query (same filters) — never from padding the capped
    // row count (design-audit P2: "501+" -> exact totals).
    expect(listings).toMatch(/getListingTilesCount\(/)
    expect(listings).toMatch(/exact != null && exact >= rows\.length/)
  })

  it('getViewportSearch (server action) bridges filters + bounds + polygon to one fetch', () => {
    expect(search).toMatch(/export async function getViewportSearch/)
    expect(search).toMatch(/getViewportListings\(/)
    expect(search).toMatch(/bounds:\s*MapBounds/)
  })
})

describe('MapSearchView orchestrator', () => {
  const src = readSrc('components/search/MapSearchView.tsx')

  it('ONE dataset drives BOTH the list and the map markers', () => {
    // Both the list and the pins derive from the SAME visibleListings set (the
    // viewport `listings` minus per-user hidden homes) — one dataset, so a
    // hidden home leaves the list and the map together (W7.2).
    expect(src).toMatch(/const visibleListings = useMemo\(\s*\(\) => excludeHiddenListings\(listings, hiddenKeys\)/)
    expect(src).toMatch(/const mapListings = useMemo\(\(\) => visibleListings\.map\(toMapListing\)/)
    expect(src).toMatch(/visibleListings\.slice\(0, visibleCount\)\.map/)
  })

  it('search-as-you-move: bounds change triggers a debounced viewport refetch', () => {
    expect(src).toMatch(/searchAsMove/)
    expect(src).toMatch(/handleBoundsChanged/)
    expect(src).toMatch(/runViewportSearch/)
    expect(src).toMatch(/setTimeout/) // debounce
  })

  it('out-of-order viewport responses are dropped (no race on fast panning)', () => {
    expect(src).toMatch(/reqIdRef/)
    expect(src).toMatch(/if \(reqId !== reqIdRef\.current\) return/)
  })

  it('list↔map hover sync is wired both directions', () => {
    expect(src).toMatch(/hoveredKey/)
    expect(src).toMatch(/onMarkerHover/)
    expect(src).toMatch(/onMouseEnter=\{\(\) => onListHover/)
    expect(src).toMatch(/data-listing-key=/)
  })

  it('has a mobile list/map toggle (design-system ToggleGroup)', () => {
    expect(src).toMatch(/mobileView/)
    expect(src).toMatch(/setMobileView\(v\)/)
    expect(src).toMatch(/ToggleGroupItem value="list"/)
    expect(src).toMatch(/ToggleGroupItem value="map"/)
  })

  it('renders the search-as-you-move toggle control', () => {
    expect(src).toMatch(/Search as I move the map/)
  })
})

describe('hidden homes are excluded from the map split view (W7.2, 2026-07-22)', () => {
  // The /search split view rendered its OWN cards + pins and never applied the
  // per-user "Hide homes I don't want to see" subtraction, so a hidden home
  // still showed on the map list AND as a pin — the feature only worked in the
  // grid (SearchResults). Contract: MapSearchView filters both renders from the
  // signed-in user's hidden_listings, and carries the hide control on its cards.
  const src = readSrc('components/search/MapSearchView.tsx')

  it('imports the shared hidden-exclusion primitives + the hide action + control', () => {
    expect(src).toMatch(/import \{ getHiddenListingKeys \} from '@\/app\/actions\/hidden-listings'/)
    expect(src).toMatch(/import \{ buildHiddenKeySet, excludeHiddenListings \} from '@\/components\/search\/hidden-exclusion'/)
    expect(src).toMatch(/import ListingCardHideControl from '@\/components\/listing\/ListingCardHideControl'/)
  })

  it('loads the user hidden keys and builds the membership set (fail-open)', () => {
    expect(src).toMatch(/getHiddenListingKeys\(\)/)
    expect(src).toMatch(/setHiddenKeys\(buildHiddenKeySet\(keys\)\)/)
  })

  it('subtracts hidden homes from BOTH the card list and the map pins', () => {
    // The list slices from visibleListings and the pins map from it — proving a
    // hidden home cannot survive in either render.
    expect(src).toMatch(/excludeHiddenListings\(listings, hiddenKeys\)/)
    expect(src).toMatch(/visibleListings\.slice\(0, visibleCount\)\.map/)
    expect(src).toMatch(/visibleListings\.map\(toMapListing\)/)
    // The raw `listings` state must NOT feed the pins directly anymore (that was
    // the leak). Guard against a regression that re-points mapListings at it.
    expect(src).not.toMatch(/mapListings = useMemo\(\(\) => listings\.map\(toMapListing\)/)
  })

  it('renders the hide control wired to the local visibility state', () => {
    expect(src).toMatch(/<ListingCardHideControl/)
    expect(src).toMatch(/onVisibilityChange=\{onHiddenChange\}/)
    // group/hide on the card wrapper drives the hover reveal.
    expect(src).toMatch(/group group\/hide relative/)
  })
})

describe('hidden homes are excluded from the SSR city browse grid too (W7.2, 2026-07-22)', () => {
  // The other half of the leak: /search/[...slug] (the city/community/preset
  // browse pages, where every /homes-for-sale/<city> link lands) SSR-rendered a
  // raw ListingCard grid with NO per-user hidden subtraction, so a home hidden
  // on /search reappeared there. Contract: that grid now renders through the
  // client HideAwareListingGrid, which applies the exclusion + carries the hide
  // control — and it is fed BOTH RETS identifiers so membership matches whether
  // the store recorded the ListingKey or the MLS ListNumber.
  const grid = readSrc('components/search/HideAwareListingGrid.tsx')
  // The slug route was split into colocated modules (2026-07-31 file-size
  // split): the browse grid lives in sections/ListingsResults.tsx. Concatenate
  // the page with every render section so the import/dual-key assertions find
  // the moved grid AND the no-raw-ListingCard guard still covers the whole
  // route render surface.
  const slug = [
    'app/search/[...slug]/page.tsx',
    'app/search/[...slug]/sections/ListingsResults.tsx',
    'app/search/[...slug]/sections/MapSplitView.tsx',
    'app/search/[...slug]/sections/GolfBranch.tsx',
    'app/search/[...slug]/sections/SeoTail.tsx',
  ].map(readSrc).join('\n')

  it('the browse grid renders through HideAwareListingGrid, not a raw ListingCard grid', () => {
    expect(slug).toMatch(/import HideAwareListingGrid, \{ type HideAwareItem \} from '@\/components\/search\/HideAwareListingGrid'/)
    expect(slug).toMatch(/<HideAwareListingGrid/)
    // Each item carries BOTH identifiers so the dual-key match works.
    expect(slug).toMatch(/ListingKey: listing\.ListingKey \?\? null, ListNumber: listing\.ListNumber \?\? null/)
    // NO raw <ListingCard> element of any shape (the leak). This is the robust
    // reintroduction guard — a differently-shaped raw grid (different cols/key)
    // is caught, unlike a signature-specific regex. The ci:hidden-exclusion-
    // surfaces gate enforces the same invariant across every browse-results page.
    expect(slug).not.toMatch(/<ListingCard[\s/>]/)
  })

  it('HideAwareListingGrid loads the user hidden set and subtracts on BOTH keys', () => {
    expect(grid).toMatch(/getHiddenListingKeys\(\)/)
    expect(grid).toMatch(/setHiddenKeys\(buildHiddenKeySet\(keys\)\)/)
    // Dual-key membership: passes ListingKey AND ListNumber to isHiddenListing.
    expect(grid).toMatch(/isHiddenListing\(\{ ListingKey: it\.ListingKey, ListNumber: it\.ListNumber \}, hiddenKeys\)/)
    // The filtered set (not the raw items) is what renders.
    expect(grid).toMatch(/visible\.map\(\(\{ card \}\)/)
  })

  it('HideAwareListingGrid carries the hover hide control on each card', () => {
    expect(grid).toMatch(/<ListingCardHideControl/)
    expect(grid).toMatch(/onVisibilityChange=\{onHiddenChange\}/)
    expect(grid).toMatch(/relative group\/hide/)
  })
})

describe('price-drops browse grids also subtract hidden homes (W7.2, 2026-07-22)', () => {
  // /price-drops and /price-drops/[city] are nav-linked browse grids of active
  // price-reduced inventory (functionally a preset search). They rendered a raw
  // <ListingCard> grid, so a home hidden on /search reappeared there (flagged by
  // the W7.2 verifier). Both now route through HideAwareListingGrid, keeping the
  // KB grid styling via gridClassName. The ci:hidden-exclusion-surfaces gate
  // enforces the no-raw-ListingCard invariant; these pin the dual-key wiring.
  for (const file of ['app/price-drops/page.tsx', 'app/price-drops/[city]/page.tsx']) {
    const src = readSrc(file)
    it(`${file} renders through HideAwareListingGrid with dual-key items and no raw ListingCard`, () => {
      expect(src).toMatch(/import HideAwareListingGrid, \{ type HideAwareItem \} from '@\/components\/search\/HideAwareListingGrid'/)
      expect(src).toMatch(/<HideAwareListingGrid/)
      expect(src).toMatch(/ListingKey: drop\.listingKey/)
      expect(src).toMatch(/ListNumber: drop\.listNumber/)
      expect(src).not.toMatch(/<ListingCard[\s/>]/)
    })
  }
})

describe('HideAwareListingGrid keeps a surface\'s own grid styling', () => {
  const grid = readSrc('components/search/HideAwareListingGrid.tsx')
  it('supports a gridClassName so the KB price-drops grid layout is preserved', () => {
    // With gridClassName it wraps in a plain div (not the design-system Grid),
    // so price-drops keeps its sm/lg/xl column rhythm.
    expect(grid).toMatch(/gridClassName\?: string/)
    expect(grid).toMatch(/if \(gridClassName\) return <div className=\{gridClassName\}>\{cards\}<\/div>/)
  })
})

describe('the city map/split view (UnifiedMapListingsView) also subtracts hidden homes (W7.2, 2026-07-22)', () => {
  // The BLOCKER the W7.2 verifier found: /search/[...slug] with view=map|split
  // early-returns UnifiedMapListingsView (a DIFFERENT component than the /search
  // MapSearchView that W7.2 first fixed), which rendered a ListingTile list + map
  // pins with NO hidden subtraction — toggling "Map view" resurfaced a home the
  // buyer hid in the grid. Contract: it now subtracts from BOTH the tile list and
  // the pins, and carries the hide control.
  const src = readSrc('components/UnifiedMapListingsView.tsx')

  it('loads the user hidden set + subtracts on both keys', () => {
    expect(src).toMatch(/import \{ getHiddenListingKeys \} from '@\/app\/actions\/hidden-listings'/)
    expect(src).toMatch(/import \{ buildHiddenKeySet, excludeHiddenListings \} from '@\/components\/search\/hidden-exclusion'/)
    expect(src).toMatch(/setHiddenKeys\(buildHiddenKeySet\(keys\)\)/)
    expect(src).toMatch(/const visibleListings = excludeHiddenListings\(listings, hiddenKeys\)/)
  })

  it('BOTH the tile list and the map pins render from the filtered set', () => {
    expect(src).toMatch(/visibleListings\.map\(\(listing, i\)/) // the <ul> tile list
    expect(src).toMatch(/const mapListings: ListingForMap\[\] = visibleListings\.map\(toMapListing\)/)
    // The pins must NOT derive from raw `listings` anymore (that was the leak).
    expect(src).not.toMatch(/mapListings: ListingForMap\[\] = listings\.map\(toMapListing\)/)
  })

  it('carries the hover hide control on each tile', () => {
    expect(src).toMatch(/<ListingCardHideControl/)
    expect(src).toMatch(/onVisibilityChange=\{onHiddenChange\}/)
    expect(src).toMatch(/className="relative group\/hide"/)
  })
})

describe('the /videos browse grid subtracts hidden homes (W7.2, 2026-07-22)', () => {
  // /videos renders a browse grid of active for-sale inventory (filtered to homes
  // with a video tour). It rendered VideoListingCard directly with no exclusion.
  // Now it routes through HideAwareVideoGrid (dual-key). The page must not import
  // VideoListingCard as a value anymore (the ci:hidden-exclusion-surfaces gate
  // enforces that import-level invariant across every browse page).
  const grid = readSrc('components/site/HideAwareVideoGrid.tsx')
  const page = readSrc('app/videos/page.tsx')

  it('HideAwareVideoGrid filters on both keys before rendering VideoListingCard', () => {
    expect(grid).toMatch(/getHiddenListingKeys\(\)/)
    expect(grid).toMatch(/isHiddenListing\(\{ ListingKey: it\.ListingKey, ListNumber: it\.ListNumber \}, hiddenKeys\)/)
    expect(grid).toMatch(/visible\.map\(\(\{ card \}\)/)
  })

  it('the page renders through HideAwareVideoGrid with dual-key items, not a raw VideoListingCard grid', () => {
    expect(page).toMatch(/import HideAwareVideoGrid, \{ type HideAwareVideoItem \} from '@\/components\/site\/HideAwareVideoGrid'/)
    expect(page).toMatch(/<HideAwareVideoGrid items=\{videoItems\}/)
    expect(page).toMatch(/ListingKey: t\.listingKey, ListNumber: t\.listNumber/)
    expect(page).not.toMatch(/<VideoListingCard/)
  })
})

describe('the /search map-only pin layer subtracts hidden homes (W7.2, 2026-07-22)', () => {
  // The second-round BLOCKER: /search?view=map (map-only) rendered a raw
  // SearchMapClustered with the server's unfiltered pins — a home hidden on the
  // list/split view reappeared as a clickable pin. Now the map-only branch
  // renders HideAwareSearchMap, which subtracts hidden before the pins draw. The
  // page must not import the pin layer (Lazy)SearchMapClustered directly (the
  // ci:hidden-exclusion-surfaces gate enforces this at the import level).
  const wrap = readSrc('components/search/HideAwareSearchMap.tsx')
  const page = readSrc('app/search/page.tsx')

  it('HideAwareSearchMap filters the pins through excludeHiddenListings', () => {
    expect(wrap).toMatch(/getHiddenListingKeys\(\)/)
    expect(wrap).toMatch(/const visible = useMemo\(\(\) => excludeHiddenListings\(listings, hiddenKeys\)/)
    expect(wrap).toMatch(/<SearchMapClustered\s+listings=\{visible\}/)
  })

  it('the /search map-only branch renders HideAwareSearchMap, not a raw pin layer', () => {
    expect(page).toMatch(/import HideAwareSearchMap from '@\/components\/search\/HideAwareSearchMap'/)
    expect(page).toMatch(/<HideAwareSearchMap/)
    // The page must not import the raw pin layer directly anymore.
    expect(page).not.toMatch(/import\s+\w+\s+from '@\/components\/(Lazy)?SearchMapClustered'/)
  })
})

describe('geo scope drops on user map move (W4.2, 2026-07-22)', () => {
  // The split view used to pin the URL's city into every viewport query, so
  // panning from Bend to Redmond returned zero rows with a misleading empty
  // state. Contract: after the first USER move (not the map's initial settle),
  // the viewport query is pure bounding-box — no invisible city, subdivision,
  // or zip pin. Until then, the scope is a visible chip with clear-on-tap.
  const src = readSrc('components/search/MapSearchView.tsx')
  const geo = readSrc('components/search/geo-scope.ts')

  it('geo-scope helper strips exactly city/subdivision/postalCode', () => {
    expect(geo).toMatch(/export const GEO_SCOPE_KEYS = \['city', 'subdivision', 'postalCode'\] as const/)
    expect(geo).toMatch(/export function stripGeoScope/)
    expect(geo).toMatch(/city: undefined/)
    expect(geo).toMatch(/subdivision: undefined/)
    expect(geo).toMatch(/postalCode: undefined/)
  })

  it('viewport fetch reads the scope decision at fire time and strips the geo pin once dropped', () => {
    expect(src).toMatch(/import \{ GEO_SCOPE_KEYS, geoScopeLabel, stripGeoScope \} from '@\/components\/search\/geo-scope'/)
    // The debounced fetch must consult the ref (not a stale closure) and call
    // getViewportSearch with the STRIPPED filters after a drop.
    expect(src).toMatch(/scopeDroppedRef\.current \? stripGeoScope\(base\) : base/)
    expect(src).toMatch(/getViewportSearch\(effectiveFilters, bounds, poly\)/)
  })

  it('a non-initial bounds report (a real pan/zoom) drops the geo scope', () => {
    expect(src).toMatch(/firstBoundsReportRef/)
    expect(src).toMatch(/initialSettleUntilRef/)
    expect(src).toMatch(/if \(isInitialSettle === false\) dropGeoScope\(\)/)
  })

  it('a user-drawn polygon also drops the geo scope', () => {
    expect(src).toMatch(/if \(poly\) dropGeoScope\(\)/)
  })

  it('renders the visible scope chip with clear-on-tap until the first move', () => {
    expect(src).toMatch(/scopeLabel && scopeDropped === false/)
    expect(src).toMatch(/onClick=\{clearGeoScope\}/)
    expect(src).toMatch(/Showing <span className="font-semibold">\{scopeLabel\}<\/span> only/)
  })

  it('a new SSR payload (URL filter change) re-establishes the scope unless ?poly= holds it dropped', () => {
    expect(src).toMatch(/scopeDroppedRef\.current = initialPolygon != null\n\s+setScopeDropped\(initialPolygon != null\)/)
  })

  it('the beyond-viewport count query drops the geo pin in lockstep', () => {
    expect(src).toMatch(/scopeDropped && \(GEO_SCOPE_KEYS as readonly string\[\]\)\.includes\(k\)/)
  })

  it('map canvas shows a loading state while the viewport fetch is in flight', () => {
    expect(src).toMatch(/Updating results…/)
    expect(src).toMatch(/animate-spin/)
  })

  it('mobile map view shows the result count from the SAME query that renders the pins (§0)', () => {
    // The count pill renders countLabel — derived from the totalCount state
    // that getViewportSearch returned alongside the pin listings. No separate
    // estimate query.
    expect(src).toMatch(/tabular-nums lg:hidden/)
    expect(src).toMatch(/const countLabel = capped \? `\$\{totalCount\.toLocaleString\(\)\}\+` : totalCount\.toLocaleString\(\)/)
  })
})

describe('multi-shape draw tools (Phase 2 items 1+3, 2026-07-29)', () => {
  // Real draw tools on the map: radius circle with a LIVE mile readout,
  // rectangle, freeform polygon — N shapes per search, each include/exclude,
  // resolved by the server-side PostGIS shapes contract and round-tripped
  // through ?shapes= (legacy ?poly= reads forever). Pinned at the source level
  // per "gates not prose".
  const codec = readSrc('lib/map-polygon.ts')
  const search = readSrc('app/actions/search.ts')
  const view = readSrc('components/search/MapSearchView.tsx')
  const mapSrc = readSrc('components/SearchMapClustered.tsx')
  const tools = readSrc('components/search/MapDrawTools.tsx')
  const page = readSrc('app/search/page.tsx')

  it('the URL codec covers multi-shape sets and keeps the legacy ?poly= reader', () => {
    expect(codec).toMatch(/export function encodeMapShapes/)
    expect(codec).toMatch(/export function decodeMapShapes/)
    expect(codec).toMatch(/export function buildShapeSetForSearch/)
    // decodeMapPolygon is the read-forever legacy contract.
    expect(codec).toMatch(/export function decodeMapPolygon/)
  })

  it('getViewportSearch accepts the include/exclude shape set and feeds the PostGIS shapes contract', () => {
    expect(search).toMatch(/polygon: MapPolygonPoint\[\] \| MapShapeSet \| null/)
    expect(search).toMatch(/\.\.\.\(shapesParam \? \{ shapes: shapesParam \} : \{\}\)/)
    // Untrusted client shapes are sanitized, never thrown through the zod gate.
    expect(search).toMatch(/function sanitizeShapeSet/)
  })

  it('MapSearchView owns the shape set: ?shapes= sync + legacy ?poly= mirror + fetch wiring', () => {
    expect(view).toMatch(/params\.set\('shapes', encoded\)/)
    expect(view).toMatch(/params\.set\('poly', polyEncoded\)/)
    expect(view).toMatch(/buildShapeSetForSearch\(shapes, bounds\)/)
    expect(view).toMatch(/onShapesChange=\{handleShapesChange\}/)
    expect(view).toMatch(/shapes=\{drawnShapes\}/)
  })

  it('SearchMapClustered keeps the legacy single-polygon API for other callers while hosting the new tools', () => {
    expect(mapSrc).toMatch(/onPolygonDrawn\?:/)
    expect(mapSrc).toMatch(/onShapesChange\?:/)
    expect(mapSrc).toMatch(/<MapDrawTools/)
    // Legacy draw UI only renders when the multi-shape tools are NOT active.
    expect(mapSrc).toMatch(/onPolygonDrawn && !multiShape/)
  })

  it('circle draw shows a LIVE radius readout in miles while dragging (Flexmls parity)', () => {
    expect(tools).toMatch(/export function formatRadiusMiles/)
    expect(tools).toMatch(/1609\.344/)
    expect(tools).toMatch(/haversineMeters\(drag\.start, drag\.current\)/)
    expect(tools).toMatch(/formatRadiusMiles\(dragRadiusM\)/)
    // A zero-radius click is rejected with a clear error (plan spec).
    expect(tools).toMatch(/MIN_CIRCLE_RADIUS_M/)
  })

  it('every drawn shape gets a floating pill with name, exclude toggle, and remove', () => {
    expect(tools).toMatch(/`Area \$\{i \+ 1\}`/)
    expect(tools).toMatch(/toggleExclude\(i\)/)
    expect(tools).toMatch(/removeShape\(i\)/)
    // Excluded shapes render visually distinct (red-tinted overlay).
    expect(tools).toMatch(/EXCLUDE_RED/)
  })

  it('a rectangle drag commits as a 4-point polygon (one shapes contract, no special server case)', () => {
    expect(tools).toMatch(/\{ lat: start\.lat, lng: last\.lng \}/)
    expect(tools).toMatch(/\{ lat: last\.lat, lng: start\.lng \}/)
  })

  it('the page hydrates ?shapes= with the legacy ?poly= fallback', () => {
    expect(page).toMatch(/decodeMapShapes\(sp\.shapes\)/)
    expect(page).toMatch(/decodeMapPolygon\(sp\.poly\)/)
    expect(page).toMatch(/initialShapes=\{initialShapes\}/)
  })
})

describe('SearchMapClustered map primitive', () => {
  const src = readSrc('components/SearchMapClustered.tsx')

  it('accepts hover-sync props', () => {
    expect(src).toMatch(/hoveredKey\?:\s*string \| null/)
    expect(src).toMatch(/onMarkerHover\?:/)
  })

  it('highlights the hovered marker via a key-indexed marker map', () => {
    expect(src).toMatch(/markersByKeyRef/)
    // Hover-aware (and active-aware) price-pill element, rebuilt per-key on
    // hover/selection change. AdvancedMarkerElement uses HTML content elements
    // (buildPricePillElement) instead of SVG data-URI icons (buildPricePillIcon).
    // The element builder must accept hover/active/saved options.
    expect(src).toMatch(/buildPricePillElement\([^)]*\bhover:/)
  })

  it('marker InfoWindow shows a photo card', () => {
    expect(src).toMatch(/openListing\.PhotoURL/)
    expect(src).toMatch(/PhotoURL\?:\s*string \| null/)
  })
})

describe('slug search page: guest save + reachable map-move (2026-06-09)', () => {
  // The high-traffic /homes-for-sale/[...slug] route (every city/preset/community
  // link lands here) must carry BOTH affordances Matt reported missing:
  //   1. a guest save/alert path (anonymous email -> FUB buyer lead), and
  //   2. a link into the search-as-you-move map (the split view).
  // Pinned at the source level so a future edit that unwires either fails CI
  // instead of silently regressing to "no save + no map" for anonymous buyers.
  const slug = readSrc('app/search/[...slug]/page.tsx')

  it('renders SearchAlertCapture for the guest email -> FUB buyer-lead path', () => {
    expect(slug).toMatch(/import \{ SearchAlertCapture \}/)
    expect(slug).toMatch(/<SearchAlertCapture/)
    // It must be told the signed-in state (guests only) and the path-derived city.
    expect(slug).toMatch(/signedIn=\{!!session\?\.user\}/)
    expect(slug).toMatch(/defaultFilters=\{guestAlertFilters\}/)
  })

  it('keeps the signed-in save-search button (now inside the shared SearchFilterBar)', () => {
    expect(slug).toMatch(/<SearchFilterBar/)
    expect(slug).toMatch(/signedIn=\{!!session\?\.user\}/)
    const bar = readFileSync(resolve(__dirname, '../../SearchFilterBar.tsx'), 'utf8')
    expect(bar).toMatch(/<SaveSearchButton user=\{!!props\.signedIn\} pathContext=\{props\.pathContext\}/)
  })

  it('SaveSearchButton stays mid-browse for guests and signed-in (B2)', () => {
    const button = readSrc('components/SaveSearchButton.tsx')
    // Guest path must stay reachable (no early return when !user).
    expect(button).not.toMatch(/if\s*\(\s*!user\s*\)\s*return\s+null/)
    // Success must show confirmation (do not slam the panel closed on ok).
    expect(button).toMatch(/You are set\./)
    expect(button).toMatch(/Keep the panel open so guests see confirmation/)
    // Navy primary trigger so the control is not a quiet outline chip.
    expect(button).toMatch(/bg-primary text-primary-foreground/)
  })

  it('hands the save-search button SERVER-RESOLVED geography, not the raw pathname', () => {
    // The button cannot tell a subdivision from a neighborhood from a preset by
    // looking at the URL: /bend/river-west, /bend/west-hills and
    // /bend/multi-family are the same shape. It used to call every second
    // segment `subdivision`, which the alert matcher compares against
    // SubdivisionName — zero rows for a neighborhood or a preset, so the saved
    // search silently never fired an alert. The page resolves the segment
    // already; it must pass the answer down.
    // The page hands the RESOLVED slug context down; the button converts it
    // through the shared helper rather than reading the URL itself.
    expect(slug).toMatch(/pathContext=\{\{ \.\.\.resolved, city, citySlug: slug\[0\] \}\}/)
    const button = readSrc('components/SaveSearchButton.tsx')
    expect(button).toMatch(/buildSavedSearchPathFilters\(pathContext\)/)
    // The pathname fallback may only apply when no resolved context was given.
    expect(button).toMatch(/if \(pathFilters\) \{/)
  })

  it('the saved-search geography helper emits canonical keys, never a bare slug', () => {
    const helper = readSrc('lib/search/saved-search-path-filters.ts')
    // A neighborhood carries the prefixed slug the RPC boundary scope keys on.
    expect(helper).toMatch(/filters\.neighborhoodSlug/)
    expect(helper).toMatch(/\$\{citySlug\}-\$\{input\.subdivisionSlug\}/)
    // A real subdivision carries its DISPLAY NAME (SubdivisionName holds
    // "West Hills", never the "west-hills" slug).
    expect(helper).toMatch(/filters\.subdivision = input\.subdivisionDisplayName/)
    // A preset contributes its real filter params (multi-family -> propertyType).
    expect(helper).toMatch(/input\.preset\?\.params/)
  })

  it('links into the search-as-you-move map via view=split', () => {
    // A reachable "Map view" CTA that flips the URL into the split branch.
    expect(slug).toMatch(/view: 'split'/)
    expect(slug).toMatch(/mapViewHref/)
    expect(slug).toMatch(/href=\{mapViewHref\}/)
  })

  it('offers a grid-view return link from the map branch (bidirectional toggle)', () => {
    expect(slug).toMatch(/gridViewHref/)
    expect(slug).toMatch(/href=\{gridViewHref\}/)
  })
})

describe('SearchAlertCapture is path-aware (slug-page filters)', () => {
  const src = readSrc('components/search/SearchAlertCapture.tsx')

  it('accepts path-derived defaults so slug-page filters are captured', () => {
    expect(src).toMatch(/defaultSubdivision/)
    expect(src).toMatch(/defaultFilters/)
  })

  it('supports layout-safe map/split inline variant (B1 residual)', () => {
    // sticky overlapped filter chips on app-frame; inline is non-sticky shrink-0.
    expect(src).toMatch(/variant\?: 'sticky' \| 'inline'/)
    expect(src).toMatch(/isInline && 'shrink-0'/)
    expect(src).toMatch(/Sign in to manage alerts/)
    const searchIndex = readSrc('app/search/page.tsx')
    expect(searchIndex).toMatch(/variant=\{isAppFrame \? 'inline' : 'sticky'\}/)
    const mapSplit = readSrc('app/search/[...slug]/sections/MapSplitView.tsx')
    expect(mapSplit).toMatch(/variant="inline"/)
    expect(mapSplit).toMatch(/underFilterBar/)
  })
})

describe('no mojibake in the search surface', () => {
  // The "Â·" sequence (UTF-8 decoded as Latin-1) shipped here for months. Pin it
  // dead at the file level in addition to the repo-wide ci:no-mojibake gate.
  const MOJI = Buffer.from([0xc3, 0x82, 0xc2, 0xb7]) // "Â·"
  const files = [
    'components/search/MapSearchView.tsx',
    'components/search/SearchResults.tsx',
    'components/SearchMapClustered.tsx',
  ]
  for (const f of files) {
    it(`${f} has no "Â·" mojibake`, () => {
      const buf = readFileSync(resolve(f))
      expect(buf.includes(MOJI)).toBe(false)
    })
  }
})
