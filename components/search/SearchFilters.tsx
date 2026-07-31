'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useRef } from 'react'
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
import { PROPERTY_TYPES } from '@/lib/property-type'
import { parseSearchQuery } from '@/lib/parse-search-query'
import SaveSearchButton from '@/components/SaveSearchButton'
import AllFiltersSheet, {
  activeRegistryFilters,
  ParsedSearchNotice,
  RegistryFilterChip,
  useParsedSearchConfirm,
} from '@/components/search/AllFiltersSheet'
import VoiceSearchButton from '@/components/VoiceSearchButton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  FilterIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons'
import { cn } from '@/lib/utils'

export type SearchFiltersInitial = {
  city?: string
  subdivision?: string
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

const STATUS_OPTIONS = [
  { value: 'Active', label: 'For sale' },
  { value: 'Pending', label: 'Under contract' },
  { value: 'Sold', label: 'Sold' },
] as const

const BEDS_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
  { value: '5', label: '5+' },
] as const

const BATHS_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
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

function typeLabel(v?: string): string | null {
  if (!v) return null
  return PROPERTY_TYPES.find((t) => t.value === v)?.label ?? null
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
// Row-2 chip bar scrolls horizontally (overflow-x-auto), and per the CSS spec
// an `overflow-x: auto` box computes `overflow-y` to `auto` as well — so the
// old absolutely-positioned panel was CLIPPED to nothing the moment it tried
// to open below the bar. A portaled Popover renders outside that clipping
// context entirely, so the panel is always visible and interactive.

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
            'shrink-0 gap-1 whitespace-nowrap rounded-full px-3.5 tabular-nums',
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
        className="w-screen max-w-sm p-0"
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
}

type OpenPanel = 'status' | 'price' | 'beds' | 'baths' | 'type' | null

export default function SearchFilters({ initialFilters, signedIn = false }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Dropdown panel state
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)

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
      router.push(`${pathname ?? '/homes-for-sale'}?${params.toString()}`, { scroll: false })
      // Instrumentation (Phase 0.5): EVERY filter mutation routes through this
      // one function — chip-bar dropdowns, the All-filters sheet apply, the
      // location picker, chip removes. One URL mutation = one event; a
      // view/sort-only update builds a null payload and fires nothing.
      const payload = buildFilterApplyPayload(updates, params)
      if (payload) fireSearchEvent('search_filter_apply', payload)
    },
    [router, pathname, searchParams]
  )

  const setFilter = useCallback(
    (key: string, value: string | number | undefined) => {
      const v = value === undefined || value === '' ? undefined : String(value)
      updateUrl({ [key]: v })
    },
    [updateUrl]
  )

  // Map a single panel's Popover open/close into the shared openPanel state so
  // only one dropdown is open at a time.
  function panelOpenHandler(panel: Exclude<OpenPanel, null>) {
    return (next: boolean) => setOpenPanel(next ? panel : null)
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
  const activeTypeLabel = typeLabel(initialFilters.propertyType)
  const activeStatusLabel = statusLabel(initialFilters.status)

  // Every registry field active in the URL, rendered generically (label from
  // the field registry). Covers price/beds/baths too, so the chip row needs no
  // per-field special cases.
  const registryActive = activeRegistryFilters(searchParams)

  const hasAnyFilter = !!(activeTypeLabel || activeStatusLabel || registryActive.length > 0)

  const moreFilterCount = registryActive.length

  function removeChip(params: string | string[]) {
    const keys = Array.isArray(params) ? params : [params]
    const upd: Record<string, undefined> = {}
    for (const k of keys) upd[k] = undefined
    updateUrl(upd)
  }

  function clearAll() {
    router.push(`${pathname ?? '/homes-for-sale'}?view=${view}`, { scroll: false })
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
      {/* Row 1: location + sort + view toggle */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        {/* Location search input — basis-full gives it its own line on phones
            (sort + view toggle squeezed it to ~60px, showing "Ben" of "Bend"). */}
        <div className="relative min-w-0 basis-full sm:basis-auto sm:flex-1 sm:max-w-sm">
          <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted px-3.5 py-2 transition focus-within:ring-2 focus-within:ring-primary/30">
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
              className="h-auto flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
              aria-label="Search by address, city, community, zip, or broker"
              role="combobox"
              aria-expanded={locationOpen && suggestItems.length > 0}
              aria-controls="search-filters-suggest-listbox"
              aria-activedescendant={
                locationOpen && highlight >= 0 ? `search-filters-suggest-item-${highlight}` : undefined
              }
            />
          </div>
          <ParsedSearchNotice chips={parsedChips} className="absolute left-0 right-0 top-full z-50 mt-1" />
          {/* ONE shared suggestions panel (SearchSuggest) — renders EVERY
              backend category, addresses included (the "3480" class the old
              inline dropdown silently dropped). */}
          {locationOpen && (
            <SearchSuggestPanel
              items={suggestItems}
              loading={suggestLoading}
              hasResult={suggestions !== null}
              highlight={highlight}
              idPrefix="search-filters-suggest"
              onPick={handleSuggestPick}
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-border bg-card pb-1 shadow-lg"
            />
          )}
        </div>

        {/* Voice search — speaks the same registry the screen panel renders */}
        <VoiceSearchButton onTranscript={applyNaturalQuery} className="shrink-0" />

        {/* Sort — pushed to the right edge with a quiet label (mockup results-count) */}
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">Sort</span>
          <Select
            value={initialFilters.sort ?? 'newest'}
            onValueChange={(v) => setFilter('sort', v)}
          >
            <SelectTrigger className="h-9 w-44" aria-label="Sort results">
              <SelectValue placeholder="Newest" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* View toggle (split / list / map) — desktop only. MapSearchView's
            own List/Map tab bar is the single mobile switcher; both showing
            at once left "Split" selected up here while the actual bottom
            tabs told a different story (design-audit P2). */}
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => {
            if (v === 'split' || v === 'list' || v === 'map') {
              setFilter('view', v)
              setView(v)
            }
          }}
          variant="outline"
          size="sm"
          className="hidden h-9 overflow-hidden rounded-lg border border-border lg:flex"
        >
          {(['split', 'list', 'map'] as const).map((v) => (
            <ToggleGroupItem
              key={v}
              value={v}
              className="h-9 rounded-none border-0 px-3.5 text-sm font-medium capitalize"
              aria-label={`${v} view`}
            >
              {v}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {/* Save search — the whole alert backend existed with no entry point
            on this surface (design-audit P1). Captures every live URL param,
            registry filters included. */}
        <SaveSearchButton user={signedIn} />
      </div>

      <Separator />

      {/* Row 2: primary filter chips row.
          Horizontal-scroll affordance kept for mobile (overflow-x-auto). The
          dropdown panels portal to <body> via Popover, so this scroll container
          no longer clips them (the old absolute-div approach was clipped here). */}
      <div className="no-scrollbar flex min-w-0 items-center gap-2 overflow-x-auto px-3 py-2 sm:px-4">
        {/* For Sale / Status */}
        <FilterDropdown
          label={STATUS_OPTIONS.find((s) => s.value === (initialFilters.status ?? 'Active'))?.label ?? 'For sale'}
          active={!!(initialFilters.status && initialFilters.status !== 'Active')}
          open={openPanel === 'status'}
          onOpenChange={panelOpenHandler('status')}
        >
          <div className="p-3">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
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
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Price range</p>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <Label className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Min price</span>
                <Input
                  type="number"
                  inputMode="numeric"
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
                    className="rounded-full px-2.5 py-1 h-auto text-xs"
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          </div>
        </FilterDropdown>

        {/* Beds */}
        <FilterDropdown
          label={activeBedsLabel ?? 'Beds'}
          active={!!activeBedsLabel}
          open={openPanel === 'beds'}
          onOpenChange={panelOpenHandler('beds')}
        >
          <div className="p-3">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bedrooms (min)</p>
            <div className="flex flex-wrap gap-1.5">
              {BEDS_OPTIONS.map(({ value, label }) => (
                <Button
                  key={value || 'any'}
                  type="button"
                  variant={(initialFilters.beds ?? '') === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setFilter('beds', value || undefined); setOpenPanel(null) }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </FilterDropdown>

        {/* Baths */}
        <FilterDropdown
          label={activeBathsLabel ?? 'Baths'}
          active={!!activeBathsLabel}
          open={openPanel === 'baths'}
          onOpenChange={panelOpenHandler('baths')}
        >
          <div className="p-3">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bathrooms (min)</p>
            <div className="flex flex-wrap gap-1.5">
              {BATHS_OPTIONS.map(({ value, label }) => (
                <Button
                  key={value || 'any'}
                  type="button"
                  variant={(initialFilters.baths ?? '') === value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setFilter('baths', value || undefined); setOpenPanel(null) }}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </FilterDropdown>

        {/* Home Type */}
        <FilterDropdown
          label={activeTypeLabel ?? 'Home type'}
          active={!!activeTypeLabel}
          open={openPanel === 'type'}
          onOpenChange={panelOpenHandler('type')}
        >
          <div className="p-3">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Home type</p>
            <div className="flex flex-col gap-1">
              {PROPERTY_TYPES.map(({ value, label }) => (
                <Button
                  key={value || 'all'}
                  type="button"
                  variant={(initialFilters.propertyType ?? '') === value ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setFilter('propertyType', value || undefined); setOpenPanel(null) }}
                  className="justify-start"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        </FilterDropdown>

        {/* More Filters button */}
        <Button
          type="button"
          variant={moreFilterCount > 0 ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMoreSheetOpen(true)}
          className="shrink-0 gap-1 rounded-full px-3.5 tabular-nums"
          aria-label="Open more filters"
        >
          <HugeiconsIcon icon={FilterIcon} className="size-3.5" aria-hidden />
          {moreFilterCount > 0 ? `More (${moreFilterCount})` : 'More'}
        </Button>
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
            <RegistryFilterChip label={activeTypeLabel} onRemove={() => setFilter('propertyType', undefined)} />
          )}
          {registryActive.map(({ key, label, params }) => (
            <RegistryFilterChip key={key} label={label} onRemove={() => removeChip(params)} />
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="ml-1 h-auto px-0 py-0 text-xs text-muted-foreground underline-offset-2 hover:underline hover:bg-transparent"
          >
            Clear all
          </Button>
        </div>
      )}
      {/* Mobile chips: ONLY sheet-applied registry filters — the quick four
          (status/price/beds/type) stay on their Row 2 triggers, so the P3
          duplication rationale holds, but a fireplace or flooring filter
          applied in the sheet was previously invisible and individually
          un-removable below 640px, and Clear all was unreachable (W-UI audit
          T2, 2026-07-30). One scrollable row restores both affordances. */}
      {registryActive.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-t border-border px-3 py-2 sm:hidden [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            className="ml-1 h-auto shrink-0 px-0 py-0 text-xs text-muted-foreground underline-offset-2 hover:underline hover:bg-transparent"
          >
            Clear all
          </Button>
        </div>
      )}

      {/* All filters — registry-driven sheet shared with the SEO filter bar */}
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
    </div>
  )
}
