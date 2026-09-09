'use client'

import { useRouter, usePathname } from 'next/navigation'
import { navigateQuery, useUrlSearchParams } from '@/lib/search/url-search-params.client'
import { mergeUrlSearchFilters } from '@/components/search/merge-url-search-filters'
import { useCallback, useMemo, useState, useRef } from 'react'
import { trackEvent } from '@/lib/tracking'
import { fireFirstPartyEvent } from '@/components/VisitTracker'
import { buildFilterApplyPayload } from '@/lib/search/search-events'
import { fireSearchEvent } from '@/components/search/search-events.client'
import {
  SearchSuggestPanel,
  flattenSuggestions,
  useSearchSuggest,
  type SuggestItem,
} from '@/components/search/SearchSuggest'
import HomeTypeFilterPanel, { homeTypeChipLabel } from '@/components/search/HomeTypeFilterPanel'
import { parseSearchQuery } from '@/lib/parse-search-query'
import dynamic from 'next/dynamic'
import SaveSearchButton from '@/components/SaveSearchButton'
import {
  activeRegistryFilters,
  ParsedSearchNotice,
  RegistryFilterChip,
  useParsedSearchConfirm,
} from '@/components/search/registry-filter-chrome'
import VoiceSearchButton from '@/components/VoiceSearchButton'
import { useViewerListingState } from '@/components/search/use-viewer-listing-state'
import './search-ledger.css'

/** P6: load the ~1k-LOC registry sheet only after first open (not on cold search). */
const AllFiltersSheet = dynamic(() => import('@/components/search/AllFiltersSheet'), {
  ssr: false,
  loading: () => null,
})
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  FilterIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'
import { REPORT_CITY_LABELS } from '@/lib/data/geo/report-cities'
import { BEND_NEIGHBORHOOD_DISTRICTS } from '@/lib/data/geo/bend-neighborhood-districts'
import { getAllResortCommunities } from '@/lib/data/communities/registry'
import { getSchoolDistrictOptions } from '@/lib/data/schools/getSchools'
import { SUBDIVISION_ALIASES } from '@/lib/subdivision-aliases'
import { normalizeSearchKey } from '@/lib/search/neighborhood-match'

export type SearchFiltersInitial = {
  city?: string
  subdivision?: string
  neighborhood?: string
  /** School district slug or label (Places grain). Listing filter expands to district cities. */
  schoolDistrict?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
  maxBeds?: string
  maxBaths?: string
  status?: string
  sort?: string
  view?: string
  minSqFt?: string
  maxSqFt?: string
  lotAcresMin?: string
  lotAcresMax?: string
  yearBuiltMin?: string
  yearBuiltMax?: string
  propertyType?: string
  propertySubTypes?: string
  hasPool?: string
  hasView?: string
  hasWaterfront?: string
  hasFireplace?: string
  hasGolfCourse?: string
  garageMin?: string
  daysOnMarket?: string
  keywords?: string
  postalCode?: string
}

// ---------------------------------------------------------------------------
// Static option lists
// ---------------------------------------------------------------------------


const PLACE_COMMUNITY_OPTIONS = getAllResortCommunities()
  .filter((c) => c.is_resort === true)
  .map((c) => ({ label: c.label, city: c.city, slug: c.slug }))

const PLACE_SUBDIVISION_OPTIONS = Object.keys(SUBDIVISION_ALIASES).sort((a, b) =>
  a.localeCompare(b),
)

const PLACE_SCHOOL_DISTRICT_OPTIONS = getSchoolDistrictOptions()

const STATUS_OPTIONS = [
  { value: 'Active', label: 'For sale' },
  { value: 'Pending', label: 'Under contract' },
  { value: 'Sold', label: 'Sold' },
] as const

const BEDS_MIN_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
  { value: '5', label: '5+' },
] as const

const BEDS_MAX_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
] as const

const BATHS_MIN_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
] as const

const BATHS_MAX_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
] as const

const PRICE_PRESETS = [
  { label: 'Any', min: undefined as number | undefined, max: undefined as number | undefined },
  { label: 'Under $300K', min: undefined, max: 300000 },
  { label: '$300K to $500K', min: 300000, max: 500000 },
  { label: '$500K to $750K', min: 500000, max: 750000 },
  { label: '$750K to $1M', min: 750000, max: 1000000 },
  { label: '$1M to $1.5M', min: 1000000, max: 1500000 },
  { label: '$1.5M+', min: 1500000, max: undefined },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPriceShort(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function priceLabel(min?: string, max?: string): string | null {
  if (!min && !max) return null
  const lo = min ? formatPriceShort(Number(min)) : null
  const hi = max ? formatPriceShort(Number(max)) : null
  if (lo && hi) return `${lo} to ${hi}`
  if (lo) return `${lo}+`
  return `Up to ${hi}`
}

// A max set via the All-filters sheet must show on the trigger too — the
// trigger reading only the min side hid an active constraint (W-UI audit T3,
// 2026-07-30).
function bedsLabel(min?: string, max?: string): string | null {
  if (min && max) return `${min}-${max} bd`
  if (min) return `${min}+ bd`
  if (max) return `Up to ${max} bd`
  return null
}

function bathsLabel(min?: string, max?: string): string | null {
  if (min && max) return `${min}-${max} ba`
  if (min) return `${min}+ ba`
  if (max) return `Up to ${max} ba`
  return null
}

function statusLabel(v?: string): string | null {
  if (!v || v === 'Active') return null
  return STATUS_OPTIONS.find((s) => s.value === v)?.label ?? null
}

// ---------------------------------------------------------------------------
// Popover-based filter dropdown
// ---------------------------------------------------------------------------
//
// Uses the design-system Popover (radix), which PORTALS the panel to the
// document body. That is the fix for the old hand-rolled absolute panel: the
// Filter panels portal to the document body. A portaled Popover stays
// visible even when the trigger row wraps, so the panel is always
// interactive.

type FilterDropdownProps = {
  label: string
  active: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  align?: 'start' | 'end'
}

function FilterDropdown({
  label,
  active,
  open,
  onOpenChange,
  children,
  align = 'start',
}: FilterDropdownProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={active ? 'default' : 'outline'}
          size="sm"
          aria-haspopup="dialog"
          className={cn(
            'srch-chip shrink-0 gap-1 whitespace-nowrap px-3',
            open && !active && 'ring-2 ring-primary/30',
          )}
        >
          {label}
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-60" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        className="srch-pop w-screen max-w-sm p-0"
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  initialFilters: SearchFiltersInitial
  /** Signed-in state — SaveSearchButton switches between account save and guest email capture. */
  signedIn?: boolean
  /** Place pages stay Split. The map shell owns Map/List. Default on. */
  hideViewToggle?: boolean
  /** Place pages already name the place. Location search would fight that pin. */
  hideLocation?: boolean
  /**
   * The page is a static shell (SITE-29): the server rendered DEFAULT
   * filters, and the URL's query applies here after mount. Filter writes go
   * to history.pushState (no server re-render exists to wait for) and the
   * chips read the merged filters, not the props.
   */
  staticShell?: boolean
}

type OpenPanel = 'places' | 'status' | 'price' | 'beds' | 'baths' | 'type' | null

export default function SearchFilters({
  initialFilters: initialFiltersProp,
  signedIn: signedInSeed = false,
  hideViewToggle = true,
  hideLocation = false,
  staticShell = false,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  // Static-safe: '' on the server and at hydration, the real query after
  // (lib/search/url-search-params.client). On a dynamic page the provider
  // supplies the request's query, so nothing changes there.
  const searchParams = useUrlSearchParams()
  // On a static shell the props are the defaults; the URL wins after mount.
  // hideLocation marks a place page, whose geo keys the URL may not re-pin.
  const initialFilters = useMemo(
    () =>
      staticShell
        ? mergeUrlSearchFilters(initialFiltersProp, searchParams, { lockPlace: hideLocation })
        : initialFiltersProp,
    [staticShell, initialFiltersProp, searchParams, hideLocation],
  )
  // Hydrated after mount so a cacheable signed-out shell still shows the
  // signed-in save flow to a signed-in visitor (see use-viewer-listing-state).
  const viewerState = useViewerListingState({ signedIn: signedInSeed })

  // Dropdown panel state
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [placesQuery, setPlacesQuery] = useState('')
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  /** Keep the lazy sheet mounted after first open so close animation still works. */
  const [moreSheetMounted, setMoreSheetMounted] = useState(false)

  // Local view state (tabs: split / list / map)
  const [view, setView] = useState<'split' | 'list' | 'map'>(
    () => (initialFilters.view === 'list' || initialFilters.view === 'map' ? initialFilters.view : 'split')
  )

  // Location search — ONE suggestions engine (SearchSuggest): 90ms debounce,
  // client cache, cached GET route, every backend category rendered
  // (addresses included — the "3480" class).
  const [locationQuery, setLocationQuery] = useState('')
  const [locationOpen, setLocationOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const locationInputRef = useRef<HTMLInputElement>(null)
  const { suggestions, loading: suggestLoading } = useSearchSuggest(locationQuery)
  const suggestItems = flattenSuggestions(suggestions)

  // Parsed-search confirmation chips (voice + typed natural-language queries)
  const { chips: parsedChips, show: showParsedChips } = useParsedSearchConfirm()

  // Note: outside-click + Escape close are handled by the design-system Popover
  // (radix) for the filter dropdowns, so no manual document listener is needed.

  // ---------------------------------------------------------------------------
  // URL helpers
  // ---------------------------------------------------------------------------

  const updateUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === '') params.delete(k)
        else params.set(k, v)
      }
      params.delete('page')
      // Place SELECT must re-fit the map to the new boundary — drop a stale
      // camera bbox from a prior city (Redmond filter + Bend bbox = empty view).
      if (
        'city' in updates ||
        'neighborhood' in updates ||
        'subdivision' in updates ||
        'schoolDistrict' in updates ||
        'postalCode' in updates
      ) {
        params.delete('bbox')
      }
      navigateQuery(router, `${pathname ?? '/homes-for-sale'}?${params.toString()}`, { staticShell })
      // Instrumentation (Phase 0.5): EVERY filter mutation routes through this
      // one function — chip-bar dropdowns, the All-filters sheet apply, the
      // location picker, chip removes. One URL mutation = one event; a
      // view/sort-only update builds a null payload and fires nothing.
      const payload = buildFilterApplyPayload(updates, params)
      if (payload) fireSearchEvent('search_filter_apply', payload)
    },
    [router, pathname, searchParams, staticShell]
  )

  const setFilter = useCallback(
    (key: string, value: string | number | undefined) => {
      const v = value === undefined || value === '' ? undefined : String(value)
      updateUrl({ [key]: v })
    },
    [updateUrl]
  )


  /** CSV place multi-select helpers (city / neighborhood / subdivision). */
  const splitCsv = useCallback((raw: string | undefined | null) => {
    if (!raw?.trim()) return [] as string[]
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }, [])

  const csvHas = useCallback((raw: string | undefined | null, value: string) => {
    const needle = value.trim().toLowerCase()
    return splitCsv(raw).some((s) => s.toLowerCase() === needle)
  }, [splitCsv])

  const toggleCsv = useCallback((raw: string | undefined | null, value: string) => {
    const needle = value.trim()
    const cur = splitCsv(raw)
    const exists = cur.some((s) => s.toLowerCase() === needle.toLowerCase())
    const next = exists
      ? cur.filter((s) => s.toLowerCase() !== needle.toLowerCase())
      : [...cur, needle]
    return next.length ? next.join(',') : undefined
  }, [splitCsv])

  // Map a single panel's Popover open/close into the shared openPanel state so
  // only one dropdown is open at a time.
  function panelOpenHandler(panel: Exclude<OpenPanel, null>) {
    return (next: boolean) => {
      setOpenPanel(next ? panel : null)
      if (panel === 'places' && !next) setPlacesQuery('')
    }
  }

  // ---------------------------------------------------------------------------
  // Location handlers
  // ---------------------------------------------------------------------------

  const handleLocationSelect = useCallback(
    (type: 'city' | 'subdivision', city: string, subdivision?: string) => {
      if (type === 'city') {
        updateUrl({ city, subdivision: undefined, postalCode: undefined })
        setLocationQuery(city)
      } else {
        updateUrl({ city, subdivision: subdivision ?? '', postalCode: undefined })
        setLocationQuery(subdivision ? `${subdivision}, ${city}` : city)
      }
      setLocationOpen(false)
      trackEvent('search', { city, subdivision: subdivision ?? undefined, search_term: locationQuery })
      // First-party mirror — feeds visitor_events so the CRM behavior panel's
      // "top searches" reads real on-site searches (metadata.query is the label
      // key getContactBehaviorSummary derives from).
      fireFirstPartyEvent('search', { metadata: { query: subdivision ? `${subdivision}, ${city}` : city, term: locationQuery || undefined, city, subdivision, source: 'typeahead' } })
    },
    [updateUrl, locationQuery]
  )

  const handleZipSelect = useCallback(
    (postalCode: string) => {
      updateUrl({ postalCode, city: undefined, subdivision: undefined })
      setLocationQuery(postalCode)
      setLocationOpen(false)
      trackEvent('search', { postalCode, search_term: locationQuery })
      fireFirstPartyEvent('search', { metadata: { query: postalCode, term: locationQuery || undefined, postalCode, source: 'typeahead' } })
    },
    [updateUrl, locationQuery]
  )

  const handleNavigateSelect = useCallback(
    (href: string, label?: string) => {
      setLocationOpen(false)
      if (label) {
        trackEvent('search', { search_term: locationQuery })
        fireFirstPartyEvent('search', { metadata: { query: label, term: locationQuery || undefined, source: 'typeahead' } })
      }
      router.push(href)
    },
    [router, locationQuery]
  )

  // ONE pick handler for every suggestion category. City / community / zip
  // apply filters in place (this surface IS the search); everything else —
  // addresses, neighborhoods, brokers, reports, pages — navigates.
  const handleSuggestPick = useCallback(
    (item: SuggestItem) => {
      if (item.kind === 'city' && item.city) {
        handleLocationSelect('city', item.city)
      } else if (item.kind === 'subdivision' && item.city) {
        handleLocationSelect('subdivision', item.city, item.subdivisionName)
      } else if (item.kind === 'zip' && item.postalCode) {
        handleZipSelect(item.postalCode)
      } else {
        handleNavigateSelect(item.href, item.label)
      }
    },
    [handleLocationSelect, handleZipSelect, handleNavigateSelect]
  )

  // ---------------------------------------------------------------------------
  // Active chip helpers
  // ---------------------------------------------------------------------------

  const activePriceLabel = priceLabel(initialFilters.minPrice, initialFilters.maxPrice)
  const activeBedsLabel = bedsLabel(initialFilters.beds, initialFilters.maxBeds)
  const activeBathsLabel = bathsLabel(initialFilters.baths, initialFilters.maxBaths)
  const selectedSubTypes = useMemo(() => {
    const raw = searchParams?.get('propertySubTypes') ?? ''
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }, [searchParams])
  const activeTypeLabel = homeTypeChipLabel(initialFilters.propertyType, selectedSubTypes)
  const activeStatusLabel = statusLabel(initialFilters.status)

  // Every registry field active in the URL, rendered generically (label from
  // the field registry). Covers price/beds/baths too, so the chip row needs no
  // per-field special cases.
  // propertySubTypes rides the Home type chip — don't double-list it here.
  const registryActive = activeRegistryFilters(searchParams).filter((f) => f.key !== 'propertySubTypes')

  const hasAnyFilter = !!(activeTypeLabel || activeStatusLabel || registryActive.length > 0)

  const moreFilterCount = registryActive.length

  function removeChip(params: string | string[]) {
    const keys = Array.isArray(params) ? params : [params]
    const upd: Record<string, undefined> = {}
    for (const k of keys) upd[k] = undefined
    updateUrl(upd)
  }

  function clearAll() {
    navigateQuery(router, `${pathname ?? '/homes-for-sale'}?view=${view}`, { staticShell })
    setLocationQuery('')
  }

  // ---------------------------------------------------------------------------
  // Natural-language apply (voice transcript or Enter in the location input)
  // ---------------------------------------------------------------------------

  const applyNaturalQuery = useCallback(
    (raw: string) => {
      const text = raw.trim()
      if (!text) return
      const parsed = parseSearchQuery(text)
      if (Object.keys(parsed).length === 0) return
      // The parser speaks statusFilter (closed/pending); this surface's status
      // param speaks Active/Pending/Sold.
      const { statusFilter, ...updates } = parsed as Record<string, string | undefined> & { statusFilter?: string }
      if (statusFilter === 'closed') updates.status = 'Sold'
      else if (statusFilter === 'pending') updates.status = 'Pending'
      updateUrl(updates)
      showParsedChips(parsed)
      setLocationOpen(false)
      setLocationQuery(parsed.city ?? '')
      trackEvent('search', { search_term: text, ...(parsed.city ? { city: parsed.city } : {}) })
      fireFirstPartyEvent('search', { metadata: { query: text, city: parsed.city, source: 'natural_language' } })
    },
    [updateUrl, showParsedChips]
  )

  // Current location label for the input placeholder
  const locationPlaceholder =
    locationQuery !== ''
      ? locationQuery
      : initialFilters.postalCode
        ? initialFilters.postalCode
        : initialFilters.subdivision && initialFilters.city
          ? `${initialFilters.subdivision}, ${initialFilters.city}`
          : initialFilters.city
            ? initialFilters.city
            : 'City, community, zip, address...'

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-0">
      {/* One filter row: location(+mic) · Places · For sale · Price · Beds · Baths ·
          Home type · All filters · Save. Map/List lives in the map shell.
          At 375: search flexes (mic stays in-bar), Places stays visible, other
          chips fold into All filters (one Sheet). Map|List|Sort is OK on phone. */}
      <div className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:px-4">
        {/* Row 1 @375: full-width search so mic stays inside the bar. */}
        {hideLocation ? null : (
        <div className="relative w-full min-w-0 sm:w-64 sm:shrink-0">
          <div className="srch-panel srch-tap relative min-h-11 flex min-w-0 items-center gap-1.5 px-2 transition focus-within:ring-2 focus-within:ring-primary/30 sm:px-3">
            <HugeiconsIcon icon={Search01Icon} className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              ref={locationInputRef}
              type="search"
              placeholder={locationPlaceholder}
              value={locationQuery}
              onChange={(e) => {
                setLocationQuery(e.target.value)
                setHighlight(-1)
              }}
              onFocus={() => setLocationOpen(true)}
              onBlur={() => setTimeout(() => setLocationOpen(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setLocationOpen(false)
                  return
                }
                if (e.key === 'ArrowDown' && locationOpen && suggestItems.length > 0) {
                  e.preventDefault()
                  setHighlight((h) => (h < suggestItems.length - 1 ? h + 1 : 0))
                  return
                }
                if (e.key === 'ArrowUp' && locationOpen && suggestItems.length > 0) {
                  e.preventDefault()
                  setHighlight((h) => (h > 0 ? h - 1 : suggestItems.length - 1))
                  return
                }
                if (e.key !== 'Enter') return
                e.preventDefault()
                const picked = highlight >= 0 ? suggestItems[highlight] : undefined
                if (picked) handleSuggestPick(picked)
                else applyNaturalQuery(locationQuery)
              }}
              className="srch-suggest h-auto min-w-0 flex-1 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Search by address, city, community, zip, or broker"
              role="combobox"
              aria-expanded={locationOpen && suggestItems.length > 0}
              aria-controls="search-filters-suggest-listbox"
              aria-activedescendant={
                locationOpen && highlight >= 0 ? `search-filters-suggest-item-${highlight}` : undefined
              }
            />
            {/* Speech-to-text lives inside the search bar (Matt 2026-09-07) — not a standalone filter-row mic. */}
            <VoiceSearchButton
              onTranscript={applyNaturalQuery}
              className="srch-mic-inbar size-9 shrink-0 border-0 bg-transparent shadow-none hover:bg-muted/60"
            />
          </div>
          <ParsedSearchNotice chips={parsedChips} className="absolute left-0 right-0 top-full z-50 mt-1" />
          {locationOpen && (
            <SearchSuggestPanel
              items={suggestItems}
              loading={suggestLoading}
              hasResult={suggestions !== null}
              highlight={highlight}
              idPrefix="search-filters-suggest"
              onPick={handleSuggestPick}
              className="srch-pop absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto pb-1"
            />
          )}
        </div>
        )}
        {/* Row 2 @375: Places chip + Filters + Save. Desktop: same row as search. */}
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-2">
        <div className="flex shrink-0 items-center gap-2">
        {/* Places — City / Neighborhood / Community / Subdivision / School district. */}
        <FilterDropdown
          label={(() => {
            const cities = splitCsv(initialFilters.city)
            const hoods = splitCsv(initialFilters.neighborhood)
            const subs = splitCsv(initialFilters.subdivision)
            const districts = splitCsv(initialFilters.schoolDistrict)
            const n = cities.length + hoods.length + subs.length + districts.length
            if (n === 0) return 'Places'
            if (n === 1) return `Places: ${cities[0] ?? hoods[0] ?? subs[0] ?? districts[0]}`
            return `Places: ${n}`
          })()}
          active={Boolean(
            initialFilters.city?.trim() ||
              initialFilters.neighborhood?.trim() ||
              initialFilters.subdivision?.trim() ||
              initialFilters.schoolDistrict?.trim(),
          )}
          open={openPanel === 'places'}
          onOpenChange={panelOpenHandler('places')}
        >
          <div className="srch-places-body flex max-h-96 flex-col p-0">
            <div className="shrink-0 border-b border-border p-3">
              <p className="srch-label mb-2">Places</p>
              <p className="mb-2 text-xs text-muted-foreground">
                Select one or more. Map draws the place boundary when GIS exists and zooms to it.
              </p>
              <Label className="sr-only" htmlFor="srch-places-typeahead">
                Search places
              </Label>
              <Input
                id="srch-places-typeahead"
                type="search"
                value={placesQuery}
                onChange={(e) => setPlacesQuery(e.target.value)}
                placeholder="Search cities, neighborhoods, communities, school districts…"
                autoComplete="off"
              />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {(() => {
                const q = normalizeSearchKey(placesQuery)
                const cityOpts = REPORT_CITY_LABELS.filter(
                  (city) => !q || normalizeSearchKey(city).includes(q),
                )
                const hoodOpts = BEND_NEIGHBORHOOD_DISTRICTS.filter(
                  (d) => !q || normalizeSearchKey(d.label).includes(q) || normalizeSearchKey(d.slug).includes(q),
                )
                const communityOpts = PLACE_COMMUNITY_OPTIONS.filter(
                  (c) => !q || normalizeSearchKey(c.label).includes(q) || normalizeSearchKey(c.slug).includes(q),
                )
                const subOpts = PLACE_SUBDIVISION_OPTIONS.filter(
                  (name) => !q || normalizeSearchKey(name).includes(q),
                )
                const schoolOpts = PLACE_SCHOOL_DISTRICT_OPTIONS.filter(
                  (d) =>
                    !q ||
                    normalizeSearchKey(d.label).includes(q) ||
                    normalizeSearchKey(d.slug).includes(q),
                )
                const empty =
                  cityOpts.length +
                    hoodOpts.length +
                    communityOpts.length +
                    subOpts.length +
                    schoolOpts.length ===
                  0
                return (
                  <>
                    {empty ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">No places match that search.</p>
                    ) : null}

                    {cityOpts.length > 0 || !q ? (
                      <>
                        <p className="srch-label mb-1.5">City</p>
                        <div className="mb-3 flex flex-col gap-1">
                          {!q ? (
                            <Button
                              type="button"
                              variant={initialFilters.city?.trim() ? 'ghost' : 'default'}
                              size="sm"
                              onClick={() => {
                                updateUrl({ city: undefined, postalCode: undefined })
                                setLocationQuery('')
                              }}
                              className="justify-start"
                            >
                              Any city
                            </Button>
                          ) : null}
                          {cityOpts.map((city) => (
                            <Button
                              key={city}
                              type="button"
                              variant={csvHas(initialFilters.city, city) ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => {
                                const next = toggleCsv(initialFilters.city, city)
                                updateUrl({
                                  city: next,
                                  postalCode: undefined,
                                })
                                setLocationQuery(next?.split(',')[0]?.trim() || '')
                                trackEvent('search', { city: next, search_term: locationQuery })
                                fireFirstPartyEvent('search', {
                                  metadata: {
                                    query: next ?? city,
                                    term: locationQuery || undefined,
                                    city: next,
                                    source: 'places_multi',
                                  },
                                })
                              }}
                              className="justify-start"
                            >
                              {city}
                            </Button>
                          ))}
                        </div>
                      </>
                    ) : null}

                    {hoodOpts.length > 0 || !q ? (
                      <>
                        <p className="srch-label mb-1.5">Neighborhood</p>
                        <div className="mb-3 flex flex-col gap-1">
                          {!q ? (
                            <Button
                              type="button"
                              variant={initialFilters.neighborhood?.trim() ? 'ghost' : 'default'}
                              size="sm"
                              onClick={() => setFilter('neighborhood', undefined)}
                              className="justify-start"
                            >
                              Any neighborhood
                            </Button>
                          ) : null}
                          {hoodOpts.map((d) => (
                            <Button
                              key={d.slug}
                              type="button"
                              variant={csvHas(initialFilters.neighborhood, d.label) ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => {
                                const next = toggleCsv(initialFilters.neighborhood, d.label)
                                const cityCsv = initialFilters.city?.trim() || 'Bend'
                                updateUrl({
                                  neighborhood: next,
                                  city: cityCsv,
                                  postalCode: undefined,
                                })
                                setLocationQuery(d.label)
                              }}
                              className="justify-start"
                            >
                              {d.label}
                            </Button>
                          ))}
                        </div>
                      </>
                    ) : null}

                    {communityOpts.length > 0 || !q ? (
                      <>
                        <p className="srch-label mb-1.5">Community</p>
                        <div className="mb-3 flex flex-col gap-1">
                          {!q ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const keep = splitCsv(initialFilters.subdivision).filter(
                                  (name) =>
                                    !PLACE_COMMUNITY_OPTIONS.some(
                                      (c) => c.label.toLowerCase() === name.toLowerCase(),
                                    ),
                                )
                                updateUrl({ subdivision: keep.length ? keep.join(',') : undefined })
                              }}
                              className="justify-start"
                            >
                              Any community
                            </Button>
                          ) : null}
                          {communityOpts.map((c) => (
                            <Button
                              key={c.slug}
                              type="button"
                              variant={csvHas(initialFilters.subdivision, c.label) ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => {
                                const next = toggleCsv(initialFilters.subdivision, c.label)
                                const cities = new Set(splitCsv(initialFilters.city))
                                if (next && csvHas(next, c.label)) cities.add(c.city)
                                updateUrl({
                                  subdivision: next,
                                  city: cities.size ? [...cities].join(',') : c.city,
                                  postalCode: undefined,
                                })
                                setLocationQuery(c.label)
                              }}
                              className="justify-start"
                            >
                              {c.label}
                            </Button>
                          ))}
                        </div>
                      </>
                    ) : null}

                    {subOpts.length > 0 || !q ? (
                      <>
                        <p className="srch-label mb-1.5">Subdivision</p>
                        <div className="mb-3 flex flex-col gap-1">
                          {!q ? (
                            <Button
                              type="button"
                              variant={initialFilters.subdivision?.trim() ? 'ghost' : 'default'}
                              size="sm"
                              onClick={() => setFilter('subdivision', undefined)}
                              className="justify-start"
                            >
                              Any subdivision
                            </Button>
                          ) : null}
                          {subOpts.map((name) => (
                            <Button
                              key={name}
                              type="button"
                              variant={csvHas(initialFilters.subdivision, name) ? 'default' : 'ghost'}
                              size="sm"
                              onClick={() => {
                                const next = toggleCsv(initialFilters.subdivision, name)
                                const cityGuess =
                                  PLACE_COMMUNITY_OPTIONS.find(
                                    (c) => c.label.toLowerCase() === name.toLowerCase(),
                                  )?.city ??
                                  splitCsv(initialFilters.city)[0] ??
                                  'Bend'
                                const cities = new Set(splitCsv(initialFilters.city))
                                if (next && csvHas(next, name)) cities.add(cityGuess)
                                updateUrl({
                                  subdivision: next,
                                  city: cities.size ? [...cities].join(',') : cityGuess,
                                  postalCode: undefined,
                                })
                                setLocationQuery(name)
                              }}
                              className="justify-start"
                            >
                              {name}
                            </Button>
                          ))}
                        </div>
                      </>
                    ) : null}

                    {schoolOpts.length > 0 || !q ? (
                      <>
                        <p className="srch-label mb-1.5">School district</p>
                        <div className="flex flex-col gap-1">
                          {!q ? (
                            <Button
                              type="button"
                              variant={initialFilters.schoolDistrict?.trim() ? 'ghost' : 'default'}
                              size="sm"
                              onClick={() =>
                                updateUrl({ schoolDistrict: undefined })
                              }
                              className="justify-start"
                            >
                              Any school district
                            </Button>
                          ) : null}
                          {schoolOpts.map((d) => (
                            <Button
                              key={d.slug}
                              type="button"
                              variant={
                                csvHas(initialFilters.schoolDistrict, d.slug) ||
                                csvHas(initialFilters.schoolDistrict, d.label)
                                  ? 'default'
                                  : 'ghost'
                              }
                              size="sm"
                              onClick={() => {
                                const cur = initialFilters.schoolDistrict
                                const on =
                                  csvHas(cur, d.slug) || csvHas(cur, d.label)
                                const next = on
                                  ? undefined
                                  : d.slug
                                // Honest listing pin: cities the district's schools sit in.
                                // Boundary draws only when public.boundaries has geo (gap rule).
                                updateUrl({
                                  schoolDistrict: next,
                                  city: next ? d.cities.join(',') : undefined,
                                  postalCode: undefined,
                                })
                                setLocationQuery(next ? d.label : '')
                              }}
                              className="justify-start"
                            >
                              {d.label}
                            </Button>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </>
                )
              })()}
            </div>
          </div>
        </FilterDropdown>
        </div>

        <div className="srch-chip-rail hidden min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar sm:flex">

        {/* For Sale / Status */}
        <FilterDropdown
          label={STATUS_OPTIONS.find((s) => s.value === (initialFilters.status ?? 'Active'))?.label ?? 'For sale'}
          active={!!(initialFilters.status && initialFilters.status !== 'Active')}
          open={openPanel === 'status'}
          onOpenChange={panelOpenHandler('status')}
        >
          <div className="p-3">
            <p className="srch-label mb-2.5">Status</p>
            <div className="flex flex-col gap-1">
              {STATUS_OPTIONS.map(({ value, label }) => (
                <Button
                  key={value}
                  type="button"
                  variant={(initialFilters.status ?? 'Active') === value ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setFilter('status', value === 'Active' ? undefined : value); setOpenPanel(null) }}
                  className="justify-start"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </FilterDropdown>

        {/* Price */}
        <FilterDropdown
          label={activePriceLabel ? `Price: ${activePriceLabel}` : 'Price'}
          active={!!activePriceLabel}
          open={openPanel === 'price'}
          onOpenChange={panelOpenHandler('price')}
        >
          <div className="p-3">
            <p className="srch-label mb-2.5">Price range</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Min price</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  name="minPrice"
                  placeholder="No min"
                  min={0}
                  step={25000}
                  defaultValue={initialFilters.minPrice}
                  className="tabular-nums"
                  onBlur={(e) => setFilter('minPrice', e.currentTarget.value || undefined)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      setFilter('minPrice', e.currentTarget.value || undefined)
                      setOpenPanel(null)
                    }
                  }}
                />
              </Label>
              <Label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Max price</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  name="maxPrice"
                  placeholder="No max"
                  min={0}
                  step={25000}
                  defaultValue={initialFilters.maxPrice}
                  className="tabular-nums"
                  onBlur={(e) => setFilter('maxPrice', e.currentTarget.value || undefined)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      setFilter('maxPrice', e.currentTarget.value || undefined)
                      setOpenPanel(null)
                    }
                  }}
                />
              </Label>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {PRICE_PRESETS.map(({ label, min, max }) => {
                const isActive =
                  (min == null && max == null && !initialFilters.minPrice && !initialFilters.maxPrice) ||
                  (String(min ?? '') === (initialFilters.minPrice ?? '') &&
                    String(max ?? '') === (initialFilters.maxPrice ?? ''))
                return (
                  <Button
                    key={label}
                    type="button"
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => {
                      updateUrl({
                        minPrice: min != null ? String(min) : undefined,
                        maxPrice: max != null ? String(max) : undefined,
                      })
                      setOpenPanel(null)
                    }}
                    className="rounded-md px-2.5 py-1 h-auto text-xs"
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          </div>
        </FilterDropdown>

        {/* Beds — min + max (URL: beds / maxBeds) */}
        <FilterDropdown
          label={activeBedsLabel ? `Beds: ${activeBedsLabel}` : 'Beds'}
          active={!!activeBedsLabel}
          open={openPanel === 'beds'}
          onOpenChange={panelOpenHandler('beds')}
        >
          <div className="space-y-3 p-3">
            <div>
              <p className="srch-label mb-2.5">Min bedrooms</p>
              <div className="flex flex-wrap gap-1.5">
                {BEDS_MIN_OPTIONS.map(({ value, label }) => (
                  <Button
                    key={`beds-min-${value || 'any'}`}
                    type="button"
                    variant={(initialFilters.beds ?? '') === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('beds', value || undefined)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="srch-label mb-2.5">Max bedrooms</p>
              <div className="flex flex-wrap gap-1.5">
                {BEDS_MAX_OPTIONS.map(({ value, label }) => (
                  <Button
                    key={`beds-max-${value || 'any'}`}
                    type="button"
                    variant={(initialFilters.maxBeds ?? '') === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('maxBeds', value || undefined)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </FilterDropdown>

        {/* Baths — min + max (URL: baths / maxBaths) */}
        <FilterDropdown
          label={activeBathsLabel ? `Baths: ${activeBathsLabel}` : 'Baths'}
          active={!!activeBathsLabel}
          open={openPanel === 'baths'}
          onOpenChange={panelOpenHandler('baths')}
        >
          <div className="space-y-3 p-3">
            <div>
              <p className="srch-label mb-2.5">Min bathrooms</p>
              <div className="flex flex-wrap gap-1.5">
                {BATHS_MIN_OPTIONS.map(({ value, label }) => (
                  <Button
                    key={`baths-min-${value || 'any'}`}
                    type="button"
                    variant={(initialFilters.baths ?? '') === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('baths', value || undefined)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="srch-label mb-2.5">Max bathrooms</p>
              <div className="flex flex-wrap gap-1.5">
                {BATHS_MAX_OPTIONS.map(({ value, label }) => (
                  <Button
                    key={`baths-max-${value || 'any'}`}
                    type="button"
                    variant={(initialFilters.maxBaths ?? '') === value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('maxBaths', value || undefined)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </FilterDropdown>

        {/* Home Type — class + MLS sub-type (duplex, manufactured on land, …) */}
        <FilterDropdown
          label={activeTypeLabel ?? 'Home type'}
          active={!!activeTypeLabel}
          open={openPanel === 'type'}
          onOpenChange={panelOpenHandler('type')}
        >
          <div className="w-full max-w-sm">
            <HomeTypeFilterPanel
              propertyType={initialFilters.propertyType}
              propertySubTypes={selectedSubTypes}
              onChange={({ propertyType, propertySubTypes }) => {
                updateUrl({
                  propertyType: propertyType || (hideLocation ? 'all' : undefined),
                  propertySubTypes:
                    propertySubTypes && propertySubTypes.length > 0
                      ? propertySubTypes.join(',')
                      : undefined,
                })
              }}
            />
          </div>
        </FilterDropdown>
        </div>

        {/* All filters — always present. Chip set scrolls on 390. */}
        <Button
          type="button"
          variant={moreFilterCount > 0 ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            setMoreSheetMounted(true)
            setMoreSheetOpen(true)
          }}
          className="srch-chip shrink-0 gap-1 px-3"
          aria-label={moreFilterCount > 0 ? `Open all filters, ${moreFilterCount} active` : 'Open all filters'}
        >
          <HugeiconsIcon icon={FilterIcon} className="size-3.5" aria-hidden />
          <span className="sm:hidden">{moreFilterCount > 0 ? moreFilterCount : 'Filters'}</span>
          <span className="hidden sm:inline">
            {moreFilterCount > 0 ? `All filters (${moreFilterCount})` : 'All filters'}
          </span>
        </Button>
        <SaveSearchButton user={viewerState.signedIn} />
        {hideViewToggle ? null : (
        <div className="map-search-mapsort__pill ml-auto shrink-0" role="group" aria-label="Map and sort">
          <div className="map-search-views map-search-mapsort__views" role="radiogroup" aria-label="View">
            {(['map', 'split', 'list'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={view === v}
                aria-label={`${v} view`}
                className={v === 'split' ? 'max-sm:hidden' : undefined}
                onClick={() => {
                  setFilter('view', v)
                  setView(v)
                }}
              >
                {v === 'list' ? 'List' : v === 'split' ? 'Split' : 'Map'}
              </button>
            ))}
          </div>
          <span className="map-search-mapsort__rule" aria-hidden />
          <button
            type="button"
            className="map-search-mapsort__sort"
            aria-label="Sort results"
            onClick={() => {
              // Open All-filters is wrong; cycle common sorts via URL like MapSearchView.
              const order = ['newest', 'price_asc', 'price_desc', 'oldest'] as const
              const cur = initialFilters.sort?.trim() || 'newest'
              const idx = order.indexOf(cur as (typeof order)[number])
              const next = order[(idx + 1) % order.length]
              setFilter('sort', next === 'newest' ? undefined : next)
            }}
          >
            Sort
          </button>
        </div>
        )}
        </div>
      </div>

      {/* Row 3: active filter chips. Row 2's trigger buttons already show the
          same value ("Price: $90M+") in their own label, so on mobile this
          row said the same fact twice before any results even rendered,
          costing ~90px of scarce viewport (design-audit P3). Desktop has
          the room and keeps the faster per-chip remove affordance. */}
      {hasAnyFilter && (
        <div className="hidden flex-wrap items-center gap-1.5 border-t border-border px-3 py-2 sm:flex sm:px-4">
          {activeStatusLabel && (
            <RegistryFilterChip label={activeStatusLabel} onRemove={() => setFilter('status', undefined)} />
          )}
          {activeTypeLabel && (
            <RegistryFilterChip
              label={activeTypeLabel}
              onRemove={() =>
                updateUrl({ propertyType: undefined, propertySubTypes: undefined })
              }
            />
          )}
          {registryActive.map(({ key, label, params }) => (
            <RegistryFilterChip key={key} label={label} onRemove={() => removeChip(params)} />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="srch-clear ml-1 px-2 text-xs text-muted-foreground underline-offset-2 hover:underline hover:bg-transparent"
          >
            Clear all
          </Button>
        </div>
      )}
      {/* Mobile active filter chips (Zillow map-search pattern). Place SELECTS
          stay as real pickers in the top row; this strip shows removable
          applied filters + Clear all. */}
      {hasAnyFilter && (
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto border-t border-border px-3 py-2 no-scrollbar sm:hidden">
          {activeStatusLabel && (
            <span className="shrink-0">
              <RegistryFilterChip label={activeStatusLabel} onRemove={() => setFilter('status', undefined)} />
            </span>
          )}
          {activeTypeLabel && (
            <span className="shrink-0">
              <RegistryFilterChip
                label={activeTypeLabel}
                onRemove={() => updateUrl({ propertyType: undefined, propertySubTypes: undefined })}
              />
            </span>
          )}
          {registryActive.map(({ key, label, params }) => (
            <span key={key} className="shrink-0">
              <RegistryFilterChip label={label} onRemove={() => removeChip(params)} />
            </span>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="srch-clear ml-1 shrink-0 px-2 text-xs text-muted-foreground underline-offset-2 hover:underline hover:bg-transparent"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* All filters — registry-driven sheet shared with the SEO filter bar.
          Mount only after first open so the P6 chunk stays off the cold path. */}
      {moreSheetMounted ? (
        <AllFiltersSheet
          open={moreSheetOpen}
          onOpenChange={setMoreSheetOpen}
          onApply={updateUrl}
          closedScope={initialFilters.status === 'Sold'}
          contextDefaults={{
            ...(initialFilters.city ? { city: initialFilters.city } : {}),
            status: initialFilters.status ?? 'Active',
          }}
        />
      ) : null}
    </div>
  )
}
