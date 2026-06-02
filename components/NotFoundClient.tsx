'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Smart 404 body.
 *
 * After the ryan-realty.com cutover, old indexed URLs and ad links can still
 * land on a 404. Instead of a bare dead end this:
 *   1. Reads the requested path and offers the most relevant live pages
 *      (a listing-shaped URL → homes for sale, a city in the path → that city,
 *      a blog/market/sell URL → the matching hub).
 *   2. Gives a search box and the core nav so any visitor has a way forward.
 *   3. Fires a GA4 `page_not_found` event + sets a distinct page title, so 404s
 *      are measurable going forward (today they inherit the homepage title and
 *      are invisible in analytics).
 */

const CITY_HUBS = [
  'bend', 'redmond', 'sisters', 'sunriver', 'la-pine', 'madras', 'prineville', 'terrebonne',
] as const

function titleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

type Suggestion = { href: string; label: string }

function suggestionsFor(pathname: string): Suggestion[] {
  const p = pathname.toLowerCase()
  const out: Suggestion[] = []
  const push = (s: Suggestion) => {
    if (!out.some((x) => x.href === s.href)) out.push(s)
  }

  const cityHit = CITY_HUBS.find((c) => p.includes(c))

  if (cityHit) {
    push({ href: `/homes-for-sale/${cityHit}`, label: `Homes for sale in ${titleCase(cityHit)}` })
  }
  if (/listing|propert|homes-for-sale|odsmls|for-sale|mls/.test(p)) {
    push({ href: '/homes-for-sale', label: 'Browse homes for sale' })
  }
  if (/sell|valuation|home-value|cma|worth/.test(p)) {
    push({ href: '/sell', label: 'Sell your home' })
  }
  if (/blog|news|article|guide|\/202\d\//.test(p)) {
    push({ href: '/blog', label: 'Read the blog' })
  }
  if (/market|report|pulse|housing|stats|trend/.test(p)) {
    push({ href: '/housing-market', label: 'Market reports' })
  }
  if (/communit|neighborhood|subdivision|resort|area-guide/.test(p)) {
    push({ href: '/communities', label: 'Central Oregon communities' })
  }
  if (/team|agent|about|broker|review|contact/.test(p)) {
    push({ href: '/about', label: 'About Ryan Realty' })
  }

  // Always-useful fallbacks so there are at least a few choices.
  push({ href: '/homes-for-sale', label: 'Browse homes for sale' })
  push({ href: '/housing-market', label: 'Market reports' })
  push({ href: '/sell', label: 'Sell your home' })

  return out.slice(0, 4)
}

export function NotFoundClient() {
  const pathname = usePathname() || '/'
  const router = useRouter()
  const [q, setQ] = useState('')

  const suggestions = useMemo(() => suggestionsFor(pathname), [pathname])

  useEffect(() => {
    // Mark the document so the global SignInPrompt knows this render is a 404
    // and never auto-pops its sign-in modal over the dead-end page. A 404 serves
    // at an arbitrary path, so pathname-based suppression can't catch it — this
    // flag is the signal. Cleared on unmount (e.g. client-nav to a real page).
    document.documentElement.dataset.notFound = '1'
    try {
      document.title = 'Page not found | Ryan Realty — Central Oregon Real Estate'
    } catch {
      // ignore
    }
    const w = window as typeof window & { gtag?: (...args: unknown[]) => void }
    if (typeof w.gtag === 'function') {
      try {
        w.gtag('event', 'page_not_found', {
          page_path: window.location.pathname + window.location.search,
          page_location: window.location.href,
          page_referrer: document.referrer || undefined,
        })
      } catch {
        // ignore
      }
    }
    return () => {
      delete document.documentElement.dataset.notFound
    }
  }, [])

  function onSearch(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim()
    router.push(term ? `/homes-for-sale?keywords=${encodeURIComponent(term)}` : '/homes-for-sale')
  }

  return (
    <div className="mx-auto w-full max-w-xl text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">404</p>
      <h1 className="mt-2 font-display text-4xl font-bold text-foreground">Page not found</h1>
      <p className="mt-3 text-muted-foreground">
        The page you’re looking for doesn’t exist or was moved. Here is where to go next.
      </p>

      <form onSubmit={onSearch} className="mt-6 flex items-center gap-2">
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search homes by city, neighborhood, or address"
          aria-label="Search homes for sale"
          className="h-11"
        />
        <Button type="submit" className="h-11 shrink-0">
          Search
        </Button>
      </form>

      <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {suggestions.map((s) => (
          <Button key={s.href} asChild variant="outline" className="justify-start">
            <Link href={s.href}>{s.label}</Link>
          </Button>
        ))}
      </div>

      <div className="mt-6">
        <Button asChild variant="ghost">
          <Link href="/">Go to the homepage</Link>
        </Button>
      </div>
    </div>
  )
}
