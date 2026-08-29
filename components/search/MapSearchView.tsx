'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ListingTileRow, MapBounds } from '@/app/actions/listings'
import { countSearchListings, getViewportSearch, type SearchFilters } from '@/app/actions/search'
import type { SearchFiltersInitial } from '@/components/search/SearchFilters'
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
import { publishSearchCount } from '@/lib/search/publish-search-count'
import { GEO_SCOPE_KEYS, geoScopeLabel, stripGeoScope } from '@/components/search/geo-scope'
import { publishStreetLine } from '@/lib/listing/publish-street-line'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { buildHiddenKeySet, excludeHiddenListings } from '@/components/search/hidden-exclusion'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import AreaPicker from '@/components/search/AreaPicker'
import { V3Field } from '@/components/site/v3'
import ListingCardHideControl from '@/components/listing/ListingCardHideControl'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { searchFieldItemId, searchFieldItems, searchFieldPins } from '@/app/search/_v3/search-field-items'

function cardStreet(l: ListingTileRow): string {
  return (
    publishStreetLine({
      streetNumber: l.StreetNumber,
      streetName: l.StreetName,
      streetSuffix: l.StreetSuffix,
    }) || (l.City ?? 'Listing')
  )
}

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

type ViewportSearchOptions = { limit?: number }
type ViewportSearchFn = (
  filters: SearchFilters,
  bounds: MapBounds,
  polygon: Parameters<typeof getViewportSearch>[2],
  options?: ViewportSearchOptions
) => ReturnType<typeof getViewportSearch>

function toSearchFilters(f: SearchFiltersInitial): SearchFilters {
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
      if (def.key === 'keywords') continue
      const value = raw[def.key]?.trim()
      if (value) registry[def.key] = value
    } else {
      if (def.key === 'dom') continue
      const params = def.legacyParams
        ? [def.legacyParams.min, def.legacyParams.max]
        : [`${def.key}Min`, `${def.key}Max`]
      for (const param of params) {
        if (param == null || param === '') continue
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
  initialShapes?: DrawnShape[] | null
  nowMs?: number
  initialDegraded?: boolean
}

export default function MapSearchView({
  initialListings,
  initialTotalCount,
  initialCapped,
  initialBounds,
  filters,
  savedListingKeys: _savedListingKeys,
  likedListingKeys: _likedListingKeys,
  placeQuery: placeQuery,
  boundaryGeojson,
  initialPolygon: initialPolygonProp = null,
  initialShapes = null,
  initialDegraded = false,
}: MapSearchViewProps) {
  const initialDrawn = useMemo<DrawnShape[]>(() => {
    if (initialShapes && initialShapes.length > 0) return initialShapes
    if (initialPolygonProp && initialPolygonProp.length >= 3) {
      return [{ type: 'polygon', points: initialPolygonProp, exclude: false }]
    }
    return []
  }, [initialShapes, initialPolygonProp])
  const initialPolygon = initialDrawn.some((s) => s.exclude === false) ? initialDrawn : null
  const [listings, setListings] = useState(initialListings)
  const [totalCount, setTotalCount] = useState(initialTotalCount)
  const [capped, setCapped] = useState(initialCapped)
  const [resultsDegraded, setResultsDegraded] = useState(initialDegraded)
  const [sortValue, setSortValue] = useState(filters.sort?.trim() || 'newest')
  const [loading, setLoading] = useState(false)
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set())
  const [searchAsMove, setSearchAsMove] = useState(true)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [drawnShapes, setDrawnShapes] = useState<DrawnShape[]>(initialDrawn)
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
  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortValue)?.label ?? 'Newest'

  const scopeLabel = useMemo(
    () => geoScopeLabel({ city: filters.city, subdivision: filters.subdivision, postalCode: filters.postalCode }),
    [filters.city, filters.subdivision, filters.postalCode]
  )
  const [scopeDropped, setScopeDropped] = useState(initialPolygon != null)
  const scopeDroppedRef = useRef(initialPolygon != null)
  const searchFiltersRef = useRef(searchFilters)
  useEffect(() => {
    searchFiltersRef.current = searchFilters
  }, [searchFilters])
  const firstBoundsReportRef = useRef(true)
  const INITIAL_SETTLE_GRACE_MS = 2500
  const initialSettleUntilRef = useRef(0)
  useEffect(() => {
    initialSettleUntilRef.current = Date.now() + INITIAL_SETTLE_GRACE_MS
  }, [])
  const router = useRouter()
  const pathname = usePathname()
  const urlSearchParams = useSearchParams()
  const zeroResultsFiredKeyRef = useRef<string | null>(null)
  const hasNarrowingFilters = useMemo(() => {
    const narrowing = [...ALL_SEARCH_URL_PARAMS, 'propertyType', 'propertySubType']
    return narrowing.some((k) => {
      if (k === 'view' || k === 'sort' || k === 'page') return false
      const v = (filters as Record<string, string | undefined>)[k]
      return typeof v === 'string' && v.trim() !== ''
    })
  }, [filters])

  const [beyondViewportCount, setBeyondViewportCount] = useState<number | null>(null)
  const [matchCount, setMatchCount] = useState<number | null>(null)
  const [matchCountReady, setMatchCountReady] = useState(false)
  const hasDrawnShapes = drawnShapes.length > 0
  useEffect(() => {
    if (totalCount !== 0 || hasNarrowingFilters === false || hasDrawnShapes) {
      setBeyondViewportCount(null)
      return
    }
    let cancelled = false
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(filters as Record<string, string | undefined>)) {
      if (scopeDropped && (GEO_SCOPE_KEYS as readonly string[]).includes(k)) continue
      if (typeof v === 'string' && v.trim() !== '') params[k] = v
    }
    countSearchListings(params)
      .then((n) => {
        if (cancelled === false) setBeyondViewportCount(n != null && n > 0 ? n : null)
      })
      .catch(() => {
        if (cancelled === false) setBeyondViewportCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [totalCount, hasNarrowingFilters, hasDrawnShapes, scopeDropped, filtersSnapshot]) // eslint-disable-line react-hooks/exhaustive-deps

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
        if (cancelled === false) {
          setMatchCount(n)
          setMatchCountReady(true)
        }
      })
      .catch(() => {
        if (cancelled === false) {
          setMatchCount(null)
          setMatchCountReady(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [scopeDropped, filtersSnapshot]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setListings(initialListings)
    setTotalCount(initialTotalCount)
    setCapped(initialCapped)
    setResultsDegraded(initialDegraded)
    setDrawnShapes(initialDrawn)
    setVisibleCount(CARD_PAGE)
    scopeDroppedRef.current = initialPolygon != null
    setScopeDropped(initialPolygon != null)
  }, [initialListings, initialTotalCount, initialCapped, initialDegraded, initialDrawn, filtersSnapshot]) // eslint-disable-line react-hooks/exhaustive-deps

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
        const base = searchFiltersRef.current
        const effectiveFilters = scopeDroppedRef.current ? stripGeoScope(base) : base
        const poly = buildShapeSetForSearch(shapes, bounds)
        const res =
          opts?.limit != null
            ? await (getViewportSearch as ViewportSearchFn)(effectiveFilters, bounds, poly, {
                limit: opts.limit,
              })
            : await getViewportSearch(effectiveFilters, bounds, poly)
        if (reqId !== reqIdRef.current) return
        setListings(res.listings)
        setTotalCount(res.totalCount)
        setCapped(res.capped)
        setResultsDegraded(false)
        if (res.totalCount === 0 && typeof window !== 'undefined') {
          const payload = buildZeroResultsPayload(window.location.search)
          const key = JSON.stringify(payload)
          if (zeroResultsFiredKeyRef.current !== key) {
            zeroResultsFiredKeyRef.current = key
            fireSearchEvent('search_zero_results', payload)
          }
        }
      } catch {
        if (reqId === reqIdRef.current) setResultsDegraded(true)
      } finally {
        if (reqId === reqIdRef.current) setLoading(false)
      }
    },
    []
  )

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
      searchFiltersRef.current = { ...searchFiltersRef.current, sort: next }
      void runViewportSearch(lastBoundsRef.current, drawnShapes)
    },
    [router, pathname, urlSearchParams, drawnShapes, runViewportSearch]
  )

  const retryViewportSearch = useCallback(() => {
    void runViewportSearch(lastBoundsRef.current, drawnShapes)
  }, [drawnShapes, runViewportSearch])

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
      const isInitialSettle =
        firstBoundsReportRef.current || Date.now() < initialSettleUntilRef.current
      firstBoundsReportRef.current = false
      if (isInitialSettle === false) dropGeoScope()
      if (searchAsMove === false) return
      if (isInitialSettle) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        runViewportSearch(bounds, drawnShapes, { limit: 250 })
      }, 350)
    },
    [searchAsMove, drawnShapes, runViewportSearch, dropGeoScope]
  )

  const syncShapesToUrl = useCallback(
    (shapes: DrawnShape[]) => {
      const params = new URLSearchParams(urlSearchParams?.toString() ?? '')
      const encoded = encodeMapShapes(shapes)
      if (encoded) params.set('shapes', encoded)
      else params.delete('shapes')
      const single =
        shapes.length === 1 && shapes[0].type === 'polygon' && shapes[0].exclude === false
          ? shapes[0]
          : null
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

  const prevShapeCountRef = useRef(initialDrawn.length)

  const handleShapesChange = useCallback(
    (shapes: DrawnShape[]) => {
      const poly = shapes.some((s) => s.exclude === false) ? shapes : null
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

  const handleAreaShapes = useCallback(
    (shapes: DrawnShape[]) => {
      if (shapes.some((s) => s.exclude === false)) dropGeoScope()
      setDrawnShapes(shapes)
      syncShapesToUrl(shapes)
      prevShapeCountRef.current = shapes.length
      runViewportSearch(lastBoundsRef.current, shapes)
    },
    [runViewportSearch, dropGeoScope, syncShapesToUrl]
  )

  const toggleSearchAsMove = useCallback(() => {
    setSearchAsMove((prev) => {
      const next = prev === false
      if (next) runViewportSearch(lastBoundsRef.current, drawnShapes)
      return next
    })
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

  useEffect(() => {
    let cancelled = false
    getHiddenListingKeys()
      .then((keys) => { if (cancelled === false && keys.length > 0) setHiddenKeys(buildHiddenKeySet(keys)) })
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

  const visibleListings = useMemo(
    () => excludeHiddenListings(listings, hiddenKeys),
    [listings, hiddenKeys],
  )
  const fieldItems = useMemo(
    () => searchFieldItems(visibleListings.slice(0, visibleCount)),
    [visibleListings, visibleCount],
  )
  const fieldPins = useMemo(() => searchFieldPins(fieldItems), [fieldItems])

  const publishedViewport = publishSearchCount({
    value: resultsDegraded ? null : totalCount,
    grain: 'map-viewport',
    capped,
  })
  const filtersSummary = useMemo(() => buildFiltersSummary(filters), [filters])
  const countPhrase = publishedViewport?.phrase ?? (totalCount === 0 ? 'No homes in this map view' : `${totalCount.toLocaleString('en-US')} homes in this map view`)
  const selectedRow = selectedKey
    ? visibleListings.find((row) => searchFieldItemId(row) === selectedKey)
    : null

  const emptyMessage = resultsDegraded
    ? 'Search took too long. Try again, or reload the page.'
    : matchCountReady === false && listings.length === 0
      ? 'Checking homes for this view. This is not an empty market.'
      : listings.length === 0
        ? hasNarrowingFilters
          ? beyondViewportCount != null
            ? `${beyondViewportCount.toLocaleString('en-US')} matching homes are outside this map view. Zoom out to see them, or loosen a filter.`
            : 'No homes match these filters here. Loosen a filter, or zoom out to widen the search area.'
          : 'No homes in this part of the map. Zoom out or pan to a different area.'
        : 'No homes in this map view.'

  const placeName =
    placeQuery.replace(/\s+Oregon$/i, '').trim() ||
    filters.city?.trim() ||
    filters.subdivision?.trim() ||
    'Central Oregon'

  return (
    <div ref={listContainerRef} className="search-field w-full">
      <V3Field
        id="homes-for-sale-field"
        ariaLabel="Homes for sale in this map view"
        listFlow
        items={fieldItems}
        count={
          publishedViewport
            ? {
                value: `${publishedViewport.value.toLocaleString('en-US')}${capped ? '+' : ''}`,
                label: publishedViewport.caption,
                source: loading
                  ? 'Updating the current map view from the regional MLS.'
                  : 'Live MLS homes in the current map view.',
              }
            : {
                value: resultsDegraded ? '—' : '0',
                label: resultsDegraded ? 'search delayed' : 'homes in this map view',
                source: resultsDegraded
                  ? 'The last map-view fetch timed out.'
                  : 'Live MLS homes in the current map view.',
              }
        }
        lead={
          <>
            <p className="v3-field__note" aria-live="polite">
              {resultsDegraded ? 'Search delayed' : countPhrase}
              {filtersSummary ? ` · ${filtersSummary}` : ''}
              {loading ? ' Updating results…' : ''}
            </p>
            <Label className="inline-flex min-h-11 items-center gap-2">
              <Checkbox
                checked={searchAsMove}
                onCheckedChange={() => toggleSearchAsMove()}
              />
              Search as I move the map
            </Label>
            {scopeLabel && scopeDropped === false ? (
              <Button
                type="button"
                variant="outline"
                onClick={clearGeoScope}
                aria-label={`Showing ${scopeLabel} only. Clear to search the whole map area.`}
                className="min-h-11"
              >
                Showing <span className="font-semibold">{scopeLabel}</span> only
              </Button>
            ) : null}
            <Select value={sortValue} onValueChange={handleSortChange}>
              <SelectTrigger className="min-h-11 w-[10.5rem]" aria-label="Sort results">
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
            {selectedRow ? (
              <div
                data-listing-key={searchFieldItemId(selectedRow)}
                className="group group/hide relative min-h-11"
              >
                <ListingCardHideControl
                  listingKey={searchFieldItemId(selectedRow)}
                  addressLine={cardStreet(selectedRow)}
                  onVisibilityChange={onHiddenChange}
                />
              </div>
            ) : null}
            <AreaPicker shapes={drawnShapes} onApply={handleAreaShapes} />
            {resultsDegraded ? (
              <Button type="button" className="min-h-11" onClick={retryViewportSearch} disabled={loading}>
                Try again
              </Button>
            ) : null}
            {visibleListings.length > visibleCount ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setVisibleCount((c) => c + CARD_PAGE)}
              >
                Show more homes
              </Button>
            ) : null}
          </>
        }
        mapSlot={
          <PlaceFieldMap
            pins={fieldPins}
            boundary={boundaryGeojson}
            placeName={placeName}
            fitOnPinChange={false}
            onBoundsChanged={handleBoundsChanged}
            shapes={drawnShapes}
            onShapesChange={handleShapesChange}
          />
        }
        emptyMessage={emptyMessage}
        activeId={hoveredKey ?? selectedKey}
        onActiveChange={(id) => {
          onListHover(id)
          onMarkerHover(id)
          if (id) setSelectedKey(id)
        }}
        footNote="Listing data comes from Oregon Data Share and Morgan Data Shuttle. Information deemed reliable but not guaranteed."
      />
    </div>
  )
}
