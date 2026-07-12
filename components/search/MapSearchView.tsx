'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import type { ListingTileRow, MapBounds } from '@/app/actions/listings'
import { countSearchListings, getViewportSearch, type SearchFilters } from '@/app/actions/search'
import type { SearchFiltersInitial } from '@/components/search/SearchFilters'
import type { ListingForMap } from '@/components/SearchMapClustered'
import type { MapPolygonPoint } from '@/lib/map-polygon'
import { ALL_SEARCH_URL_PARAMS, SEARCH_FIELDS } from '@/lib/search/field-registry'
import { listingDetailPath, displaySubdivision } from '@/lib/slug'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Eyebrow, H3, Body } from '@/components/site/primitives'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
// React #418 regression class). The server page computes `now` once and
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
  initialPolygon = null,
  nowMs,
}: MapSearchViewProps) {
  const [listings, setListings] = useState(initialListings)
  const [totalCount, setTotalCount] = useState(initialTotalCount)
  const [capped, setCapped] = useState(initialCapped)
  const [loading, setLoading] = useState(false)
  const [searchAsMove, setSearchAsMove] = useState(true)
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)
  const [polygon, setPolygon] = useState<MapPolygonPoint[] | null>(initialPolygon)
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
  const router = useRouter()
  const pathname = usePathname()
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
  useEffect(() => {
    if (totalCount !== 0 || !hasNarrowingFilters || polygon) {
      setBeyondViewportCount(null)
      return
    }
    let cancelled = false
    const params: Record<string, string> = {}
    for (const [k, v] of Object.entries(filters as Record<string, string | undefined>)) {
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
  }, [totalCount, hasNarrowingFilters, polygon, filtersSnapshot]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-seed from server props whenever the URL filters change (new SSR payload).
  useEffect(() => {
    setListings(initialListings)
    setTotalCount(initialTotalCount)
    setCapped(initialCapped)
    setPolygon(initialPolygon)
    setVisibleCount(CARD_PAGE)
  }, [initialListings, initialTotalCount, initialCapped, initialPolygon, filtersSnapshot])

  // Clean up any pending debounce on unmount.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  const runViewportSearch = useCallback(
    async (bounds: MapBounds, poly: MapPolygonPoint[] | null) => {
      const reqId = ++reqIdRef.current
      setLoading(true)
      try {
        const res = await getViewportSearch(searchFilters, bounds, poly)
        // Ignore out-of-order responses (user kept panning).
        if (reqId !== reqIdRef.current) return
        setListings(res.listings)
        setTotalCount(res.totalCount)
        setCapped(res.capped)
      } finally {
        if (reqId === reqIdRef.current) setLoading(false)
      }
    },
    [searchFilters]
  )

  const handleBoundsChanged = useCallback(
    (bounds: MapBounds) => {
      lastBoundsRef.current = bounds
      if (!searchAsMove) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        runViewportSearch(bounds, polygon)
      }, 350)
    },
    [searchAsMove, polygon, runViewportSearch]
  )

  const handlePolygonDrawn = useCallback(
    (poly: MapPolygonPoint[] | null) => {
      setPolygon(poly)
      runViewportSearch(lastBoundsRef.current, poly)
    },
    [runViewportSearch]
  )

  // When the user flips search-as-you-move ON, immediately sync to the current view.
  const toggleSearchAsMove = useCallback(() => {
    setSearchAsMove((prev) => {
      const next = !prev
      if (next) runViewportSearch(lastBoundsRef.current, polygon)
      return next
    })
  }, [polygon, runViewportSearch])

  const onListHover = useCallback((key: string | null) => setHoveredKey(key), [])
  const onMarkerHover = useCallback((key: string | null) => {
    setHoveredKey(key)
    if (key) {
      const el = listContainerRef.current?.querySelector(`[data-listing-key="${key}"]`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [])

  const mapListings = useMemo(() => listings.map(toMapListing), [listings])
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
          {listings.slice(0, visibleCount).map((l) => {
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
              // A <button> (SaveListingButton) can't legally nest inside an
              // <a> — the card used to be one big Link wrapping everything.
              // The Link is now a stretched absolute overlay UNDER the save
              // button (which sits above it in the DOM/z-index), so the
              // whole card is still one click target except the save corner.
              <article
                key={key}
                data-listing-key={key}
                className={cn(
                  'group relative overflow-hidden rounded-xl bg-card shadow-sm ring-1 transition',
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
                    <div className="pointer-events-none absolute left-2.5 top-2.5">
                      <span className="rounded-full border border-border bg-card px-2.5 py-0.5 text-[11px] font-medium text-foreground shadow-sm">
                        {badge}
                      </span>
                    </div>
                  ) : null}
                  <div className="absolute right-2 top-2 z-10">
                    <SaveListingButton listingKey={key} saved={savedSet.has(key)} compact />
                  </div>
                </div>
                <div className="pointer-events-none px-4 pb-4 pt-3.5">
                  <div className="text-[22px] font-bold tabular-nums tracking-[-0.01em] text-foreground">
                    {formatPrice(l.ListPrice)}
                  </div>
                  <div className="mt-0.5 truncate text-[13px] text-foreground">{cardStreet(l)}</div>
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
        {listings.length > visibleCount && (
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
        onPolygonDrawn={handlePolygonDrawn}
        initialPolygon={polygon}
        hoveredKey={hoveredKey}
        onMarkerHover={onMarkerHover}
        className="h-full w-full"
      />
      {/* Search-as-you-move toggle (Redfin/Zillow pattern). */}
      <Label className="absolute left-1/2 top-3 z-[100] flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-md">
        <Checkbox
          checked={searchAsMove}
          onCheckedChange={() => toggleSearchAsMove()}
        />
        Search as I move the map
      </Label>
    </div>
  )

  return (
    <div className="map-search-shell flex w-full flex-col overflow-hidden" style={{ contain: 'layout' }}>
      {/* Mobile segmented toggle */}
      <div className="flex shrink-0 border-b border-border bg-card lg:hidden">
        <ToggleGroup
          type="single"
          value={mobileView}
          onValueChange={(v) => { if (v === 'list' || v === 'map') setMobileView(v) }}
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

      {/* Desktop: list + map side by side */}
      <div className="hidden min-h-0 flex-1 lg:flex">
        <div className="map-search-rail flex shrink-0 flex-col border-r border-border">
          {listPanel}
        </div>
        {mapPanel}
      </div>

      {/* Mobile: one panel at a time */}
      <div className="flex min-h-0 flex-1 lg:hidden">
        {mobileView === 'list' ? listPanel : mapPanel}
      </div>
    </div>
  )
}
