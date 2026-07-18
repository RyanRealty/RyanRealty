'use client'

/**
 * BpoFilters — URL-searchParams-driven filter bar for the BPO worklist,
 * copying the ProspectFilters idiom (components/admin/prospecting/
 * ProspectFilters.client.tsx): pill <Link>s for binary/enum facets, a GET
 * form for free text, and a client-navigated Select for city (Radix Select
 * has no native form submit, so it drives the URL via router.push). Every
 * control's value is read straight off `filters` (the URL-derived contract).
 *
 * `posture` is a hard binary toggle (Buyer · Seller, no "all" state) —
 * mirrors ProspectFilters' expired/fsbo `kind` toggle exactly. Any filter
 * change drops `?page` implicitly, resetting pagination to page 1.
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
import type { BpoPosture, BpoStatusFilter, BpoWorklistFilters } from '@/lib/data/bpo/reads'

const POSTURE_OPTIONS: { value: BpoPosture; label: string }[] = [
  { value: 'buyer', label: 'Buyer' },
  { value: 'seller', label: 'Seller' },
]

const STATUS_OPTIONS: { value: BpoStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'final', label: 'Final' },
  { value: 'archived', label: 'Archived' },
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
function filtersToParams(filters: BpoWorklistFilters): ParamMap {
  return {
    posture: filters.posture === 'seller' ? 'seller' : 'buyer',
    status: filters.status && filters.status !== 'all' ? filters.status : undefined,
    city: filters.city ?? undefined,
    q: filters.q ?? undefined,
  }
}

export function BpoFilters({
  filters,
  cities,
  basePath,
}: {
  filters: BpoWorklistFilters
  cities: string[]
  basePath: string
}) {
  const router = useRouter()
  const params = filtersToParams(filters)
  const filtersActive = Boolean(params.status || params.city || params.q)

  function setCity(next: string) {
    router.push(buildHref(basePath, { ...params, city: next === ALL_CITIES ? undefined : next }))
  }

  return (
    <div className="space-y-4">
      {/* Posture toggle — Buyer · Seller (offer_strategy.mode), no "all" state. */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">Posture</span>
        <div className="flex gap-1.5">
          {POSTURE_OPTIONS.map((opt) => {
            const active = params.posture === opt.value
            return (
              <Button
                key={opt.value}
                asChild
                size="sm"
                variant={active ? 'default' : 'outline'}
                className="h-9 rounded-full px-4 text-xs"
              >
                <Link href={buildHref(basePath, { ...params, posture: opt.value })} aria-pressed={active}>
                  {opt.label}
                </Link>
              </Button>
            )
          })}
        </div>
      </div>

      {/* Free text — address / subdivision. */}
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
        {/* Preserve the non-form facets (posture/city/status) across this submit. */}
        <Input type="hidden" name="posture" value={params.posture} />
        {params.city ? <Input type="hidden" name="city" value={params.city} /> : null}
        {params.status ? <Input type="hidden" name="status" value={params.status} /> : null}

        <div className="w-full flex-1 sm:min-w-56">
          <Label htmlFor="bpo-q" className="text-xs font-medium text-muted-foreground">
            Address or subdivision
          </Label>
          <Input id="bpo-q" name="q" defaultValue={filters.q ?? ''} placeholder="20889 SE Caldera Dr" />
        </div>
        <Button type="submit" className="h-11 min-h-11">
          Search
        </Button>
        {filtersActive ? (
          <Button asChild variant="outline" className="h-11 min-h-11">
            <Link href={buildHref(basePath, { posture: params.posture })}>Clear all</Link>
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
