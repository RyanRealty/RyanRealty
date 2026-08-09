'use client'

/**
 * BpoFilters — URL-searchParams-driven filter bar for the BPO worklist,
 * copying the ProspectFilters idiom (components/admin/prospecting/
 * ProspectFilters.client.tsx): pill <Link>s for binary/enum facets and a
 * client-navigated select for city. Every control's value is read straight
 * off `filters` (the URL-derived contract).
 *
 * `posture` is a hard binary toggle (Buyer · Seller, no "all" state) —
 * mirrors ProspectFilters' expired/fsbo `kind` toggle exactly. Any filter
 * change drops `?page` implicitly, resetting pagination to page 1.
 *
 * 11F: on the LOCKED admin v2 language. Posture/status pills keep their real
 * <Link> navigation (av2-chip classes applied directly, same idiom as the
 * entity Links in app/admin/(protected)/prospecting/page.tsx) — no behavior
 * change. City keeps its router.push-driven select, now a ToolbarSelect.
 * The free-text field moved off the native `method="get"` form: it relied on
 * `<input type="hidden">` to carry the other facets across the submit, and a
 * raw <input> is banned in a migrated file (ci:admin-ui rule A, baseline 0
 * here). It is now a client submit that calls the exact same buildHref(...)
 * with the exact same params — the resulting URL is identical, only the
 * transport (native GET vs. router.push) changed, which this component
 * already does for the City select.
 */

import { useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { CSSProperties } from 'react'
import { Button, TextField, ToolbarSelect } from '@/components/admin/v2'
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

const facetLabelStyle: CSSProperties = {
  width: 64,
  flexShrink: 0,
  fontSize: 'var(--a-text-xs)',
  fontWeight: 500,
  color: 'var(--a-text-2)',
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
  const qRef = useRef<HTMLInputElement>(null)
  const params = filtersToParams(filters)
  const filtersActive = Boolean(params.status || params.city || params.q)

  function setCity(next: string) {
    router.push(buildHref(basePath, { ...params, city: next === ALL_CITIES ? undefined : next }))
  }

  function submitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    router.push(buildHref(basePath, { ...params, q: qRef.current?.value.trim() || undefined }))
  }

  return (
    <div className="space-y-4">
      {/* Posture toggle — Buyer · Seller (offer_strategy.mode), no "all" state. */}
      <div className="flex flex-wrap items-center gap-2">
        <span style={facetLabelStyle}>Posture</span>
        <div className="flex gap-1.5">
          {POSTURE_OPTIONS.map((opt) => {
            const active = params.posture === opt.value
            return (
              <Link
                key={opt.value}
                href={buildHref(basePath, { ...params, posture: opt.value })}
                className="av2-chip"
                aria-pressed={active}
              >
                {opt.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Free text — address / subdivision. */}
      <form onSubmit={submitSearch} className="flex flex-wrap items-end gap-2">
        <div className="w-full flex-1 sm:min-w-56">
          <TextField
            ref={qRef}
            label="Address or subdivision"
            name="q"
            defaultValue={filters.q ?? ''}
            placeholder="20889 SE Caldera Dr"
          />
        </div>
        <Button type="submit" touch>
          Search
        </Button>
        {filtersActive ? (
          <Link
            href={buildHref(basePath, { posture: params.posture })}
            className="av2-btn av2-btn--quiet av2-btn--touch"
            style={{ textDecoration: 'none' }}
          >
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

      {/* Status pills. */}
      <div className="flex flex-wrap items-center gap-2">
        <span style={facetLabelStyle}>Status</span>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((opt) => {
            const active = (filters.status ?? 'all') === opt.value
            const nextParams = { ...params, status: opt.value === 'all' ? undefined : opt.value }
            return (
              <Link key={opt.value} href={buildHref(basePath, nextParams)} className="av2-chip" aria-pressed={active}>
                {opt.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
