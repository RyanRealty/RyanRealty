'use client'

/**
 * SearchSuggest — THE one search-suggestions engine for the whole site
 * (W4.1 merge, 2026-07-22). Absorbs the orphaned components/SmartSearch.tsx
 * (deleted) and the inline dropdown SearchFilters.tsx used to carry.
 *
 * - `useSearchSuggest` fetches the cached GET /api/search/suggestions route
 *   (CDN s-maxage) with a 90ms debounce and an in-memory client cache — the
 *   SmartSearch data path, which replaced the uncacheable server-action POST.
 * - `flattenSuggestions` turns the grouped result into one keyboard-navigable
 *   list covering EVERY category the backend returns — addresses included
 *   (the "3480" class: the old dropdown never rendered them).
 * - `SearchSuggestPanel` renders the grouped dropdown. Plain elements +
 *   semantic token classes only (no shadcn) so it drops into both the portal
 *   filter bar and the KB nav without violating G47.
 *
 * Consumers own their input element and keyboard wiring; the panel is
 * aria-activedescendant-compatible (`${idPrefix}-item-${index}`).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SearchSuggestionsResult } from '@/app/actions/listings'
import { cityPagePath } from '@/lib/slug'
import { communityPagePath } from '@/lib/community-slug'

export const SUGGEST_MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 90

export const EMPTY_SUGGESTIONS: SearchSuggestionsResult = {
  addresses: [],
  cities: [],
  subdivisions: [],
  neighborhoods: [],
  zips: [],
  brokers: [],
  reports: [],
  pages: [],
}

export type SuggestKind =
  | 'address'
  | 'city'
  | 'subdivision'
  | 'neighborhood'
  | 'zip'
  | 'broker'
  | 'report'
  | 'page'

export type SuggestItem = {
  kind: SuggestKind
  label: string
  sublabel?: string
  href: string
  /** Structured fields so filter-bar consumers can apply filters in place. */
  city?: string
  subdivisionName?: string
  postalCode?: string
}

export const SUGGEST_GROUP_LABELS: Record<SuggestKind, string> = {
  address: 'Addresses',
  city: 'Cities',
  subdivision: 'Communities',
  neighborhood: 'Neighborhoods',
  zip: 'Zip codes',
  broker: 'Agents and brokers',
  report: 'Market reports',
  page: 'Pages and guides',
}

/** Per-category render caps (dropdown stays scannable). */
const CAPS = {
  addresses: 8,
  cities: 5,
  subdivisions: 8,
  neighborhoods: 5,
  zips: 5,
  brokers: 5,
  reports: 3,
  pages: 6,
} as const

/**
 * Flatten the grouped backend result into ONE ordered list. Every category the
 * backend returns is represented here — a category missing from this function
 * is a rendering bug (contract-tested).
 */
export function flattenSuggestions(s: SearchSuggestionsResult | null): SuggestItem[] {
  if (!s) return []
  const items: SuggestItem[] = []
  for (const a of (s.addresses ?? []).slice(0, CAPS.addresses)) {
    items.push({ kind: 'address', label: a.label, href: a.href })
  }
  for (const c of (s.cities ?? []).slice(0, CAPS.cities)) {
    items.push({
      kind: 'city',
      label: c.city,
      sublabel: c.count > 0 ? `${c.count}` : undefined,
      href: cityPagePath(c.city),
      city: c.city,
    })
  }
  for (const sub of (s.subdivisions ?? []).slice(0, CAPS.subdivisions)) {
    items.push({
      kind: 'subdivision',
      label: sub.subdivisionName,
      sublabel: sub.city,
      href: communityPagePath(sub.city, sub.subdivisionName),
      city: sub.city,
      subdivisionName: sub.subdivisionName,
    })
  }
  for (const n of (s.neighborhoods ?? []).slice(0, CAPS.neighborhoods)) {
    items.push({ kind: 'neighborhood', label: n.neighborhoodName, sublabel: n.cityName, href: n.href })
  }
  for (const z of (s.zips ?? []).slice(0, CAPS.zips)) {
    items.push({
      kind: 'zip',
      label: z.postalCode,
      sublabel: z.city,
      href: z.href,
      postalCode: z.postalCode,
    })
  }
  for (const b of (s.brokers ?? []).slice(0, CAPS.brokers)) {
    items.push({ kind: 'broker', label: b.label, href: b.href })
  }
  for (const r of (s.reports ?? []).slice(0, CAPS.reports)) {
    items.push({ kind: 'report', label: r.label, href: r.href })
  }
  for (const p of (s.pages ?? []).slice(0, CAPS.pages)) {
    items.push({
      kind: 'page',
      label: p.label,
      sublabel: p.kind === 'guide' ? 'Guide' : p.kind === 'blog' ? 'Blog' : undefined,
      href: p.href,
    })
  }
  return items
}

/**
 * Debounced (90ms), client-cached fetch of the cached GET suggestions route.
 * Latest-query-wins: out-of-order responses never clobber newer input.
 */
export function useSearchSuggest(query: string): {
  suggestions: SearchSuggestionsResult | null
  loading: boolean
} {
  const [suggestions, setSuggestions] = useState<SearchSuggestionsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const cacheRef = useRef<Map<string, SearchSuggestionsResult>>(new Map())
  const latestRef = useRef('')

  const fetchSuggestions = useCallback(async (q: string) => {
    const cacheKey = q.toLowerCase()
    const cached = cacheRef.current.get(cacheKey)
    if (cached) {
      setSuggestions(cached)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`)
      const result = (await response.json()) as SearchSuggestionsResult
      // Degraded = a backing read failed server-side. Render what came back,
      // but never pin it — the next keystroke (or retype) retries fresh.
      if (!result.degraded) cacheRef.current.set(cacheKey, result)
      if (latestRef.current === q) setSuggestions(result)
    } catch {
      if (latestRef.current === q) setSuggestions(null)
    } finally {
      if (latestRef.current === q) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const q = query.trim()
    latestRef.current = q
    if (q.length < SUGGEST_MIN_QUERY_LENGTH) {
      setSuggestions(null)
      setLoading(false)
      return
    }
    const t = setTimeout(() => fetchSuggestions(q), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query, fetchSuggestions])

  return { suggestions, loading }
}

type PanelProps = {
  items: SuggestItem[]
  loading?: boolean
  /** Non-null once a fetch has resolved — drives the "No results" state. */
  hasResult?: boolean
  highlight?: number
  idPrefix: string
  /** Return handling is the consumer's job (navigate or apply filters). */
  onPick: (item: SuggestItem) => void
  className?: string
}

/**
 * The grouped dropdown body. Options are anchors (real hrefs — middle-click
 * and copy-link work) whose default navigation is deferred to `onPick` via
 * onMouseDown, so filter-bar consumers can apply filters in place and blur
 * handlers never race the click.
 */
export function SearchSuggestPanel({
  items,
  loading = false,
  hasResult = false,
  highlight = -1,
  idPrefix,
  onPick,
  className,
}: PanelProps) {
  if (loading && items.length === 0) {
    return (
      <div className={className}>
        <p className="px-4 py-2.5 text-sm text-muted-foreground">Searching…</p>
      </div>
    )
  }
  if (hasResult && items.length === 0) {
    return (
      <div className={className}>
        <p className="px-4 py-2.5 text-sm text-muted-foreground">No results</p>
      </div>
    )
  }
  if (items.length === 0) return null

  return (
    <div id={`${idPrefix}-listbox`} role="listbox" aria-label="Search suggestions" className={className}>
      {items.map((item, index) => {
        const showHeader = index === 0 || items[index - 1]!.kind !== item.kind
        const active = index === highlight
        return (
          <div key={`${item.kind}-${index}-${item.href}`}>
            {showHeader && (
              <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {SUGGEST_GROUP_LABELS[item.kind]}
              </p>
            )}
            <a
              id={`${idPrefix}-item-${index}`}
              role="option"
              aria-selected={active}
              href={item.href}
              tabIndex={-1}
              className={`block w-full px-4 py-2 text-left text-sm transition ${
                active ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted'
              }`}
              onMouseDown={(e) => {
                // Left click only; let middle/modified clicks use the raw href.
                if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                e.preventDefault()
                onPick(item)
              }}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
                e.preventDefault()
              }}
            >
              {item.label}
              {item.sublabel && <span className="ml-1.5 text-muted-foreground">({item.sublabel})</span>}
            </a>
          </div>
        )
      })}
    </div>
  )
}
