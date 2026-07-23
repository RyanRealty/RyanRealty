'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  useSearchSuggest,
  flattenSuggestions,
  SearchSuggestPanel,
  SUGGEST_MIN_QUERY_LENGTH,
  type SuggestItem,
} from '@/components/search/SearchSuggest'

/**
 * W4.1 — global header search for the DEFAULT (SiteHeader) chrome.
 *
 * The KB-nav chrome (KbNav.client) already carries the ONE suggestions engine
 * (components/search/SearchSuggest). This gives the SAME engine to every page
 * that falls back to SiteHeader — /dashboard, /account, the auth pages, /feed,
 * and the legal pages — so search is reachable from every header on the site,
 * not just the ~70 KB-chrome routes. Input glue only: the fetch, flatten, and
 * dropdown are the shared SearchSuggest engine, never a second copy.
 *
 * Raw <input>/<label> (like KbNav's + MobileNav's search) — NOT the shadcn
 * <Input>: the default chrome is a burn-down-shadcn site surface
 * (ci:shadcn-burndown), and the KB `--cream` design tokens are scoped to
 * `.kb-root` (unavailable here), so this on-navy box is styled with the global
 * `primary-foreground` token. Listed in .design-token-lint-ignore for the raw
 * primitives (same exception class as the KB idiom).
 */
const INPUT_ID = 'site-header-search'

export default function SiteHeaderSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(-1)
  const [focused, setFocused] = useState(false)
  const { suggestions, loading } = useSearchSuggest(query)
  const items = flattenSuggestions(suggestions)
  const open = focused && query.trim().length >= SUGGEST_MIN_QUERY_LENGTH

  const go = useCallback(
    (item?: SuggestItem) => {
      if (item) {
        router.push(item.href)
      } else {
        const q = query.trim()
        if (!q) return
        router.push(`/search?q=${encodeURIComponent(q)}`)
      }
      setQuery('')
      setHighlight(-1)
      document.getElementById(INPUT_ID)?.blur()
    },
    [query, router],
  )

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('')
      setHighlight(-1)
      return
    }
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault()
      setHighlight((h) => (h < items.length - 1 ? h + 1 : 0))
      return
    }
    if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault()
      setHighlight((h) => (h > 0 ? h - 1 : items.length - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      go(highlight >= 0 ? items[highlight] : items[0])
    }
  }

  return (
    <div className="relative hidden md:block">
      <label htmlFor={INPUT_ID} className="sr-only">
        Search homes, neighborhoods, and guides
      </label>
      <input
        id={INPUT_ID}
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setHighlight(-1)
        }}
        onFocus={() => setFocused(true)}
        // Delay blur so a mousedown on a panel option is handled before the
        // panel unmounts (SearchSuggestPanel defers navigation to onMouseDown).
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={onKeyDown}
        placeholder="Search"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls="site-header-search-panel"
        className="h-9 w-40 rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-3 text-sm text-primary-foreground transition-all placeholder:text-primary-foreground/60 focus:w-56 focus:border-primary-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary-foreground/30"
      />
      {open && (
        <div id="site-header-search-panel" className="absolute right-0 top-11 z-50 w-80">
          <SearchSuggestPanel
            items={items}
            loading={loading}
            hasResult={suggestions !== null}
            highlight={highlight}
            idPrefix="site-header-search"
            onPick={(item) => go(item)}
            className="overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-lg"
          />
        </div>
      )}
    </div>
  )
}
