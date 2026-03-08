'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

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
]

type Props = {
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
  minSqFt?: string
  propertyType?: string
  sort?: string
  /** Include closed listings (URL param includeClosed=1) */
  includeClosed?: string
  page?: string
  /** Columns: '1'–'4' */
  view?: string
  /** Per page: '6' | '12' | '24' | '48' */
  perPage?: string
}

export default function ListingFilters({
  minPrice: initMinPrice,
  maxPrice: initMaxPrice,
  beds: initBeds,
  baths: initBaths,
  minSqFt: initMinSqFt,
  propertyType: initPropertyType,
  sort: initSort,
  includeClosed: initIncludeClosed,
  page: _initPage,
  view: initView,
  perPage: initPerPage,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()?.split('?')[0] ?? '/listings'
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function applyFilters(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const params = new URLSearchParams()
    const minPrice = (data.get('minPrice') as string)?.trim()
    const maxPrice = (data.get('maxPrice') as string)?.trim()
    const beds = (data.get('beds') as string)?.trim()
    const baths = (data.get('baths') as string)?.trim()
    const minSqFt = (data.get('minSqFt') as string)?.trim()
    const propertyType = (data.get('propertyType') as string)?.trim()
    const sort = (data.get('sort') as string)?.trim()
    const includeClosed = form.querySelector<HTMLInputElement>('input[name="includeClosed"]')?.checked
    if (minPrice) params.set('minPrice', minPrice)
    if (maxPrice) params.set('maxPrice', maxPrice)
    if (beds) params.set('beds', beds)
    if (baths) params.set('baths', baths)
    if (minSqFt) params.set('minSqFt', minSqFt)
    if (propertyType !== undefined && propertyType !== null) params.set('propertyType', propertyType)
    if (sort) params.set('sort', sort)
    if (includeClosed) params.set('includeClosed', '1')
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

  return (
    <form
      onSubmit={applyFilters}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500">Min price</span>
        <input
          type="number"
          name="minPrice"
          placeholder="Any"
          min={0}
          step={25000}
          defaultValue={initMinPrice}
          className="w-28 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500">Max price</span>
        <input
          type="number"
          name="maxPrice"
          placeholder="Any"
          min={0}
          step={25000}
          defaultValue={initMaxPrice}
          className="w-28 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500">Beds (min)</span>
        <select
          name="beds"
          defaultValue={initBeds ?? ''}
          className="w-20 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">Any</option>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>{n}+</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500">Baths (min)</span>
        <select
          name="baths"
          defaultValue={initBaths ?? ''}
          className="w-20 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          <option value="">Any</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{n}+</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500">Min sq ft</span>
        <input
          type="number"
          name="minSqFt"
          placeholder="Any"
          min={0}
          step={100}
          defaultValue={initMinSqFt}
          className="w-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500">Property type</span>
        <select
          name="propertyType"
          defaultValue={initPropertyType ?? 'Residential'}
          className="min-w-[120px] rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          {PROPERTY_TYPES.map(({ value, label }) => (
            <option key={value || 'all'} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-zinc-500">Sort by</span>
        <select
          name="sort"
          defaultValue={initSort ?? 'newest'}
          className="min-w-[140px] rounded-lg border border-zinc-200 px-3 py-2 text-sm"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-2 self-end pb-2">
        <input
          type="checkbox"
          name="includeClosed"
          defaultChecked={initIncludeClosed === '1'}
          className="h-4 w-4 rounded border-zinc-300"
        />
        <span className="text-sm text-zinc-600">Include closed listings</span>
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-70"
      >
        {isPending ? 'Applying…' : 'Apply'}
      </button>
    </form>
  )
}
