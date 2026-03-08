'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition, useState } from 'react'

const PROPERTY_TYPES = [
  { value: '', label: 'All types' },
  { value: 'Residential', label: 'Residential' },
  { value: 'Commercial', label: 'Commercial' },
  { value: 'Land', label: 'Land' },
  { value: 'Rental', label: 'Rental' },
]

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
    beds,
    baths,
    minSqFt,
    maxSqFt,
    maxBeds,
    maxBaths,
    yearBuiltMin,
    yearBuiltMax,
    lotAcresMin,
    lotAcresMax,
    postalCode,
    propertyType,
    propertySubType,
    statusFilter,
    keywords,
    hasOpenHouse,
    garageMin,
    hasPool,
    hasView,
    hasWaterfront,
    newListingsDays,
    sort,
    includeClosed,
    view: initView,
    perPage: initPerPage,
    basePath,
  } = props
  const router = useRouter()
  const pathname = basePath ?? (usePathname()?.split('?')[0] ?? '/listings')
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [advancedOpen, setAdvancedOpen] = useState(
    !!(yearBuiltMin || yearBuiltMax || lotAcresMin || lotAcresMax || postalCode || propertySubType ||
       statusFilter || keywords || hasOpenHouse || garageMin || hasPool || hasView || hasWaterfront || newListingsDays ||
       maxSqFt || maxBeds || maxBaths)
  )

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
    set('beds', getNum('beds'))
    set('baths', getNum('baths'))
    set('minSqFt', getNum('minSqFt'))
    set('maxSqFt', getNum('maxSqFt'))
    set('maxBeds', getNum('maxBeds'))
    set('maxBaths', getNum('maxBaths'))
    set('yearBuiltMin', getNum('yearBuiltMin'))
    set('yearBuiltMax', getNum('yearBuiltMax'))
    set('lotAcresMin', getNum('lotAcresMin'))
    set('lotAcresMax', getNum('lotAcresMax'))
    set('postalCode', get('postalCode'))
    set('propertyType', get('propertyType'))
    set('propertySubType', get('propertySubType'))
    set('statusFilter', get('statusFilter') || undefined)
    set('keywords', get('keywords'))
    set('garageMin', getNum('garageMin'))
    set('newListingsDays', getNum('newListingsDays'))
    set('sort', get('sort'))
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

  const labelClass = 'text-xs font-medium text-zinc-500'
  const inputClass = 'rounded-lg border border-zinc-200 px-3 py-2 text-sm'

  return (
    <form onSubmit={applyFilters} className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
      {/* Quick filters — always visible */}
      <div className="p-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Min price</span>
          <input type="number" name="minPrice" placeholder="Any" min={0} step={25000} defaultValue={minPrice} className={`w-28 ${inputClass}`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Max price</span>
          <input type="number" name="maxPrice" placeholder="Any" min={0} step={25000} defaultValue={maxPrice} className={`w-28 ${inputClass}`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Beds</span>
          <select name="beds" defaultValue={beds ?? ''} className={`w-20 ${inputClass}`}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <option key={n} value={n}>{n}+</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Baths</span>
          <select name="baths" defaultValue={baths ?? ''} className={`w-20 ${inputClass}`}>
            <option value="">Any</option>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}+</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Sq ft (min)</span>
          <input type="number" name="minSqFt" placeholder="Any" min={0} step={100} defaultValue={minSqFt} className={`w-24 ${inputClass}`} />
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Property type</span>
          <select name="propertyType" defaultValue={propertyType ?? ''} className={`min-w-[120px] ${inputClass}`}>
            {PROPERTY_TYPES.map(({ value, label }) => (
              <option key={value || 'all'} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Status</span>
          <select name="statusFilter" defaultValue={statusFilter ?? (includeClosed === '1' ? 'all' : 'active')} className={`min-w-[160px] ${inputClass}`}>
            {STATUS_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>Sort by</span>
          <select name="sort" defaultValue={sort ?? 'newest'} className={`min-w-[160px] ${inputClass}`}>
            {SORT_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 self-end pb-2">
          <input type="checkbox" name="includeClosed" defaultChecked={includeClosed === '1'} className="h-4 w-4 rounded border-zinc-300" />
          <span className="text-sm text-zinc-600">Include closed</span>
        </label>
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="self-end pb-2 text-sm font-medium text-zinc-600 hover:text-zinc-900"
        >
          {advancedOpen ? 'Fewer filters' : 'More filters'}
        </button>
        <button type="submit" disabled={isPending} className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-70 ml-auto">
          {isPending ? 'Applying…' : 'Apply'}
        </button>
      </div>

      {/* Advanced filters — collapsible */}
      {advancedOpen && (
        <div className="border-t border-zinc-200 bg-zinc-50/60 p-4 flex flex-wrap items-end gap-4">
          <span className="w-full text-xs font-semibold text-zinc-600 uppercase tracking-wider">More filters</span>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Max beds</span>
            <select name="maxBeds" defaultValue={maxBeds ?? ''} className={`w-20 ${inputClass}`}>
              <option value="">Any</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>{n} or fewer</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Max baths</span>
            <select name="maxBaths" defaultValue={maxBaths ?? ''} className={`w-20 ${inputClass}`}>
              <option value="">Any</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} or fewer</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Sq ft (max)</span>
            <input type="number" name="maxSqFt" placeholder="Any" min={0} step={100} defaultValue={maxSqFt} className={`w-24 ${inputClass}`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Year built (min)</span>
            <input type="number" name="yearBuiltMin" placeholder="Any" min={1800} max={2100} step={1} defaultValue={yearBuiltMin} className={`w-24 ${inputClass}`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Year built (max)</span>
            <input type="number" name="yearBuiltMax" placeholder="Any" min={1800} max={2100} step={1} defaultValue={yearBuiltMax} className={`w-24 ${inputClass}`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Lot (acres min)</span>
            <input type="number" name="lotAcresMin" placeholder="Any" min={0} step={0.1} defaultValue={lotAcresMin} className={`w-24 ${inputClass}`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Lot (acres max)</span>
            <input type="number" name="lotAcresMax" placeholder="Any" min={0} step={0.1} defaultValue={lotAcresMax} className={`w-24 ${inputClass}`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Zip code</span>
            <input type="text" name="postalCode" placeholder="e.g. 97702" maxLength={10} defaultValue={postalCode} className={`w-28 ${inputClass}`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Property subtype</span>
            <input type="text" name="propertySubType" placeholder="e.g. Single Family" defaultValue={propertySubType} className={`min-w-[140px] ${inputClass}`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Status</span>
            <select name="statusFilter" defaultValue={statusFilter ?? (includeClosed === '1' ? 'all' : 'active')} className={`min-w-[160px] ${inputClass}`}>
              {STATUS_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
            <span className={labelClass}>Keywords (in description)</span>
            <input type="text" name="keywords" placeholder="e.g. mountain view, granite" defaultValue={keywords} className={`w-full ${inputClass}`} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>New listings</span>
            <select name="newListingsDays" defaultValue={newListingsDays ?? ''} className={`w-32 ${inputClass}`}>
              <option value="">Any</option>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Garage (min spaces)</span>
            <select name="garageMin" defaultValue={garageMin ?? ''} className={`w-24 ${inputClass}`}>
              <option value="">Any</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n}+</option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-6 self-end pb-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="hasOpenHouse" defaultChecked={hasOpenHouse === '1'} className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm text-zinc-600">Open house</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="hasPool" defaultChecked={hasPool === '1'} className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm text-zinc-600">Pool</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="hasView" defaultChecked={hasView === '1'} className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm text-zinc-600">View</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="hasWaterfront" defaultChecked={hasWaterfront === '1'} className="h-4 w-4 rounded border-zinc-300" />
              <span className="text-sm text-zinc-600">Waterfront</span>
            </label>
          </div>
        </div>
      )}
    </form>
  )
}
