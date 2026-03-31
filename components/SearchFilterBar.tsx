'use client'

import React, { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { PROPERTY_TYPES } from '@/lib/property-type'
import SaveSearchButton from '@/components/SaveSearchButton'
import { listingsBrowsePath } from '@/lib/slug'
import { HugeiconsIcon } from '@hugeicons/react'
import { Location01Icon } from '@hugeicons/core-free-icons'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'

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
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpen(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

  const btnBase =
    'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition whitespace-nowrap'
  const btnDefault =
    'border-border bg-card text-foreground hover:bg-card hover:border-primary/20'
  const btnActive =
    'border-accent bg-accent/10 text-primary'
  const dropdownPanel =
    'absolute left-0 top-full z-50 mt-1 min-w-[280px] rounded-lg border border-border bg-card p-4 shadow-lg'

  return (
    <div ref={barRef} className="flex flex-wrap items-center gap-2">
      {/* Location search bar — shows current area and keeps map/search in sync (like reference: "Bend OR" at top) */}
      {props.locationLabel != null && props.locationLabel !== '' && (
        <div className="flex items-center gap-2">
          <Link
            href={props.locationHref ?? pathname}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-card hover:border-primary/30 min-w-[140px]"
            aria-label={`Search area: ${props.locationLabel}. Click to change.`}
          >
            <span className="text-primary" aria-hidden>
              <HugeiconsIcon icon={Location01Icon} className="h-4 w-4" aria-hidden />
            </span>
            <span className="truncate">{props.locationLabel}</span>
          </Link>
          <span className="text-muted-foreground hidden sm:inline" aria-hidden>|</span>
        </div>
      )}
      {/* For Sale (status) */}
      <div className="relative">
        <Button
          type="button"
          onClick={() => setOpen(open === 'status' ? null : 'status')}
          className={`${btnBase} ${open === 'status' || hasStatusActive(props) ? btnActive : btnDefault}`}
          aria-expanded={open === 'status'}
          aria-haspopup="true"
        >
          For Sale
          <span className="text-[10px] opacity-80" aria-hidden>
            {open === 'status' ? 'â–´' : 'â–¾'}
          </span>
        </Button>
        {open === 'status' && (
          <div className={dropdownPanel}>
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
              <Label className="flex cursor-pointer items-center gap-2 pt-2 border-t border-border">
                <Input
                  type="checkbox"
                  name="includeClosed"
                  defaultChecked={props.includeClosed === '1'}
                  className="h-4 w-4 rounded border-border text-accent-foreground focus:ring-accent"
                />
                <span className="text-sm text-muted-foreground">Include closed/sold</span>
              </Label>
              <Button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-accent/90 disabled:opacity-70"
              >
                {isPending ? 'Applying…' : 'Apply'}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Price */}
      <div className="relative">
        <Button
          type="button"
          onClick={() => setOpen(open === 'price' ? null : 'price')}
          className={`${btnBase} ${open === 'price' || hasPriceActive(props) ? btnActive : btnDefault}`}
          aria-expanded={open === 'price'}
        >
          Price
          <span className="text-[10px] opacity-80" aria-hidden>
            {open === 'price' ? 'â–´' : 'â–¾'}
          </span>
        </Button>
        {open === 'price' && (
          <div className={dropdownPanel}>
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
                    className="rounded-lg border border-border px-3 py-2 text-sm"
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
                    className="rounded-lg border border-border px-3 py-2 text-sm"
                  />
                </Label>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRICE_PRESETS.map(({ label, min, max }) => (
                  <Button
                    key={label}
                    type="button"
                    onClick={() => {
                      apply(
                        buildParams({
                          minPrice: min != null ? String(min) : undefined,
                          maxPrice: max != null ? String(max) : undefined,
                        })
                      )
                    }}
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground hover:bg-card"
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <Button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-accent/90 disabled:opacity-70"
              >
                {isPending ? 'Applying…' : 'Apply'}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Beds & Baths */}
      <div className="relative">
        <Button
          type="button"
          onClick={() => setOpen(open === 'bedsbaths' ? null : 'bedsbaths')}
          className={`${btnBase} ${open === 'bedsbaths' || hasBedsBathsActive(props) ? btnActive : btnDefault}`}
          aria-expanded={open === 'bedsbaths'}
        >
          Beds & Baths
          <span className="text-[10px] opacity-80" aria-hidden>
            {open === 'bedsbaths' ? 'â–´' : 'â–¾'}
          </span>
        </Button>
        {open === 'bedsbaths' && (
          <div className={dropdownPanel}>
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
                <div className="flex flex-wrap gap-1">
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
                <div className="flex flex-wrap gap-1">
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
              <Button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-accent/90 disabled:opacity-70"
              >
                {isPending ? 'Applying…' : 'Apply'}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Home Type */}
      <div className="relative">
        <Button
          type="button"
          onClick={() => setOpen(open === 'hometype' ? null : 'hometype')}
          className={`${btnBase} ${open === 'hometype' || hasHomeTypeActive(props) ? btnActive : btnDefault}`}
          aria-expanded={open === 'hometype'}
        >
          Home Type
          <span className="text-[10px] opacity-80" aria-hidden>
            {open === 'hometype' ? 'â–´' : 'â–¾'}
          </span>
        </Button>
        {open === 'hometype' && (
          <div className={dropdownPanel}>
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
                  className="text-xs font-medium text-accent-foreground hover:underline"
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
              <Button
                type="submit"
                disabled={isPending}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-accent/90 disabled:opacity-70"
              >
                {isPending ? 'Applying…' : 'Apply'}
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* More */}
      <div className="relative">
        <Button
          type="button"
          onClick={() => setOpen(open === 'more' ? null : 'more')}
          className={`${btnBase} ${open === 'more' || hasMoreActive(props) ? btnActive : btnDefault}`}
          aria-expanded={open === 'more'}
        >
          More
          <span className="text-[10px] opacity-80" aria-hidden>
            {open === 'more' ? 'â–´' : 'â–¾'}
          </span>
        </Button>
        {open === 'more' && (
          <div className={`${dropdownPanel} min-w-[320px] max-w-[90vw]`}>
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
                  <Select defaultValue={props.garageMin ?? '__all__'} onValueChange={(v) => {
                    const form = (event?.target as HTMLElement)?.closest('form');
                    if (form) {
                      const select = form.querySelector<HTMLInputElement>('input[name="garageMin"]');
                      if (select) select.value = v;
                    }
                  }}>
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
                  <input type="hidden" name="garageMin" defaultValue={props.garageMin ?? '__all__'} />
                </Label>
                <Label className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">New listings</span>
                  <Select defaultValue={props.newListingsDays ?? '__all__'} onValueChange={(v) => {
                    const form = (event?.target as HTMLElement)?.closest('form');
                    if (form) {
                      const select = form.querySelector<HTMLInputElement>('input[name="newListingsDays"]');
                      if (select) select.value = v;
                    }
                  }}>
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
                  <input type="hidden" name="newListingsDays" defaultValue={props.newListingsDays ?? '__all__'} />
                </Label>
              </div>
              <div className="flex flex-wrap gap-4 border-t border-border pt-3">
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
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <Button
                  type="button"
                  onClick={() => apply(new URLSearchParams({ page: '1', ...(props.view && { view: props.view }), ...(props.perPage && { perPage: props.perPage }) }))}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground hover:underline"
                >
                  Reset all filters
                </Button>
                <Button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-accent/90 disabled:opacity-70"
                >
                  {isPending ? 'Applying…' : 'Apply'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Sort */}
      <div className="ml-2">
        <Select
          value={props.sort ?? 'newest'}
          onValueChange={(sort) => {
            apply(buildParams({ sort: sort || undefined }))
          }}
        >
          <SelectTrigger className={`${btnBase} ${btnDefault}`} aria-label="Sort results">
            <SelectValue placeholder="Newest first" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="price_asc">Price: low to high</SelectItem>
            <SelectItem value="price_desc">Price: high to low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {props.signedIn && <SaveSearchButton user={true} />}
    </div>
  )
}
