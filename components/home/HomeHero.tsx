'use client'

import { useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import type { SearchSuggestionsResult } from '@/app/actions/listings'
import { trackEvent } from '@/lib/tracking'
import { cityPagePath } from '@/lib/slug'
import { communityPagePath } from '@/lib/community-slug'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getHomeHeroImage, resolveUnsplashHeroImage } from '@/lib/hero-media'

const DEFAULT_HERO_IMAGE = getHomeHeroImage()
const SEARCH_DEBOUNCE_MS = 90

type MarketSnapshot = {
  count: number
  medianPrice: number | null
  avgDom?: number | null
}

type Props = {
  marketSnapshot: MarketSnapshot
  /** When set, hero background is a looping video (autoplay, muted). */
  heroVideoUrl?: string | null
  /** Background image when no video, or poster/fallback. */
  heroImageUrl?: string | null
}

export default function HomeHero({ marketSnapshot, heroVideoUrl, heroImageUrl }: Props) {
  const backgroundImage = resolveUnsplashHeroImage(heroImageUrl, DEFAULT_HERO_IMAGE)
  const useVideo = Boolean(heroVideoUrl?.trim())
  const [enableVideo, setEnableVideo] = useState(false)
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestionsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const suggestionsCacheRef = useRef<Map<string, SearchSuggestionsResult>>(new Map())
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
    const q = query.trim()
    if (q.length < 2) {
      setSuggestions(null)
      setLoading(false)
      setOpen(false)
      return
    }
    const controller = new AbortController()
    const t = setTimeout(async () => {
      const cached = suggestionsCacheRef.current.get(q.toLowerCase())
      if (cached) {
        setOpen(true)
        setSuggestions(cached)
        setLoading(false)
        return
      }
      setOpen(true)
      setLoading(true)
      try {
        const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
          cache: 'no-store',
        })
        const data = (await res.json()) as SearchSuggestionsResult
        suggestionsCacheRef.current.set(q.toLowerCase(), data)
        setSuggestions(data)
      } catch {
        setSuggestions(null)
      } finally {
        setLoading(false)
      }
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    if (!useVideo) {
      setEnableVideo(false)
      return
    }
    // Keep the hero image as the initial LCP surface, then start video shortly after first paint.
    const timer = setTimeout(() => setEnableVideo(true), 1200)
    return () => clearTimeout(timer)
  }, [useVideo])

  const MAX_ADDRESSES = 6
  const MAX_CITIES = 6
  const MAX_SUBDIVISIONS = 6
  const MAX_NEIGHBORHOODS = 5
  const MAX_ZIPS = 5
  const MAX_BROKERS = 5
  const MAX_REPORTS = 5

  useEffect(() => {
    setHighlight(0)
  }, [suggestions])

  const displayedCounts = suggestions
    ? {
        addresses: Math.min(MAX_ADDRESSES, suggestions.addresses.length),
        cities: Math.min(MAX_CITIES, suggestions.cities.length),
        subdivisions: Math.min(MAX_SUBDIVISIONS, suggestions.subdivisions.length),
        neighborhoods: Math.min(MAX_NEIGHBORHOODS, suggestions.neighborhoods.length),
        zips: Math.min(MAX_ZIPS, suggestions.zips.length),
        brokers: Math.min(MAX_BROKERS, suggestions.brokers.length),
        reports: Math.min(MAX_REPORTS, suggestions.reports.length),
      }
    : null

  const totalItems = displayedCounts
    ? displayedCounts.addresses +
      displayedCounts.cities +
      displayedCounts.subdivisions +
      displayedCounts.neighborhoods +
      displayedCounts.zips +
      displayedCounts.brokers +
      displayedCounts.reports
    : 0

  const getHref = (index: number): string | null => {
    if (!suggestions || !displayedCounts) return null
    let i = index
    if (i < displayedCounts.addresses) return suggestions.addresses[i]?.href ?? null
    i -= displayedCounts.addresses
    if (i < displayedCounts.cities) return cityPagePath(suggestions.cities[i]!.city)
    i -= displayedCounts.cities
    if (i < displayedCounts.subdivisions) {
      const s = suggestions.subdivisions[i]!
      return communityPagePath(s.city, s.subdivisionName)
    }
    i -= displayedCounts.subdivisions
    if (i < displayedCounts.neighborhoods) return suggestions.neighborhoods[i]?.href ?? null
    i -= displayedCounts.neighborhoods
    if (i < displayedCounts.zips) return suggestions.zips[i]?.href ?? null
    i -= displayedCounts.zips
    if (i < displayedCounts.brokers) return suggestions.brokers[i]?.href ?? null
    i -= displayedCounts.brokers
    if (i < displayedCounts.reports) return suggestions.reports[i]?.href ?? null
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
    <section ref={sectionRef} className="relative min-h-[60vh] flex items-center justify-center overflow-hidden w-full" aria-label="Hero">
      <div className="absolute inset-0">
        {useVideo ? (
          <>
            {/* Image loads instantly (priority) for fast LCP, video fades in on top after loading */}
            {backgroundImage && (
              <Image
                src={backgroundImage}
                alt="Central Oregon landscape"
                fill
                className="object-cover"
                sizes="100vw"
                priority
              />
            )}
            {enableVideo ? (
              <video
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                className="absolute inset-0 h-full w-full object-cover bg-transparent"
                aria-hidden
                onCanPlay={(e) => {
                  const el = e.currentTarget
                  el.style.opacity = '1'
                }}
                style={{ opacity: 0, transition: 'opacity 0.5s ease-in' }}
              >
                <source src={heroVideoUrl!} type="video/mp4" />
              </video>
            ) : null}
          </>
        ) : backgroundImage ? (
          <Image
            src={backgroundImage}
            alt="Central Oregon landscape"
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-primary" aria-hidden />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-primary/50 via-primary/25 to-transparent" aria-hidden />
      <div className="relative z-10 w-full max-w-3xl px-4 pt-24 pb-16 sm:pt-28 sm:pb-20 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary-foreground drop-shadow-md">
          Find Your Home in Central Oregon
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-muted font-light">
          Search homes for sale across Central Oregon
        </p>
        <form onSubmit={handleSubmit} className="relative mt-8" ref={panelRef}>
          <div className="flex rounded-lg overflow-hidden shadow-lg bg-card">
            <Input
              ref={inputRef}
              type="search"
              autoComplete="off"
              placeholder="City, community, neighborhood, address, or broker…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.trim().length >= 2 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-w-0 px-4 py-4 text-primary placeholder:text-muted-foreground focus:outline-none border-0"
            />
            <Button
              type="submit"
              variant="secondary"
              className="px-6 py-4"
            >
              Search
            </Button>
          </div>
          {open && (
            <div role="listbox" className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg max-h-[min(70vh,400px)] overflow-auto z-20 py-2">
              {query.trim().length < 2 ? (
                <p className="px-4 py-2 text-sm text-muted-foreground">Type at least 2 characters</p>
              ) : loading ? (
                <p className="px-4 py-2 text-sm text-muted-foreground">Searching...</p>
              ) : suggestions && totalItems === 0 ? (
                <p className="px-4 py-2 text-sm text-muted-foreground">No matches found</p>
              ) : null}
              {suggestions && suggestions.addresses.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Listings</p>
                  {suggestions.addresses.slice(0, 6).map((a, i) => (
                    <Button
                      key={`addr-${i}-${a.label}`}
                      type="button"
                      variant="ghost"
                      role="option"
                      aria-selected={highlight === i}
                      className={`block w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted rounded-none ${highlight === i ? 'bg-muted' : ''}`}
                      onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(a.href); setOpen(false); }}
                    >
                      {a.label}
                    </Button>
                  ))}
                </div>
              )}
              {suggestions && suggestions.cities.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cities</p>
                  {suggestions.cities.slice(0, 6).map((c, i) => {
                    const idx = suggestions.addresses.length + i
                    return (
                      <Button
                        key={`city-${c.city}`}
                        type="button"
                        variant="ghost"
                        role="option"
                        aria-selected={highlight === idx}
                        className={`block w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted rounded-none ${highlight === idx ? 'bg-muted' : ''}`}
                        onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(cityPagePath(c.city)); setOpen(false); }}
                      >
                        {c.city} {c.count > 0 ? `(${c.count})` : ''}
                      </Button>
                    )
                  })}
                </div>
              )}
              {suggestions && suggestions.subdivisions.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Communities</p>
                  {suggestions.subdivisions.slice(0, 6).map((s, i) => {
                    const idx = suggestions.addresses.length + suggestions.cities.length + i
                    return (
                      <Button
                        key={`sub-${s.city}-${s.subdivisionName}`}
                        type="button"
                        variant="ghost"
                        role="option"
                        aria-selected={highlight === idx}
                        className={`block w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted rounded-none ${highlight === idx ? 'bg-muted' : ''}`}
                        onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(communityPagePath(s.city, s.subdivisionName)); setOpen(false); }}
                      >
                        {s.subdivisionName}, {s.city} {s.count > 0 ? `(${s.count})` : ''}
                      </Button>
                    )
                  })}
                </div>
              )}
              {suggestions && suggestions.neighborhoods.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Neighborhoods</p>
                  {suggestions.neighborhoods.slice(0, 5).map((n, i) => {
                    const idx = suggestions.addresses.length + suggestions.cities.length + suggestions.subdivisions.length + i
                    return (
                      <Button
                        key={`n-${n.citySlug}-${n.neighborhoodSlug}`}
                        type="button"
                        variant="ghost"
                        role="option"
                        aria-selected={highlight === idx}
                        className={`block w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted rounded-none ${highlight === idx ? 'bg-muted' : ''}`}
                        onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(n.href); setOpen(false); }}
                      >
                        {n.neighborhoodName}, {n.cityName}
                      </Button>
                    )
                  })}
                </div>
              )}
              {suggestions && suggestions.zips.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zip codes</p>
                  {suggestions.zips.slice(0, 5).map((z, i) => {
                    const idx = suggestions.addresses.length + suggestions.cities.length + suggestions.subdivisions.length + suggestions.neighborhoods.length + i
                    return (
                      <Button
                        key={`zip-${z.postalCode}`}
                        type="button"
                        variant="ghost"
                        role="option"
                        aria-selected={highlight === idx}
                        className={`block w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted rounded-none ${highlight === idx ? 'bg-muted' : ''}`}
                        onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(z.href); setOpen(false); }}
                      >
                        {z.postalCode} {z.city ? `(${z.city})` : ''} {z.count > 0 ? `· ${z.count}` : ''}
                      </Button>
                    )
                  })}
                </div>
              )}
              {suggestions && suggestions.brokers.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agents &amp; brokers</p>
                  {suggestions.brokers.slice(0, 5).map((b, i) => {
                    const idx = suggestions.addresses.length + suggestions.cities.length + suggestions.subdivisions.length + suggestions.neighborhoods.length + suggestions.zips.length + i
                    return (
                      <Button
                        key={`broker-${b.label}`}
                        type="button"
                        variant="ghost"
                        role="option"
                        aria-selected={highlight === idx}
                        className={`block w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted rounded-none ${highlight === idx ? 'bg-muted' : ''}`}
                        onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(b.href); setOpen(false); }}
                      >
                        {b.label}
                      </Button>
                    )
                  })}
                </div>
              )}
              {suggestions && suggestions.reports.length > 0 && (
                <div>
                  <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Market reports</p>
                  {suggestions.reports.slice(0, 5).map((r, i) => {
                    const idx = suggestions.addresses.length + suggestions.cities.length + suggestions.subdivisions.length + suggestions.neighborhoods.length + suggestions.zips.length + suggestions.brokers.length + i
                    return (
                      <Button
                        key={`report-${i}-${r.label}`}
                        type="button"
                        variant="ghost"
                        role="option"
                        aria-selected={highlight === idx}
                        className={`block w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-muted rounded-none ${highlight === idx ? 'bg-muted' : ''}`}
                        onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(r.href); setOpen(false); }}
                      >
                        {r.label}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </section>
  )
}

