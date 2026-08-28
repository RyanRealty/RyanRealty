'use client'

/**
 * Homepage hero search. Reuses the site's one public search stack:
 * SearchSuggest (city / community / address) + parseSearchQuery +
 * searchHrefForQuery. No second suggestions engine.
 */

import { useCallback, useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  SearchSuggestPanel,
  flattenSuggestions,
  useSearchSuggest,
  type SuggestItem,
} from '@/components/search/SearchSuggest'
import { searchHrefForQuery } from '@/lib/parse-search-query'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import './home-hero-search.css'

export function HomeHeroSearch() {
  const router = useRouter()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const { suggestions, loading } = useSearchSuggest(query)
  const items = useMemo(() => flattenSuggestions(suggestions), [suggestions])
  const prefix = 'home-hero-suggest'

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router],
  )

  const onPick = useCallback(
    (item: SuggestItem) => {
      go(item.href)
    },
    [go],
  )

  const onSubmit = useCallback(() => {
    const text = query.trim()
    if (!text) {
      go(publishRegionalSearchHref())
      return
    }
    const picked = highlight >= 0 ? items[highlight] : undefined
    if (picked) {
      go(picked.href)
      return
    }
    go(searchHrefForQuery(text))
  }, [query, highlight, items, go])

  return (
    <form
      className="home-hero-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label className="home-hero-search__label" htmlFor={listId}>
        Search homes
      </label>
      <div className="home-hero-search__row">
        <input
          id={listId}
          className="home-hero-search__input"
          type="search"
          name="q"
          autoComplete="off"
          placeholder="City, community, or address"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setHighlight(-1)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              return
            }
            if (event.key === 'ArrowDown' && open && items.length > 0) {
              event.preventDefault()
              setHighlight((h) => (h < items.length - 1 ? h + 1 : 0))
              return
            }
            if (event.key === 'ArrowUp' && open && items.length > 0) {
              event.preventDefault()
              setHighlight((h) => (h > 0 ? h - 1 : items.length - 1))
            }
          }}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && (items.length > 0 || loading)}
          aria-controls={`${prefix}-listbox`}
          aria-activedescendant={
            open && highlight >= 0 ? `${prefix}-item-${highlight}` : undefined
          }
        />
        <button type="submit" className="home-hero-search__go">
          Search
        </button>
      </div>
      {open ? (
        <SearchSuggestPanel
          items={items}
          loading={loading}
          hasResult={suggestions !== null}
          highlight={highlight}
          idPrefix={prefix}
          onPick={onPick}
          className="home-hero-search__panel"
        />
      ) : null}
    </form>
  )
}
