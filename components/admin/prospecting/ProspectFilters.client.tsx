'use client'

/**
 * ProspectFilters — URL-searchParams-driven filter bar for the prospecting
 * worklist (spec 07 §2/§8), copying the `/admin/cmas` idiom: pill <Link>s for
 * binary/enum facets, a GET form for free text + numeric/date ranges, and a
 * client-navigated Select for city (Radix Select has no native form submit,
 * so it drives the same URL via router.push). Every control's value is read
 * straight off `filters` (the URL-derived contract) — no local state that
 * isn't already in the URL. Any filter change drops `?page` implicitly
 * (never carried forward by buildHref), resetting pagination to page 1.
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ProspectKind, ProspectListFilters, ProspectStatusFilter } from '@/lib/data/prospecting/types'

const KIND_OPTIONS: { value: ProspectKind; label: string }[] = [
  { value: 'expired', label: 'Expired' },
  { value: 'fsbo', label: 'FSBO' },
]

const STATUS_OPTIONS: { value: ProspectStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'sendable', label: 'Ready to send' },
  { value: 'needs-audit', label: 'Needs audit' },
  { value: 'sent', label: 'Sent' },
  { value: 'excluded', label: 'Excluded' },
  { value: 'no-phone', label: 'No phone' },
]

const ALL_CITIES = '__all__'

type ParamMap = Record<string, string | undefined>

/** Build "<basePath>?k=v&...", dropping empty values and (deliberately) `page`. */
function buildHref(basePath: string, params: ParamMap): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) usp.set(k, v)
  }
  const qs = usp.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

/** The current filter set flattened to a param map — the single source both the hidden inputs and the href builders read from. */
function filtersToParams(filters: ProspectListFilters): ParamMap {
  return {
    kind: filters.kind,
    q: filters.q ?? undefined,
    city: filters.city ?? undefined,
    status: filters.status && filters.status !== 'all' ? filters.status : undefined,
    minPrice: filters.minPrice != null ? String(filters.minPrice) : undefined,
    maxPrice: filters.maxPrice != null ? String(filters.maxPrice) : undefined,
    dateAfter: filters.dateAfter ?? undefined,
    dateBefore: filters.dateBefore ?? undefined,
  }
}

export function ProspectFilters({
  filters,
  cities,
  basePath,
}: {
  filters: ProspectListFilters
  cities: string[]
  basePath: string
}) {
  const router = useRouter()
  const params = filtersToParams(filters)
  const filtersActive = Boolean(
    params.q || params.city || params.status || params.minPrice || params.maxPrice || params.dateAfter || params.dateBefore,
  )
  // A stale/out-of-range `?city=` (not present in the current `cities` list)
  // still needs its own SelectItem so the Select shows the real active value
  // instead of silently falling back to the "All cities" placeholder.
  const activeCityMissing = Boolean(params.city) && !cities.includes(params.city as string)

  function setCity(next: string) {
    router.push(buildHref(basePath, { ...params, city: next === ALL_CITIES ? undefined : next }))
  }

  return (
    <div className="space-y-4">
      {/* Type toggle — Expired · FSBO */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">Source</span>
        <div className="flex gap-1.5">
          {KIND_OPTIONS.map((opt) => {
            const active = filters.kind === opt.value
            return (
              <Button
                key={opt.value}
                asChild
                size="sm"
                variant={active ? 'default' : 'outline'}
                className="h-9 rounded-full px-4 text-xs"
              >
                <Link href={buildHref(basePath, { ...params, kind: opt.value })} aria-pressed={active}>
                  {opt.label}
                </Link>
              </Button>
            )
          })}
        </div>
      </div>

      {/* Free text + price + date range — one GET form so they submit together. */}
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
        {/* Preserve the non-form facets (kind/city/status) across this submit. */}
        <Input type="hidden" name="kind" value={filters.kind} />
        {params.city ? <Input type="hidden" name="city" value={params.city} /> : null}
        {params.status ? <Input type="hidden" name="status" value={params.status} /> : null}

        <div className="w-full flex-1 sm:min-w-56">
          <Label htmlFor="prospect-q" className="text-xs font-medium text-muted-foreground">
            Address or owner
          </Label>
          <Input id="prospect-q" name="q" defaultValue={filters.q ?? ''} placeholder="20889 SE Caldera Dr" />
        </div>
        <div className="w-24">
          <Label htmlFor="prospect-min-price" className="text-xs font-medium text-muted-foreground">
            Min price
          </Label>
          <Input
            id="prospect-min-price"
            name="minPrice"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={params.minPrice ?? ''}
            placeholder="$0"
          />
        </div>
        <div className="w-24">
          <Label htmlFor="prospect-max-price" className="text-xs font-medium text-muted-foreground">
            Max price
          </Label>
          <Input
            id="prospect-max-price"
            name="maxPrice"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={params.maxPrice ?? ''}
            placeholder="Any"
          />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="prospect-date-after" className="text-xs font-medium text-muted-foreground">
            From
          </Label>
          <Input id="prospect-date-after" name="dateAfter" type="date" defaultValue={params.dateAfter ?? ''} />
        </div>
        <div className="w-full sm:w-40">
          <Label htmlFor="prospect-date-before" className="text-xs font-medium text-muted-foreground">
            To
          </Label>
          <Input id="prospect-date-before" name="dateBefore" type="date" defaultValue={params.dateBefore ?? ''} />
        </div>
        <Button type="submit" className="h-11 min-h-11">
          Search
        </Button>
        {filtersActive ? (
          <Button asChild variant="outline" className="h-11 min-h-11">
            <Link href={buildHref(basePath, { kind: filters.kind })}>Clear all</Link>
          </Button>
        ) : null}
      </form>

      {/* City — Radix Select has no native form submit; drive the URL via router.push. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">City</span>
        <Select value={params.city ?? ALL_CITIES} onValueChange={setCity}>
          <SelectTrigger className="h-9 w-full sm:w-56" aria-label="City">
            <SelectValue placeholder="All cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CITIES}>All cities</SelectItem>
            {/* An applied ?city= filter that fell out of the current `cities`
                list (e.g. a city with zero matching rows for the other active
                filters) still needs a matching SelectItem — otherwise Radix
                can't resolve `value` to a label and silently falls back to
                the "All cities" placeholder while the filter stays active. */}
            {activeCityMissing ? <SelectItem value={params.city as string}>{params.city}</SelectItem> : null}
            {cities.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status pills. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">Status</span>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => {
            const active = (filters.status ?? 'all') === opt.value
            const nextParams = { ...params, status: opt.value === 'all' ? undefined : opt.value }
            return (
              <Button
                key={opt.value}
                asChild
                size="sm"
                variant={active ? 'default' : 'outline'}
                className="h-8 rounded-full px-3 text-xs"
              >
                <Link href={buildHref(basePath, nextParams)} aria-pressed={active}>
                  {opt.label}
                </Link>
              </Button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
