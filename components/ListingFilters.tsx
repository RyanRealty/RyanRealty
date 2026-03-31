'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { PROPERTY_TYPES } from '@/lib/property-type'
import { listingsBrowsePath } from '@/lib/slug'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  const pathname = usePathname()?.split('?')[0] ?? listingsBrowsePath()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function applyFilters(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const params = new URLSearchParams()
    const minPrice = (data.get('minPrice') as string)?.trim()
    const maxPrice = (data.get('maxPrice') as string)?.trim()
    const beds = ((data.get('beds') as string)?.trim() === '__all__' ? '' : (data.get('beds') as string)?.trim())
    const baths = ((data.get('baths') as string)?.trim() === '__all__' ? '' : (data.get('baths') as string)?.trim())
    const minSqFt = (data.get('minSqFt') as string)?.trim()
    const propertyType = ((data.get('propertyType') as string)?.trim() === '__all__' ? '' : (data.get('propertyType') as string)?.trim())
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
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      <Label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Min price</span>
        <Input
          type="number"
          name="minPrice"
          placeholder="Any"
          min={0}
          step={25000}
          defaultValue={initMinPrice}
          className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
        />
      </Label>
      <Label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Max price</span>
        <Input
          type="number"
          name="maxPrice"
          placeholder="Any"
          min={0}
          step={25000}
          defaultValue={initMaxPrice}
          className="w-28 rounded-lg border border-border px-3 py-2 text-sm"
        />
      </Label>
      <Label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Beds (min)</span>
        <Select name="beds" defaultValue={initBeds || '__all__'}>
          <SelectTrigger className="w-20 rounded-lg px-3 py-2 text-sm">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Any</SelectItem>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Baths (min)</span>
        <Select name="baths" defaultValue={initBaths || '__all__'}>
          <SelectTrigger className="w-20 rounded-lg px-3 py-2 text-sm">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Any</SelectItem>
            {[1, 2, 3, 4, 5].map((n) => (
              <SelectItem key={n} value={String(n)}>{n}+</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Min sq ft</span>
        <Input
          type="number"
          name="minSqFt"
          placeholder="Any"
          min={0}
          step={100}
          defaultValue={initMinSqFt}
          className="w-24 rounded-lg border border-border px-3 py-2 text-sm"
        />
      </Label>
      <Label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Property type</span>
        <Select name="propertyType" defaultValue={initPropertyType || 'Residential'}>
          <SelectTrigger className="min-w-[120px] rounded-lg px-3 py-2 text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            {PROPERTY_TYPES.map(({ value, label }) => (
              <SelectItem key={value || '__all__'} value={value || '__all__'}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Sort by</span>
        <Select name="sort" defaultValue={initSort || 'newest'}>
          <SelectTrigger className="min-w-[140px] rounded-lg px-3 py-2 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Label>
      <Label className="flex items-center gap-2 self-end pb-2">
        <Input
          type="checkbox"
          name="includeClosed"
          defaultChecked={initIncludeClosed === '1'}
          className="h-4 w-4 rounded border-border"
        />
        <span className="text-sm text-muted-foreground">Include closed listings</span>
      </Label>
      <Button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-muted-foreground disabled:opacity-70"
      >
        {isPending ? 'Applying…' : 'Apply'}
      </Button>
    </form>
  )
}
