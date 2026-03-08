'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSearchSuggestions } from '@/app/actions/listings'
import type { SearchSuggestionsResult } from '@/app/actions/listings'
import { cityEntityKey, subdivisionEntityKey } from '@/lib/slug'

const DEBOUNCE_MS = 220
const MIN_QUERY_LENGTH = 2

type SmartSearchProps = { onClose?: () => void }

export default function SmartSearch({ onClose }: SmartSearchProps = {}) {
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
      : suggestions.addresses.length +
        suggestions.cities.length +
        suggestions.subdivisions.length

  const getItemHref = (index: number): string | null => {
    if (!suggestions) return null
    let i = index
    if (i < suggestions.addresses.length)
      return suggestions.addresses[i].href
    i -= suggestions.addresses.length
    if (i < suggestions.cities.length) {
      const c = suggestions.cities[i]
      return `/search/${cityEntityKey(c.city)}`
    }
    i -= suggestions.cities.length
    if (i < suggestions.subdivisions.length) {
      const s = suggestions.subdivisions[i]
      return `/search/${cityEntityKey(s.city)}/${encodeURIComponent(s.subdivisionName)}`
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
      inputRef.current?.blur()
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
      const href = getItemHref(highlight)
      if (href) {
        setOpen(false)
        setQuery('')
        onClose?.()
        router.push(href)
      }
    }
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current?.contains(e.target as Node) ||
        inputRef.current?.contains(e.target as Node)
      )
        return
      setOpen(false)
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  let itemIndex = 0
  const linkClass = (isHighlight: boolean) =>
    `block w-full px-4 py-2.5 text-left text-sm transition ${
      isHighlight ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-700 hover:bg-zinc-50'
    }`

  return (
    <div className="relative w-full max-w-md" ref={panelRef}>
      <label htmlFor="smart-search-input" className="sr-only">
        Search address, city, or neighborhood
      </label>
      <input
        id="smart-search-input"
        ref={inputRef}
        type="search"
        autoComplete="off"
        role="combobox"
        aria-expanded={open && totalItems > 0}
        aria-controls="smart-search-results"
        aria-activedescendant={
          open && totalItems > 0 ? `smart-search-item-${highlight}` : undefined
        }
        placeholder="Search address, city, or neighborhood…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.trim().length >= MIN_QUERY_LENGTH && setOpen(true)}
        onKeyDown={handleKeyDown}
        className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-4 pr-10 text-zinc-900 placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </span>

      {open && (
        <div
          id="smart-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[min(70vh,400px)] overflow-auto rounded-xl border border-zinc-200 bg-white py-2 shadow-lg"
        >
          {query.trim().length < MIN_QUERY_LENGTH ? (
            <p className="px-4 py-2 text-sm text-zinc-500">
              Type at least {MIN_QUERY_LENGTH} characters…
            </p>
          ) : loading ? (
            <p className="px-4 py-2 text-sm text-zinc-500">Searching…</p>
          ) : suggestions && totalItems === 0 ? (
            <p className="px-4 py-2 text-sm text-zinc-500">No results</p>
          ) : suggestions && totalItems > 0 ? (
            <>
              {suggestions.addresses.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Addresses
                  </p>
                  {suggestions.addresses.map((a, i) => {
                    const idx = itemIndex++
                    return (
                      <Link
                        key={`addr-${i}-${a.label}`}
                        id={`smart-search-item-${idx}`}
                        role="option"
                        aria-selected={highlight === idx}
                        href={a.href}
                        className={linkClass(highlight === idx)}
                        onClick={() => {
                          setOpen(false)
                          setQuery('')
                          onClose?.()
                        }}
                      >
                        {a.label}
                      </Link>
                    )
                  })}
                </div>
              )}
              {suggestions.cities.length > 0 && (
                <div className="mb-1">
                  <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Cities
                  </p>
                  {suggestions.cities.map((c, i) => {
                    const idx = itemIndex++
                    const href = `/search/${cityEntityKey(c.city)}`
                    return (
                      <Link
                        key={`city-${i}-${c.city}`}
                        id={`smart-search-item-${idx}`}
                        role="option"
                        aria-selected={highlight === idx}
                        href={href}
                        className={linkClass(highlight === idx)}
                        onClick={() => {
                          setOpen(false)
                          setQuery('')
                          onClose?.()
                        }}
                      >
                        {c.city}
                        {c.count > 0 && <span className="ml-1 text-zinc-400">({c.count})</span>}
                      </Link>
                    )
                  })}
                </div>
              )}
              {suggestions.subdivisions.length > 0 && (
                <div>
                  <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Neighborhoods &amp; communities
                  </p>
                  {suggestions.subdivisions.map((s, i) => {
                    const idx = itemIndex++
                    const href = `/search/${cityEntityKey(s.city)}/${encodeURIComponent(s.subdivisionName)}`
                    return (
                      <Link
                        key={`sub-${i}-${s.city}-${s.subdivisionName}`}
                        id={`smart-search-item-${idx}`}
                        role="option"
                        aria-selected={highlight === idx}
                        href={href}
                        className={linkClass(highlight === idx)}
                        onClick={() => {
                          setOpen(false)
                          setQuery('')
                          onClose?.()
                        }}
                      >
                        {s.subdivisionName}
                        <span className="ml-1 text-zinc-400">({s.city})</span>
                        {s.count > 0 && <span className="ml-1 text-zinc-400">· {s.count}</span>}
                      </Link>
                    )
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}
