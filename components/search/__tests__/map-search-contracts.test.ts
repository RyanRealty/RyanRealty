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
    expect(src).toMatch(/searchFieldItems\(visibleListings\.slice\(0, visibleCount\)\)/)
    expect(src).toMatch(/searchFieldPins\(fieldItems\)/)
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
    expect(src).toMatch(/onListHover/)
    expect(src).toMatch(/onActiveChange/)
    expect(src).toMatch(/data-listing-key=/)
  })

  it('uses the homepage Field list-first + Map toggle on 390', () => {
    expect(src).toMatch(/listFlow/)
    expect(src).toMatch(/listFirst/)
    expect(src).toMatch(/mapToggle/)
    expect(src).not.toMatch(/ToggleGroupItem value="list"/)
    expect(src).not.toMatch(/useState<'list' \| 'map'>\('list'\)/)
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
    expect(src).toMatch(/searchFieldItems\(visibleListings\.slice\(0, visibleCount\)\)/)
    expect(src).toMatch(/searchFieldPins\(fieldItems\)/)
    expect(src).not.toMatch(/searchFieldPins\(listings\)/)
  })

  it('renders the hide control wired to the local visibility state', () => {
    expect(src).toMatch(/<ListingCardHideControl/)
    expect(src).toMatch(/onVisibilityChange=\{onHiddenChange\}/)
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
  // /price-drops and /price-drops/[city] list documented asking-price cuts on
  // the v3 Field. Hidden-home subtraction for search still lives on /search
  // (HideAwareListingGrid + ci:hidden-exclusion-surfaces). These pages must
  // not regress to a raw ListingCard grid.
  for (const file of ['app/price-drops/page.tsx', 'app/price-drops/[city]/page.tsx']) {
    const src = readSrc(file)
    it(`${file} renders cuts through V3Field and no raw ListingCard`, () => {
      expect(src).toMatch(/import \{\s*[\s\S]*V3Field[\s\S]*\} from '@\/components\/site\/v3'/)
      expect(src).toMatch(/<V3Field/)
      expect(src).not.toMatch(/<ListingCard[\s/>]/)
    })
  }

  it('price-drop Field rows open the listing via listingDetailPath', () => {
    const src = readSrc('app/price-drops/_v3/drops-field-items.ts')
    expect(src).toMatch(/listingDetailPath\(/)
    expect(src).toMatch(/mlsNumber: drop\.listNumber/)
  })
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

describe('the city map/split view (MapSearchView via MapSplitView) subtracts hidden homes (W7.2, 2026-08-11)', () => {
  // P10 fold: SEO map/split seeds flagship MapSearchView (not UnifiedMapListingsView).
  // Contract stays: hide set subtracts from BOTH the card list and map pins.
  const src = readSrc('components/search/MapSearchView.tsx')
  const mapSplit = readSrc('app/search/[...slug]/sections/MapSplitView.tsx')

  it('MapSplitView mounts MapSearchView (not UnifiedMapListingsView)', () => {
    expect(mapSplit).toMatch(/import MapSearchView from '@\/components\/search\/MapSearchView'/)
    expect(mapSplit).toMatch(/<MapSearchView/)
    expect(mapSplit).not.toMatch(/UnifiedMapListingsView/)
  })

  it('loads the user hidden set + subtracts on both keys', () => {
    expect(src).toMatch(/import \{ getHiddenListingKeys \} from '@\/app\/actions\/hidden-listings'/)
    expect(src).toMatch(/import \{ buildHiddenKeySet, excludeHiddenListings \} from '@\/components\/search\/hidden-exclusion'/)
    expect(src).toMatch(/setHiddenKeys\(buildHiddenKeySet\(keys\)\)/)
    expect(src).toMatch(/excludeHiddenListings\(listings, hiddenKeys\)/)
  })

  it('BOTH the card list and the map pins render from the filtered set', () => {
    expect(src).toMatch(/searchFieldPins\(fieldItems\)/)
    expect(src).not.toMatch(/searchFieldPins\(listings\)/)
  })

  it('carries the hover hide control on each tile', () => {
    expect(src).toMatch(/<ListingCardHideControl/)
    expect(src).toMatch(/onVisibilityChange=\{onHiddenChange\}/)
    expect(src).toMatch(/group\/hide/)
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

  it('the /search Field face does not import a raw pin layer', () => {
    expect(page).toMatch(/<MapSearchView/)
    expect(page).not.toMatch(/import\s+\w+\s+from '@\/components\/(Lazy)?SearchMapClustered'/)
    expect(page).not.toMatch(/<HideAwareSearchMap/)
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
  })

  it('prints one map-viewport count for the same query that renders the pins', () => {
    expect(src).toMatch(/publishSearchCount\(/)
    expect(src).toMatch(/grain: 'map-viewport'/)
    expect(src).toMatch(/countSearchListings\(/)
    expect(src).not.toMatch(/publishSearchCountPair\(/)
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
    expect(view).toMatch(/<PlaceFieldMap/)
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

  it('marker popup is a brand card (not stock Google InfoWindow chrome)', () => {
    const map = readSrc('components/SearchMapClustered.tsx')
    const popup = readSrc('components/search/MapListingPopup.tsx')
    expect(map).toMatch(/MapListingPopup/)
    expect(map).not.toMatch(/<InfoWindow[\s>]/)
    expect(popup).toMatch(/OverlayView/)
    expect(popup).toMatch(/View listing/)
    expect(popup).toMatch(/maxHeight:\s*360/)
  })

  it('photoURL still reaches the popup card from the open listing', () => {
    expect(src).toMatch(/photoURL:\s*openListing\.PhotoURL/)
    expect(src).toMatch(/PhotoURL\?:\s*string \| null/)
  })
})

describe('slug search page: guest save + reachable map-move (2026-06-09)', () => {
  // The high-traffic /homes-for-sale/[...slug] route (every city/preset/community
  // link lands here) must carry BOTH affordances Matt reported missing:
  //   1. a guest save/alert path (anonymous email -> CRM buyer lead), and
  //   2. a link into the search-as-you-move map (the split view).
  // Pinned at the source level so a future edit that unwires either fails CI
  // instead of silently regressing to "no save + no map" for anonymous buyers.
  const slug = readSrc('app/search/[...slug]/page.tsx')

  it('renders SearchAlertCapture for the guest email -> CRM buyer-lead path', () => {
    expect(slug).toMatch(/import \{ SearchAlertCapture \}/)
    expect(slug).toMatch(/<SearchAlertCapture/)
    // It must be told the signed-in state (guests only) and the path-derived city.
    expect(slug).toMatch(/signedIn=\{!!session\?\.user\}/)
    expect(slug).toMatch(/defaultFilters=\{guestAlertFilters\}/)
  })

  it('keeps the signed-in save-search button on the Field face', () => {
    expect(slug).toMatch(/pathContext=\{\{ \.\.\.resolved, city, citySlug: slug\[0\] \}\}/)
    const filters = readSrc('components/search/SearchFilters.tsx')
    expect(filters).toMatch(/<SaveSearchButton user=\{signedIn\} pathContext=\{pathContext\} guestCapture="scroll"/)
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

  it('opens the place search on the Field with the homepage list-first Map toggle', () => {
    expect(slug).toMatch(/const isMapSplitView = Boolean\(city \|\| hasFilterOnly\)/)
    expect(slug).toMatch(/renderMapSplitView\(/)
    const split = readSrc('app/search/[...slug]/sections/MapSplitView.tsx')
    expect(split).toMatch(/<MapSearchView/)
    const view = readSrc('components/search/MapSearchView.tsx')
    expect(view).toMatch(/listFlow/)
    expect(view).toMatch(/listFirst/)
    expect(view).toMatch(/mapToggle/)
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
    expect(searchIndex).toMatch(/variant="inline"/)
    const mapSplit = readSrc('app/search/[...slug]/sections/MapSplitView.tsx')
    expect(mapSplit).toMatch(/variant="inline"/)
  })

  it('guest capture shows the email field under Field results (inline), collapsed sticky on 390', () => {
    // Inline is under the tiles, so the email field is the ask. Sticky in a
    // filter dock still starts collapsed on 390.
    expect(src).toMatch(/const \[expanded, setExpanded\] = useState\(variant === 'inline'\)/)
    expect(src).toMatch(/if \(variant === 'inline'\) return/)
    expect(src).toMatch(/matchMedia\('\(min-width: 640px\)'\)/)
    expect(src).toMatch(/Get listing alerts/)
    expect(src).toMatch(/expanded === false \?/)
    expect(src).toMatch(/name="company"/)
    expect(src).toMatch(/type="email"/)
    expect(src).toMatch(/readRrSessionId\(\)/)
    expect(src).toMatch(/submitSearchAlertSignup/)
    expect(src).toMatch(/Free\. Unsubscribe any time/)
    expect(src).toMatch(/Free\. One email per new match\. Unsubscribe any time/)
    expect(src).not.toMatch(/<Dialog[\s>]/)
    expect(src).not.toMatch(/from '@\/components\/ui\/dialog'/)
    // inline must not pick up sticky/z-30 (layout-safe on the app frame)
    expect(src).toMatch(/isInline === false &&\s*\n\s*'sticky top-0 z-30/)
  })
})

describe('search index H1 is Homes for Sale on the Field face', () => {
  const page = readSrc('app/search/page.tsx')

  it('keeps one Homes for Sale heading that is not sr-only', () => {
    expect(page).toMatch(/<V3Heading level=\{1\} size="field">Homes for Sale<\/V3Heading>/)
    expect(page).not.toMatch(/<h1 className="sr-only">/)
    expect(page.match(/<V3Heading level=\{1\}/g)?.length).toBe(1)
  })

  it('puts that heading above one SearchFilters field', () => {
    expect(page.indexOf('Homes for Sale')).toBeLessThan(page.indexOf('search-filter-dock'))
    expect(page.indexOf('</header>')).toBeLessThan(page.indexOf('search-filter-dock'))
    const dock = page.slice(page.indexOf('search-filter-dock'))
    expect(dock).toMatch(/<SearchFilters /)
    expect(dock).not.toMatch(/<V3Heading level=\{1\}/)
  })

  it('keeps the footer on the Field face', () => {
    expect(page).toMatch(/<V3Footer columns=\{V3_FOOTER_COLUMNS\} \/>/)
    expect(page).not.toMatch(/\{isAppFrame \? null : <V3Footer/)
  })
})

describe('search filter dock and required map attribution (PR 163)', () => {
  it('paints the sticky filter dock with opaque cream', () => {
    const css = readSrc('app/search/search-frame.css')
    expect(css).toMatch(/\.search-filter-dock \{[\s\S]*background:\s*var\(--v3-surface\)/)
    expect(css).not.toMatch(/\.search-filter-dock \{[\s\S]*background:\s*transparent/)
    expect(css).not.toMatch(/\.search-filter-dock \{[\s\S]*bg-card\/95/)
  })

  it('shows the map above tiles when the 390 Map toggle is on, and hides the toggle at 1280', () => {
    const css = readSrc('app/search/search-frame.css')
    expect(css).toMatch(
      /\.search-field \.v3\.v3-field--map-toggle\.v3-field--map-open \.v3-field__frame > \.v3-field__col:first-of-type/,
    )
    expect(css).toMatch(/\.search-field \.v3-field__lead \.v3-btn\.v3-field__map-toggle/)
  })

  it('bounds the 390 Field list so the email ask sits under the Field', () => {
    const css = readSrc('app/search/search-frame.css')
    expect(css).toMatch(/\.search-field \.v3\.v3-field--flow \.v3-field__list/)
    expect(css).toMatch(/max-height:\s*min\(70vh,\s*560px\)/)
    const page = readSrc('app/search/page.tsx')
    expect(page.indexOf('<MapSearchView')).toBeLessThan(page.indexOf('<SearchAlertCapture'))
    const split = readSrc('app/search/[...slug]/sections/MapSplitView.tsx')
    expect(split.indexOf('<MapSearchView')).toBeLessThan(split.indexOf('<SearchAlertCapture'))
  })

  it('sticks dock plus Field as one cream unit at 390 and 1280 so the map and list stay clear', () => {
    const css = readSrc('app/search/search-frame.css')
    expect(css).toMatch(/\.search-filter-dock \{[\s\S]*position:\s*relative/)
    expect(css).not.toMatch(/\.search-filter-dock \{[\s\S]*position:\s*sticky/)
    expect(css).toMatch(/\.search-workspace \{[\s\S]*background:\s*var\(--v3-surface\)/)
    expect(css).toMatch(/\.search-workspace--stuck \{[\s\S]*position:\s*fixed/)
    expect(css).toMatch(/\.search-workspace--stuck \{[\s\S]*background:\s*var\(--v3-surface\)/)
    expect(css).toMatch(/\.search-workspace \.search-filter-dock \{[\s\S]*position:\s*relative/)
    const wrap = readSrc('components/search/SearchWorkspace.tsx')
    expect(wrap).toMatch(/search-workspace--stuck/)
    expect(wrap).toMatch(/releasedRef/)
    expect(wrap).toMatch(/shouldPinSearchWorkspace/)
    expect(wrap).not.toMatch(/min-width: 56\.25rem/)
    const page = readSrc('app/search/page.tsx')
    expect(page).toMatch(/<SearchWorkspace>/)
    expect(page.indexOf('<SearchWorkspace>')).toBeLessThan(page.indexOf('search-filter-dock'))
    expect(page.indexOf('<SearchWorkspace>')).toBeLessThan(page.indexOf('<MapSearchView'))
    const split = readSrc('app/search/[...slug]/sections/MapSplitView.tsx')
    expect(split).toMatch(/<SearchWorkspace>/)
  })

  it('keeps required Google attribution and only hides the decorative MAP chip', () => {
    const css = readSrc('components/site/v3/V3Field.css')
    expect(css).toMatch(/\.v3-field__map \.gm-style-mtc/)
    expect(css).not.toMatch(/\.gm-style-cc/)
    expect(css).not.toMatch(/gmnoprint/)
    const map = readSrc('app/central-oregon/_v3/PlaceFieldMapImpl.tsx')
    expect(map).not.toMatch(/attributionControl:\s*false/)
  })
})

describe('SearchFilters does not duplicate the collapsed alert ask (E-SEARCH-CHIP)', () => {
  it('keeps Save this search and drops the navy Get alerts chip', () => {
    const filters = readSrc('components/search/SearchFilters.tsx')
    expect(filters).toMatch(/<SaveSearchButton user=\{signedIn\} pathContext=\{pathContext\} guestCapture="scroll"/)
    expect(filters).not.toMatch(/>\s*Get alerts\s*</)
    expect(filters).not.toMatch(/focusSearchAlertCapture/)
  })
})

describe('search Field taps use shared --v3-tap (PR 162 chrome)', () => {
  it('sizes chips and the search panel to --v3-tap, not a 32px button height', () => {
    const css = readSrc('components/search/search-ledger.css')
    expect(css).toContain('.srch-chip')
    expect(css).toContain('.srch-panel')
    expect(css).toContain('min-height: var(--v3-tap')
    expect(css).not.toContain('min-height: 2rem')
  })

  it('keeps the stacked footer tap floor from the parent chrome commit', () => {
    const footer = readSrc('components/site/v3/V3Footer.css')
    expect(footer).toContain('.v3-footer__column-list a')
    expect(footer).toContain('min-height: var(--v3-tap)')
    expect(footer).not.toContain('min-height: 2rem')
    const cookie = readSrc('components/CookieConsentBanner.tsx')
    expect(cookie).toContain('COOKIE_ACTION_STYLE')
    expect(cookie).toContain("minHeight: 'var(--v3-tap)'")
  })
})

describe('map craft: selection + zoom storytelling + basemap', () => {
  it('selects list card when a map pin opens (stronger than hover)', () => {
    const view = readSrc('components/search/MapSearchView.tsx')
    expect(view).toMatch(/selectedKey/)
    expect(view).toMatch(/onMarkerClick/)
    expect(view).toMatch(/in this map view/)
    expect(view).toMatch(/grain: 'map-viewport'/)
    expect(view).toMatch(/listFlow/)
    expect(view).toMatch(/listFirst/)
    expect(view).toMatch(/mapToggle/)
  })

  it('uses SuperCluster maxZoom and photo stamps at close zoom', () => {
    const map = readSrc('components/SearchMapClustered.tsx')
    expect(map).toMatch(/SuperClusterAlgorithm/)
    expect(map).toMatch(/maxZoom:\s*14/)
    expect(map).toMatch(/buildPhotoStampElement/)
    expect(map).toMatch(/zoomMode/)
  })

  it('ships editorial MAP_SEARCH_STYLES for cream/muted basemap', () => {
    const markers = readSrc('lib/maps/markers.ts')
    expect(markers).toMatch(/MAP_SEARCH_STYLES/)
    expect(markers).toMatch(/f3f0e8/)
    expect(markers).toMatch(/c5d8e0/)
  })
})

describe('Home type two-layer filter (class + MLS sub type)', () => {
  it('primary chip bar mounts HomeTypeFilterPanel with duplex/manufactured sub-types', () => {
    const panel = readSrc('components/search/HomeTypeFilterPanel.tsx')
    expect(panel).toMatch(/PROPERTY_TYPES/)
    expect(panel).toMatch(/propertySubTypeDisplayLabel/)
    expect(panel).toMatch(/Duplex|propertySubTypes/)
    for (const rel of ['components/search/SearchFilters.tsx', 'components/SearchFilterBar.tsx']) {
      const src = readSrc(rel)
      expect(src).toMatch(/HomeTypeFilterPanel/)
      expect(src).toMatch(/propertySubTypes/)
    }
    const types = readSrc('lib/property-type.ts')
    expect(types).toMatch(/multi-family/)
    expect(types).toMatch(/SUBTYPE_DISPLAY_LABELS/)
    expect(types).toMatch(/Manufactured On Land/)
  })

  it('beds/baths chips have unique control ids (nightly locators)', () => {
    const bar = readSrc('components/SearchFilterBar.tsx')
    expect(bar).toMatch(/filter-beds-\$\{value \|\| 'any'\}/)
    expect(bar).toMatch(/filter-baths-\$\{value \|\| 'any'\}/)
    expect(bar).toMatch(/htmlFor=\{id\}/)
  })
})

describe('SEARCH_UX_WAVE3 P6/P7 polish (2026-08-11)', () => {
  it('P6: filter bars load AllFiltersSheet via dynamic() and mount only after first open', () => {
    for (const rel of ['components/search/SearchFilters.tsx', 'components/SearchFilterBar.tsx']) {
      const src = readSrc(rel)
      expect(src).toMatch(/dynamic\(\(\)\s*=>\s*import\(['"]@\/components\/search\/AllFiltersSheet['"]\)/)
      expect(src).toMatch(/moreSheetMounted/)
      expect(src).toMatch(/from ['"]@\/components\/search\/registry-filter-chrome['"]/)
      // Cold path must not static-import the heavy sheet module.
      expect(src).not.toMatch(/import AllFiltersSheet[, ]/)
    }
  })

  it('All filters sheet is full width at 390 so boolean labels are not clipped', () => {
    const sheet = readSrc('components/search/AllFiltersSheet.tsx')
    expect(sheet).toMatch(/data-\[side=right\]:w-full/)
    expect(sheet).toMatch(/whitespace-normal break-words/)
    expect(sheet).toMatch(/min-w-0/)
  })

  it('P7: first four search cards request image priority for LCP', () => {
    const card = readSrc('components/site/ListingCard.tsx')
    expect(card).toMatch(/priority\?: boolean/)
    expect(card).toMatch(/priority=\{priority\}/)
    expect(readSrc('components/search/SearchResults.tsx')).toMatch(/priority=\{cardIndex < 4\}/)
    expect(readSrc('components/search/MapSearchView.tsx')).toMatch(/<V3Field/)
  })
})

describe('flagship map timeout + city honesty (runtime crosswalk 2026-08-18)', () => {
  const page = readSrc('app/search/page.tsx')
  const view = readSrc('components/search/MapSearchView.tsx')

  it('Field seed uses withTimeoutSettled and passes degraded into MapSearchView', () => {
    expect(page).toMatch(/await withTimeoutSettled\(/)
    expect(page).toMatch(/initialDegraded=\{viewportDegraded\}/)
  })

  it('does not invent filters.city = Bend for split/map', () => {
    expect(page).toMatch(/city: filters\.city,/)
    expect(page).toMatch(/city: sp\.city \?\? '',/)
    expect(page).not.toMatch(/city: filters\.city \|\| \(view !== 'list' \? defaultCity/)
    expect(page).not.toMatch(/city: sp\.city \?\? \(view !== 'list' \? defaultCity/)
    expect(page).not.toMatch(/getCityBoundary\(effectiveFilters\.city \|\| defaultCity\)/)
    expect(page).toMatch(/defaultCity=\{effectiveFilters\.city \?\? ''\}/)
  })

  it('does not say No homes while filter-match is still in flight', () => {
    expect(view).toMatch(/const \[matchCountReady, setMatchCountReady\] = useState\(false\)/)
    expect(view).toMatch(/matchCountReady === false && listings\.length === 0/)
    expect(view).toMatch(/This is not an empty market/)
    expect(view).not.toMatch(/totalCount === 0 && matchCount == null\s*\n\s*\? 'No homes'/)
  })

  it('keeps empty status as active+pending (does not coerce \'\' to Active)', () => {
    expect(view).toMatch(/status: f\.status \?\? 'Active'/)
    expect(view).not.toMatch(/status: f\.status \|\| 'Active'/)
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
