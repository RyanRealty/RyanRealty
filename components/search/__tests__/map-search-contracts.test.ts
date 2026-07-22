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
    // mapListings is derived from the same `listings` state that the list renders.
    expect(src).toMatch(/const mapListings = useMemo\(\(\) => listings\.map\(toMapListing\)/)
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

  it('a new SSR payload (URL filter change) re-establishes the scope', () => {
    expect(src).toMatch(/scopeDroppedRef\.current = false\n\s+setScopeDropped\(false\)/)
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

  it('keeps the signed-in save-search button', () => {
    expect(slug).toMatch(/<SaveSearchButton user=\{!!session\?\.user\} \/>/)
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
