'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSearchSuggestions } from '@/app/actions/listings'
import type { SearchSuggestionsResult } from '@/app/actions/listings'
import { cityPagePath } from '@/lib/slug'
import { communityPagePath } from '@/lib/community-slug'
import VoiceSearchButton from '@/components/VoiceSearchButton'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon } from '@hugeicons/core-free-icons'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const DEBOUNCE_MS = 220
const MIN_QUERY_LENGTH = 2

type Props = {
  /** e.g. "Homes for You in Bend" */
  homesForYouLabel: string
}

export default function HeroSearchOverlay({ homesForYouLabel }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchSuggestionsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions(null)
      return
    }
    setLoading(true)
    try {
      const result = await getSearchSuggestions(q)
      setSuggestions(result)
      setHighlight(0)
    } catch {
      setSuggestions(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < MIN_QUERY_LENGTH) {
      setSuggestions(null)
      setOpen(!!q)
      return
    }
    debounceRef.current = setTimeout(() => {
      setOpen(true)
      fetchSuggestions(q)
    }, DEBOUNCE_MS)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, fetchSuggestions])

  const totalItems =
    suggestions == null
      ? 0
      : suggestions.addresses.length + suggestions.cities.length + suggestions.subdivisions.length

  const getItemHref = (index: number): string | null => {
    if (!suggestions) return null
    let i = index
    if (i < suggestions.addresses.length) return suggestions.addresses[i].href
    i -= suggestions.addresses.length
    if (i < suggestions.cities.length) {
      const c = suggestions.cities[i]
      return cityPagePath(c.city)
    }
    i -= suggestions.cities.length
    if (i < suggestions.subdivisions.length) {
      const s = suggestions.subdivisions[i]
      return communityPagePath(s.city, s.subdivisionName)
    }
    return null
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || suggestions == null) {
      if (e.key === 'Escape') setOpen(false)
      return
    }
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
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
    if (e.key === 'Enter') {
      e.preventDefault()
      const href = totalItems > 0 ? getItemHref(highlight) : null
      if (href) {
        setOpen(false)
        setQuery('')
        router.push(href)
      }
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current?.contains(e.target as Node) || inputRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  let itemIndex = 0
  const linkClass = (isHighlight: boolean) =>
    `block w-full px-4 py-2.5 text-left text-sm transition ${isHighlight ? 'bg-card/20 text-white' : 'text-white/90 hover:bg-card/10'}`

  return (
    <div className="relative w-full max-w-2xl" ref={panelRef}>
      <Label htmlFor="hero-search-input" className="sr-only">
        Enter an address, neighborhood, city, or zip code
      </Label>
      <div className="flex items-center gap-3 rounded-lg border-2 border-white/30 bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm">
        <HugeiconsIcon icon={Search01Icon} className="h-6 w-6 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          id="hero-search-input"
          ref={inputRef}
          type="search"
          autoComplete="off"
          role="combobox"
          aria-expanded={open && totalItems > 0}
          placeholder="Enter an address, neighborhood, city, or zip code"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim().length >= MIN_QUERY_LENGTH && setOpen(true)}
          onKeyDown={handleKeyDown}
          className="min-w-0 flex-1 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <VoiceSearchButton
          onTranscript={(text) => {
            setQuery(text)
            router.push(`/listings?keywords=${encodeURIComponent(text)}`)
          }}
        />
      </div>
      <p className="mt-3 text-center text-lg font-medium text-white drop-shadow-md">
        {homesForYouLabel}
      </p>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(50vh,320px)] overflow-auto rounded-lg border border-border bg-card py-2 shadow-lg"
        >
          {query.trim().length < MIN_QUERY_LENGTH ? (
            <p className="px-4 py-2 text-sm text-muted-foreground">Type at least {MIN_QUERY_LENGTH} characters…</p>
          ) : loading ? (
            <p className="px-4 py-2 text-sm text-muted-foreground">Searching…</p>
          ) : suggestions && totalItems === 0 ? (
            <p className="px-4 py-2 text-sm text-muted-foreground">No results</p>
          ) : suggestions && totalItems > 0 ? (
            <>
              {suggestions.addresses.map((a, i) => {
                const idx = itemIndex++
                return (
                  <Link
                    key={`addr-${i}`}
                    role="option"
                    aria-selected={highlight === idx}
                    href={a.href}
                    className={`block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted ${highlight === idx ? 'bg-muted' : ''}`}
                    onClick={() => { setOpen(false); setQuery('') }}
                  >
                    {a.label}
                  </Link>
                )
              })}
              {suggestions.cities.map((c, i) => {
                const idx = itemIndex++
                const href = cityPagePath(c.city)
                return (
                  <Link
                    key={`city-${i}`}
                    role="option"
                    aria-selected={highlight === idx}
                    href={href}
                    className={`block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted ${highlight === idx ? 'bg-muted' : ''}`}
                    onClick={() => { setOpen(false); setQuery('') }}
                  >
                    {c.city} {c.count > 0 && <span className="text-muted-foreground">({c.count})</span>}
                  </Link>
                )
              })}
              {suggestions.subdivisions.map((s, i) => {
                const idx = itemIndex++
                const href = communityPagePath(s.city, s.subdivisionName)
                return (
                  <Link
                    key={`sub-${i}`}
                    role="option"
                    aria-selected={highlight === idx}
                    href={href}
                    className={`block px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted ${highlight === idx ? 'bg-muted' : ''}`}
                    onClick={() => { setOpen(false); setQuery('') }}
                  >
                    {s.subdivisionName} <span className="text-muted-foreground">({s.city})</span>
                  </Link>
                )
              })}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
