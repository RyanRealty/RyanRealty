'use client'

/**
 * CmaFilters — URL-searchParams-driven filter bar for the CMA worklist,
 * copying the ProspectFilters idiom (components/admin/prospecting/
 * ProspectFilters.client.tsx): pill <Link>s for the status facet, a GET form
 * for free text, and a client-navigated Select for city (Radix Select has no
 * native form submit, so it drives the same URL via router.push). Every
 * control's value is read straight off `filters` (the URL-derived contract).
 * Unlike prospecting, there is no kind toggle (Expired/FSBO) — this worklist
 * is seller CMAs only.
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
import type { CmaStatusFilter, CmaWorklistFilters } from './types'

const STATUS_OPTIONS: { value: CmaStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'finalized', label: 'Finalized' },
  { value: 'delivered', label: 'Delivered' },
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
function filtersToParams(filters: CmaWorklistFilters): ParamMap {
  return {
    q: filters.q ?? undefined,
    city: filters.city ?? undefined,
    status: filters.status && filters.status !== 'all' ? filters.status : undefined,
  }
}

export function CmaFilters({
  filters,
  cities,
  basePath,
}: {
  filters: CmaWorklistFilters
  cities: string[]
  basePath: string
}) {
  const router = useRouter()
  const params = filtersToParams(filters)
  const filtersActive = Boolean(params.q || params.city || params.status)

  function setCity(next: string) {
    router.push(buildHref(basePath, { ...params, city: next === ALL_CITIES ? undefined : next }))
  }

  return (
    <div className="space-y-4">
      {/* Free text — one GET form. */}
      <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
        {/* Preserve the non-form facets (city/status) across this submit. */}
        {params.city ? <Input type="hidden" name="city" value={params.city} /> : null}
        {params.status ? <Input type="hidden" name="status" value={params.status} /> : null}

        <div className="w-full flex-1 sm:min-w-56">
          <Label htmlFor="cma-q" className="text-xs font-medium text-muted-foreground">
            Address or client
          </Label>
          <Input id="cma-q" name="q" defaultValue={filters.q ?? ''} placeholder="20889 SE Caldera Dr" />
        </div>
        <Button type="submit" className="h-11 min-h-11">
          Search
        </Button>
        {filtersActive ? (
          <Button asChild variant="outline" className="h-11 min-h-11">
            <Link href={basePath}>Clear all</Link>
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
