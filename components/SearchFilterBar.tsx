'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import HomeTypeFilterPanel, { homeTypeChipLabel } from '@/components/search/HomeTypeFilterPanel'
import dynamic from 'next/dynamic'
import SaveSearchButton from '@/components/SaveSearchButton'
import type { SavedSearchPathContext } from '@/lib/search/saved-search-path-filters'
import {
  activeRegistryFilters,
  ParsedSearchNotice,
  RegistryFilterChip,
  useParsedSearchConfirm,
} from '@/components/search/registry-filter-chrome'
import VoiceSearchButton from '@/components/VoiceSearchButton'
import '@/components/search/search-ledger.css'

/** P6: load the ~1k-LOC registry sheet only after first open (not on cold SEO browse). */
const AllFiltersSheet = dynamic(() => import('@/components/search/AllFiltersSheet'), {
  ssr: false,
  loading: () => null,
})
import { parseSearchQuery, searchHrefForQuery } from '@/lib/parse-search-query'
import {
  publishSearchStatusChip,
  SEARCH_STATUS_FILTER_CHIPS,
} from '@/lib/search/publish-search-status'
import { listingsBrowsePath } from '@/lib/slug'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Location01Icon } from '@hugeicons/core-free-icons'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const STATUS_OPTIONS = SEARCH_STATUS_FILTER_CHIPS

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
  /** Server-resolved geography for path-scoped routes (city/subdivision/preset
   *  in the slug) — SaveSearchButton stores canonical filters instead of
   *  guessing from the pathname. Query-param surfaces omit it. */
  pathContext?: SavedSearchPathContext
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
  /**
   * Filters the preset ROUTE applies that are not in the query string
   * (/with-pool applies hasPool without ?hasPool=1). Without these chips the
   * filter was live but invisible and un-removable (W-UI audit T1,
   * 2026-07-30). Removing one writes its off param (`hasPool=0`), which the
   * page's preset merge now honors.
   */
  presetChips?: readonly { label: string; param: string }[]
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

function hasHomeTypeActive(params: SearchFilterBarProps, subTypes: string[]): boolean {
  return !!(params.propertyType && params.propertyType !== '') || subTypes.length > 0
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
  /** Keep the lazy sheet mounted after first open so close animation still works. */
  const [moreSheetMounted, setMoreSheetMounted] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Every registry field active in the URL — powers the More badge + chip row.
  // propertySubTypes rides the Home type chip — don't double-list it here.
  const registryActive = activeRegistryFilters(searchParams).filter((f) => f.key !== 'propertySubTypes')
  const selectedSubTypes = useMemo(() => {
    const raw = searchParams?.get('propertySubTypes') ?? ''
    return raw.split(',').map((s) => s.trim()).filter(Boolean)
  }, [searchParams])
  const homeTypeLabel =
    homeTypeChipLabel(props.propertyType, selectedSubTypes) ?? 'Home Type'

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
      // Sub-types live only in the query string (registry multi), not bar props.
      propertySubTypes: searchParams?.get('propertySubTypes') || undefined,
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
  const dropdownSurface = 'srch-pop'

  return (
    <div ref={barRef} className="flex w-full min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto no-scrollbar px-1 py-1">
        {props.locationLabel != null && props.locationLabel !== '' && (
          <Link
            href={props.locationHref ?? pathname}
            className="srch-panel inline-flex h-11 min-w-11 max-w-40 shrink-0 items-center gap-2 px-3 text-sm font-medium text-foreground sm:max-w-56"
            aria-label={`Search area: ${props.locationLabel}. Click to change.`}
          >
            <HugeiconsIcon icon={Location01Icon} className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">{props.locationLabel}</span>
          </Link>
        )}
        <div className="relative shrink-0">
          <VoiceSearchButton onTranscript={handleVoiceTranscript} />
          <ParsedSearchNotice
            chips={parsedChips}
            className="absolute left-0 top-full z-50 mt-1 w-72 max-w-xs"
          />
        </div>
        <div
          className="flex min-w-0 flex-1 flex-nowrap items-center gap-2"
        >
      {/* For Sale (status) */}
      <div className="relative shrink-0">
        <Button
          type="button"
          variant={open === 'status' || hasStatusActive(props) ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setOpen(open === 'status' ? null : 'status')}
          className="srch-chip h-8 gap-1"
          aria-expanded={open === 'status'}
          aria-haspopup="true"
        >
          {publishSearchStatusChip(props.statusFilter)}
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-70" aria-hidden />
        </Button>
        {open === 'status' && (
          <div className={cn(dropdownAnchor, dropdownSurface, 'w-[min(calc(100vw-2rem),20rem)] p-4')}>
            <p className="srch-label mb-3">
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
          className="srch-chip h-8 gap-1"
          aria-expanded={open === 'price'}
        >
          Price
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-70" aria-hidden />
        </Button>
        {open === 'price' && (
          <div className={cn(dropdownAnchor, dropdownSurface, 'w-[min(calc(100vw-2rem),20rem)] p-4')}>
            <p className="srch-label mb-3">
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
          className="srch-chip h-8 gap-1"
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
                <p className="srch-label mb-2">
                  Bedrooms
                </p>
                <div className="flex flex-nowrap gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {BEDS_OPTIONS.map(({ value, label }) => {
                    const id = `filter-beds-${value || 'any'}`
                    return (
                      <Label key={id} htmlFor={id} className="cursor-pointer">
                        <Input
                          type="radio"
                          id={id}
                          name="beds"
                          value={value}
                          defaultChecked={(props.beds ?? '') === value}
                          className="peer sr-only"
                        />
                        <span className="block rounded-none border border-border px-2.5 py-1.5 text-sm font-medium text-foreground peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-primary hover:border-primary/30">
                          {label}
                        </span>
                      </Label>
                    )
                  })}
                </div>
              </div>
              <div>
                <p className="srch-label mb-2">
                  Bathrooms
                </p>
                <div className="flex flex-nowrap gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                  {BATHS_OPTIONS.map(({ value, label }) => {
                    const id = `filter-baths-${value || 'any'}`
                    return (
                      <Label key={id} htmlFor={id} className="cursor-pointer">
                        <Input
                          type="radio"
                          id={id}
                          name="baths"
                          value={value}
                          defaultChecked={(props.baths ?? '') === value}
                          className="peer sr-only"
                        />
                        <span className="block rounded-none border border-border px-2.5 py-1.5 text-sm font-medium text-foreground peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-primary hover:border-primary/30">
                          {label}
                        </span>
                      </Label>
                    )
                  })}
                </div>
              </div>
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending ? 'Applying…' : 'Apply'}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Home Type — class + MLS sub-type (duplex, manufactured on land, …) */}
      <div className="relative shrink-0">
        <Button
          type="button"
          variant={open === 'hometype' || hasHomeTypeActive(props, selectedSubTypes) ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setOpen(open === 'hometype' ? null : 'hometype')}
          className="srch-chip h-8 gap-1"
          aria-expanded={open === 'hometype'}
        >
          {homeTypeLabel}
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-70" aria-hidden />
        </Button>
        {open === 'hometype' && (
          <div className={cn(dropdownAnchor, dropdownSurface, 'w-full max-w-sm p-0')}>
            <HomeTypeFilterPanel
              propertyType={props.propertyType}
              propertySubTypes={selectedSubTypes}
              onChange={({ propertyType, propertySubTypes }) => {
                apply(
                  buildParams({
                    propertyType: propertyType || undefined,
                    propertySubTypes:
                      propertySubTypes && propertySubTypes.length > 0
                        ? propertySubTypes.join(',')
                        : undefined,
                  }),
                )
              }}
            />
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
            setMoreSheetMounted(true)
            setMoreSheetOpen(true)
          }}
          className="srch-chip h-8 gap-1"
          aria-expanded={moreSheetOpen}
          aria-haspopup="dialog"
        >
          {registryActive.length > 0 ? `All filters (${registryActive.length})` : 'All filters'}
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
          <SelectTrigger className="srch-square h-8 w-[min(11rem,46vw)]" aria-label="Sort results">
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
          save; guests get the email-capture path (native buyer lead, audience:buyer).
          Gating on props.signedIn hid the affordance from most visitors. */}
      <SaveSearchButton user={!!props.signedIn} pathContext={props.pathContext} />
        </div>
      </div>

      {/* Active registry filters — removable chips so applied filters stay
          visible. Preset-route filters render first: their remove writes the
          off param instead of deleting (deleting would let the preset
          re-apply on the next request). */}
      {(registryActive.length > 0 || (props.presetChips?.length ?? 0) > 0) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {props.presetChips?.map(({ label, param }) => (
            <RegistryFilterChip
              key={`preset:${param}`}
              label={label}
              onRemove={() => applyRegistryUpdates({ [param]: '0' })}
            />
          ))}
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
          wrong number. Mount only after first open (P6 cold-chunk). */}
      {moreSheetMounted ? (
        <AllFiltersSheet
          open={moreSheetOpen}
          onOpenChange={setMoreSheetOpen}
          onApply={applyRegistryUpdates}
          closedScope={props.statusFilter === 'closed' || props.includeClosed === '1'}
          enableCount={false}
        />
      ) : null}
    </div>
  )
}
