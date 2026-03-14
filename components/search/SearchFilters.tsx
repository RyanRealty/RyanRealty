'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback, useState, useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/tracking'
import { getSearchSuggestions } from '@/app/actions/listings'
import { Button } from '@/components/ui/button'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const PRICE_PRESETS = [
  { label: 'Any', min: undefined, max: undefined },
  { label: 'Under $300K', min: undefined, max: 300000 },
  { label: '$300K – $500K', min: 300000, max: 500000 },
  { label: '$500K – $750K', min: 500000, max: 750000 },
  { label: '$750K – $1M', min: 750000, max: 1000000 },
  { label: '$1M – $1.5M', min: 1000000, max: 1500000 },
  { label: '$1.5M+', min: 1500000, max: undefined },
]

const BEDS_OPTIONS = [undefined, 1, 2, 3, 4, 5] as const
const BATHS_OPTIONS = [undefined, 1, 2, 3, 4] as const
const STATUS_OPTIONS = ['Active', 'Pending', 'Sold'] as const
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'price_per_sqft_asc', label: 'Price/sq ft: Low to High' },
  { value: 'price_per_sqft_desc', label: 'Price/sq ft: High to Low' },
  { value: 'year_newest', label: 'Newest Built' },
  { value: 'year_oldest', label: 'Oldest Built' },
] as const

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
  garageMin?: string
  daysOnMarket?: string
  keywords?: string
}

type Props = {
  initialFilters: SearchFiltersInitial
}

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

export default function SearchFilters({ initialFilters }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [locationQuery, setLocationQuery] = useState('')
  const [locationOpen, setLocationOpen] = useState(false)
  const [suggestions, setSuggestions] = useState<{ addresses: { label: string; href: string }[]; cities: { city: string; count: number }[]; subdivisions: { city: string; subdivisionName: string; count: number }[] }>({ addresses: [], cities: [], subdivisions: [] })
  const [moreOpen, setMoreOpen] = useState(false)
  const [view, setView] = useState<'split' | 'list' | 'map'>(() => (initialFilters.view === 'list' || initialFilters.view === 'map' ? initialFilters.view : 'split'))
  const locationInputRef = useRef<HTMLInputElement>(null)
  const debouncedLocation = useDebounce(locationQuery, 300)

  useEffect(() => {
    if (debouncedLocation.length < 2) {
      setSuggestions({ addresses: [], cities: [], subdivisions: [] })
      return
    }
    getSearchSuggestions(debouncedLocation).then(setSuggestions)
  }, [debouncedLocation])

  const updateUrl = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      Object.entries(updates).forEach(([k, v]) => {
        if (v === undefined || v === '') params.delete(k)
        else params.set(k, v)
      })
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

  const clearAll = useCallback(() => {
    router.push('/homes-for-sale', { scroll: false })
    setLocationQuery('')
    setMoreOpen(false)
  }, [router])

  const activeFilterCount = [
    initialFilters.minSqFt,
    initialFilters.maxSqFt,
    initialFilters.lotAcresMin,
    initialFilters.lotAcresMax,
    initialFilters.yearBuiltMin,
    initialFilters.yearBuiltMax,
    initialFilters.propertyType,
    initialFilters.hasPool,
    initialFilters.hasView,
    initialFilters.hasWaterfront,
    initialFilters.garageMin,
    initialFilters.daysOnMarket,
    initialFilters.keywords,
  ].filter((v) => v != null && v !== '').length

  const handleLocationSelect = useCallback(
    (type: 'city' | 'subdivision', city: string, subdivision?: string) => {
      if (type === 'city') {
        updateUrl({ city, subdivision: undefined })
        setLocationQuery(city)
      } else {
        updateUrl({ city, subdivision: subdivision ?? '' })
        setLocationQuery(subdivision ? `${subdivision}, ${city}` : city)
      }
      setLocationOpen(false)
      trackEvent('search', { city, subdivision: subdivision ?? undefined, search_term: locationQuery })
    },
    [updateUrl, locationQuery]
  )

  const handleSearchTrack = useCallback(() => {
    trackEvent('search', {
      city: initialFilters.city,
      subdivision: initialFilters.subdivision,
      min_price: initialFilters.minPrice,
      max_price: initialFilters.maxPrice,
      beds: initialFilters.beds,
      baths: initialFilters.baths,
      status: initialFilters.status,
    })
  }, [initialFilters.city, initialFilters.subdivision, initialFilters.minPrice, initialFilters.maxPrice, initialFilters.beds, initialFilters.baths, initialFilters.status])

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Location */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Input
            ref={locationInputRef}
            type="text"
            placeholder="City, community, or zip"
            value={locationQuery !== undefined && locationQuery !== '' ? locationQuery : (initialFilters.subdivision && initialFilters.city ? `${initialFilters.subdivision}, ${initialFilters.city}` : (initialFilters.city ?? ''))}
            onChange={(e) => setLocationQuery(e.target.value)}
            onFocus={() => setLocationOpen(true)}
            onBlur={() => setTimeout(() => setLocationOpen(false), 200)}
            className="w-full rounded-lg border border-border px-3 py-2 text-primary placeholder:text-muted-foreground focus:border-accent focus:outline-none"
          />
          {locationOpen && (suggestions.cities.length > 0 || suggestions.subdivisions.length > 0) && (
            <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-lg border border-border bg-card shadow-md max-h-64 overflow-auto">
              {suggestions.cities.slice(0, 5).map((c) => (
                <Button
                  key={c.city}
                  type="button"
                  className="block w-full text-left px-3 py-2 text-sm text-primary hover:bg-muted"
                  onMouseDown={() => handleLocationSelect('city', c.city)}
                >
                  {c.city} {c.count > 0 && `(${c.count})`}
                </Button>
              ))}
              {suggestions.subdivisions.slice(0, 8).map((s) => (
                <Button
                  key={`${s.city}-${s.subdivisionName}`}
                  type="button"
                  className="block w-full text-left px-3 py-2 text-sm text-primary hover:bg-muted"
                  onMouseDown={() => handleLocationSelect('subdivision', s.city, s.subdivisionName)}
                >
                  {s.subdivisionName}, {s.city}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Price presets */}
        <div className="flex flex-wrap gap-1">
          {PRICE_PRESETS.map((preset) => {
            const active =
              (preset.min == null && preset.max == null && !initialFilters.minPrice && !initialFilters.maxPrice) ||
              (preset.min === (initialFilters.minPrice ? Number(initialFilters.minPrice) : undefined) && preset.max === (initialFilters.maxPrice ? Number(initialFilters.maxPrice) : undefined))
            return (
              <Button
                key={preset.label}
                type="button"
                onClick={() => {
                  setFilter('minPrice', preset.min)
                  setFilter('maxPrice', preset.max)
                  handleSearchTrack()
                }}
                className={`rounded-full px-3 py-1 text-sm ${active ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground hover:bg-border'}`}
              >
                {preset.label}
              </Button>
            )
          })}
        </div>

        {/* Beds */}
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">Beds:</span>
          {BEDS_OPTIONS.map((n) => {
            const val = n == null ? '' : String(n)
            const active = (initialFilters.beds ?? '') === val
            return (
              <Button
                key={val || 'any'}
                type="button"
                onClick={() => { setFilter('beds', val); handleSearchTrack() }}
                className={`rounded px-2 py-1 text-sm ${active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
              >
                {n == null ? 'Any' : `${n}+`}
              </Button>
            )
          })}
        </div>

        {/* Baths */}
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">Baths:</span>
          {BATHS_OPTIONS.map((n) => {
            const val = n == null ? '' : String(n)
            const active = (initialFilters.baths ?? '') === val
            return (
              <Button
                key={val || 'any'}
                type="button"
                onClick={() => { setFilter('baths', val); handleSearchTrack() }}
                className={`rounded px-2 py-1 text-sm ${active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
              >
                {n == null ? 'Any' : `${n}+`}
              </Button>
            )
          })}
        </div>

        {/* Status */}
        <div className="flex items-center gap-1">
          {STATUS_OPTIONS.map((s) => {
            const active = (initialFilters.status ?? 'Active') === s
            return (
              <Button
                key={s}
                type="button"
                onClick={() => { setFilter('status', s); handleSearchTrack() }}
                className={`rounded px-3 py-1 text-sm ${active ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}
              >
                {s}
              </Button>
            )
          })}
        </div>

        {/* View mode */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['split', 'list', 'map'] as const).map((v) => (
            <Button
              key={v}
              type="button"
              onClick={() => { setFilter('view', v); setView(v); }}
              className={`px-3 py-1.5 text-sm capitalize ${view === v ? 'bg-accent text-primary' : 'bg-card text-muted-foreground'}`}
            >
              {v}
            </Button>
          ))}
        </div>

        {/* More Filters */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMoreOpen((o) => !o)}
          >
            More Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
          </Button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setMoreOpen(false)} />
              <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-lg border border-border bg-card p-4 shadow-lg">
                <div className="space-y-3 text-sm">
                  <Label className="flex justify-between items-center">
                    <span className="text-primary">Min Sq Ft</span>
                    <Input
                      type="number"
                      className="w-24 rounded border border-border px-2 py-1"
                      value={initialFilters.minSqFt ?? ''}
                      onChange={(e) => setFilter('minSqFt', e.target.value || undefined)}
                    />
                  </Label>
                  <Label className="flex justify-between items-center">
                    <span className="text-primary">Max Sq Ft</span>
                    <Input
                      type="number"
                      className="w-24 rounded border border-border px-2 py-1"
                      value={initialFilters.maxSqFt ?? ''}
                      onChange={(e) => setFilter('maxSqFt', e.target.value || undefined)}
                    />
                  </Label>
                  <Label className="flex justify-between items-center">
                    <span className="text-primary">Lot (acres) min</span>
                    <Input
                      type="number"
                      step={0.1}
                      className="w-24 rounded border border-border px-2 py-1"
                      value={initialFilters.lotAcresMin ?? ''}
                      onChange={(e) => setFilter('lotAcresMin', e.target.value || undefined)}
                    />
                  </Label>
                  <Label className="flex justify-between items-center">
                    <span className="text-primary">Year built</span>
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        placeholder="Min"
                        className="w-16 rounded border border-border px-2 py-1"
                        value={initialFilters.yearBuiltMin ?? ''}
                        onChange={(e) => setFilter('yearBuiltMin', e.target.value || undefined)}
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        className="w-16 rounded border border-border px-2 py-1"
                        value={initialFilters.yearBuiltMax ?? ''}
                        onChange={(e) => setFilter('yearBuiltMax', e.target.value || undefined)}
                      />
                    </div>
                  </Label>
                  <Label className="flex items-center gap-2">
                    <Input
                      type="checkbox"
                      checked={initialFilters.hasPool === '1'}
                      onChange={(e) => setFilter('hasPool', e.target.checked ? '1' : undefined)}
                    />
                    <span className="text-primary">Pool</span>
                  </Label>
                  <Label className="flex items-center gap-2">
                    <Input
                      type="checkbox"
                      checked={initialFilters.hasView === '1'}
                      onChange={(e) => setFilter('hasView', e.target.checked ? '1' : undefined)}
                    />
                    <span className="text-primary">View</span>
                  </Label>
                  <Label className="flex items-center gap-2">
                    <Input
                      type="checkbox"
                      checked={initialFilters.hasWaterfront === '1'}
                      onChange={(e) => setFilter('hasWaterfront', e.target.checked ? '1' : undefined)}
                    />
                    <span className="text-primary">Waterfront</span>
                  </Label>
                  <Label className="flex justify-between items-center">
                    <span className="text-primary">Garage</span>
                    <Select value={initialFilters.garageMin ?? '__all__'} onValueChange={(v) => setFilter('garageMin', v === '__all__' ? undefined : v)}>
                      <SelectTrigger className="rounded border border-border px-2 py-1 w-24">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Any</SelectItem>
                        <SelectItem value="1">1+</SelectItem>
                        <SelectItem value="2">2+</SelectItem>
                        <SelectItem value="3">3+</SelectItem>
                      </SelectContent>
                    </Select>
                  </Label>
                  <Label className="flex justify-between items-center">
                    <span className="text-primary">Days on market</span>
                    <Select value={initialFilters.daysOnMarket ?? '__all__'} onValueChange={(v) => setFilter('daysOnMarket', v === '__all__' ? undefined : v)}>
                      <SelectTrigger className="rounded border border-border px-2 py-1 w-24">
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Any</SelectItem>
                        <SelectItem value="7">Under 7</SelectItem>
                        <SelectItem value="30">Under 30</SelectItem>
                        <SelectItem value="90">Under 90</SelectItem>
                      </SelectContent>
                    </Select>
                  </Label>
                  <Label className="block">
                    <span className="text-primary">Keywords</span>
                    <Input
                      type="text"
                      placeholder="Search in description"
                      className="mt-1 w-full rounded border border-border px-2 py-1"
                      value={initialFilters.keywords ?? ''}
                      onChange={(e) => setFilter('keywords', e.target.value || undefined)}
                    />
                  </Label>
                </div>
              </div>
            </>
          )}
        </div>

        <Button variant="ghost" size="sm" onClick={clearAll}>
          Clear All
        </Button>
      </div>

      {/* Min/Max price inputs when not using preset */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Label className="flex items-center gap-1">
          <span className="text-muted-foreground">Min $</span>
          <Input
            type="number"
            className="w-24 rounded border border-border px-2 py-1"
            value={initialFilters.minPrice ?? ''}
            onChange={(e) => setFilter('minPrice', e.target.value || undefined)}
          />
        </Label>
        <Label className="flex items-center gap-1">
          <span className="text-muted-foreground">Max $</span>
          <Input
            type="number"
            className="w-24 rounded border border-border px-2 py-1"
            value={initialFilters.maxPrice ?? ''}
            onChange={(e) => setFilter('maxPrice', e.target.value || undefined)}
          />
        </Label>
        <Label className="flex items-center gap-1">
          <span className="text-muted-foreground">Sort</span>
          <Select value={initialFilters.sort ?? 'newest'} onValueChange={(v) => setFilter('sort', v)}>
            <SelectTrigger className="rounded border border-border px-2 py-1 text-primary w-48">
              <SelectValue placeholder="Newest" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Label>
      </div>
    </div>
  )
}
