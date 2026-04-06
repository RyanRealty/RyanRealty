'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition, useState } from 'react'
import { PROPERTY_TYPES } from '@/lib/property-type'
import { listingsBrowsePath } from '@/lib/slug'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'price_per_sqft_asc', label: 'Price/sq ft: low to high' },
  { value: 'price_per_sqft_desc', label: 'Price/sq ft: high to low' },
  { value: 'year_newest', label: 'Year built: newest' },
  { value: 'year_oldest', label: 'Year built: oldest' },
]

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active only' },
  { value: 'active_and_pending', label: 'Active + under contract' },
  { value: 'pending', label: 'Under contract only' },
  { value: 'closed', label: 'Closed/sold' },
  { value: 'all', label: 'All statuses' },
]

export type AdvancedSearchFiltersProps = {
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
  propertySubType?: string
  statusFilter?: string
  keywords?: string
  hasOpenHouse?: string
  garageMin?: string
  hasPool?: string
  hasView?: string
  hasWaterfront?: string
  newListingsDays?: string
  sort?: string
  includeClosed?: string
  page?: string
  view?: string
  perPage?: string
  /** Base path (e.g. /listings or /search/bend) */
  basePath?: string
}

export default function AdvancedSearchFilters(props: AdvancedSearchFiltersProps) {
  const {
    minPrice,
    maxPrice,
    beds: initBeds,
    baths: initBaths,
    minSqFt,
    maxSqFt,
    maxBeds: initMaxBeds,
    maxBaths: initMaxBaths,
    yearBuiltMin,
    yearBuiltMax,
    lotAcresMin,
    lotAcresMax,
    postalCode,
    propertyType: initPropertyType,
    propertySubType,
    statusFilter: initStatusFilter,
    keywords,
    hasOpenHouse,
    garageMin: initGarageMin,
    hasPool,
    hasView,
    hasWaterfront,
    newListingsDays: initNewListingsDays,
    sort: initSort,
    includeClosed,
    view: initView,
    perPage: initPerPage,
    basePath,
  } = props
  const router = useRouter()
  const rawPathname = usePathname()
  const pathname = basePath ?? (rawPathname?.split('?')[0] ?? listingsBrowsePath())
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [advancedOpen, setAdvancedOpen] = useState(
    !!(yearBuiltMin || yearBuiltMax || lotAcresMin || lotAcresMax || postalCode || propertySubType ||
       initStatusFilter || keywords || hasOpenHouse || initGarageMin || hasPool || hasView || hasWaterfront || initNewListingsDays ||
       maxSqFt || initMaxBeds || initMaxBaths)
  )

  // Controlled state for all select elements
  const [beds, setBeds] = useState(initBeds ?? '')
  const [baths, setBaths] = useState(initBaths ?? '')
  const [propertyType, setPropertyType] = useState(initPropertyType ?? '')
  const [statusFilter, setStatusFilter] = useState(initStatusFilter ?? (includeClosed === '1' ? 'all' : 'active'))
  const [sort, setSort] = useState(initSort ?? 'newest')
  const [maxBeds, setMaxBeds] = useState(initMaxBeds ?? '')
  const [maxBaths, setMaxBaths] = useState(initMaxBaths ?? '')
  const [newListingsDays, setNewListingsDays] = useState(initNewListingsDays ?? '')
  const [garageMin, setGarageMin] = useState(initGarageMin ?? '')

  function applyFilters(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const params = new URLSearchParams()

    const set = (key: string, value: string | undefined) => {
      if (value != null && String(value).trim() !== '') params.set(key, String(value).trim())
    }
    const get = (name: string) => (data.get(name) as string)?.trim()
    const getNum = (name: string) => {
      const v = get(name)
      return v !== '' ? v : undefined
    }
    const getCheck = (name: string) => form.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.checked

    set('minPrice', getNum('minPrice'))
    set('maxPrice', getNum('maxPrice'))
    set('beds', beds || undefined)
    set('baths', baths || undefined)
    set('minSqFt', getNum('minSqFt'))
    set('maxSqFt', getNum('maxSqFt'))
    set('maxBeds', maxBeds || undefined)
    set('maxBaths', maxBaths || undefined)
    set('yearBuiltMin', getNum('yearBuiltMin'))
    set('yearBuiltMax', getNum('yearBuiltMax'))
    set('lotAcresMin', getNum('lotAcresMin'))
    set('lotAcresMax', getNum('lotAcresMax'))
    set('postalCode', get('postalCode'))
    set('propertyType', propertyType || undefined)
    set('propertySubType', get('propertySubType'))
    set('statusFilter', statusFilter || undefined)
    set('keywords', get('keywords'))
    set('garageMin', garageMin || undefined)
    set('newListingsDays', newListingsDays || undefined)
    set('sort', sort)
    if (getCheck('hasOpenHouse')) params.set('hasOpenHouse', '1')
    if (getCheck('hasPool')) params.set('hasPool', '1')
    if (getCheck('hasView')) params.set('hasView', '1')
    if (getCheck('hasWaterfront')) params.set('hasWaterfront', '1')
    if (getCheck('includeClosed')) params.set('includeClosed', '1')
    const view = initView ?? searchParams.get('view')
    if (view) params.set('view', view)
    const perPage = initPerPage ?? searchParams.get('perPage')
    if (perPage) params.set('perPage', perPage)
    params.set('page', '1')

    const q = params.toString()
    startTransition(() => {
      router.push(q ? `${pathname}?${q}` : pathname)
    })
  }

  const labelClass = 'text-xs font-medium text-muted-foreground'

  return (
    <form onSubmit={applyFilters} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
        <Label className="flex min-w-0 flex-col gap-1">
          <span className={labelClass}>Min price</span>
          <Input type="number" name="minPrice" placeholder="Any" min={0} step={25000} defaultValue={minPrice} className="min-w-0" />
        </Label>
        <Label className="flex min-w-0 flex-col gap-1">
          <span className={labelClass}>Max price</span>
          <Input type="number" name="maxPrice" placeholder="Any" min={0} step={25000} defaultValue={maxPrice} className="min-w-0" />
        </Label>
        {/* 1. Beds */}
        <div className="flex min-w-0 flex-col gap-1">
          <span className={labelClass}>Beds</span>
          <Select value={beds || '__all__'} onValueChange={(v) => setBeds(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any</SelectItem>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* 2. Baths */}
        <div className="flex min-w-0 flex-col gap-1">
          <span className={labelClass}>Baths</span>
          <Select value={baths || '__all__'} onValueChange={(v) => setBaths(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Any</SelectItem>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Label className="flex min-w-0 flex-col gap-1">
          <span className={labelClass}>Sq ft (min)</span>
          <Input type="number" name="minSqFt" placeholder="Any" min={0} step={100} defaultValue={minSqFt} className="min-w-0" />
        </Label>
        {/* 3. Property type */}
        <div className="col-span-2 flex min-w-0 flex-col gap-1 sm:col-span-1">
          <span className={labelClass}>Property type</span>
          <Select value={propertyType || '__all__'} onValueChange={(v) => setPropertyType(v === '__all__' ? '' : v)}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map(({ value, label }) => (
                <SelectItem key={value || '__all__'} value={value || '__all__'}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* 4. Status (quick filters) */}
        <div className="col-span-2 flex min-w-0 flex-col gap-1 md:col-span-1">
          <span className={labelClass}>Status</span>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Active only" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* 5. Sort by */}
        <div className="col-span-2 flex min-w-0 flex-col gap-1 xl:col-span-1">
          <span className={labelClass}>Sort by</span>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder="Newest first" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <Label className="flex cursor-pointer items-center gap-2">
            <Input
              type="checkbox"
              name="includeClosed"
              defaultChecked={includeClosed === '1'}
              className="size-4 rounded border-input"
            />
            <span className="text-sm text-muted-foreground">Include closed</span>
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdvancedOpen((o) => !o)}>
              {advancedOpen ? 'Fewer filters' : 'More filters'}
            </Button>
            <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
              {isPending ? 'Applying\u2026' : 'Apply'}
            </Button>
          </div>
        </div>
      </div>

      {advancedOpen && (
        <>
          <Separator />
          <div className="space-y-4 bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">More filters</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          <div className="flex min-w-0 flex-col gap-1">
            <span className={labelClass}>Max beds</span>
            <Select value={maxBeds || '__all__'} onValueChange={(v) => setMaxBeds(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Any</SelectItem>
                {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} or fewer</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className={labelClass}>Max baths</span>
            <Select value={maxBaths || '__all__'} onValueChange={(v) => setMaxBaths(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Any</SelectItem>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n} or fewer</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Label className="flex min-w-0 flex-col gap-1">
            <span className={labelClass}>Sq ft (max)</span>
            <Input type="number" name="maxSqFt" placeholder="Any" min={0} step={100} defaultValue={maxSqFt} className="min-w-0" />
          </Label>
          <Label className="flex min-w-0 flex-col gap-1">
            <span className={labelClass}>Year built (min)</span>
            <Input type="number" name="yearBuiltMin" placeholder="Any" min={1800} max={2100} step={1} defaultValue={yearBuiltMin} className="min-w-0" />
          </Label>
          <Label className="flex min-w-0 flex-col gap-1">
            <span className={labelClass}>Year built (max)</span>
            <Input type="number" name="yearBuiltMax" placeholder="Any" min={1800} max={2100} step={1} defaultValue={yearBuiltMax} className="min-w-0" />
          </Label>
          <Label className="flex min-w-0 flex-col gap-1">
            <span className={labelClass}>Lot (acres min)</span>
            <Input type="number" name="lotAcresMin" placeholder="Any" min={0} step={0.1} defaultValue={lotAcresMin} className="min-w-0" />
          </Label>
          <Label className="flex min-w-0 flex-col gap-1">
            <span className={labelClass}>Lot (acres max)</span>
            <Input type="number" name="lotAcresMax" placeholder="Any" min={0} step={0.1} defaultValue={lotAcresMax} className="min-w-0" />
          </Label>
          <Label className="flex min-w-0 flex-col gap-1">
            <span className={labelClass}>Zip code</span>
            <Input type="text" name="postalCode" placeholder="e.g. 97702" maxLength={10} defaultValue={postalCode} className="min-w-0" />
          </Label>
          <Label className="col-span-2 flex min-w-0 flex-col gap-1 md:col-span-1">
            <span className={labelClass}>Property subtype</span>
            <Input type="text" name="propertySubType" placeholder="e.g. Single Family" defaultValue={propertySubType} className="min-w-0" />
          </Label>
          <div className="flex min-w-0 flex-col gap-1">
            <span className={labelClass}>New listings</span>
            <Select value={newListingsDays || '__all__'} onValueChange={(v) => setNewListingsDays(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Any</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="14">Last 14 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className={labelClass}>Garage (min spaces)</span>
            <Select value={garageMin || '__all__'} onValueChange={(v) => setGarageMin(v === '__all__' ? '' : v)}>
              <SelectTrigger className="w-full min-w-0">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Any</SelectItem>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-3">
            <Label className="flex cursor-pointer items-center gap-2">
              <Input type="checkbox" name="hasOpenHouse" defaultChecked={hasOpenHouse === '1'} className="size-4 rounded border-input" />
              <span className="text-sm text-muted-foreground">Open house</span>
            </Label>
            <Label className="flex cursor-pointer items-center gap-2">
              <Input type="checkbox" name="hasPool" defaultChecked={hasPool === '1'} className="size-4 rounded border-input" />
              <span className="text-sm text-muted-foreground">Pool</span>
            </Label>
            <Label className="flex cursor-pointer items-center gap-2">
              <Input type="checkbox" name="hasView" defaultChecked={hasView === '1'} className="size-4 rounded border-input" />
              <span className="text-sm text-muted-foreground">View</span>
            </Label>
            <Label className="flex cursor-pointer items-center gap-2">
              <Input type="checkbox" name="hasWaterfront" defaultChecked={hasWaterfront === '1'} className="size-4 rounded border-input" />
              <span className="text-sm text-muted-foreground">Waterfront</span>
            </Label>
          </div>
        </div>
        </>
      )}
    </form>
  )
}
