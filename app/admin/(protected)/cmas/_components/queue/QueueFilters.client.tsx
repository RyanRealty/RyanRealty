'use client'

/**
 * Compact CMA queue toolbar. One search + selects, no chip walls
 * (ADMIN_UI surface bar: a filter set is a dropdown, never rows of pills).
 */

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'
import { SearchField, ToolbarSelect } from '@/components/admin/v2'
import type { CmaOrigin } from '@/lib/cma/origin'
import {
  CMA_QUEUE_DEFAULT_STATE,
  cmaQueueHref,
  type CmaCreatedWindow,
  type CmaQueueSort,
  type CmaQueueViewFilters,
  type CmaQueueViewState,
  type CmaRecBand,
} from '@/lib/cma/queue-view'

type Option = { value: string; label: string; count?: number }

export function QueueFilters({
  filters,
  cities,
  stateOptions,
  originOptions,
}: {
  filters: CmaQueueViewFilters
  cities: string[]
  stateOptions: Option[]
  originOptions: Option[]
}) {
  const router = useRouter()

  const go = useCallback(
    (patch: Partial<CmaQueueViewFilters>) => {
      router.push(cmaQueueHref({ ...filters, ...patch }))
    },
    [filters, router],
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const fd = new FormData(e.currentTarget)
          go({ q: String(fd.get('q') ?? '').trim() || undefined })
        }}
      >
        <SearchField
          aria-label="Address, city, or client"
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="Address or client"
          style={{ width: '100%', maxWidth: 'none' }}
        />
      </form>

      <div className="av2-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <ToolbarSelect
          aria-label="Status"
          value={filters.state ?? CMA_QUEUE_DEFAULT_STATE}
          onChange={(e) => go({ state: e.target.value as CmaQueueViewState | 'all' | 'work' })}
        >
        <option value="work">Needs action</option>
        <option value="all">All CMAs</option>
        {stateOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.count == null ? '' : ` (${o.count})`}
          </option>
        ))}
      </ToolbarSelect>

      <ToolbarSelect
        aria-label="Origin"
        value={filters.origin ?? 'all'}
        onChange={(e) => go({ origin: e.target.value as CmaOrigin | 'all' })}
      >
        <option value="all">Every origin</option>
        {originOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.count == null ? '' : ` (${o.count})`}
          </option>
        ))}
      </ToolbarSelect>

      <ToolbarSelect
        aria-label="City"
        value={filters.city ?? ''}
        onChange={(e) => go({ city: e.target.value || undefined })}
      >
        <option value="">All cities</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </ToolbarSelect>

      <ToolbarSelect
        aria-label="Date created"
        value={filters.created ?? 'all'}
        onChange={(e) => go({ created: e.target.value as CmaCreatedWindow })}
      >
        <option value="all">Any date</option>
        <option value="7d">Last 7 days</option>
        <option value="30d">Last 30 days</option>
        <option value="90d">Last 90 days</option>
      </ToolbarSelect>

      <ToolbarSelect
        aria-label="Recommended price"
        value={filters.rec ?? 'all'}
        onChange={(e) => go({ rec: e.target.value as CmaRecBand })}
      >
        <option value="all">Any price</option>
        <option value="lt400">Under $400k</option>
        <option value="400-600">$400k-$600k</option>
        <option value="600-800">$600k-$800k</option>
        <option value="800-1m">$800k-$1M</option>
        <option value="gt1m">$1M+</option>
      </ToolbarSelect>

      <ToolbarSelect
        aria-label="Sort"
        value={filters.sort ?? 'work'}
        onChange={(e) => go({ sort: e.target.value as CmaQueueSort })}
      >
        <option value="work">Work first</option>
        <option value="newest">Newest</option>
        <option value="price-desc">Price high-low</option>
        <option value="price-asc">Price low-high</option>
        <option value="city">City</option>
      </ToolbarSelect>
      </div>
    </div>
  )
}
