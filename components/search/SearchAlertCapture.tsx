'use client'

import { useMemo, useState, useTransition } from 'react'
import { ALL_SEARCH_URL_PARAMS, SEARCH_FIELDS } from '@/lib/search/field-registry'
import type { FormEvent } from 'react'
import { useSearchParams } from 'next/navigation'
import { BellAlertIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getFiltersSummary } from '@/lib/search-filters'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'

/**
 * Inline guest-email "get listing alerts for this search" capture, shown to
 * ANONYMOUS visitors on /search (signed-in users already have save-search).
 *
 * The URL is the source of truth for the current search on /search, so we read
 * the live filters from useSearchParams(). The captured alert matches exactly
 * what the visitor is looking at, even after they change a filter client-side.
 */

/**
 * Every saved-search filter key that can live in the URL query. Mirrors
 * FILTER_KEYS in lib/search-filters.ts (the canonical filter model) so a saved
 * alert captures the FULL search state, not a subset. Shared with
 * components/SaveSearchButton.tsx so the two capture paths can never drift.
 */
const LEGACY_SAVED_SEARCH_KEYS = [
  'city',
  'subdivision',
  'minPrice',
  'maxPrice',
  'beds',
  'baths',
  'minSqFt',
  'maxSqFt',
  'maxBeds',
  'maxBaths',
  'yearBuiltMin',
  'yearBuiltMax',
  'lotAcresMin',
  'lotAcresMax',
  'postalCode',
  'propertyType',
  'propertySubType',
  'statusFilter',
  'keywords',
  'hasOpenHouse',
  'garageMin',
  'hasPool',
  'hasView',
  'hasWaterfront',
  'hasFireplace',
  'hasGolfCourse',
  'viewContains',
  'cities',
  'viewContainsAny',
  'offMarketWithinDays',
  'excludeSoldSince',
  'newListingsDays',
  'sort',
  'includeClosed',
  'view',
  'poly',
] as const

/**
 * Every URL param a saved search captures: the legacy set UNION the full field
 * registry. Hard-coding only the legacy list silently dropped registry filters
 * (viewTypes, shop, onWell, hoaMonthlyMax, …) at save time — a subscriber who
 * saved "Awbrey Butte with panoramic views" was alerted for ALL of Awbrey
 * Butte (2026-07-11 fix). Registry-derived so new fields are captured the day
 * they ship.
 */
export const SAVED_SEARCH_QUERY_KEYS: readonly string[] = [
  ...new Set<string>([...LEGACY_SAVED_SEARCH_KEYS, ...ALL_SEARCH_URL_PARAMS]),
]

/** The multi-value keys, sent as repeated params or comma-separated in one param. */
export const SAVED_SEARCH_ARRAY_QUERY_KEYS: ReadonlySet<string> = new Set([
  'cities',
  'viewContainsAny',
  ...SEARCH_FIELDS.filter((f) => f.kind === 'multi').map((f) => f.key),
])

/** Read every multi-value entry for a key (repeated params + comma-separated). */
export function readArrayParam(params: URLSearchParams, key: string): string[] {
  return params
    .getAll(key)
    .flatMap((entry) => entry.split(','))
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function SearchAlertCapture({
  signedIn,
  defaultCity,
  defaultSubdivision,
  defaultFilters,
}: {
  signedIn: boolean
  defaultCity?: string
  /** Subdivision/community when it lives in the route path (the /homes-for-sale/[...slug] page), not the query. */
  defaultSubdivision?: string
  /** Preset-supplied filters that live in the path (e.g. /homes-for-sale/bend/under-750k), not the query. */
  defaultFilters?: Record<string, string>
}) {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot, humans never see this
  const [state, setState] = useState<'idle' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [dismissed, setDismissed] = useState(false)
  const [pending, startTransition] = useTransition()

  const defaultFiltersSnapshot = JSON.stringify(defaultFilters ?? {})
  const filters = useMemo(() => {
    const out: Record<string, string> = {}
    // Path-supplied defaults first (city/subdivision/preset live in the slug, not
    // the query, on /homes-for-sale/[...slug]) so the captured alert matches what
    // the visitor sees. A live query param for the same key overrides below.
    if (defaultFilters) {
      for (const [key, value] of Object.entries(defaultFilters)) {
        if (value) out[key] = value
      }
    }
    // FULL capture: every canonical filter key present in the live query round-
    // trips into the alert, so the saved filters mirror lib/search-filters.ts
    // FILTER_KEYS instead of a hand-picked subset.
    for (const key of SAVED_SEARCH_QUERY_KEYS) {
      if (SAVED_SEARCH_ARRAY_QUERY_KEYS.has(key)) {
        const values = readArrayParam(searchParams, key)
        if (values.length > 0) out[key] = values.join(',')
        continue
      }
      const value = searchParams.get(key)
      if (value && value.trim()) out[key] = value.trim()
    }
    // On bare /search the server defaults the visible results to a city the URL
    // omits. Capture it so the alert matches what the visitor is looking at.
    if (!out.city && defaultCity) out.city = defaultCity
    if (!out.subdivision && defaultSubdivision) out.subdivision = defaultSubdivision
    return out
    // defaultFiltersSnapshot stands in for the defaultFilters object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, defaultCity, defaultSubdivision, defaultFiltersSnapshot])

  // Signed-in users already have the save-search affordance. This is for guests.
  if (signedIn || dismissed) return null

  if (state === 'done') {
    return (
      <div className="w-full border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 text-sm text-foreground sm:px-6">
          <BellAlertIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p>You are set. We will email you when a match comes up.</p>
        </div>
      </div>
    )
  }

  const summary = getFiltersSummary(filters)
  const target = summary === 'Any filters' ? 'this search' : summary

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    setState('idle')
    setError('')
    startTransition(async () => {
      const res = await submitSearchAlertSignup({ email, filters, company })
      if (res.ok) {
        setState('done')
      } else {
        setState('error')
        setError(res.error)
      }
    })
  }

  return (
    <div className="w-full border-b border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-start gap-2 sm:items-center">
          <BellAlertIcon className="mt-0.5 h-4 w-4 shrink-0 text-primary sm:mt-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Get new listings first</p>
            {/* "for $90M, Bend" read as nonsense (matches FOR a price?) — "matching"
                works grammatically no matter what the filter-shorthand contains
                (design-audit P3). */}
            <p className="line-clamp-2 text-xs text-muted-foreground">
              We will email you new homes matching {target}.
            </p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          {/* Honeypot: visually + a11y hidden, not tab-reachable. Bots fill it. */}
          <Input
            type="text"
            name="company"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
            // P0-6: h-px w-px so tailwind-merge drops the Input base h-8/w-full.
            // Bare sr-only loses the width war to w-full (absolute 390px input
            // widened the document and caused horizontal page scroll at 390px).
            className="sr-only h-px w-px"
          />
          <Input
            type="email"
            name="email"
            inputMode="email"
            autoComplete="email"
            maxLength={254}
            required
            placeholder="you@email.com"
            aria-label="Email for listing alerts"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full sm:w-56"
            disabled={pending}
          />
          <Button type="submit" size="default" disabled={pending} className="shrink-0">
            {pending ? 'Setting up...' : 'Get alerts'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden />
          </Button>
        </form>
      </div>
      {state === 'error' ? (
        <div className="mx-auto max-w-7xl px-4 pb-2 text-xs text-destructive sm:px-6" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  )
}
