'use client'

import { useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getSearchSuggestions, type SearchSuggestionsResult } from '@/app/actions/listings'
import { trackEvent } from '@/lib/tracking'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// No stock photography — fallback is empty; hero renders a navy gradient when no brokerage image is set.
const DEFAULT_HERO_IMAGE = ''

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
  const backgroundImage = heroImageUrl?.trim() || DEFAULT_HERO_IMAGE
  const useVideo = Boolean(heroVideoUrl?.trim())
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
    if (i < suggestions.cities.length) return `/homes-for-sale?city=${encodeURIComponent(suggestions.cities[i]!.city)}`
    i -= suggestions.cities.length
    if (i < suggestions.subdivisions.length) {
      const s = suggestions.subdivisions[i]!
      return `/homes-for-sale?city=${encodeURIComponent(s.city)}&subdivision=${encodeURIComponent(s.subdivisionName)}`
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
      router.push(`/homes-for-sale?keywords=${encodeURIComponent(query.trim())}`)
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
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            className="h-full w-full object-cover bg-primary"
            aria-hidden
          >
            <source src={heroVideoUrl!} type="video/mp4" />
          </video>
        ) : backgroundImage ? (
          <Image
            src={backgroundImage}
            alt="Central Oregon landscape"
            fill
            className="object-cover animate-hero-ken-burns"
            sizes="100vw"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-primary" aria-hidden />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-primary/50 via-primary/25 to-transparent" aria-hidden />
      <div className="relative z-10 w-full max-w-3xl px-4 pt-24 pb-16 sm:pt-28 sm:pb-20 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white drop-shadow-md">
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
              placeholder="City, community, or zip"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => query.trim().length >= 2 && setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 200)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-w-0 px-4 py-4 text-primary placeholder:text-muted-foreground focus:outline-none border-0"
            />
            <Button
              type="submit"
              className="px-6 py-4 bg-accent text-primary font-semibold hover:bg-accent/90 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
            >
              Search
            </Button>
          </div>
          {open && suggestions && totalItems > 0 && (
            <div role="listbox" className="absolute top-full left-0 right-0 mt-1 rounded-lg border border-border bg-card shadow-lg max-h-64 overflow-auto z-20">
              {suggestions.addresses.slice(0, 5).map((a, i) => (
                <Button
                  key={a.href + i}
                  type="button"
                  role="option"
                  aria-selected={highlight === i}
                  className={`block w-full text-left px-4 py-3 text-primary hover:bg-muted ${highlight === i ? 'bg-muted' : ''}`}
                  onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(a.href); setOpen(false); }}
                >
                  {a.label}
                </Button>
              ))}
              {suggestions.cities.slice(0, 5).map((c, i) => {
                const idx = suggestions.addresses.length + i
                return (
                  <Button
                    key={c.city}
                    type="button"
                    role="option"
                    aria-selected={highlight === idx}
                    className={`block w-full text-left px-4 py-3 text-primary hover:bg-muted ${highlight === idx ? 'bg-muted' : ''}`}
                    onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(`/homes-for-sale?city=${encodeURIComponent(c.city)}`); setOpen(false); }}
                  >
                    {c.city} {c.count > 0 ? `(${c.count})` : ''}
                  </Button>
                )
              })}
              {suggestions.subdivisions.slice(0, 6).map((s, i) => {
                const idx = suggestions.addresses.length + suggestions.cities.length + i
                return (
                  <Button
                    key={`${s.city}-${s.subdivisionName}`}
                    type="button"
                    role="option"
                    aria-selected={highlight === idx}
                    className={`block w-full text-left px-4 py-3 text-primary hover:bg-muted ${highlight === idx ? 'bg-muted' : ''}`}
                    onMouseDown={() => { trackEvent('hero_search', { cta_location: 'hero_search' }); router.push(`/homes-for-sale?city=${encodeURIComponent(s.city)}&subdivision=${encodeURIComponent(s.subdivisionName)}`); setOpen(false); }}
                  >
                    {s.subdivisionName}, {s.city}
                  </Button>
                )
              })}
            </div>
          )}
        </form>
      </div>
    </section>
  )
}

