'use client'

/**
 * City hero search. Same public search stack as the homepage Stage, plus
 * one Type control. Empty submit still goes to this city's browse.
 */

import { useCallback, useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  SearchSuggestPanel,
  flattenSuggestions,
  useSearchSuggest,
  type SuggestItem,
} from '@/components/search/SearchSuggest'
import {
  CITY_TYPE_OPTIONS,
  citySearchHref,
  isCityTypeKey,
  type CityTypeKey,
} from './city-search'
import './city-hero-search.css'

export function CityHeroSearch({ cityName }: { cityName: string }) {
  const router = useRouter()
  const listId = useId()
  const typeId = useId()
  const [query, setQuery] = useState('')
  const [type, setType] = useState<CityTypeKey>('any')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const { suggestions, loading } = useSearchSuggest(query)
  const items = useMemo(() => flattenSuggestions(suggestions), [suggestions])
  const prefix = 'city-hero-suggest'

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
    const picked = highlight >= 0 ? items[highlight] : undefined
    if (picked && query.trim()) {
      go(picked.href)
      return
    }
    go(citySearchHref({ query, cityName, type }))
  }, [query, highlight, items, go, cityName, type])

  return (
    <form
      className="city-hero-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
    >
      <label className="city-hero-search__label" htmlFor={listId}>
        Search homes in {cityName}
      </label>
      <div className="city-hero-search__row">
        <input
          id={listId}
          className="city-hero-search__input"
          type="search"
          name="q"
          autoComplete="off"
          placeholder={`Address or community in ${cityName}`}
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
        <label className="city-hero-search__label" htmlFor={typeId}>
          Property type
        </label>
        <select
          id={typeId}
          className="city-hero-search__type"
          name="type"
          value={type}
          onChange={(event) => {
            const next = event.target.value
            setType(isCityTypeKey(next) ? next : 'any')
          }}
        >
          {CITY_TYPE_OPTIONS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
        <button type="submit" className="city-hero-search__go">
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
          className="city-hero-search__panel"
        />
      ) : null}
    </form>
  )
}
