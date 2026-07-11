'use client'

import { useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createSavedSearch } from '@/app/actions/saved-searches'
import { submitSearchAlertSignup } from '@/app/actions/search-alert-capture'
import { normalizeSavedSearchFilters } from '@/lib/search-filters'
import {
  SAVED_SEARCH_QUERY_KEYS,
  SAVED_SEARCH_ARRAY_QUERY_KEYS,
  readArrayParam,
} from '@/components/search/SearchAlertCapture'
import { trackEvent } from '@/lib/tracking'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from '@/components/ui/checkbox'

type Props = { user: boolean }

export default function SaveSearchButton({ user }: Props) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('') // honeypot, humans never see this
  const [isPublic, setIsPublic] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Guests can save a search too. Instead of returning null (the old behavior,
  // which made "Save this search" invisible to anyone not signed in, i.e. most
  // visitors), the guest branch captures an email and routes it through the same
  // FUB buyer-lead path the alert strip uses (audience:buyer). Save a search is
  // therefore ALWAYS reachable and always feeds the buyer funnel.

  /**
   * FULL filter capture: the path supplies city/subdivision, then EVERY
   * canonical filter key (SAVED_SEARCH_QUERY_KEYS mirrors FILTER_KEYS in
   * lib/search-filters.ts) present in the live query round-trips into the
   * saved filters. normalizeSavedSearchFilters coerces strings to the typed
   * shape (numbers, booleans, arrays) the alert cron and edit UI expect.
   */
  function buildFilters(): Record<string, unknown> {
    const raw: Record<string, unknown> = {}
    const parts = pathname?.split('/').filter(Boolean) ?? []
    if (parts[0] === 'search' || parts[0] === 'homes-for-sale') {
      if (parts[1]) raw.city = decodeURIComponent(parts[1]).trim()
      if (parts[2]) raw.subdivision = decodeURIComponent(parts[2])
    }
    for (const key of SAVED_SEARCH_QUERY_KEYS) {
      if (SAVED_SEARCH_ARRAY_QUERY_KEYS.has(key)) {
        const values = readArrayParam(searchParams, key)
        if (values.length > 0) raw[key] = values
        continue
      }
      const value = searchParams.get(key)
      if (value && value.trim()) raw[key] = value.trim()
    }
    return normalizeSavedSearchFilters(raw)
  }

  async function handleGuestSave(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    setErrorMsg('')
    const filters = buildFilters()
    // Map the normalized filters to the alert-capture string shape, then route
    // through the existing spam-hardened FUB buyer-lead path (audience:buyer).
    const stringFilters: Record<string, string> = {}
    for (const [key, value] of Object.entries(filters)) {
      if (value == null) continue
      if (Array.isArray(value)) {
        stringFilters[key] = value.join(',')
        continue
      }
      stringFilters[key] = typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
    }
    const res = await submitSearchAlertSignup({ email, filters: stringFilters, company })
    if (res.ok) {
      setStatus('done')
      try {
        trackEvent('save_search', {
          guest: true,
          name: (name.trim() || 'My search').slice(0, 64),
          city: typeof filters.city === 'string' ? filters.city.slice(0, 64) : undefined,
          subdivision: typeof filters.subdivision === 'string' ? filters.subdivision.slice(0, 64) : undefined,
          min_price: typeof filters.minPrice === 'number' ? filters.minPrice : undefined,
          max_price: typeof filters.maxPrice === 'number' ? filters.maxPrice : undefined,
        })
      } catch {
        // never block UX on tracking
      }
      setName('')
      setEmail('')
      setOpen(false)
    } else {
      setStatus('error')
      setErrorMsg(res.error)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setStatus('saving')
    const trimmedName = name.trim() || 'My search'
    const filters = buildFilters()
    const result = await createSavedSearch(trimmedName, filters, {
      isPublic,
      publicTitle: isPublic ? trimmedName : undefined,
    })
    setStatus(result.error ? 'error' : 'done')
    if (!result.error) {
      // High-intent event: visitor saved a search, expects alerts on new matches.
      // Carries the filter dimensions so we can answer "which buyer criteria
      // are most common" from the GA4 event taxonomy.
      try {
        trackEvent('save_search', {
          name: trimmedName.slice(0, 64),
          city: typeof filters.city === 'string' ? filters.city.slice(0, 64) : undefined,
          subdivision: typeof filters.subdivision === 'string' ? filters.subdivision.slice(0, 64) : undefined,
          min_price: typeof filters.minPrice === 'number' ? filters.minPrice : undefined,
          max_price: typeof filters.maxPrice === 'number' ? filters.maxPrice : undefined,
          beds: typeof filters.beds === 'number' ? filters.beds : undefined,
          baths: typeof filters.baths === 'number' ? filters.baths : undefined,
          property_type: typeof filters.propertyType === 'string' ? filters.propertyType : undefined,
          is_public: isPublic,
        })
      } catch {
        // never block UX on tracking
      }
      setName('')
      setIsPublic(false)
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm hover:bg-muted"
      >
        Save this search
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" aria-hidden onClick={() => setOpen(false)} />
          {user ? (
            <form
              onSubmit={handleSave}
              className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-card p-4 shadow-md"
            >
              <Label className="block text-sm font-medium text-muted-foreground">Name this search</Label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Bend under $600k"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                autoFocus
              />
              {searchParams?.get('poly') ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Alerts cover the area around your drawn boundary, not the exact shape.
                </p>
              ) : null}
              <div className="mt-3 flex items-start gap-2">
                <Checkbox
                  id="save-search-public"
                  checked={isPublic}
                  onCheckedChange={(checked) => setIsPublic(checked === true)}
                />
                <Label htmlFor="save-search-public" className="text-sm text-muted-foreground">
                  Make this search public for the Popular Searches section
                </Label>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  type="submit"
                  disabled={status === 'saving'}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {status === 'saving' ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
              {status === 'done' && <p className="mt-2 text-sm text-success">Saved.</p>}
              {status === 'error' && <p className="mt-2 text-sm text-destructive">Could not save. Try again.</p>}
            </form>
          ) : (
            <form
              onSubmit={handleGuestSave}
              className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-card p-4 shadow-md"
            >
              <p className="text-sm font-medium text-foreground">Save this search</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add your email and we will send new matches as they hit the market.
              </p>
              {searchParams?.get('poly') ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Alerts cover the area around your drawn boundary, not the exact shape.
                </p>
              ) : null}
              {/* Honeypot: visually + a11y hidden, not tab-reachable. Bots fill it. */}
              <Input
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                // P0-6: h-px w-px so tailwind-merge drops the Input base h-8/w-full
                // (bare sr-only loses width:1px to the base w-full in the cascade).
                className="sr-only h-px w-px"
              />
              <Label htmlFor="save-search-email" className="mt-3 block text-sm font-medium text-muted-foreground">
                Email
              </Label>
              <Input
                id="save-search-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                maxLength={254}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-sm"
                autoFocus
              />
              <div className="mt-3 flex gap-2">
                <Button
                  type="submit"
                  disabled={status === 'saving'}
                  className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {status === 'saving' ? 'Saving…' : 'Save search'}
                </Button>
                <Button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>
              {status === 'error' && (
                <p className="mt-2 text-sm text-destructive" role="alert">
                  {errorMsg || 'Could not save. Try again.'}
                </p>
              )}
            </form>
          )}
        </>
      )}
    </div>
  )
}
