'use client'

import { useMemo, useState, useTransition } from 'react'
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
 * the live filters from useSearchParams() — the captured alert matches exactly
 * what the visitor is looking at, even after they change a filter client-side.
 */

const FILTER_PARAM_KEYS = [
  'city', 'subdivision', 'minPrice', 'maxPrice', 'beds', 'baths', 'minSqFt', 'maxSqFt',
  'propertyType', 'keywords', 'postalCode', 'hasPool', 'hasView', 'hasWaterfront',
  'hasFireplace', 'hasGolfCourse', 'garageMin', 'lotAcresMin', 'lotAcresMax',
  'yearBuiltMin', 'yearBuiltMax',
] as const

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
  const [company, setCompany] = useState('') // honeypot — humans never see this
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
    for (const key of FILTER_PARAM_KEYS) {
      const value = searchParams.get(key)
      if (value) out[key] = value
    }
    // On bare /search the server defaults the visible results to a city the URL
    // omits — capture it so the alert matches what the visitor is looking at.
    if (!out.city && defaultCity) out.city = defaultCity
    if (!out.subdivision && defaultSubdivision) out.subdivision = defaultSubdivision
    return out
    // defaultFiltersSnapshot stands in for the defaultFilters object identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, defaultCity, defaultSubdivision, defaultFiltersSnapshot])

  // Signed-in users already have the save-search affordance — this is for guests.
  if (signedIn || dismissed) return null

  if (state === 'done') {
    return (
      <div className="w-full border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 text-sm text-foreground sm:px-6">
          <BellAlertIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <p>You&apos;re set. We&apos;ll email you when a match comes up.</p>
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
            <p className="line-clamp-2 text-xs text-muted-foreground">
              We&apos;ll email you new matches for {target}.
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
            className="sr-only"
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
