'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import type { ListingTileRow } from '@/app/actions/listings'
import { getSearchListings, type SearchFilters } from '@/app/actions/search'
import { getHiddenListingKeys } from '@/app/actions/hidden-listings'
import { SearchHomesField } from '@/app/search/_v3/SearchHomesField'
import { dedupeListingRows } from '@/app/search/_v3/search-field-items'
import { SEARCH_FIELDS } from '@/lib/search/field-registry'
import { buildHiddenKeySet, excludeHiddenListings } from '@/components/search/hidden-exclusion'
import type { SearchFiltersInitial } from '@/components/search/SearchFilters'
import { Button } from '@/components/ui/button'
import './search-ledger.css'

/**
 * Convert the page's URL filter object into getSearchListings' SearchFilters.
 * Same registry passthrough MapSearchView uses so page 2 matches page 1
 * (maxBeds/maxBaths + every SEARCH_FIELDS key). Empty status stays empty
 * (active+pending); do not coerce '' to Active.
 */
export function toSearchListingsFilters(f: SearchFiltersInitial): SearchFilters {
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

type Props = {
  initialListings: ListingTileRow[]
  totalCount: number
  initialPage: number
  filters: SearchFiltersInitial
  view: 'split' | 'list' | 'map'
  /** When true and totalCount is 0, show a helpful empty state with clear-filters CTA. */
  hasActiveFilters?: boolean
  /**
   * SEARCH_UX_WAVE3 Wave 0b: SSR list fetch timed out or threw.
   * Do not claim "no homes match" — that would invent empty inventory.
   */
  initialDegraded?: boolean
}

export default function SearchResults({
  initialListings,
  totalCount,
  initialPage,
  filters,
  hasActiveFilters = false,
  initialDegraded = false,
}: Props) {
  const [listings, setListings] = useState(initialListings)
  const [page, setPage] = useState(initialPage)
  const [total, setTotal] = useState(totalCount)
  const [loading, setLoading] = useState(false)
  const [degraded, setDegraded] = useState(initialDegraded)
  // Per-user hidden homes ("Hide homes I don't want to see"). CONSTRAINT: the
  // server listing results are SHARED caches (same rows for every visitor), so
  // per-user hiding must never be baked into the fetch — it is filtered here,
  // at the edge of render, from the signed-in user's hidden_listings rows.
  // Signed-out users get an empty set (no filtering, no extra work).
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => new Set())
  const sentinelRef = useRef<HTMLDivElement>(null)

  const filtersSnapshot = JSON.stringify(filters)

  useEffect(() => {
    let cancelled = false
    getHiddenListingKeys()
      .then((keys) => {
        if (!cancelled && keys.length > 0) setHiddenKeys(buildHiddenKeySet(keys))
      })
      .catch(() => {}) // fail open: worst case the user sees a home they hid
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setListings(dedupeListingRows(initialListings))
    setPage(initialPage)
    setTotal(totalCount)
    setDegraded(initialDegraded)
  }, [initialListings, initialPage, totalCount, initialDegraded, filtersSnapshot])

  const loadMore = useCallback(async () => {
    if (loading || listings.length >= total) return
    setLoading(true)
    try {
      const nextPage = page + 1
      const { listings: nextListings, totalCount: nextTotal } = await getSearchListings(
        toSearchListingsFilters(filters),
        nextPage
      )
      setListings((prev) => dedupeListingRows([...prev, ...nextListings]))
      setTotal(nextTotal)
      setPage(nextPage)
    } finally {
      setLoading(false)
    }
  }, [loading, listings.length, total, page, filters])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '200px', threshold: 0 }
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [loadMore])

  const showDegradedState = degraded && total === 0 && listings.length === 0
  const showEmptyState = !showDegradedState && total === 0 && hasActiveFilters
  // Hidden homes drop out of the rendered grid only — `total` stays the shared
  // server count (per-user subtraction would misstate paging + the cache).
  const visibleListings = useMemo(
    () => excludeHiddenListings(listings, hiddenKeys),
    [listings, hiddenKeys],
  )

  return (
    <div className="w-full p-4 space-y-4">
      {showDegradedState ? (
        <div className="srch-panel p-8 text-center">
          <p className="srch-label">Search delayed</p>
          <h3 className="mt-2 text-base font-semibold text-foreground">
            We could not load listings in time
          </h3>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            This is a connection or timeout problem, not an empty market. Try again.
          </p>
          <Button
            type="button"
            variant="outline"
            className="srch-chip mt-6"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload()
            }}
          >
            Reload page
          </Button>
        </div>
      ) : showEmptyState ? (
        <div className="srch-panel p-8 text-center">
          <p className="srch-label">No matches</p>
          <h3 className="mt-2 text-base font-semibold text-foreground">
            No homes match these filters
          </h3>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Loosen a filter, or view every Central Oregon listing.
          </p>
          <Button asChild variant="outline" className="srch-chip mt-6">
            <Link href="/homes-for-sale">View all listings</Link>
          </Button>
        </div>
      ) : (
        <>
          <p className="srch-count text-muted-foreground">
            <span className="srch-figure">{total.toLocaleString()}</span> home
            {total !== 1 ? 's' : ''} found
          </p>
          <SearchHomesField
            listings={visibleListings}
            placeName={filters.city?.trim() || 'Central Oregon'}
            count={
              total > 0
                ? {
                    value: total.toLocaleString('en-US'),
                    label: 'homes in this search',
                    source: 'Regional MLS via listing_search_mv',
                  }
                : undefined
            }
            emptyMessage="No homes match these filters. Loosen a filter, or view every Central Oregon listing."
          />
      {listings.length < total && (
        <div ref={sentinelRef} className="flex justify-center py-8">
          {loading && <span className="text-muted-foreground">Loading more…</span>}
        </div>
      )}
        </>
      )}
    </div>
  )
}
