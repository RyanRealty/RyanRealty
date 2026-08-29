'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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
import { publishSearchCountPair } from '@/lib/search/publish-search-count'
import { GEO_SCOPE_KEYS, geoScopeLabel, stripGeoScope } from '@/components/search/geo-scope'
import { nextSearchUrlWithBbox } from '@/lib/search/publish-map-bbox'
import { listingDetailPath, displaySubdivision } from '@/lib/slug'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { buildHiddenKeySet, excludeHiddenListings } from '@/components/search/hidden-exclusion'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import AreaPicker from '@/components/search/AreaPicker'
import { V3ListingRow, type V3ListingRowBadge as ListingBadge } from '@/components/site/v3'
import { publishListingStatusBadge } from '@/lib/search/publish-search-status'
import ListingCardHideControl from '@/components/listing/ListingCardHideControl'
import './search-ledger.css'

const SearchMapClustered = dynamic(() => import('@/components/SearchMapClustered'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground" style={{ minHeight: 320 }}>
      Loading map…
    </div>
  ),
})

/** Street line only (e.g. "2732 NW Ordway Ave") — matches ListingCard addressLine. */
function cardStreet(l: ListingTileRow): string {
  return (
    publishStreetLine({
      streetNumber: l.StreetNumber,
      streetName: l.StreetName,
      streetSuffix: l.StreetSuffix,
    }) || (l.City ?? 'Listing')
  )
}

/** "Bend, OR 97703 · Awbrey Butte" — city + state + zip, plus subdivision when
 *  the row carries one. Oregon-scoped, so "OR" is a safe constant when State is
 *  absent. Mirrors SearchResults cityLine so split + list views read identically. */
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

/** Sort options for the list-pane count row (G2). Values match SearchFilters.SORT_OPTIONS. */
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price_per_sqft_asc', label: 'Price per sq ft: low to high' },
  { value: 'price_per_sqft_desc', label: 'Price per sq ft: high to low' },
  { value: 'year_newest', label: 'Newest built' },
  { value: 'year_oldest', label: 'Oldest built' },
] as const

/** Compact filter crumbs for the mockup count row ("N homes · Bend · $500K+"). */
function buildFiltersSummary(f: SearchFiltersInitial): string {
  const parts: string[] = []
  if (f.city?.trim()) parts.push(f.city.trim())
  if (f.subdivision?.trim()) parts.push(f.subdivision.trim())
  if (f.postalCode?.trim()) parts.push(f.postalCode.trim())
  const minP = f.minPrice?.trim() ? Number(f.minPrice) : null
  const maxP = f.maxPrice?.trim() ? Number(f.maxPrice) : null
  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
      : n >= 1_000
        ? `$${Math.round(n / 1_000)}K`
        : `$${n}`
  if (minP != null && Number.isFinite(minP) && maxP != null && Number.isFinite(maxP)) {
    parts.push(`${fmt(minP)} to ${fmt(maxP)}`)
  } else if (minP != null && Number.isFinite(minP)) {
    parts.push(`${fmt(minP)}+`)
  } else if (maxP != null && Number.isFinite(maxP)) {
    parts.push(`Up to ${fmt(maxP)}`)
  }
  if (f.beds?.trim()) parts.push(`${f.beds}+ bd`)
  if (f.baths?.trim()) parts.push(`${f.baths}+ ba`)
  if (f.propertyType?.trim()) parts.push(f.propertyType.trim())
  if (f.status && f.status !== 'Active') parts.push(f.status)
  return parts.join(' · ')
}

/** Optional 4th arg for pan payload cap. Server may ignore until Wave 3 API lands. */
type ViewportSearchOptions = { limit?: number }
type ViewportSearchFn = (
  filters: SearchFilters,
  bounds: MapBounds,
  polygon: Parameters<typeof getViewportSearch>[2],
  options?: ViewportSearchOptions
) => ReturnType<typeof getViewportSearch>

const NEW_LISTING_WINDOW_DAYS = 7

/**
 * Map viewport badge → ListingCard badge prop.
 * Non-active MLS status uses publishListingStatusBadge (Pending / Under
 * contract / Sold). `nowMs` is a server-passed wall-clock prop so SSR HTML
 * matches hydration (do not sample the clock inside this pure helper).
 */
function cardBadge(
  l: ListingTileRow,
  nowMs: number
): { kind: ListingBadge; label: string } | undefined {
  const statusBadge = publishListingStatusBadge(l.StandardStatus)
  if (statusBadge) return statusBadge
  if (l.OnMarketDate) {
    const days = (nowMs - new Date(l.OnMarketDate).getTime()) / 86_400_000
    if (Number.isFinite(days) && days >= 0 && days <= NEW_LISTING_WINDOW_DAYS) {
      return { kind: 'new', label: 'New' }
    }
  }
  return undefined
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
    neighborhood: f.neighborhood || undefined,
    minPrice: f.minPrice ? Number(f.minPrice) : undefined,
    maxPrice: f.maxPrice ? Number(f.maxPrice) : undefined,
    beds: f.beds ? Number(f.beds) : undefined,
    baths: f.baths ? Number(f.baths) : undefined,
    maxBeds: f.maxBeds ? Number(f.maxBeds) : undefined,
    maxBaths: f.maxBaths ? Number(f.maxBaths) : undefined,
    // Empty string is active+pending (SEO map / getViewportSearch). Do not
    // coerce '' to Active — only default when status is actually missing.
    status: f.status ?? 'Active',
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
  /**
   * SSR viewport timed out or failed (SEARCH_UX_WAVE3 P9). When true the empty
   * state must NOT claim "no homes" — show a retry instead of inventing zero inventory.
   */
  initialDegraded?: boolean
  /** Place pages: the city pin is the page. Do not offer "clear Redmond". */
  lockPlace?: boolean
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
  initialDegraded = false,
  lockPlace = false,
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
  // Timeout honesty (P9): seed from SSR; clear on a successful viewport fetch.
  const [resultsDegraded, setResultsDegraded] = useState(initialDegraded)
  // Local sort so the Select stays in sync while URL replace + viewport refetch run.
  const [sortValue, setSortValue] = useState(filters.sort?.trim() || 'newest')
  const [loading, setLoading] = useState(false)
  // Per-user hidden homes ("Hide homes I don't want to see"). Same edge-of-
  // render model as SearchResults: viewport results are SHARED caches, so the
  // per-user subtraction never touches the fetch — a hidden home is filtered
  // out of BOTH the card list AND the map pins here, from the signed-in user's
  // hidden_listings rows. Signed-out users get an empty set (no filtering).
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set())
  const [areaDirty, setAreaDirty] = useState(false)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  /** Pin/list selection (stronger than hover) — map popup open ↔ list card ring + scroll. */
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [drawnShapes, setDrawnShapes] = useState<DrawnShape[]>(initialDrawn)
  // List-first on mobile so the first 390 viewport shows a house, not a
  // map-only void. Map is one tap on the List/Map toggle.
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
  useEffect(() => {
    setSortValue(filters.sort?.trim() || 'newest')
  }, [filters.sort])
  // Radix SelectValue only paints a label once SelectContent has mounted at
  // least once (a client-only useLayoutEffect) — with no children of its own
  // it renders truly empty in SSR HTML, which a crawler sees as a blank
  // control. Pass the label as SelectValue's children so the served markup
  // always carries the current sort's text, SSR and post-hydration alike.
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortValue)?.label ?? 'Newest'

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
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [matchCountReady, setMatchCountReady] = useState(false)
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

  // Filter-match count (no bbox) — the coherent number for the URL filters.
  // Viewport totalCount is a different population and may only print labeled.
  useEffect(() => {
    let cancelled = false
    setMatchCountReady(false)
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(filters as Record<string, string | undefined>)) {
      if (scopeDropped && (GEO_SCOPE_KEYS as readonly string[]).includes(k)) continue
      if (typeof v === 'string' && v.trim() !== '') params[k] = v
    }
    countSearchListings(params)
      .then((n) => {
        if (!cancelled) {
          setMatchCount(n)
          setMatchCountReady(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatchCount(null)
          setMatchCountReady(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [scopeDropped, filtersSnapshot]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-seed from server props whenever the URL filters change (new SSR payload).
  // The SSR payload is scoped again, so the scope-drop resets with it — the
  // chip re-appears and the next user move re-drops it.
  useEffect(() => {
    setListings(initialListings)
    setTotalCount(initialTotalCount)
    setCapped(initialCapped)
    setResultsDegraded(initialDegraded)
    setDrawnShapes(initialDrawn)
    setVisibleCount(CARD_PAGE)
    scopeDroppedRef.current = initialPolygon != null
    setScopeDropped(initialPolygon != null)
    setAreaDirty(false)
  }, [initialListings, initialTotalCount, initialCapped, initialDegraded, initialDrawn, filtersSnapshot]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up any pending debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const runViewportSearch = useCallback(
    async (bounds: MapBounds, shapes: DrawnShape[], opts?: ViewportSearchOptions) => {
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
        // Pan passes { limit: 250 } for a lighter payload (P3). Non-pan paths
        // (draw, toggle, retry) keep the three-arg call so SSR-style fidelity
        // remains the default; the 4th arg is TypeScript-optional until the
        // server action accepts it.
        const res =
          opts?.limit != null
            ? await (getViewportSearch as ViewportSearchFn)(effectiveFilters, bounds, poly, {
                limit: opts.limit,
              })
            : await getViewportSearch(effectiveFilters, bounds, poly)
        // Ignore out-of-order responses (user kept panning).
        if (reqId !== reqIdRef.current) return
        setListings(res.listings)
        setTotalCount(res.totalCount)
        setCapped(res.capped)
        setResultsDegraded(false)
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
      } catch {
        // Network / action failure: honest degraded empty, not "0 homes".
        if (reqId === reqIdRef.current) setResultsDegraded(true)
      } finally {
        if (reqId === reqIdRef.current) setLoading(false)
      }
    },
    []
  )

  /** Mockup G2: sort lives on the count row; updates URL like other filters. */
  const handleSortChange = useCallback(
    (value: string) => {
      const next = value || 'newest'
      setSortValue(next)
      const params = new URLSearchParams(urlSearchParams?.toString() ?? '')
      if (next === 'newest') params.delete('sort')
      else params.set('sort', next)
      params.delete('page')
      const query = params.toString()
      const base = pathname ?? '/homes-for-sale'
      router.replace(query ? `${base}?${query}` : base, { scroll: false })
      // Immediate viewport refetch with the new sort (don't wait on full SSR).
      searchFiltersRef.current = { ...searchFiltersRef.current, sort: next }
      void runViewportSearch(lastBoundsRef.current, drawnShapes)
    },
    [router, pathname, urlSearchParams, drawnShapes, runViewportSearch]
  )

  const retryViewportSearch = useCallback(() => {
    void runViewportSearch(lastBoundsRef.current, drawnShapes)
  }, [drawnShapes, runViewportSearch])

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
      const cameraUrl = nextSearchUrlWithBbox(
        pathname ?? '/homes-for-sale',
        urlSearchParams?.toString() ?? '',
        bounds,
      )
      if (cameraUrl) router.replace(cameraUrl, { scroll: false })
      if (isInitialSettle === false) dropGeoScope()
      if (isInitialSettle) return
      // Camera only. List + pins stay until Search this area.
      setAreaDirty(true)
    },
    [dropGeoScope, pathname, router, urlSearchParams]
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

  const searchThisArea = useCallback(() => {
    setAreaDirty(false)
    runViewportSearch(lastBoundsRef.current, drawnShapes, { limit: 250 })
  }, [drawnShapes, runViewportSearch])

  const onListHover = useCallback((key: string | null) => setHoveredKey(key), [])
  const scrollListToKey = useCallback((key: string) => {
    const el = listContainerRef.current?.querySelector(`[data-listing-key="${key}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])
  const onMarkerHover = useCallback(
    (key: string | null) => {
      setHoveredKey(key)
      if (key) scrollListToKey(key)
    },
    [scrollListToKey],
  )
  const onMarkerClick = useCallback(
    (key: string) => {
      setSelectedKey((prev) => (prev === key ? null : key))
      setHoveredKey(key)
      scrollListToKey(key)
    },
    [scrollListToKey],
  )

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

  const publishedCounts = publishSearchCountPair({
    matchCount,
    viewportCount: totalCount,
    viewportCapped: capped,
  })
  const filtersSummary = useMemo(() => buildFiltersSummary(filters), [filters])
  // Filter-match is the coherent number for the URL filters. Viewport prints
  // only when it differs, labeled "in this map view".
  const listCountPhrase =
    !matchCountReady && totalCount === 0
      ? 'Updating…'
      : (publishedCounts.match?.phrase ?? publishedCounts.viewport?.phrase ?? 'Homes')
  const mapCountPhrase =
    publishedCounts.viewport?.phrase ??
    publishedCounts.match?.phrase ??
    (totalCount === 0 ? 'No homes in this map view' : `${totalCount.toLocaleString('en-US')} homes in this map view`)

  // listPanel is mounted once (desktop rail + mobile bottom sheet share the
  // node via CSS). Mobile List expands the sheet; Map hides it (count pill).
  // totalCount is sticky across pan refetches — loading never clears it, so
  // the row / pill show previous N + "Updating…" (SEARCH_UX_WAVE3 pan sticky count).
  const listPanel = (
    <div ref={listContainerRef} className="flex-1 min-h-0 overflow-y-auto bg-muted">
      {/* Mockup G2: "N homes · filters · Sort" sticky count/sort row. */}
      <div className="sticky top-0 z-10 hidden flex-wrap items-center justify-between gap-2 border-b border-border bg-card px-4 py-2 sm:py-3 lg:flex">
        <p className="srch-count min-w-0 flex-1 text-muted-foreground" aria-live="polite">
          {resultsDegraded ? (
            <span className="font-semibold text-foreground">Search delayed</span>
          ) : (
            <>
              <span className="srch-figure font-semibold text-foreground">{listCountPhrase}</span>
              {/* The viewport phrase prints ONLY when it differs (2026-08-27
                  audit: with no filter match the list phrase falls back to the
                  viewport phrase and this line printed the same string twice —
                  "1,094+ homes in this map view 1,094+ homes in this map view"). */}
              {publishedCounts.viewport && publishedCounts.viewport.phrase !== listCountPhrase ? (
                <span className="ml-2"> · {publishedCounts.viewport.phrase}</span>
              ) : null}
              {filtersSummary ? (
                <span className="hidden sm:inline"> · {filtersSummary}</span>
              ) : null}
            </>
          )}
          {loading ? (
            <span className="ml-2 text-xs text-muted-foreground">Updating…</span>
          ) : null}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <span className="srch-label hidden sm:inline">Sort</span>
          <Select value={sortValue} onValueChange={handleSortChange}>
            <SelectTrigger className="srch-square h-9 w-[10.5rem]" aria-label="Sort results" size="sm">
              <SelectValue placeholder="Newest">{sortLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {resultsDegraded ? (
        <div className="srch-panel m-4 p-8 text-center">
          <p className="srch-label">Try again</p>
          <h3 className="mt-2 text-base font-semibold text-foreground">Search took too long</h3>
          <p className="mt-2 text-muted-foreground">
            We could not load homes for this view. Try again, or reload the page.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Button type="button" size="sm" className="srch-chip" onClick={retryViewportSearch} disabled={loading}>
              Try again
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="srch-chip"
              onClick={() => {
                if (typeof window !== 'undefined') window.location.reload()
              }}
            >
              Reload page
            </Button>
          </div>
        </div>
      ) : !matchCountReady && listings.length === 0 ? (
        <div className="srch-panel m-4 p-8 text-center">
          <p className="srch-label">Updating</p>
          <h3 className="mt-2 text-base font-semibold text-foreground">Checking homes for this view</h3>
          <p className="mt-2 text-muted-foreground">
            The filter-match count is still loading. This is not an empty market.
          </p>
        </div>
      ) : listings.length === 0 ? (
        hasNarrowingFilters ? (
          <div className="srch-panel m-4 p-8 text-center">
            <p className="srch-label">{beyondViewportCount != null ? 'Outside this view' : 'No matches'}</p>
            <h3 className="mt-2 text-base font-semibold text-foreground">
              {beyondViewportCount != null
                ? `${beyondViewportCount.toLocaleString('en-US')} matching home${beyondViewportCount === 1 ? ' is' : 's are'} outside this map view`
                : 'No homes match these filters here'}
            </h3>
            <p className="mt-2 text-muted-foreground">
              {beyondViewportCount != null
                ? 'Zoom out to see them, or loosen a filter.'
                : 'Loosen a filter, or zoom out to widen the search area.'}
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="srch-chip mt-4"
              onClick={() => router.push(`${pathname ?? '/homes-for-sale'}?view=${filters.view ?? 'split'}`, { scroll: false })}
            >
              Clear all filters
            </Button>
          </div>
        ) : (
          <div className="srch-panel m-4 p-8 text-center">
            <p className="srch-label">Empty view</p>
            <h3 className="mt-2 text-base font-semibold text-foreground">No homes in this part of the map</h3>
            <p className="mt-2 text-muted-foreground">Zoom out or pan to a different area to see listings.</p>
          </div>
        )
      ) : (
        <>
        <div className="v3-lrow-list px-4 py-2">
          {visibleListings.slice(0, visibleCount).map((l, cardIndex) => {
            const key = rowKey(l)
            const href = listingDetailPath(
              key,
              { streetNumber: l.StreetNumber, streetName: l.StreetName, city: l.City, state: l.State, postalCode: l.PostalCode },
              undefined,
              { mlsNumber: l.ListNumber ?? null }
            )
            const isHovered = hoveredKey === key
            const isSelected = selectedKey === key
            const addressLine = cardStreet(l)
            const badge = nowMs != null ? cardBadge(l, nowMs) : undefined
            // V3ListingRow — the Ledger-register listing unit (same as
            // SearchResults). Wrapper owns data-listing-key + hide control;
            // the map hover/select state rides the row's own functional
            // inset ring (`is-hot` / `is-active`), never an elevation shadow.
            return (
              <div
                key={key}
                data-listing-key={key}
                className="group group/hide relative"
                onMouseEnter={() => onListHover(key)}
                onMouseLeave={() => onListHover(null)}
                onClick={() => setSelectedKey(key)}
              >
                <ListingCardHideControl
                  listingKey={key}
                  addressLine={addressLine}
                  onVisibilityChange={onHiddenChange}
                  className="left-1 top-1 right-auto size-7"
                />
                <V3ListingRow
                  showPricePerSqft
                  priority={cardIndex < 4}
                  className={cn('v3-lrow--split', isSelected && 'is-active', !isSelected && isHovered && 'is-hot')}
                  listing={{
                    listingKey: key,
                    href,
                    photoUrl: l.PhotoURL,
                    price: l.ListPrice,
                    addressLine,
                    cityLine: cardCity(l),
                    beds: l.BedroomsTotal,
                    baths: l.BathroomsTotal,
                    sqft: rowSqft(l),
                    pricePerSqft: cardPricePerSqft(l),
                    // The card publishes the ask and the $/sq ft, and needs to
                    // know what kind of listing it is drawing to do it: on a
                    // commercial lease the price is rent, and on a fractional
                    // share it buys part of the home.
                    propertyType: l.PropertyType ?? null,
                    propertySubType: l.PropertySubType ?? null,
                    subdivisionName: l.SubdivisionName ?? null,
                    city: l.City ?? null,
                    listNumber: l.ListNumber ?? null,
                    badge,
                  }}
                />
              </div>
            )
          })}
        </div>
        {visibleListings.length > visibleCount && (
          <div className="px-4 pb-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVisibleCount((c) => c + CARD_PAGE)}
              className="srch-chip w-full"
            >
              Show more homes
            </Button>
          </div>
        )}
        {/* ODS Aug 2024 IDX display rules (G54): every rendered price/$-per-sqft
            needs source attribution in view. Split/map is an app frame that
            deliberately omits V3Footer, so it carries no attribution of its
            own — this line mirrors V3Footer's ODS text verbatim (compact,
            no broker-license line, since this is not the global chrome). */}
        <p className="px-4 pb-4 text-xs text-muted-foreground">
          Listing data comes from Oregon Data Share and Morgan Data Shuttle. Information deemed
          reliable but not guaranteed.
        </p>
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
        hideBoundaryToggle={lockPlace}
        initialBounds={initialBounds}
        lockBounds
        relayoutKey={mobileView}
        onBoundsChanged={handleBoundsChanged}
        shapes={drawnShapes}
        onShapesChange={handleShapesChange}
        hoveredKey={hoveredKey ?? selectedKey}
        onMarkerHover={onMarkerHover}
        onMarkerClick={onMarkerClick}
        className="h-full w-full"
      />
      {/* Saved named areas (Flexmls My-Map-Overlays parity). Applying one
          replaces the drawn shape set, so it rides the identical ?shapes=
          contract and is shareable + alert-savable like any drawn area. */}
      <AreaPicker shapes={drawnShapes} onApply={handleAreaShapes} />
      {areaDirty ? (
        <Button
          type="button"
          variant="outline"
          onClick={searchThisArea}
          className="absolute left-1/2 top-3 z-[100] h-11 -translate-x-1/2 rounded-none border-border bg-card px-4 text-sm font-medium text-foreground shadow-none"
        >
          Search this area
        </Button>
      ) : null}
      {/* Active place scope — visible until the first user map move, then the
          query is pure bounding-box. Tap the chip to drop the scope now. */}
      {scopeLabel && scopeDropped === false && !lockPlace ? (
        <Button
          type="button"
          variant="outline"
          onClick={clearGeoScope}
          aria-label={`Showing ${scopeLabel} only. Clear to search the whole map area.`}
          className="absolute left-1/2 top-[3.6rem] z-[100] flex h-auto -translate-x-1/2 items-center gap-2 rounded-none border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground shadow-none transition hover:bg-muted"
        >
          <span>
            Showing <span className="font-semibold">{scopeLabel}</span> only
          </span>
          <span
            aria-hidden
            className="flex h-4 w-4 items-center justify-center rounded-none bg-foreground/10 text-xs leading-none"
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
          // Sit above the mobile count pill / sheet so the spinner stays readable.
          'pointer-events-none absolute bottom-24 left-1/2 z-[100] -translate-x-1/2 transition-opacity lg:bottom-16',
          loading ? 'opacity-100' : 'opacity-0'
        )}
      >
        <span className="flex items-center gap-2 rounded-none border border-border bg-card px-3.5 py-1.5 text-xs font-medium text-foreground shadow-none">
          <span
            aria-hidden
            className="h-3 w-3 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground"
          />
          {loading ? 'Updating results…' : 'Results updated'}
        </span>
      </div>
      {/* Mobile map canvas: result count rides the canvas from the SAME totalCount
          as the pins (§0). Hidden when the list sheet is expanded (no double count).
          Never claim "0 homes" when the fetch was degraded (P9). */}
      <p
        className={cn(
          'srch-count pointer-events-none absolute bottom-4 left-1/2 z-[100] -translate-x-1/2 rounded-none border border-border bg-card px-4 py-2 font-medium text-foreground shadow-none lg:hidden',
          mobileView === 'list' ? 'invisible' : 'visible'
        )}
        aria-live="polite"
      >
        {resultsDegraded ? (
          'Search delayed'
        ) : (
          <>
            <span className="srch-figure font-semibold">{mapCountPhrase}</span>
            {loading ? <span className="ml-1.5 text-xs text-muted-foreground">Updating…</span> : null}
          </>
        )}
      </p>
    </div>
  )

  return (
    <div className="map-search-shell flex min-h-0 flex-1 w-full flex-col overflow-hidden" style={{ contain: 'layout' }}>
      {/* Mobile segmented toggle — list-first default; Map hides the sheet. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border bg-card px-2 py-1 lg:hidden">
        <ToggleGroup
          type="single"
          value={mobileView}
          onValueChange={(v) => {
            if (v === 'list' || v === 'map') {
              setMobileView(v)
            }
          }}
          className="min-w-0 flex-1 rounded-none border-0"
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="list" className="flex-1 rounded-none border-0 py-2 text-sm font-medium" aria-label="List view">
            List
          </ToggleGroupItem>
          <ToggleGroupItem value="map" className="flex-1 rounded-none border-0 py-2 text-sm font-medium" aria-label="Map view">
            Map
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="srch-figure min-w-0 shrink truncate text-xs font-semibold text-foreground" aria-live="polite">
          {resultsDegraded ? 'Search delayed' : listCountPhrase}
        </p>
        <Select value={sortValue} onValueChange={handleSortChange}>
          <SelectTrigger className="srch-square h-9 w-[7.5rem] shrink-0" aria-label="Sort results" size="sm">
            <SelectValue placeholder="Newest">{sortLabel}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List + map, ONE mount each. Desktop: side-by-side. Mobile: list-first
          fills the shell so a house is in the first 390 viewport; Map hides the
          list and shows the canvas. Never double-render panels. */}
      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Map — full-bleed under the list on mobile; flex-1 rail partner on desktop. */}
        <div className="absolute inset-0 z-0 min-h-0 min-w-0 lg:static lg:relative lg:z-auto lg:order-2 lg:min-h-0 lg:flex-1">
          {mapPanel}
        </div>

        {/* List rail / mobile list pane.
            List mode: covers the map so overlays cannot sit on the photo.
            Map mode: pane hidden (count pill on canvas). Desktop: left rail. */}
        <div
          className={cn(
            'z-10 min-h-0 flex-col bg-card',
            'absolute inset-0',
            mobileView === 'list' ? 'flex' : 'hidden',
            'map-search-list lg:static lg:order-1 lg:z-auto lg:flex lg:h-auto lg:max-h-none lg:shrink-0 lg:rounded-none lg:border-t-0 lg:border-r lg:border-border lg:shadow-none lg:transition-none lg:inset-auto'
          )}
        >
          {listPanel}
        </div>
      </div>
    </div>
  )
}
