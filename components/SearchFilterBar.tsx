'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { PROPERTY_TYPES } from '@/lib/property-type'
import SaveSearchButton from '@/components/SaveSearchButton'
import AllFiltersSheet, {
  activeRegistryFilters,
  ParsedSearchNotice,
  RegistryFilterChip,
  useParsedSearchConfirm,
} from '@/components/search/AllFiltersSheet'
import VoiceSearchButton from '@/components/VoiceSearchButton'
import { parseSearchQuery, searchHrefForQuery } from '@/lib/parse-search-query'
import { listingsBrowsePath } from '@/lib/slug'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Location01Icon } from '@hugeicons/core-free-icons'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const STATUS_OPTIONS = [
  { value: 'active', label: 'For Sale' },
  { value: 'active_and_pending', label: 'Active + under contract' },
  { value: 'pending', label: 'Under contract only' },
  { value: 'closed', label: 'Sold' },
  { value: 'all', label: 'All statuses' },
] as const

const PRICE_PRESETS = [
  { label: 'Any', min: undefined, max: undefined },
  { label: 'Under $300K', min: undefined, max: 300000 },
  { label: '$300K – $500K', min: 300000, max: 500000 },
  { label: '$500K – $750K', min: 500000, max: 750000 },
  { label: '$750K – $1M', min: 750000, max: 1000000 },
  { label: '$1M – $1.5M', min: 1000000, max: 1500000 },
  { label: '$1.5M+', min: 1500000, max: undefined },
]

const BEDS_OPTIONS = [
  { value: '', label: 'Any' },
  ...([1, 2, 3, 4, 5, 6] as const).map((n) => ({ value: String(n), label: `${n}+` })),
]

const BATHS_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: '1+' },
  { value: '1.5', label: '1.5+' },
  ...([2, 3, 4, 5] as const).map((n) => ({ value: String(n), label: `${n}+` })),
]

export type SearchFilterBarProps = {
  basePath?: string
  /** When set (e.g. in map view), show current search location as a prominent link so map and search stay synced. */
  locationLabel?: string
  /** URL for the location link (e.g. /homes-for-sale/bend?view=map). */
  locationHref?: string
  /** Pass to show Save search button (logged-in only). */
  signedIn?: boolean
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
  minSqFt?: string
  maxSqFt?: string
  maxBeds?: string
  maxBaths?: string
  yearBuiltMin?: string
  yearBuiltMax?: string
  lotAcresMin?: string
  lotAcresMax?: string
  postalCode?: string
  propertyType?: string
  statusFilter?: string
  keywords?: string
  hasOpenHouse?: string
  garageMin?: string
  hasPool?: string
  hasView?: string
  hasWaterfront?: string
  newListingsDays?: string
  includeClosed?: string
  sort?: string
  view?: string
  perPage?: string
  poly?: string
}

function hasStatusActive(params: SearchFilterBarProps): boolean {
  return (params.statusFilter && params.statusFilter !== 'active') || params.includeClosed === '1'
}

function hasPriceActive(params: SearchFilterBarProps): boolean {
  return !!(params.minPrice || params.maxPrice)
}

function hasBedsBathsActive(params: SearchFilterBarProps): boolean {
  return !!(params.beds || params.baths)
}

function hasHomeTypeActive(params: SearchFilterBarProps): boolean {
  return !!(params.propertyType && params.propertyType !== '')
}

function hasMoreActive(params: SearchFilterBarProps): boolean {
  return !!(
    params.minSqFt ||
    params.maxSqFt ||
    params.maxBeds ||
    params.maxBaths ||
    params.yearBuiltMin ||
    params.yearBuiltMax ||
    params.lotAcresMin ||
    params.lotAcresMax ||
    params.postalCode ||
    params.keywords ||
    params.hasOpenHouse === '1' ||
    params.garageMin ||
    params.hasPool === '1' ||
    params.hasView === '1' ||
    params.hasWaterfront === '1' ||
    params.newListingsDays
  )
}

type OpenKey = 'status' | 'price' | 'bedsbaths' | 'hometype' | null

export default function SearchFilterBar(props: SearchFilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const pathname = props.basePath ?? listingsBrowsePath()
  const [open, setOpen] = useState<OpenKey>(null)
  const [moreSheetOpen, setMoreSheetOpen] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Every registry field active in the URL — powers the More badge + chip row.
  const registryActive = activeRegistryFilters(searchParams)

  // Parsed-search confirmation chips (voice transcripts)
  const { chips: parsedChips, show: showParsedChips } = useParsedSearchConfirm()

  // Merge registry param updates into the CURRENT query string, keeping this
  // bar's apply semantics (page reset + transition + its own base path).
  const applyRegistryUpdates = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams?.toString() ?? '')
      for (const [k, v] of Object.entries(updates)) {
        if (v === undefined || v === '') params.delete(k)
        else params.set(k, v)
      }
      params.set('page', '1')
      setOpen(null)
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [searchParams, pathname, router, startTransition]
  )

  const handleVoiceTranscript = useCallback(
    (text: string) => {
      const parsed = parseSearchQuery(text.trim())
      if (Object.keys(parsed).length === 0) return
      showParsedChips(parsed)
      // This surface's geography lives in the PATH — a spoken city merged into
      // the query string would be silently ignored (review finding 2026-07-11).
      // A parsed city (or sold/pending intent, same path-scope problem) routes
      // to the query-param search surface where every parsed key applies.
      if (parsed.city || parsed.statusFilter) {
        router.push(searchHrefForQuery(text.trim()))
        return
      }
      applyRegistryUpdates(parsed)
    },
    [applyRegistryUpdates, showParsedChips, router]
  )

  function buildParams(overrides: Record<string, string | undefined>): URLSearchParams {
    const p = {
      minPrice: props.minPrice,
      maxPrice: props.maxPrice,
      beds: props.beds,
      baths: props.baths,
      minSqFt: props.minSqFt,
      maxSqFt: props.maxSqFt,
      maxBeds: props.maxBeds,
      maxBaths: props.maxBaths,
      yearBuiltMin: props.yearBuiltMin,
      yearBuiltMax: props.yearBuiltMax,
      lotAcresMin: props.lotAcresMin,
      lotAcresMax: props.lotAcresMax,
      postalCode: props.postalCode,
      propertyType: props.propertyType,
      statusFilter: props.statusFilter,
      keywords: props.keywords,
      garageMin: props.garageMin,
      newListingsDays: props.newListingsDays,
      hasOpenHouse: props.hasOpenHouse,
      hasPool: props.hasPool,
      hasView: props.hasView,
      hasWaterfront: props.hasWaterfront,
      includeClosed: props.includeClosed,
      sort: props.sort,
      view: props.view,
      perPage: props.perPage,
      poly: props.poly,
      page: '1',
      ...overrides,
    }
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(p)) {
      if (v !== undefined && v !== '') params.set(k, v)
    }
    return params
  }

  function apply(params: URLSearchParams) {
    setOpen(null)
    const q = params.toString()
    startTransition(() => {
      router.push(q ? `${pathname}?${q}` : pathname)
    })
  }

  const dropdownAnchor = 'absolute left-0 top-full z-50 mt-1.5'
  const dropdownSurface = 'rounded-lg border border-border bg-card shadow-lg'

  return (
    <div ref={barRef} className="flex w-full min-w-0 flex-col gap-3">
      {props.locationLabel != null && props.locationLabel !== '' && (
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={props.locationHref ?? pathname}
            className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm sm:max-w-md sm:px-4 sm:py-2.5"
            aria-label={`Search area: ${props.locationLabel}. Click to change.`}
          >
            <HugeiconsIcon icon={Location01Icon} className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{props.locationLabel}</span>
          </Link>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        {/* Voice search — outside the scroll container so the confirm chips
            are not clipped by overflow-x-auto */}
        <div className="relative shrink-0 self-start sm:self-auto">
          <VoiceSearchButton onTranscript={handleVoiceTranscript} />
          <ParsedSearchNotice
            chips={parsedChips}
            className="absolute left-0 top-full z-50 mt-1 w-72 max-w-[80vw]"
          />
        </div>
        <div
          className={cn(
            'flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain pb-0.5',
            '[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
          )}
        >
      {/* For Sale (status) */}
      <div className="relative shrink-0">
        <Button
          type="button"
          variant={open === 'status' || hasStatusActive(props) ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setOpen(open === 'status' ? null : 'status')}
          className="gap-1"
          aria-expanded={open === 'status'}
          aria-haspopup="true"
        >
          For Sale
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-70" aria-hidden />
        </Button>
        {open === 'status' && (
          <div className={cn(dropdownAnchor, dropdownSurface, 'w-[min(calc(100vw-2rem),20rem)] p-4')}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Property status
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const status = (form.querySelector('input[name="statusFilter"]:checked') as HTMLInputElement)?.value ?? ''
                const includeClosed = (form.querySelector('input[name="includeClosed"]') as HTMLInputElement)?.checked
                const params = buildParams({
                  statusFilter: status || undefined,
                  includeClosed: includeClosed ? '1' : undefined,
                })
                apply(params)
              }}
              className="space-y-3"
            >
              {STATUS_OPTIONS.map(({ value, label }) => (
                <Label key={value} className="flex cursor-pointer items-center gap-2">
                  <Input
                    type="radio"
                    name="statusFilter"
                    value={value}
                    defaultChecked={(props.statusFilter ?? (props.includeClosed === '1' ? 'all' : 'active')) === value}
                    className="h-4 w-4 border-border text-accent-foreground focus:ring-accent"
                  />
                  <span className="text-sm text-foreground">{label}</span>
                </Label>
              ))}
              <Separator />
              <Label className="flex cursor-pointer items-center gap-2">
                <Input
                  type="checkbox"
                  name="includeClosed"
                  defaultChecked={props.includeClosed === '1'}
                  className="h-4 w-4 rounded border-border text-accent-foreground focus:ring-accent"
                />
                <span className="text-sm text-muted-foreground">Include closed/sold</span>
              </Label>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Applying…' : 'Apply'}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Price */}
      <div className="relative shrink-0">
        <Button
          type="button"
          variant={open === 'price' || hasPriceActive(props) ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setOpen(open === 'price' ? null : 'price')}
          className="gap-1"
          aria-expanded={open === 'price'}
        >
          Price
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-70" aria-hidden />
        </Button>
        {open === 'price' && (
          <div className={cn(dropdownAnchor, dropdownSurface, 'w-[min(calc(100vw-2rem),20rem)] p-4')}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Price range
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const data = new FormData(form)
                const min = (data.get('minPrice') as string)?.trim() || undefined
                const max = (data.get('maxPrice') as string)?.trim() || undefined
                apply(buildParams({ minPrice: min, maxPrice: max }))
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <Label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Min</span>
                  <Input
                    type="number"
                    name="minPrice"
                    placeholder="No min"
                    min={0}
                    step={25000}
                    defaultValue={props.minPrice}
                  />
                </Label>
                <Label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Max</span>
                  <Input
                    type="number"
                    name="maxPrice"
                    placeholder="No max"
                    min={0}
                    step={25000}
                    defaultValue={props.maxPrice}
                  />
                </Label>
              </div>
              <div className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {PRICE_PRESETS.map(({ label, min, max }) => (
                  <Button
                    key={label}
                    type="button"
                    variant="outline"
                    size="xs"
                    className="shrink-0"
                    onClick={() => {
                      apply(
                        buildParams({
                          minPrice: min != null ? String(min) : undefined,
                          maxPrice: max != null ? String(max) : undefined,
                        })
                      )
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Applying…' : 'Apply'}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Beds & Baths */}
      <div className="relative shrink-0">
        <Button
          type="button"
          variant={open === 'bedsbaths' || hasBedsBathsActive(props) ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setOpen(open === 'bedsbaths' ? null : 'bedsbaths')}
          className="gap-1"
          aria-expanded={open === 'bedsbaths'}
        >
          Beds & Baths
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-70" aria-hidden />
        </Button>
        {open === 'bedsbaths' && (
          <div className={cn(dropdownAnchor, dropdownSurface, 'w-[min(calc(100vw-2rem),22rem)] p-4')}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const data = new FormData(form)
                const beds = (data.get('beds') as string)?.trim() || undefined
                const baths = (data.get('baths') as string)?.trim() || undefined
                apply(buildParams({ beds, baths }))
              }}
              className="space-y-4"
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Bedrooms
                </p>
                <div className="flex flex-nowrap gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {BEDS_OPTIONS.map(({ value, label }) => (
                    <Label key={value || 'any'} className="cursor-pointer">
                      <Input
                        type="radio"
                        name="beds"
                        value={value}
                        defaultChecked={(props.beds ?? '') === value}
                        className="peer sr-only"
                      />
                      <span className="block rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-foreground peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-primary hover:border-primary/30">
                        {label}
                      </span>
                    </Label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Bathrooms
                </p>
                <div className="flex flex-nowrap gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {BATHS_OPTIONS.map(({ value, label }) => (
                    <Label key={value || 'any'} className="cursor-pointer">
                      <Input
                        type="radio"
                        name="baths"
                        value={value}
                        defaultChecked={(props.baths ?? '') === value}
                        className="peer sr-only"
                      />
                      <span className="block rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-foreground peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-primary hover:border-primary/30">
                        {label}
                      </span>
                    </Label>
                  ))}
                </div>
              </div>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Applying…' : 'Apply'}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Home Type */}
      <div className="relative shrink-0">
        <Button
          type="button"
          variant={open === 'hometype' || hasHomeTypeActive(props) ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setOpen(open === 'hometype' ? null : 'hometype')}
          className="gap-1"
          aria-expanded={open === 'hometype'}
        >
          Home Type
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-70" aria-hidden />
        </Button>
        {open === 'hometype' && (
          <div className={cn(dropdownAnchor, dropdownSurface, 'w-[min(calc(100vw-2rem),20rem)] p-4')}>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const type = (form.querySelector('input[name="propertyType"]:checked') as HTMLInputElement)?.value ?? ''
                apply(buildParams({ propertyType: type || undefined }))
              }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Home Type
                </p>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  className="h-auto p-0 text-xs"
                  onClick={(e) => {
                    const form = (e.target as HTMLElement).closest('form')
                    form?.querySelectorAll<HTMLInputElement>('input[name="propertyType"]').forEach((el) => {
                      el.checked = el.value === ''
                    })
                  }}
                >
                  Deselect all
                </Button>
              </div>
              <div>
                {PROPERTY_TYPES.filter((t) => t.value !== '').map(({ value, label }) => (
                  <Label key={value} className="flex cursor-pointer items-center gap-2 py-1.5">
                    <Input
                      type="radio"
                      name="propertyType"
                      value={value}
                      defaultChecked={(props.propertyType ?? '') === value}
                      className="h-4 w-4 border-border text-accent-foreground focus:ring-accent"
                    />
                    <span className="text-sm text-foreground">{label}</span>
                  </Label>
                ))}
                <Label className="flex cursor-pointer items-center gap-2 py-1.5">
                  <Input
                    type="radio"
                    name="propertyType"
                    value=""
                    defaultChecked={!(props.propertyType ?? '')}
                    className="h-4 w-4 border-border text-accent-foreground focus:ring-accent"
                  />
                  <span className="text-sm text-foreground">All types</span>
                </Label>
              </div>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Applying…' : 'Apply'}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* More — opens the registry-driven All-filters sheet */}
      <div className="relative shrink-0">
        <Button
          type="button"
          variant={moreSheetOpen || hasMoreActive(props) || registryActive.length > 0 ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => {
            setOpen(null)
            setMoreSheetOpen(true)
          }}
          className="gap-1"
          aria-expanded={moreSheetOpen}
          aria-haspopup="dialog"
        >
          {registryActive.length > 0 ? `More (${registryActive.length})` : 'More'}
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-70" aria-hidden />
        </Button>
      </div>

        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Select
          value={props.sort ?? 'newest'}
          onValueChange={(sort) => {
            apply(buildParams({ sort: sort || undefined }))
          }}
        >
          <SelectTrigger className="h-8 w-[min(11rem,46vw)]" aria-label="Sort results">
            <SelectValue placeholder="Newest first" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="price_asc">Price: low to high</SelectItem>
            <SelectItem value="price_desc">Price: high to low</SelectItem>
          </SelectContent>
        </Select>

      {/* Save this search — always present. Signed-in users get the named/public
          save; guests get the email-capture path (FUB buyer lead, audience:buyer).
          Gating on props.signedIn hid the affordance from most visitors. */}
      <SaveSearchButton user={!!props.signedIn} />
        </div>
      </div>

      {/* Active registry filters — removable chips so applied filters stay visible */}
      {registryActive.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {registryActive.map(({ key, label, params }) => (
            <RegistryFilterChip
              key={key}
              label={label}
              onRemove={() => applyRegistryUpdates(Object.fromEntries(params.map((p) => [p, undefined])))}
            />
          ))}
        </div>
      )}

      {/* All filters — registry-driven sheet shared with /homes-for-sale.
          Live count stays off here: the location scope (city/neighborhood)
          lives in the path on these pages, so a query-only count would be a
          wrong number. */}
      <AllFiltersSheet
        open={moreSheetOpen}
        onOpenChange={setMoreSheetOpen}
        onApply={applyRegistryUpdates}
        closedScope={props.statusFilter === 'closed' || props.includeClosed === '1'}
        enableCount={false}
      />
    </div>
  )
}
