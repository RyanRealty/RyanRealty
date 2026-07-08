'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/tracking'
import { getSearchSuggestions, type SearchSuggestionsResult } from '@/app/actions/listings'
import { PROPERTY_TYPES } from '@/lib/property-type'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowDown01Icon,
  FilterIcon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'

export type SearchFiltersInitial = {
  city?: string
  subdivision?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
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

const SQFT_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '750', label: '750+' },
  { value: '1000', label: '1,000+' },
  { value: '1250', label: '1,250+' },
  { value: '1500', label: '1,500+' },
  { value: '2000', label: '2,000+' },
  { value: '2500', label: '2,500+' },
  { value: '3000', label: '3,000+' },
  { value: '4000', label: '4,000+' },
  { value: '5000', label: '5,000+' },
]

const LOT_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '0.1', label: '0.1+ acres' },
  { value: '0.25', label: '0.25+ acres' },
  { value: '0.5', label: '0.5+ acres' },
  { value: '1', label: '1+ acres' },
  { value: '2', label: '2+ acres' },
  { value: '5', label: '5+ acres' },
  { value: '10', label: '10+ acres' },
]

const GARAGE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
]

const DOM_OPTIONS = [
  { value: '', label: 'Any time' },
  { value: '7', label: 'Under 7 days' },
  { value: '30', label: 'Under 30 days' },
  { value: '90', label: 'Under 90 days' },
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

function bedsLabel(v?: string): string | null {
  if (!v) return null
  return `${v}+ bd`
}

function bathsLabel(v?: string): string | null {
  if (!v) return null
  return `${v}+ ba`
}

function typeLabel(v?: string): string | null {
  if (!v) return null
  return PROPERTY_TYPES.find((t) => t.value === v)?.label ?? null
}

function statusLabel(v?: string): string | null {
  if (!v || v === 'Active') return null
  return STATUS_OPTIONS.find((s) => s.value === v)?.label ?? null
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

// ---------------------------------------------------------------------------
// Chip component
// ---------------------------------------------------------------------------

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="secondary" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium h-auto">
      {label}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Remove filter: ${label}`}
        onClick={onRemove}
        className="ml-0.5 size-3.5 rounded-full p-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
      >
        <HugeiconsIcon icon={Cancel01Icon} className="size-3" aria-hidden />
      </Button>
    </Badge>
  )
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
          variant={active || open ? 'secondary' : 'outline'}
          size="sm"
          aria-haspopup="dialog"
          className="shrink-0 gap-1 whitespace-nowrap"
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
}

type OpenPanel = 'status' | 'price' | 'beds' | 'baths' | 'type' | null

export default function SearchFilters({ initialFilters }: Props) {
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

  // Location search
  const [locationQuery, setLocationQuery] = useState('')
  const [locationOpen, setLocationOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestionsResult>({
    addresses: [],
    cities: [],
    subdivisions: [],
    neighborhoods: [],
    zips: [],
    brokers: [],
    reports: [],
  })
  const locationInputRef = useRef<HTMLInputElement>(null)
  const debouncedLocation = useDebounce(locationQuery, 300)

  // More filters local state (controlled by Sheet form)
  const [moreState, setMoreState] = useState({
    minSqFt: initialFilters.minSqFt ?? '',
    maxSqFt: initialFilters.maxSqFt ?? '',
    lotAcresMin: initialFilters.lotAcresMin ?? '',
    lotAcresMax: initialFilters.lotAcresMax ?? '',
    yearBuiltMin: initialFilters.yearBuiltMin ?? '',
    yearBuiltMax: initialFilters.yearBuiltMax ?? '',
    garageMin: initialFilters.garageMin ?? '',
    daysOnMarket: initialFilters.daysOnMarket ?? '',
    hasPool: initialFilters.hasPool === '1',
    hasView: initialFilters.hasView === '1',
    hasWaterfront: initialFilters.hasWaterfront === '1',
    hasFireplace: initialFilters.hasFireplace === '1',
    hasGolfCourse: initialFilters.hasGolfCourse === '1',
    keywords: initialFilters.keywords ?? '',
  })

  // Sync moreState when filters change from URL (e.g. chip removal)
  useEffect(() => {
    setMoreState({
      minSqFt: initialFilters.minSqFt ?? '',
      maxSqFt: initialFilters.maxSqFt ?? '',
      lotAcresMin: initialFilters.lotAcresMin ?? '',
      lotAcresMax: initialFilters.lotAcresMax ?? '',
      yearBuiltMin: initialFilters.yearBuiltMin ?? '',
      yearBuiltMax: initialFilters.yearBuiltMax ?? '',
      garageMin: initialFilters.garageMin ?? '',
      daysOnMarket: initialFilters.daysOnMarket ?? '',
      hasPool: initialFilters.hasPool === '1',
      hasView: initialFilters.hasView === '1',
      hasWaterfront: initialFilters.hasWaterfront === '1',
      hasFireplace: initialFilters.hasFireplace === '1',
      hasGolfCourse: initialFilters.hasGolfCourse === '1',
      keywords: initialFilters.keywords ?? '',
    })
  }, [
    initialFilters.minSqFt,
    initialFilters.maxSqFt,
    initialFilters.lotAcresMin,
    initialFilters.lotAcresMax,
    initialFilters.yearBuiltMin,
    initialFilters.yearBuiltMax,
    initialFilters.garageMin,
    initialFilters.daysOnMarket,
    initialFilters.hasPool,
    initialFilters.hasView,
    initialFilters.hasWaterfront,
    initialFilters.hasFireplace,
    initialFilters.hasGolfCourse,
    initialFilters.keywords,
  ])

  // Note: outside-click + Escape close are handled by the design-system Popover
  // (radix) for the filter dropdowns, so no manual document listener is needed.

  // Location suggestions
  useEffect(() => {
    if (debouncedLocation.length < 2) {
      setSuggestions({ addresses: [], cities: [], subdivisions: [], neighborhoods: [], zips: [], brokers: [], reports: [] })
      return
    }
    getSearchSuggestions(debouncedLocation).then(setSuggestions)
  }, [debouncedLocation])

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
    },
    [updateUrl, locationQuery]
  )

  const handleZipSelect = useCallback(
    (postalCode: string) => {
      updateUrl({ postalCode, city: undefined, subdivision: undefined })
      setLocationQuery(postalCode)
      setLocationOpen(false)
      trackEvent('search', { postalCode, search_term: locationQuery })
    },
    [updateUrl, locationQuery]
  )

  const handleBrokerSelect = useCallback(
    (href: string) => {
      setLocationOpen(false)
      router.push(href)
    },
    [router]
  )

  // ---------------------------------------------------------------------------
  // Active chip helpers
  // ---------------------------------------------------------------------------

  const activePriceLabel = priceLabel(initialFilters.minPrice, initialFilters.maxPrice)
  const activeBedsLabel = bedsLabel(initialFilters.beds)
  const activeBathsLabel = bathsLabel(initialFilters.baths)
  const activeTypeLabel = typeLabel(initialFilters.propertyType)
  const activeStatusLabel = statusLabel(initialFilters.status)

  const moreActiveFilters: { label: string; key: string | string[] }[] = []
  if (initialFilters.minSqFt || initialFilters.maxSqFt) {
    const lo = initialFilters.minSqFt ? `${Number(initialFilters.minSqFt).toLocaleString()}+` : ''
    const hi = initialFilters.maxSqFt ? `up to ${Number(initialFilters.maxSqFt).toLocaleString()}` : ''
    moreActiveFilters.push({ label: `${[lo, hi].filter(Boolean).join(' to ')} sq ft`, key: ['minSqFt', 'maxSqFt'] })
  }
  if (initialFilters.lotAcresMin) {
    moreActiveFilters.push({ label: `${initialFilters.lotAcresMin}+ acres`, key: ['lotAcresMin', 'lotAcresMax'] })
  }
  if (initialFilters.yearBuiltMin || initialFilters.yearBuiltMax) {
    const lo = initialFilters.yearBuiltMin ?? ''
    const hi = initialFilters.yearBuiltMax ?? ''
    moreActiveFilters.push({ label: `Built ${[lo, hi].filter(Boolean).join(' to ')}`, key: ['yearBuiltMin', 'yearBuiltMax'] })
  }
  if (initialFilters.garageMin) {
    moreActiveFilters.push({ label: `${initialFilters.garageMin}+ garage`, key: 'garageMin' })
  }
  if (initialFilters.daysOnMarket) {
    const o = DOM_OPTIONS.find((d) => d.value === initialFilters.daysOnMarket)
    moreActiveFilters.push({ label: o?.label ?? `Under ${initialFilters.daysOnMarket} days`, key: 'daysOnMarket' })
  }
  if (initialFilters.hasPool === '1') moreActiveFilters.push({ label: 'Pool', key: 'hasPool' })
  if (initialFilters.hasView === '1') moreActiveFilters.push({ label: 'View', key: 'hasView' })
  if (initialFilters.hasWaterfront === '1') moreActiveFilters.push({ label: 'Waterfront', key: 'hasWaterfront' })
  if (initialFilters.hasFireplace === '1') moreActiveFilters.push({ label: 'Fireplace', key: 'hasFireplace' })
  if (initialFilters.hasGolfCourse === '1') moreActiveFilters.push({ label: 'Golf course', key: 'hasGolfCourse' })
  if (initialFilters.keywords) moreActiveFilters.push({ label: `"${initialFilters.keywords}"`, key: 'keywords' })

  const hasAnyFilter = !!(
    activePriceLabel ||
    activeBedsLabel ||
    activeBathsLabel ||
    activeTypeLabel ||
    activeStatusLabel ||
    moreActiveFilters.length > 0
  )

  const moreFilterCount = moreActiveFilters.length

  function removeChip(key: string | string[]) {
    const keys = Array.isArray(key) ? key : [key]
    const upd: Record<string, undefined> = {}
    for (const k of keys) upd[k] = undefined
    updateUrl(upd)
  }

  function clearAll() {
    router.push(`${pathname ?? '/homes-for-sale'}?view=${view}`, { scroll: false })
    setLocationQuery('')
  }

  // ---------------------------------------------------------------------------
  // More-filters sheet apply
  // ---------------------------------------------------------------------------

  function applyMoreFilters() {
    updateUrl({
      minSqFt: moreState.minSqFt || undefined,
      maxSqFt: moreState.maxSqFt || undefined,
      lotAcresMin: moreState.lotAcresMin || undefined,
      lotAcresMax: moreState.lotAcresMax || undefined,
      yearBuiltMin: moreState.yearBuiltMin || undefined,
      yearBuiltMax: moreState.yearBuiltMax || undefined,
      garageMin: moreState.garageMin || undefined,
      daysOnMarket: moreState.daysOnMarket || undefined,
      hasPool: moreState.hasPool ? '1' : undefined,
      hasView: moreState.hasView ? '1' : undefined,
      hasWaterfront: moreState.hasWaterfront ? '1' : undefined,
      hasFireplace: moreState.hasFireplace ? '1' : undefined,
      hasGolfCourse: moreState.hasGolfCourse ? '1' : undefined,
      keywords: moreState.keywords || undefined,
    })
    setMoreSheetOpen(false)
  }

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
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
        {/* Location search input — basis-full gives it its own line on phones
            (sort + view toggle squeezed it to ~60px, showing "Ben" of "Bend"). */}
        <div className="relative min-w-0 basis-full sm:basis-auto sm:flex-1 sm:max-w-sm">
          <Input
            ref={locationInputRef}
            type="search"
            placeholder={locationPlaceholder}
            value={locationQuery}
            onChange={(e) => setLocationQuery(e.target.value)}
            onFocus={() => setLocationOpen(true)}
            onBlur={() => setTimeout(() => setLocationOpen(false), 150)}
            className="w-full rounded-xl"
            aria-label="Search by city, community, zip, or address"
          />
          {locationOpen &&
            (suggestions.cities.length > 0 ||
              suggestions.subdivisions.length > 0 ||
              suggestions.neighborhoods.length > 0 ||
              suggestions.zips.length > 0 ||
              suggestions.brokers.length > 0 ||
              suggestions.reports.length > 0) && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-auto rounded-xl border border-border bg-card shadow-lg">
                {suggestions.cities.slice(0, 5).map((c) => (
                  <Button
                    key={c.city}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 rounded-none px-3 py-2 h-auto font-normal"
                    onMouseDown={() => handleLocationSelect('city', c.city)}
                  >
                    <Badge variant="secondary" className="shrink-0 text-xs font-normal">City</Badge>
                    <span className="truncate">{c.city}{c.count > 0 && ` (${c.count})`}</span>
                  </Button>
                ))}
                {suggestions.subdivisions.slice(0, 8).map((s) => (
                  <Button
                    key={`${s.city}-${s.subdivisionName}`}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 rounded-none px-3 py-2 h-auto font-normal"
                    onMouseDown={() => handleLocationSelect('subdivision', s.city, s.subdivisionName)}
                  >
                    <Badge variant="secondary" className="shrink-0 text-xs font-normal">Community</Badge>
                    <span className="truncate">{s.subdivisionName}, {s.city}</span>
                  </Button>
                ))}
                {suggestions.neighborhoods.slice(0, 5).map((n) => (
                  <Button
                    key={n.href}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 rounded-none px-3 py-2 h-auto font-normal"
                    onMouseDown={() => handleBrokerSelect(n.href)}
                  >
                    <Badge variant="secondary" className="shrink-0 text-xs font-normal">Neighborhood</Badge>
                    <span className="truncate">{n.neighborhoodName}, {n.cityName}</span>
                  </Button>
                ))}
                {suggestions.zips.slice(0, 5).map((z) => (
                  <Button
                    key={z.postalCode}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 rounded-none px-3 py-2 h-auto font-normal"
                    onMouseDown={() => handleZipSelect(z.postalCode)}
                  >
                    <Badge variant="secondary" className="shrink-0 text-xs font-normal">Zip</Badge>
                    <span className="truncate">{z.postalCode}{z.city && ` (${z.city})`}</span>
                  </Button>
                ))}
                {suggestions.brokers.slice(0, 5).map((b) => (
                  <Button
                    key={b.label}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 rounded-none px-3 py-2 h-auto font-normal"
                    onMouseDown={() => handleBrokerSelect(b.href)}
                  >
                    <Badge variant="secondary" className="shrink-0 text-xs font-normal">Agent</Badge>
                    <span className="truncate">{b.label}</span>
                  </Button>
                ))}
                {suggestions.reports.slice(0, 3).map((r) => (
                  <Button
                    key={r.href}
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2 rounded-none px-3 py-2 h-auto font-normal"
                    onMouseDown={() => handleBrokerSelect(r.href)}
                  >
                    <Badge variant="secondary" className="shrink-0 text-xs font-normal">Market report</Badge>
                    <span className="truncate">{r.label}</span>
                  </Button>
                ))}
              </div>
            )}
        </div>

        {/* Sort */}
        <Select
          value={initialFilters.sort ?? 'newest'}
          onValueChange={(v) => setFilter('sort', v)}
        >
          <SelectTrigger className="h-8 w-44" aria-label="Sort results">
            <SelectValue placeholder="Newest" />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

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
          className="hidden lg:flex rounded-lg border border-border overflow-hidden"
        >
          {(['split', 'list', 'map'] as const).map((v) => (
            <ToggleGroupItem
              key={v}
              value={v}
              className="px-3 py-1.5 text-xs font-medium capitalize rounded-none border-0"
              aria-label={`${v} view`}
            >
              {v}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
          variant={moreFilterCount > 0 ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setMoreSheetOpen(true)}
          className="shrink-0 gap-1"
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
          the room and keeps the faster per-chip remove affordance; mobile
          drops to Row 2 + its dropdown's own clear control. */}
      {hasAnyFilter && (
        <div className="hidden flex-wrap items-center gap-1.5 border-t border-border px-3 py-2 sm:flex sm:px-4">
          {activeStatusLabel && (
            <FilterChip label={activeStatusLabel} onRemove={() => setFilter('status', undefined)} />
          )}
          {activePriceLabel && (
            <FilterChip label={`Price: ${activePriceLabel}`} onRemove={() => updateUrl({ minPrice: undefined, maxPrice: undefined })} />
          )}
          {activeBedsLabel && (
            <FilterChip label={activeBedsLabel} onRemove={() => setFilter('beds', undefined)} />
          )}
          {activeBathsLabel && (
            <FilterChip label={activeBathsLabel} onRemove={() => setFilter('baths', undefined)} />
          )}
          {activeTypeLabel && (
            <FilterChip label={activeTypeLabel} onRemove={() => setFilter('propertyType', undefined)} />
          )}
          {moreActiveFilters.map(({ label, key }) => (
            <FilterChip key={Array.isArray(key) ? key[0] : key} label={label} onRemove={() => removeChip(key)} />
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

      {/* More Filters Sheet */}
      <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader className="px-4 pt-4 pb-0">
            <SheetTitle>More filters</SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1 px-4 py-4">
            <div className="flex flex-col gap-5">

              {/* Square footage */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Square footage</p>
                <div className="grid grid-cols-2 gap-2">
                  <Label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Min sq ft</span>
                    <Select
                      value={moreState.minSqFt || ''}
                      onValueChange={(v) => setMoreState((s) => ({ ...s, minSqFt: v }))}
                    >
                      <SelectTrigger className="tabular-nums" aria-label="Minimum square feet">
                        <SelectValue placeholder="No min" />
                      </SelectTrigger>
                      <SelectContent>
                        {SQFT_OPTIONS.map((o) => (
                          <SelectItem key={o.value || 'any'} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Label>
                  <Label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Max sq ft</span>
                    <Input
                      type="number"
                      placeholder="No max"
                      min={0}
                      step={100}
                      value={moreState.maxSqFt}
                      onChange={(e) => setMoreState((s) => ({ ...s, maxSqFt: e.target.value }))}
                      className="tabular-nums"
                    />
                  </Label>
                </div>
              </section>

              <Separator />

              {/* Lot size */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lot size</p>
                <div className="grid grid-cols-2 gap-2">
                  <Label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Min lot (acres)</span>
                    <Select
                      value={moreState.lotAcresMin || ''}
                      onValueChange={(v) => setMoreState((s) => ({ ...s, lotAcresMin: v }))}
                    >
                      <SelectTrigger className="tabular-nums" aria-label="Minimum lot size in acres">
                        <SelectValue placeholder="No min" />
                      </SelectTrigger>
                      <SelectContent>
                        {LOT_OPTIONS.map((o) => (
                          <SelectItem key={o.value || 'any'} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Label>
                  <Label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Max lot (acres)</span>
                    <Input
                      type="number"
                      placeholder="No max"
                      min={0}
                      step={0.1}
                      value={moreState.lotAcresMax}
                      onChange={(e) => setMoreState((s) => ({ ...s, lotAcresMax: e.target.value }))}
                      className="tabular-nums"
                    />
                  </Label>
                </div>
              </section>

              <Separator />

              {/* Year built */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Year built</p>
                <div className="grid grid-cols-2 gap-2">
                  <Label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">From year</span>
                    <Input
                      type="number"
                      placeholder="e.g. 1990"
                      min={1800}
                      max={2100}
                      value={moreState.yearBuiltMin}
                      onChange={(e) => setMoreState((s) => ({ ...s, yearBuiltMin: e.target.value }))}
                      className="tabular-nums"
                    />
                  </Label>
                  <Label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">To year</span>
                    <Input
                      type="number"
                      placeholder="e.g. 2024"
                      min={1800}
                      max={2100}
                      value={moreState.yearBuiltMax}
                      onChange={(e) => setMoreState((s) => ({ ...s, yearBuiltMax: e.target.value }))}
                      className="tabular-nums"
                    />
                  </Label>
                </div>
              </section>

              <Separator />

              {/* Garage + days on market */}
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Garage and listing age</p>
                <div className="grid grid-cols-2 gap-2">
                  <Label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Garage spaces</span>
                    <Select
                      value={moreState.garageMin || ''}
                      onValueChange={(v) => setMoreState((s) => ({ ...s, garageMin: v }))}
                    >
                      <SelectTrigger aria-label="Minimum garage spaces">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        {GARAGE_OPTIONS.map((o) => (
                          <SelectItem key={o.value || 'any'} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Label>
                  <Label className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Days on market</span>
                    <Select
                      value={moreState.daysOnMarket || ''}
                      onValueChange={(v) => setMoreState((s) => ({ ...s, daysOnMarket: v }))}
                    >
                      <SelectTrigger aria-label="Days on market">
                        <SelectValue placeholder="Any time" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOM_OPTIONS.map((o) => (
                          <SelectItem key={o.value || 'any'} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Label>
                </div>
              </section>

              <Separator />

              {/* Feature flags */}
              <section>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Features</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {(
                    [
                      { key: 'hasPool', label: 'Pool' },
                      { key: 'hasView', label: 'View' },
                      { key: 'hasWaterfront', label: 'Waterfront' },
                      { key: 'hasFireplace', label: 'Fireplace' },
                      { key: 'hasGolfCourse', label: 'Golf course' },
                    ] as const
                  ).map(({ key, label }) => (
                    <Label key={key} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={moreState[key]}
                        onCheckedChange={(v) =>
                          setMoreState((s) => ({ ...s, [key]: v === true }))
                        }
                        aria-label={label}
                      />
                      <span className="text-sm text-foreground">{label}</span>
                    </Label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  View, waterfront, fireplace, and golf course apply in list view.
                </p>
              </section>

              <Separator />

              {/* Keywords */}
              <section>
                <Label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Keywords</span>
                  <Input
                    type="search"
                    placeholder="e.g. mountain view, RV parking"
                    value={moreState.keywords}
                    onChange={(e) => setMoreState((s) => ({ ...s, keywords: e.target.value }))}
                  />
                  <span className="text-xs text-muted-foreground">List view searches the listing description. Split view matches address and area terms.</span>
                </Label>
              </section>

            </div>
          </ScrollArea>

          <SheetFooter className="gap-2 px-4 pb-4">
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              onClick={() => {
                setMoreState({
                  minSqFt: '', maxSqFt: '', lotAcresMin: '', lotAcresMax: '',
                  yearBuiltMin: '', yearBuiltMax: '', garageMin: '', daysOnMarket: '',
                  hasPool: false, hasView: false, hasWaterfront: false,
                  hasFireplace: false, hasGolfCourse: false, keywords: '',
                })
              }}
            >
              Reset
            </Button>
            <Button type="button" className="flex-1" onClick={applyMoreFilters}>
              Apply filters
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
