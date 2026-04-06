'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { PROPERTY_TYPES } from '@/lib/property-type'
import SaveSearchButton from '@/components/SaveSearchButton'
import { listingsBrowsePath } from '@/lib/slug'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon, Location01Icon } from '@hugeicons/core-free-icons'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

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

type OpenKey = 'status' | 'price' | 'bedsbaths' | 'hometype' | 'more' | null

export default function SearchFilterBar(props: SearchFilterBarProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const pathname = props.basePath ?? listingsBrowsePath()
  const [open, setOpen] = useState<OpenKey>(null)
  const [garageMinValue, setGarageMinValue] = useState(props.garageMin ?? '__all__')
  const [newListingsDaysValue, setNewListingsDaysValue] = useState(props.newListingsDays ?? '__all__')
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    setGarageMinValue(props.garageMin ?? '__all__')
    setNewListingsDaysValue(props.newListingsDays ?? '__all__')
  }, [props.garageMin, props.newListingsDays])

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

      {/* More */}
      <div className="relative shrink-0">
        <Button
          type="button"
          variant={open === 'more' || hasMoreActive(props) ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setOpen(open === 'more' ? null : 'more')}
          className="gap-1"
          aria-expanded={open === 'more'}
        >
          More
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-3.5 opacity-70" aria-hidden />
        </Button>
        {open === 'more' && (
          <div
            className={cn(
              dropdownAnchor,
              dropdownSurface,
              'w-[min(calc(100vw-1.5rem),24rem)] sm:w-[28rem]'
            )}
          >
            <ScrollArea className="max-h-[min(65vh,28rem)]">
            <div className="p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                const form = e.currentTarget
                const data = new FormData(form)
                const get = (n: string) => { const v = (data.get(n) as string)?.trim(); return (!v || v === '__all__') ? undefined : v }
                const getCheck = (n: string) => form.querySelector<HTMLInputElement>(`input[name="${n}"]`)?.checked
                apply(
                  buildParams({
                    minSqFt: get('minSqFt'),
                    maxSqFt: get('maxSqFt'),
                    maxBeds: get('maxBeds'),
                    maxBaths: get('maxBaths'),
                    yearBuiltMin: get('yearBuiltMin'),
                    yearBuiltMax: get('yearBuiltMax'),
                    lotAcresMin: get('lotAcresMin'),
                    lotAcresMax: get('lotAcresMax'),
                    postalCode: get('postalCode'),
                    keywords: get('keywords'),
                    garageMin: get('garageMin'),
                    newListingsDays: get('newListingsDays'),
                    hasOpenHouse: getCheck('hasOpenHouse') ? '1' : undefined,
                    hasPool: getCheck('hasPool') ? '1' : undefined,
                    hasView: getCheck('hasView') ? '1' : undefined,
                    hasWaterfront: getCheck('hasWaterfront') ? '1' : undefined,
                  })
                )
              }}
              className="space-y-4"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                More filters
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Sq ft (min)</span>
                  <Input
                    type="number"
                    name="minSqFt"
                    placeholder="No min"
                    min={0}
                    step={100}
                    defaultValue={props.minSqFt}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </Label>
                <Label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Sq ft (max)</span>
                  <Input
                    type="number"
                    name="maxSqFt"
                    placeholder="No max"
                    min={0}
                    step={100}
                    defaultValue={props.maxSqFt}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </Label>
                <Label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Lot acres (min)</span>
                  <Input
                    type="number"
                    name="lotAcresMin"
                    placeholder="No min"
                    min={0}
                    step={0.1}
                    defaultValue={props.lotAcresMin}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </Label>
                <Label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Lot acres (max)</span>
                  <Input
                    type="number"
                    name="lotAcresMax"
                    placeholder="No max"
                    min={0}
                    step={0.1}
                    defaultValue={props.lotAcresMax}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </Label>
                <Label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Year built (min)</span>
                  <Input
                    type="number"
                    name="yearBuiltMin"
                    placeholder="No min"
                    min={1800}
                    max={2100}
                    defaultValue={props.yearBuiltMin}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </Label>
                <Label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Year built (max)</span>
                  <Input
                    type="number"
                    name="yearBuiltMax"
                    placeholder="No max"
                    min={1800}
                    max={2100}
                    defaultValue={props.yearBuiltMax}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </Label>
                <Label className="flex flex-col gap-1 col-span-2">
                  <span className="text-xs text-muted-foreground">Zip code</span>
                  <Input
                    type="text"
                    name="postalCode"
                    placeholder="e.g. 97702"
                    maxLength={10}
                    defaultValue={props.postalCode}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </Label>
                <Label className="flex flex-col gap-1 col-span-2">
                  <span className="text-xs text-muted-foreground">Keywords</span>
                  <Input
                    type="text"
                    name="keywords"
                    placeholder="e.g. mountain view, granite"
                    defaultValue={props.keywords}
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </Label>
              </div>
              <div className="space-y-2">
                <Label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Garage (min)</span>
                  <Select value={garageMinValue} onValueChange={setGarageMinValue}>
                    <SelectTrigger className="rounded-lg border border-border px-3 py-2 text-sm">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Any</SelectItem>
                      {[1, 2, 3, 4].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="garageMin" value={garageMinValue} readOnly />
                </Label>
                <Label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">New listings</span>
                  <Select value={newListingsDaysValue} onValueChange={setNewListingsDaysValue}>
                    <SelectTrigger className="rounded-lg border border-border px-3 py-2 text-sm">
                      <SelectValue placeholder="Any" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Any</SelectItem>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="14">Last 14 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                  <input type="hidden" name="newListingsDays" value={newListingsDaysValue} readOnly />
                </Label>
              </div>
              <Separator />
              <div className="flex flex-wrap gap-4">
                <Label className="flex cursor-pointer items-center gap-2">
                  <Input
                    type="checkbox"
                    name="hasOpenHouse"
                    defaultChecked={props.hasOpenHouse === '1'}
                    className="h-4 w-4 rounded border-border text-accent-foreground"
                  />
                  <span className="text-sm text-muted-foreground">Open house</span>
                </Label>
                <Label className="flex cursor-pointer items-center gap-2">
                  <Input
                    type="checkbox"
                    name="hasPool"
                    defaultChecked={props.hasPool === '1'}
                    className="h-4 w-4 rounded border-border text-accent-foreground"
                  />
                  <span className="text-sm text-muted-foreground">Pool</span>
                </Label>
                <Label className="flex cursor-pointer items-center gap-2">
                  <Input
                    type="checkbox"
                    name="hasView"
                    defaultChecked={props.hasView === '1'}
                    className="h-4 w-4 rounded border-border text-accent-foreground"
                  />
                  <span className="text-sm text-muted-foreground">View</span>
                </Label>
                <Label className="flex cursor-pointer items-center gap-2">
                  <Input
                    type="checkbox"
                    name="hasWaterfront"
                    defaultChecked={props.hasWaterfront === '1'}
                    className="h-4 w-4 rounded border-border text-accent-foreground"
                  />
                  <span className="text-sm text-muted-foreground">Waterfront</span>
                </Label>
              </div>
              <Separator />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-center sm:w-auto"
                  onClick={() =>
                    apply(
                      new URLSearchParams({
                        page: '1',
                        ...(props.view ? { view: props.view } : {}),
                        ...(props.perPage ? { perPage: props.perPage } : {}),
                      })
                    )
                  }
                >
                  Reset all filters
                </Button>
                <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                  {isPending ? 'Applying…' : 'Apply'}
                </Button>
              </div>
            </form>
            </div>
            </ScrollArea>
          </div>
        )}
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

      {props.signedIn && <SaveSearchButton user={true} />}
        </div>
      </div>
    </div>
  )
}
