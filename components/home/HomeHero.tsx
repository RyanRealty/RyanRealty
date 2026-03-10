'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getSearchSuggestions, type SearchSuggestionsResult } from '@/app/actions/listings'
import { trackEvent } from '@/lib/tracking'

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=1920&q=80'

type MarketSnapshot = {
  count: number
  medianPrice: number | null
  avgDom?: number | null
}

type Props = {
  marketSnapshot: MarketSnapshot
}

export default function HomeHero({ marketSnapshot }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestionsResult | null>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLFormElement>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const sentRef = useRef(false)

  useEffect(() => {
    if (sentRef.current || !sectionRef.current) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          sentRef.current = true
          trackEvent('hero_impression', {})
          trackEvent('homepage_view', { market_listings: marketSnapshot.count, median_price: marketSnapshot.medianPrice ?? undefined })
        }
      },
      { threshold: 0.3 }
    )
    io.observe(sectionRef.current)
    return () => io.disconnect()
  }, [marketSnapshot.count, marketSnapshot.medianPrice])

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions(null)
      setOpen(false)
      return
    }
    const t = setTimeout(() => {
      getSearchSuggestions(query).then(setSuggestions)
    }, 220)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    setHighlight(0)
  }, [suggestions])

  const totalItems = suggestions
    ? suggestions.addresses.length + suggestions.cities.length + suggestions.subdivisions.length
    : 0

  const getHref = (index: number): string | null => {
    if (!suggestions) return null
    let i = index
    if (i < suggestions.addresses.length) return suggestions.addresses[i]?.href ?? null
    i -= suggestions.addresses.length
    if (i < suggestions.cities.length) return `/search?city=${encodeURIComponent(suggestions.cities[i]!.city)}`
    i -= suggestions.cities.length
    if (i < suggestions.subdivisions.length) {
      const s = suggestions.subdivisions[i]!
      return `/search?city=${encodeURIComponent(s.city)}&subdivision=${encodeURIComponent(s.subdivisionName)}`
    }
    return null
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (totalItems > 0 && getHref(highlight)) {
      trackEvent('hero_search', { query: query.trim(), cta_location: 'hero_search' })
      router.push(getHref(highlight)!)
      setOpen(false)
      return
    }
    if (query.trim()) {
      trackEvent('hero_search', { query: query.trim(), cta_location: 'hero_search' })
      router.push(`/search?keywords=${encodeURIComponent(query.trim())}`)
    }
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions == null) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight((h) => (h < totalItems - 1 ? h + 1 : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => (h > 0 ? h - 1 : totalItems - 1))
      return
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <section ref={sectionRef} className="relative min-h-[520px] sm:min-h-[600px] flex items-center justify-center overflow-hidden" aria-label="Hero">
      <div className="absolute inset-0">
        <Image
          src={HERO_IMAGE}
          alt=""
          fill
          className="object-cover animate-hero-ken-burns"
          sizes="100vw"
          priority
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--brand-navy)]/80 via-[var(--brand-navy)]/50 to-[var(--brand-navy)]/40" aria-hidden />
      <div className="relative z-10 w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white drop-shadow-lg">
          Find Your Home in Central Oregon
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-[var(--brand-cream)] font-light">
          The most comprehensive real estate platform for Bend, Redmond, Sisters, and Sunriver
        </p>
        <form onSubmit={handleSubmit} className="relative mt-8" ref={panelRef}>
          <div className="flex rounded-xl border-2 border-white/30 bg-white shadow-xl overflow-hidden">
            <input
              ref={inputRef}
              type="search"
              autoComplete="off"
              placeholder="City, community, or zip"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.trim().length >= 2 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-w-0 px-4 py-4 text-[var(--brand-navy)] placeholder:text-[var(--gray-muted)] focus:outline-none"
            />
            <button
              type="submit"
              className="px-6 py-4 bg-[var(--accent)] text-[var(--brand-navy)] font-semibold hover:bg-[var(--accent-hover)] transition-colors"
            >
              Search
            </button>
          </div>
          {open && suggestions && totalItems > 0 && (
            <div role="listbox" className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-[var(--gray-border)] bg-white shadow-xl max-h-64 overflow-auto z-20">
              {suggestions.addresses.slice(0, 5).map((a, i) => (
                <button
                  key={a.href + i}
                  type="button"
                  role="option"
                  aria-selected={highlight === i}
                  className={`block w-full text-left px-4 py-3 text-[var(--brand-navy)] hover:bg-[var(--gray-bg)] ${highlight === i ? 'bg-[var(--gray-bg)]' : ''}`}
                  onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(a.href); setOpen(false); }}
                >
                  {a.label}
                </button>
              ))}
              {suggestions.cities.slice(0, 5).map((c, i) => {
                const idx = suggestions.addresses.length + i
                return (
                  <button
                    key={c.city}
                    type="button"
                    role="option"
                    aria-selected={highlight === idx}
                    className={`block w-full text-left px-4 py-3 text-[var(--brand-navy)] hover:bg-[var(--gray-bg)] ${highlight === idx ? 'bg-[var(--gray-bg)]' : ''}`}
                    onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(`/search?city=${encodeURIComponent(c.city)}`); setOpen(false); }}
                  >
                    {c.city} {c.count > 0 ? `(${c.count})` : ''}
                  </button>
                )
              })}
              {suggestions.subdivisions.slice(0, 6).map((s, i) => {
                const idx = suggestions.addresses.length + suggestions.cities.length + i
                return (
                  <button
                    key={`${s.city}-${s.subdivisionName}`}
                    type="button"
                    role="option"
                    aria-selected={highlight === idx}
                    className={`block w-full text-left px-4 py-3 text-[var(--brand-navy)] hover:bg-[var(--gray-bg)] ${highlight === idx ? 'bg-[var(--gray-bg)]' : ''}`}
                    onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(`/search?city=${encodeURIComponent(s.city)}&subdivision=${encodeURIComponent(s.subdivisionName)}`); setOpen(false); }}
                  >
                    {s.subdivisionName}, {s.city}
                  </button>
                )
              })}
            </div>
          )}
        </form>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {['Bend', 'Redmond', 'Sisters', 'Sunriver'].map((city) => (
            <Link
              key={city}
              href={`/search?city=${encodeURIComponent(city)}`}
              className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30 transition-colors"
            >
              {city}
            </Link>
          ))}
          <Link href="/search?maxPrice=500000" className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30 transition-colors">
            Under $500K
          </Link>
          <Link href="/search?minPrice=1000000" className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30 transition-colors">
            Luxury
          </Link>
          <Link href="/search?keywords=new+construction" className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30 transition-colors">
            New Construction
          </Link>
          <Link href="/search?hasWaterfront=1" className="rounded-full bg-white/20 px-4 py-2 text-sm font-medium text-white hover:bg-white/30 transition-colors">
            Waterfront
          </Link>
        </div>
        <div className="mt-8 rounded-lg bg-black/30 px-4 py-3 text-[var(--brand-cream)] text-sm">
          {marketSnapshot.count.toLocaleString()} Active Listings
          {marketSnapshot.medianPrice != null && ` | Median Price $${marketSnapshot.medianPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
          {marketSnapshot.avgDom != null && marketSnapshot.avgDom > 0 && ` | Avg ${Math.round(marketSnapshot.avgDom)} Days on Market`}
        </div>
      </div>
    </section>
  )
}

