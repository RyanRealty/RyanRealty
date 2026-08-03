'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import type { ListingTileRow, MapBounds } from '@/app/actions/listings'
import { countSearchListings, getViewportSearch, type SearchFilters } from '@/app/actions/search'
import type { SearchFiltersInitial } from '@/components/search/SearchFilters'
import type { ListingForMap } from '@/components/SearchMapClustered'
import {
  buildShapeSetForSearch,
  encodeMapPolygon,
  encodeMapShapes,
  type DrawnShape,
  type MapPolygonPoint,
} from '@/lib/map-polygon'
import { buildMapDrawPayload, buildZeroResultsPayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import { ALL_SEARCH_URL_PARAMS, SEARCH_FIELDS } from '@/lib/search/field-registry'
import { GEO_SCOPE_KEYS, geoScopeLabel, stripGeoScope } from '@/components/search/geo-scope'
import { listingDetailPath, displaySubdivision } from '@/lib/slug'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { buildHiddenKeySet, excludeHiddenListings } from '@/components/search/hidden-exclusion'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Eyebrow, H3, Body } from '@/components/site/primitives'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import AreaPicker from '@/components/search/AreaPicker'
import ListingCardHideControl from '@/components/listing/ListingCardHideControl'
import SaveListingButton from '@/components/listing/SaveListingButton'

const SearchMapClustered = dynamic(() => import('@/components/SearchMapClustered'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground" style={{ minHeight: 320 }}>
      Loading map…
    </div>
  ),
})

function formatPrice(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function formatAddress(l: ListingTileRow): string {
  return [
    [l.StreetNumber, l.StreetName, l.StreetSuffix].filter(Boolean).join(' ').trim(),
    l.City,
    l.State,
    l.PostalCode,
  ]
    .filter(Boolean)
    .join(', ')
}

// "street, City" only — the full "street, City, ST, zip" string never fits
// the 2-up card width, so every card title truncated with an ellipsis and
// no card showed a complete address (design-audit P3). The search is
// already Oregon-scoped, so state + zip add nothing a buyer needs to scan a
// result card. formatAddress() above still carries the full string for
// photo alt text.
function formatCardAddress(l: ListingTileRow): string {
  return [[l.StreetNumber, l.StreetName, l.StreetSuffix].filter(Boolean).join(' ').trim(), l.City]
    .filter(Boolean)
    .join(', ')
}

/** Street line only (e.g. "2732 NW Ordway Ave") for the elevated result card —
 *  the city/neighborhood sits on its own line below (matches ListingCard + the
 *  search mockup .addr / .city split). */
function cardStreet(l: ListingTileRow): string {
  return [l.StreetNumber, l.StreetName, l.StreetSuffix].filter(Boolean).join(' ').trim() || (l.City ?? 'Listing')
}

/** "Bend, OR 97703 · Awbrey Butte" — city + state + zip, plus subdivision when
 *  the row carries one. Oregon-scoped, so "OR" is a safe constant when State is
 *  absent. Mirrors the list card's cityLine so both views read identically. */
function cardCity(l: ListingTileRow): string {
  const cityZip = [l.City ? `${l.City}, ${l.State ?? 'OR'}` : null, l.PostalCode].filter(Boolean).join(' ').trim()
  const sub = displaySubdivision(l.SubdivisionName)
  return sub ? `${cityZip} · ${sub}` : cityZip
}

/** Whole-dollar list price per living sqft, or null when either input is missing. */
function cardPricePerSqft(l: ListingTileRow): number | null {
  const sqft = rowSqft(l)
  if (l.ListPrice == null || sqft == null || sqft <= 0) return null
  return Math.round(l.ListPrice / sqft)
}

/** Editorial results-summary suffix per sort mode (mockup: "· sorted by newest").
 *  Keys mirror SORT_OPTIONS in SearchFilters; unknown sorts render no suffix. */
const SORT_SUFFIX: Record<string, string> = {
  newest: 'sorted by newest',
  oldest: 'sorted by oldest',
  price_asc: 'price: low to high',
  price_desc: 'price: high to low',
  price_per_sqft_asc: 'price per sqft: low to high',
  price_per_sqft_desc: 'price per sqft: high to low',
  year_newest: 'newest built first',
  year_oldest: 'oldest built first',
}

const NEW_LISTING_WINDOW_DAYS = 7

// Status/new badge — nothing distinguished fresh or under-contract inventory
// on the result card, so a buyer triaging hundreds of homes couldn't tell
// them apart without opening each one (design-audit P2). Only uses fields
// already on the viewport row (StandardStatus, OnMarketDate) — no
// fabricated price-drop or open-house data.
//
// `nowMs` is passed in rather than reading the wall clock here: this is a
// 'use client' component, and a clock read in the render body disagrees
// between the server-rendered HTML and the client's first hydration pass,
// which kills hydration for the whole tree (G37 hydration-safety gate, the
// React error 418 regression class). The server page computes `now` once and
// passes it down as a prop instead.
function cardBadge(l: ListingTileRow, nowMs: number): string | null {
  const status = l.StandardStatus?.trim()
  if (status && status !== 'Active' && status !== 'Closed') return status
  if (l.OnMarketDate) {
    const days = (nowMs - new Date(l.OnMarketDate).getTime()) / 86_400_000
    if (Number.isFinite(days) && days >= 0 && days <= NEW_LISTING_WINDOW_DAYS) return 'New'
  }
  return null
}

function rowKey(l: ListingTileRow): string {
  return String(l.ListNumber ?? l.ListingKey ?? '').trim()
}

/** ListingTileRow carries TotalLivingAreaSqFt at runtime from the viewport fetch even though the base type omits it. */
function rowSqft(l: ListingTileRow): number | null {
  const v = (l as { TotalLivingAreaSqFt?: number | null }).TotalLivingAreaSqFt
  return v ?? null
}

function toMapListing(l: ListingTileRow): ListingForMap {
  return {
    Latitude: l.Latitude,
    Longitude: l.Longitude,
    ListingKey: l.ListingKey,
    ListNumber: l.ListNumber ?? null,
    ListPrice: l.ListPrice,
    StreetNumber: l.StreetNumber,
    StreetName: l.StreetName,
    StreetSuffix: l.StreetSuffix ?? null,
    City: l.City,
    State: l.State,
    PostalCode: l.PostalCode,
    BedroomsTotal: l.BedroomsTotal,
    BathroomsTotal: l.BathroomsTotal,
    PhotoURL: l.PhotoURL,
    TotalLivingAreaSqFt: rowSqft(l),
  }
}

/** Convert the page's URL filter object into the server-action SearchFilters shape. */
function toSearchFilters(f: SearchFiltersInitial): SearchFilters {
  // Registry fields ride along as raw URL-param strings (the server page
  // spreads every ALL_SEARCH_URL_PARAMS hit into the filters prop). Coerce
  // them per the field registry so a pan/zoom refetch keeps every active
  // filter — booleans `1` -> true, multi CSV -> string[], ranges -> numbers.
  const raw = f as Record<string, string | undefined>
  const registry: Record<string, unknown> = {}
  for (const def of SEARCH_FIELDS) {
    if (def.kind === 'boolean') {
      if (raw[def.key] === '1') registry[def.key] = true
    } else if (def.kind === 'multi') {
      const value = raw[def.key]
      if (value?.trim()) {
        const values = value.split(',').map((v) => v.trim()).filter(Boolean)
        if (values.length > 0) registry[def.key] = values
      }
    } else if (def.kind === 'text') {
      if (def.key === 'keywords') continue // handled below with the base fields
      const value = raw[def.key]?.trim()
      if (value) registry[def.key] = value
    } else {
      if (def.key === 'dom') continue // rides the legacy daysOnMarket string below
      const params = def.legacyParams
        ? [def.legacyParams.min, def.legacyParams.max]
        : [`${def.key}Min`, `${def.key}Max`]
      for (const param of params) {
        if (!param) continue
        const value = raw[param]
        if (value == null || value.trim() === '') continue
        const parsed = Number(value)
        if (Number.isFinite(parsed)) registry[param] = parsed
      }
    }
  }
  return {
    ...(registry as Partial<SearchFilters>),
    city: f.city || undefined,
    subdivision: f.subdivision || undefined,
    minPrice: f.minPrice ? Number(f.minPrice) : undefined,
    maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
    beds: f.beds ? Number(f.beds) : undefined,
    baths: f.baths ? Number(f.baths) : undefined,
    status: f.status || 'Active',
    sort: f.sort || 'newest',
    minSqFt: f.minSqFt ? Number(f.minSqFt) : undefined,
    maxSqFt: f.maxSqFt ? Number(f.maxSqFt) : undefined,
    lotAcresMin: f.lotAcresMin != null && f.lotAcresMin !== '' ? Number(f.lotAcresMin) : undefined,
    lotAcresMax: f.lotAcresMax != null && f.lotAcresMax !== '' ? Number(f.lotAcresMax) : undefined,
    yearBuiltMin: f.yearBuiltMin ? Number(f.yearBuiltMin) : undefined,
    yearBuiltMax: f.yearBuiltMax ? Number(f.yearBuiltMax) : undefined,
    propertyType: f.propertyType || undefined,
    postalCode: f.postalCode || undefined,
    garageMin: f.garageMin ? Number(f.garageMin) : undefined,
    daysOnMarket: f.daysOnMarket || undefined,
    keywords: f.keywords || undefined,
    hasPool: f.hasPool === '1' ? true : undefined,
    hasView: f.hasView === '1' ? true : undefined,
    hasWaterfront: f.hasWaterfront === '1' ? true : undefined,
    hasFireplace: f.hasFireplace === '1' ? true : undefined,
    hasGolfCourse: f.hasGolfCourse === '1' ? true : undefined,
  }
}

export type MapSearchViewProps = {
  initialListings: ListingTileRow[]
  initialTotalCount: number
  initialCapped: boolean
  initialBounds: MapBounds
  filters: SearchFiltersInitial
  savedListingKeys: string[]
  likedListingKeys: string[]
  placeQuery: string
  boundaryGeojson?: unknown
  initialPolygon?: MapPolygonPoint[] | null
  /** Multi-shape draw set from ?shapes= (falls back to ?poly= via initialPolygon). */
  initialShapes?: DrawnShape[] | null
  /** Server-computed request timestamp (ms) for the card "New" badge — see
   *  cardBadge()'s comment for why this isn't read client-side. */
  nowMs?: number
}

export default function MapSearchView({
  initialListings,
  initialTotalCount,
  initialCapped,
  initialBounds,
  filters,
  savedListingKeys,
  likedListingKeys,
  placeQuery,
  boundaryGeojson,
  initialPolygon: initialPolygonProp = null,
  initialShapes = null,
  nowMs,
}: MapSearchViewProps) {
  // One initial shape set, whichever URL spelling delivered it: ?shapes=
  // (multi-shape) wins; a legacy ?poly= ring arrives as a single include
  // polygon. `initialPolygon` keeps its historical meaning for the scope-drop
  // + re-seed logic: non-null exactly when the URL carried ANY include shape.
  const initialDrawn = useMemo<DrawnShape[]>(() => {
    if (initialShapes && initialShapes.length > 0) return initialShapes
    if (initialPolygonProp && initialPolygonProp.length >= 3) {
      return [{ type: 'polygon', points: initialPolygonProp, exclude: false }]
    }
    return []
  }, [initialShapes, initialPolygonProp])
  const initialPolygon = initialDrawn.some((s) => !s.exclude) ? initialDrawn : null
  const [listings, setListings] = useState(initialListings)
  const [totalCount, setTotalCount] = useState(initialTotalCount)
  const [capped, setCapped] = useState(initialCapped)
  const [loading, setLoading] = useState(false)
  // Per-user hidden homes ("Hide homes I don't want to see"). Same edge-of-
  // render model as SearchResults: viewport results are SHARED caches, so the
  // per-user subtraction never touches the fetch — a hidden home is filtered
  // out of BOTH the card list AND the map pins here, from the signed-in user's
  // hidden_listings rows. Signed-out users get an empty set (no filtering).
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set())
  const [searchAsMove, setSearchAsMove] = useState(true)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [drawnShapes, setDrawnShapes] = useState<DrawnShape[]>(initialDrawn)
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list')
  // Window the CARD list so the SSR payload + hydration cost stays small even
  // when the viewport returns hundreds of homes. The MAP still gets every pin
  // (mapListings below) — only the heavy cards are paged in. "Show more" reveals
  // the rest from already-loaded data (no extra fetch).
  const CARD_PAGE = 48
  const [visibleCount, setVisibleCount] = useState(CARD_PAGE)

  const listContainerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastBoundsRef = useRef<MapBounds>(initialBounds)
  const reqIdRef = useRef(0)

  const searchFilters = useMemo(() => toSearchFilters(filters), [filters])
  const filtersSnapshot = JSON.stringify(filters)

  // ── Geo scope (W4.2) ──────────────────────────────────────────────────────
  // The URL can pin the search to a place (city / subdivision / zip). That pin
  // is honest only while the map still shows that place — once the user MOVES
  // the map (or draws an area), the viewport query becomes pure bounding-box.
  // Keeping an invisible city=Bend filter while the map sits over Redmond
  // returned zero rows with a misleading empty state. Until the first move,
  // the scope is visible as a chip on the map canvas with clear-on-tap.
  const scopeLabel = useMemo(
    () => geoScopeLabel({ city: filters.city, subdivision: filters.subdivision, postalCode: filters.postalCode }),
    [filters.city, filters.subdivision, filters.postalCode]
  )
  // A URL that arrives with ?poly= encodes a search whose place pin was
  // ALREADY superseded by the drawn shape (drawing calls dropGeoScope, and the
  // server strips the geo scope from the initial viewport fetch when poly is
  // present) — so the scope starts dropped and the chip stays hidden. That is
  // what makes reload/share reproduce the exact post-draw state.
  const [scopeDropped, setScopeDropped] = useState(initialPolygon != null)
  // Refs mirror the state so the debounced viewport fetch (350 ms setTimeout)
  // reads the CURRENT scope decision at fire time, not the closure it was
  // created with — a pan that drops the scope must not race its own refetch.
  const scopeDroppedRef = useRef(initialPolygon != null)
  const searchFiltersRef = useRef(searchFilters)
  useEffect(() => {
    searchFiltersRef.current = searchFilters
  }, [searchFilters])
  // The map's FIRST bounds report is its initial settle (fitBounds on load),
  // not a user gesture — it must not drop the scope. Every report after that
  // is a real pan/zoom/re-center. A short grace window covers the async
  // place-viewport fit (SearchMapClustered's PlacesService callback fires a
  // SECOND idle after the first settle when no boundary polygon is available).
  const firstBoundsReportRef = useRef(true)
  const INITIAL_SETTLE_GRACE_MS = 2500
  const initialSettleUntilRef = useRef(0)
  useEffect(() => {
    initialSettleUntilRef.current = Date.now() + INITIAL_SETTLE_GRACE_MS
    // Mount-only: stamps the settle window once per MapSearchView instance.
  }, [])
  const router = useRouter()
  const pathname = usePathname()
  const urlSearchParams = useSearchParams()
  // Once-per-distinct-query guard for search_zero_results — a pan across the
  // same empty search must not re-fire; a CHANGED query that dead-ends must.
  const zeroResultsFiredKeyRef = useRef<string | null>(null)
  // Zero results can come from tight filters, not just the map viewport — the
  // empty state names the likely cause and offers the same reset as "Clear all".
  // Registry params (fireplace, shop, well water, …) count as narrowing too;
  // enumerating them from the registry keeps this in step as fields are added.
  const hasNarrowingFilters = useMemo(() => {
    const narrowing = [...ALL_SEARCH_URL_PARAMS, 'propertyType', 'propertySubType']
    return narrowing.some((k) => {
      if (k === 'view' || k === 'sort' || k === 'page') return false
      const v = (filters as Record<string, string | undefined>)[k]
      return typeof v === 'string' && v.trim() !== ''
    })
  }, [filters])

  // When the viewport shows zero but the same filters match homes elsewhere,
  // say so with the real number — a bare "0 homes" reads as "we have nothing"
  // when the matches are simply outside the current map (rural listings around
  // a city are the common case).
  const [beyondViewportCount, setBeyondViewportCount] = useState<number | null>(null)
  const hasDrawnShapes = drawnShapes.length > 0
  useEffect(() => {
    if (totalCount !== 0 || !hasNarrowingFilters || hasDrawnShapes) {
      setBeyondViewportCount(null)
      return
    }
    let cancelled = false
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(filters as Record<string, string | undefined>)) {
      // Once the user has moved the map the geo pin no longer applies to the
      // viewport query, so the "matches elsewhere" count must not apply it
      // either — the two numbers would describe different searches.
      if (scopeDropped && (GEO_SCOPE_KEYS as readonly string[]).includes(k)) continue
      if (typeof v === 'string' && v.trim() !== '') params[k] = v
    }
    countSearchListings(params)
      .then((n) => {
        if (!cancelled) setBeyondViewportCount(n != null && n > 0 ? n : null)
      })
      .catch(() => {
        if (!cancelled) setBeyondViewportCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [totalCount, hasNarrowingFilters, hasDrawnShapes, scopeDropped, filtersSnapshot]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-seed from server props whenever the URL filters change (new SSR payload).
  // The SSR payload is scoped again, so the scope-drop resets with it — the
  // chip re-appears and the next user move re-drops it.
  useEffect(() => {
    setListings(initialListings)
    setTotalCount(initialTotalCount)
    setCapped(initialCapped)
    setDrawnShapes(initialDrawn)
    setVisibleCount(CARD_PAGE)
    scopeDroppedRef.current = initialPolygon != null
    setScopeDropped(initialPolygon != null)
  }, [initialListings, initialTotalCount, initialCapped, initialDrawn, filtersSnapshot]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up any pending debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const runViewportSearch = useCallback(
    async (bounds: MapBounds, shapes: DrawnShape[]) => {
      const reqId = ++reqIdRef.current
      setLoading(true)
      try {
        // Read filters + scope decision through refs at FIRE time: this call
        // often runs from a 350 ms debounce, and the pan that scheduled it may
        // have just dropped the geo scope. After the drop the query is pure
        // bounding-box — no invisible city/subdivision/zip pin.
        const base = searchFiltersRef.current
        const effectiveFilters = scopeDroppedRef.current ? stripGeoScope(base) : base
        // The drawn set becomes the server's include/exclude shapes contract
        // (PostGIS). Exclude-only sets ride the current viewport as the
        // include ring — "this view minus those areas".
        const poly = buildShapeSetForSearch(shapes, bounds)
        const res = await getViewportSearch(effectiveFilters, bounds, poly)
        // Ignore out-of-order responses (user kept panning).
        if (reqId !== reqIdRef.current) return
        setListings(res.listings)
        setTotalCount(res.totalCount)
        setCapped(res.capped)
        // Instrumentation (Phase 0.5): a search round-trip that dead-ends at 0
        // homes, keyed by the live query string so repeated pans over the same
        // empty search fire once. Fire-and-forget — never touches the fetch.
        if (res.totalCount === 0 && typeof window !== 'undefined') {
          const payload = buildZeroResultsPayload(window.location.search)
          const key = JSON.stringify(payload)
          if (zeroResultsFiredKeyRef.current !== key) {
            zeroResultsFiredKeyRef.current = key
            fireSearchEvent('search_zero_results', payload)
          }
        }
      } finally {
        if (reqId === reqIdRef.current) setLoading(false)
      }
    },
    []
  )

  /** Drop the place pin (chip tap or first user map move) — see geo-scope.ts. */
  const dropGeoScope = useCallback(() => {
    if (scopeDroppedRef.current) return
    scopeDroppedRef.current = true
    setScopeDropped(true)
  }, [])

  const clearGeoScope = useCallback(() => {
    dropGeoScope()
    runViewportSearch(lastBoundsRef.current, drawnShapes)
  }, [dropGeoScope, drawnShapes, runViewportSearch])

  const handleBoundsChanged = useCallback(
    (bounds: MapBounds) => {
      lastBoundsRef.current = bounds
      // The first report is the map's initial settle, not a user gesture.
      // Every later report means the user moved the map — from then on the
      // query is the viewport itself, so the geo pin comes off.
      const isInitialSettle =
        // Event-time read: runs only when the map fires bounds-changed, never
        // during render, so SSR/client HTML cannot diverge.
        firstBoundsReportRef.current || Date.now() < initialSettleUntilRef.current // hydration-safe
      firstBoundsReportRef.current = false
      if (isInitialSettle === false) dropGeoScope()
      if (!searchAsMove) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        runViewportSearch(bounds, drawnShapes)
      }, 350)
    },
    [searchAsMove, drawnShapes, runViewportSearch, dropGeoScope]
  )

  /** Reflect the drawn shape set into the URL so reload/share reproduce it.
   *  `?shapes=` carries the full multi-shape set; a plain single freeform
   *  include polygon ALSO mirrors into legacy `?poly=` (same encoding as the
   *  SEO route) so every existing ?poly= consumer keeps working. Clearing
   *  removes both params. */
  const syncShapesToUrl = useCallback(
    (shapes: DrawnShape[]) => {
      const params = new URLSearchParams(urlSearchParams?.toString() ?? '')
      const encoded = encodeMapShapes(shapes)
      if (encoded) params.set('shapes', encoded)
      else params.delete('shapes')
      const single =
        shapes.length === 1 && shapes[0].type === 'polygon' && !shapes[0].exclude ? shapes[0] : null
      const polyEncoded = single ? encodeMapPolygon(single.points) : undefined
      if (polyEncoded) params.set('poly', polyEncoded)
      else params.delete('poly')
      params.delete('page')
      const query = params.toString()
      const base = pathname ?? '/homes-for-sale'
      router.replace(query ? `${base}?${query}` : base, { scroll: false })
    },
    [router, pathname, urlSearchParams]
  )

  // Instrumentation guard: fire search_map_draw only when a shape was ADDED
  // (not on exclude toggles / removals), with the polygon's vertex count.
  const prevShapeCountRef = useRef(initialDrawn.length)

  const handleShapesChange = useCallback(
    (shapes: DrawnShape[]) => {
      // A user-drawn include area is an explicit spatial choice — it
      // supersedes the URL's place pin the same way a pan does.
      const poly = shapes.some((s) => !s.exclude) ? shapes : null
      if (poly) dropGeoScope()
      setDrawnShapes(shapes)
      syncShapesToUrl(shapes)
      if (shapes.length > prevShapeCountRef.current) {
        const latest = shapes[shapes.length - 1]
        if (latest.type === 'polygon') {
          fireSearchEvent('search_map_draw', buildMapDrawPayload(latest.points.length))
        } else if (latest.type === 'circle') {
          fireSearchEvent('search_map_draw', buildMapDrawPayload(0, 'circle', latest.radiusM))
        }
      }
      prevShapeCountRef.current = shapes.length
      runViewportSearch(lastBoundsRef.current, shapes)
    },
    [runViewportSearch, dropGeoScope, syncShapesToUrl]
  )

  /**
   * Apply (or clear) a SAVED named area from the in-map picker.
   *
   * Same end state as a hand-drawn set — shapes replaced, geo scope dropped,
   * `?shapes=` rewritten, viewport refetched — with one difference: it does
   * NOT fire search_map_draw. Picking a saved area is not a draw, and counting
   * it as one would inflate the draw-adoption metric this instrumentation
   * exists to measure. prevShapeCountRef still advances so the NEXT real draw
   * compares against the right baseline.
   */
  const handleAreaShapes = useCallback(
    (shapes: DrawnShape[]) => {
      if (shapes.some((s) => !s.exclude)) dropGeoScope()
      setDrawnShapes(shapes)
      syncShapesToUrl(shapes)
      prevShapeCountRef.current = shapes.length
      runViewportSearch(lastBoundsRef.current, shapes)
    },
    [runViewportSearch, dropGeoScope, syncShapesToUrl]
  )

  // When the user flips search-as-you-move ON, immediately sync to the current view.
  const toggleSearchAsMove = useCallback(() => {
    setSearchAsMove((prev) => {
      const next = !prev
      if (next) runViewportSearch(lastBoundsRef.current, drawnShapes)
      return next
    })
  }, [drawnShapes, runViewportSearch])

  const onListHover = useCallback((key: string | null) => setHoveredKey(key), [])
  const onMarkerHover = useCallback((key: string | null) => {
    setHoveredKey(key)
    if (key) {
      const el = listContainerRef.current?.querySelector(`[data-listing-key="${key}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [])

  // Load the signed-in user's hidden keys once; fail open (worst case a hidden
  // home briefly reappears). Membership matches ListingKey OR MLS ListNumber.
  useEffect(() => {
    let cancelled = false
    getHiddenListingKeys()
      .then((keys) => { if (!cancelled && keys.length > 0) setHiddenKeys(buildHiddenKeySet(keys)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const onHiddenChange = useCallback((key: string, hidden: boolean) => {
    setHiddenKeys((prev) => {
      const next = new Set(prev)
      if (hidden) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  // The hidden subtraction feeds BOTH renders: the card list slices from it and
  // the map pins derive from it — a hidden home leaves the list and the map in
  // lockstep. totalCount stays the shared server number (§0): per-user hiding
  // must not restate the area count, exactly as SearchResults keeps `total`.
  const visibleListings = useMemo(
    () => excludeHiddenListings(listings, hiddenKeys),
    [listings, hiddenKeys],
  )
  const mapListings = useMemo(() => visibleListings.map(toMapListing), [visibleListings])
  const savedSet = useMemo(() => new Set(savedListingKeys), [savedListingKeys])

  const countLabel = capped ? `${totalCount.toLocaleString()}+` : totalCount.toLocaleString()
  const sortSuffix = SORT_SUFFIX[filters.sort ?? 'newest'] ?? null

  const listPanel = (
    <div ref={listContainerRef} className="flex-1 min-h-0 overflow-y-auto bg-muted">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
          <span className="font-semibold text-foreground">{countLabel}</span>{' '}
          {totalCount === 1 ? 'home' : 'homes'} in this area
          {sortSuffix ? <span className="hidden sm:inline"> · {sortSuffix}</span> : null}
        </p>
        {loading && <span className="shrink-0 text-xs text-muted-foreground">Updating…</span>}
      </div>
      {listings.length === 0 ? (
        hasNarrowingFilters ? (
          <div className="p-8 text-center">
            <Eyebrow>{beyondViewportCount != null ? 'Outside this view' : 'No matches'}</Eyebrow>
            <H3 className="mt-2">
              {beyondViewportCount != null
                ? `${beyondViewportCount.toLocaleString('en-US')} matching home${beyondViewportCount === 1 ? ' is' : 's are'} outside this map view`
                : 'No homes match these filters here'}
            </H3>
            <Body className="mt-2 text-muted-foreground">
              {beyondViewportCount != null
                ? 'Zoom out to see them, or loosen a filter.'
                : 'Loosen a filter, or zoom out to widen the search area.'}
            </Body>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => router.push(`${pathname ?? '/homes-for-sale'}?view=${filters.view ?? 'split'}`, { scroll: false })}
            >
              Clear all filters
            </Button>
          </div>
        ) : (
          <div className="p-8 text-center">
            <Eyebrow>Empty view</Eyebrow>
            <H3 className="mt-2">No homes in this part of the map</H3>
            <Body className="mt-2 text-muted-foreground">Zoom out or pan to a different area to see listings.</Body>
          </div>
        )
      ) : (
        <>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {visibleListings.slice(0, visibleCount).map((l) => {
            const key = rowKey(l)
            const href = listingDetailPath(
              key,
              { streetNumber: l.StreetNumber, streetName: l.StreetName, city: l.City, state: l.State, postalCode: l.PostalCode },
              undefined,
              { mlsNumber: l.ListNumber ?? null }
            )
            const isHovered = hoveredKey === key
            const sqft = rowSqft(l)
            const ppsf = cardPricePerSqft(l)
            const badge = nowMs != null ? cardBadge(l, nowMs) : null
            return (
              // A button element (SaveListingButton) can't legally nest inside
              // an anchor — the card used to be one big Link wrapping everything.
              // The Link is now a stretched absolute overlay UNDER the save
              // button (which sits above it in the DOM/z-index), so the
              // whole card is still one click target except the save corner.
              <article
                key={key}
                data-listing-key={key}
                className={cn(
                  // `group/hide` (named) drives the hover-revealed hide control
                  // without entangling the card's own unnamed `group` scale hover.
                  'group group/hide relative overflow-hidden rounded-xl bg-card shadow-sm ring-1 transition',
                  isHovered
                    ? 'shadow-lg ring-2 ring-primary'
                    : 'ring-foreground/10 hover:shadow-md hover:ring-primary/30'
                )}
                onMouseEnter={() => onListHover(key)}
                onMouseLeave={() => onListHover(null)}
              >
                <Link
                  href={href}
                  className="absolute inset-0 z-0"
                  aria-label={`${formatCardAddress(l)} — ${formatPrice(l.ListPrice)}`}
                  onFocus={() => onListHover(key)}
                  onBlur={() => onListHover(null)}
                />
                {/* Hide control (top-left, clear of the save button at top-right
                    and the badge now at bottom-left). Optimistically drops the
                    home from this view AND the map pins via onHiddenChange. */}
                <ListingCardHideControl
                  listingKey={key}
                  addressLine={cardStreet(l)}
                  onVisibilityChange={onHiddenChange}
                  className="left-2.5 right-auto top-2.5"
                />
                <div className="relative aspect-[4/3] bg-muted">
                  {l.PhotoURL ? (
                    <Image
                      src={l.PhotoURL}
                      alt={`${formatAddress(l)} property photo`}
                      fill
                      className="pointer-events-none object-cover transition duration-300 group-hover:scale-[1.02]"
                      sizes="(max-width:1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted-foreground/20 text-sm text-muted-foreground">
                      No photo
                    </div>
                  )}
                  {badge ? (
                    // Bottom-left so it never sits under the top-left hide control.
                    <div className="pointer-events-none absolute bottom-2.5 left-2.5">
                      <Badge variant="outline" className="bg-card px-2.5 shadow-sm">
                        {badge}
                      </Badge>
                    </div>
                  ) : null}
                  <div className="absolute right-2 top-2 z-10">
                    <SaveListingButton listingKey={key} saved={savedSet.has(key)} compact />
                  </div>
                </div>
                <div className="pointer-events-none px-4 pb-4 pt-3.5">
                  <div className="text-2xl font-bold tabular-nums tracking-[-0.01em] text-foreground">
                    {formatPrice(l.ListPrice)}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-foreground">{cardStreet(l)}</div>
                  <div className="truncate text-xs text-muted-foreground">{cardCity(l)}</div>
                  {(l.BedroomsTotal != null || l.BathroomsTotal != null || sqft != null) && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
                      {[
                        l.BedroomsTotal != null ? `${l.BedroomsTotal.toLocaleString()} bd` : null,
                        l.BathroomsTotal != null ? `${l.BathroomsTotal.toLocaleString()} ba` : null,
                        sqft != null ? `${sqft.toLocaleString()} sqft` : null,
                        ppsf != null ? `$${ppsf.toLocaleString()}/sqft` : null,
                      ]
                        .filter(Boolean)
                        .map((part, i) => (
                          <span key={part} className="flex items-center gap-1.5">
                            {i > 0 ? <span aria-hidden>·</span> : null}
                            <span>{part}</span>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
        {visibleListings.length > visibleCount && (
          <div className="px-4 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVisibleCount((c) => c + CARD_PAGE)}
              className="w-full"
            >
              Show more homes
            </Button>
          </div>
        )}
        </>
      )}
    </div>
  )

  const mapPanel = (
    <div className="relative h-full min-h-0 min-w-0 flex-1">
      <SearchMapClustered
        listings={mapListings}
        savedListingKeys={savedListingKeys}
        likedListingKeys={likedListingKeys}
        placeQuery={placeQuery}
        boundaryGeojson={boundaryGeojson}
        onBoundsChanged={handleBoundsChanged}
        shapes={drawnShapes}
        onShapesChange={handleShapesChange}
        hoveredKey={hoveredKey}
        onMarkerHover={onMarkerHover}
        className="h-full w-full"
      />
      {/* Saved named areas (Flexmls My-Map-Overlays parity). Applying one
          replaces the drawn shape set, so it rides the identical ?shapes=
          contract and is shareable + alert-savable like any drawn area. */}
      <AreaPicker shapes={drawnShapes} onApply={handleAreaShapes} />
      {/* Search-as-you-move toggle (Redfin/Zillow pattern). */}
      <Label className="absolute left-1/2 top-3 z-[100] flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-md">
        <Checkbox
          checked={searchAsMove}
          onCheckedChange={() => toggleSearchAsMove()}
        />
        Search as I move the map
      </Label>
      {/* Active place scope — visible until the first user map move, then the
          query is pure bounding-box. Tap the chip to drop the scope now. */}
      {scopeLabel && scopeDropped === false ? (
        <Button
          type="button"
          variant="outline"
          onClick={clearGeoScope}
          aria-label={`Showing ${scopeLabel} only. Clear to search the whole map area.`}
          className="absolute left-1/2 top-[3.6rem] z-[100] flex h-auto -translate-x-1/2 items-center gap-2 rounded-full border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground shadow-md transition hover:bg-muted"
        >
          <span>
            Showing <span className="font-semibold">{scopeLabel}</span> only
          </span>
          <span
            aria-hidden
            className="flex h-4 w-4 items-center justify-center rounded-full bg-foreground/10 text-xs leading-none"
          >
            ✕
          </span>
        </Button>
      ) : null}
      {/* Canvas-level fetch state — the map itself says when results are stale. */}
      {loading ? (
        <div className="pointer-events-none absolute inset-0 z-[95] bg-background/20" aria-hidden />
      ) : null}
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-none absolute bottom-16 left-1/2 z-[100] -translate-x-1/2 transition-opacity',
          loading ? 'opacity-100' : 'opacity-0'
        )}
      >
        <span className="flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground shadow-md">
          <span
            aria-hidden
            className="h-3 w-3 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground"
          />
          {loading ? 'Updating results…' : 'Results updated'}
        </span>
      </div>
      {/* Mobile map view has no list header, so the result count rides the
          canvas. Same totalCount state the pins render from — one query, one
          number (§0). */}
      <p
        className="pointer-events-none absolute bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-md tabular-nums lg:hidden"
        aria-live="polite"
      >
        <span className="font-semibold">{countLabel}</span> {totalCount === 1 ? 'home' : 'homes'} in this area
      </p>
    </div>
  )

  return (
    <div className="map-search-shell flex w-full flex-col overflow-hidden" style={{ contain: 'layout' }}>
      {/* Mobile segmented toggle */}
      <div className="flex shrink-0 border-b border-border bg-card lg:hidden">
        <ToggleGroup
          type="single"
          value={mobileView}
          onValueChange={(v) => {
            if (v === 'list' || v === 'map') {
              // Opening the mobile map mounts a fresh map instance whose
              // initial settle fires a bounds report — that report is not a
              // user move, so it must not drop the geo scope.
              if (v === 'map') {
                firstBoundsReportRef.current = true
                // Event-time read (user tap on the toggle), never render-time.
                initialSettleUntilRef.current = Date.now() + INITIAL_SETTLE_GRACE_MS // hydration-safe
              }
              setMobileView(v)
            }
          }}
          className="w-full rounded-none border-0"
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="list" className="flex-1 py-3 rounded-none border-0 text-sm font-medium" aria-label="List view">
            List
          </ToggleGroupItem>
          <ToggleGroupItem value="map" className="flex-1 py-3 rounded-none border-0 text-sm font-medium" aria-label="Map view">
            Map
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* List + map, ONE mount each — CSS (not a second render) decides which
          shows. Payload audit item 16 (2026-08-03): the old markup rendered
          listPanel (and, when mobileView==="map", mapPanel) into the DOM
          TWICE — once for this "desktop side by side" block, once for the
          "mobile: one panel at a time" block below it, toggled with
          hidden/lg:hidden. Both copies serialize into the SSR HTML regardless
          of which is visible, doubling every card's markup, image srcset and
          icons. Below, each slot mounts once; mobileView + the lg breakpoint
          both gate the same node via Tailwind's hidden/lg:flex pattern. */}
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div
          className={cn(
            'min-h-0 w-full flex-col lg:w-[420px] lg:min-w-[360px] lg:max-w-[480px] lg:shrink-0 lg:border-r lg:border-border',
            mobileView === 'list' ? 'flex' : 'hidden',
            'lg:flex'
          )}
        >
          {listPanel}
        </div>
        <div
          className={cn(
            'min-h-0 w-full flex-1',
            mobileView === 'map' ? 'flex' : 'hidden',
            'lg:flex'
          )}
        >
          {mapPanel}
        </div>
      </div>
    </div>
  )
}
