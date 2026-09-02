'use client'

/**
 * CmaFilters — URL-searchParams-driven filter bar for the CMA worklist,
 * copying the ProspectFilters idiom (components/admin/prospecting/
 * ProspectFilters.client.tsx): pill <Link>s for the status facet, a search
 * submit for free text, and a client-navigated select for city. Every
 * control's value is read straight off `filters` (the URL-derived contract).
 * Unlike prospecting, there is no kind toggle (Expired/FSBO) — this worklist
 * is seller CMAs only.
 *
 * 11F: on the LOCKED admin v2 language (mirrors the BPO family's BpoFilters,
 * whose docblock this note follows). City keeps its router.push-driven
 * select, now a ToolbarSelect. The free-text field moved off the native
 * `method="get"` form: it relied on `<input type="hidden">` to carry the
 * other facets across the submit, and a raw <input> is banned in a migrated
 * file (ci:admin-ui rule A). It is now a client submit that calls the exact
 * same buildHref(...) with the exact same params — the resulting URL is
 * identical, only the transport (native GET vs. router.push) changed, which
 * this component already does for the City select.
 */

import { useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { Button, TextField, ToolbarSelect } from '@/components/admin/v2'
import type { CmaStatusFilter, CmaWorklistFilters } from './types'

const STATUS_OPTIONS: { value: CmaStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'asked', label: 'Asked, unsent' },
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

/** The current filter set flattened to a param map — the single source both the client submit and the href builders read from. */
function filtersToParams(filters: CmaWorklistFilters): ParamMap {
  return {
    q: filters.q ?? undefined,
    city: filters.city ?? undefined,
    status: filters.status && filters.status !== 'all' ? filters.status : undefined,
  }
}

const facetLabelStyle: CSSProperties = {
  width: 64,
  flexShrink: 0,
  fontSize: 'var(--a-text-xs)',
  fontWeight: 500,
  color: 'var(--a-text-2)',
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
  const qRef = useRef<HTMLInputElement>(null)
  const params = filtersToParams(filters)
  const filtersActive = Boolean(params.q || params.city || params.status)

  function setCity(next: string) {
    router.push(buildHref(basePath, { ...params, city: next === ALL_CITIES ? undefined : next }))
  }

  function submitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    router.push(buildHref(basePath, { ...params, q: qRef.current?.value.trim() || undefined }))
  }

  return (
    <div className="space-y-4">
      {/* Free text — address or client. */}
      <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-2">
        <div className="w-full flex-1 sm:min-w-56">
          <TextField
            ref={qRef}
            label="Address or client"
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="20889 SE Caldera Dr"
          />
        </div>
        <Button type="submit" touch>
          Search
        </Button>
        {filtersActive ? (
          <Link href={basePath} className="av2-btn av2-btn--quiet av2-btn--touch" style={{ textDecoration: 'none' }}>
            Clear all
          </Link>
        ) : null}
      </form>

      {/* City — a client-navigated select drives the URL via router.push. */}
      <div className="flex flex-wrap items-center gap-2">
        <span style={facetLabelStyle}>City</span>
        <ToolbarSelect
          aria-label="City"
          value={params.city ?? ALL_CITIES}
          onChange={(e) => setCity(e.target.value)}
          style={{ width: '100%', maxWidth: 224 }}
        >
          <option value={ALL_CITIES}>All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </ToolbarSelect>
      </div>

      {/* Status — one compact control, same idiom as City (bar rule 2: no chip walls). */}
      <div className="flex flex-wrap items-center gap-2">
        <span style={facetLabelStyle}>Status</span>
        <ToolbarSelect
          aria-label="Status"
          value={filters.status ?? 'all'}
          onChange={(e) =>
            router.push(
              buildHref(basePath, {
                ...params,
                status: e.target.value === 'all' ? undefined : e.target.value,
              }),
            )
          }
          style={{ width: '100%', maxWidth: 224 }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </ToolbarSelect>
      </div>
    </div>
  )
}
