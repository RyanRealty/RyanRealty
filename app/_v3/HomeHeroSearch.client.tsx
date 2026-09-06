'use client'

/**
 * Homepage hero search. Buy | Sell tabs (Redfin/Zillow pattern).
 * Buy reuses SearchSuggest + parseSearchQuery + searchHrefForQuery.
 * Sell routes to the valuation spine (Value my home).
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

type HeroTab = 'buy' | 'sell'

export function HomeHeroSearch({ valuationHref }: { valuationHref: string }) {
  const router = useRouter()
  const listId = useId()
  const [tab, setTab] = useState<HeroTab>('buy')
  const [query, setQuery] = useState('')
  const [sellAddress, setSellAddress] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const { suggestions, loading } = useSearchSuggest(tab === 'buy' ? query : '')
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

  const onBuySubmit = useCallback(() => {
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

  const onSellSubmit = useCallback(() => {
    // Valuation spine owns the address field. Hero Sell tab opens that path.
    void sellAddress
    go(valuationHref)
  }, [go, valuationHref, sellAddress])

  const buyFieldId = `${listId}-q`
  const sellFieldId = `${listId}-sell`
  const tabsId = `${listId}-tabs`

  return (
    <div className="home-hero-search">
      <div className="home-hero-search__tabs" role="tablist" aria-label="Buy or sell" id={tabsId}>
        <button
          type="button"
          role="tab"
          id={`${tabsId}-buy`}
          aria-selected={tab === 'buy'}
          aria-controls={`${tabsId}-buy-panel`}
          className={
            tab === 'buy'
              ? 'home-hero-search__tab home-hero-search__tab--on'
              : 'home-hero-search__tab'
          }
          onClick={() => {
            setTab('buy')
            setOpen(false)
          }}
        >
          Buy
        </button>
        <button
          type="button"
          role="tab"
          id={`${tabsId}-sell`}
          aria-selected={tab === 'sell'}
          aria-controls={`${tabsId}-sell-panel`}
          className={
            tab === 'sell'
              ? 'home-hero-search__tab home-hero-search__tab--on'
              : 'home-hero-search__tab'
          }
          onClick={() => {
            setTab('sell')
            setOpen(false)
          }}
        >
          Sell
        </button>
      </div>

      {tab === 'buy' ? (
        <form
          id={`${tabsId}-buy-panel`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-buy`}
          className="home-hero-search__panel-form"
          onSubmit={(event) => {
            event.preventDefault()
            onBuySubmit()
          }}
        >
          <label className="home-hero-search__label" htmlFor={buyFieldId}>
            City, community, or address
          </label>
          <div className="home-hero-search__row">
            <input
              id={buyFieldId}
              className="home-hero-search__input"
              type="search"
              name="q"
              autoComplete="off"
              placeholder="Bend, Tetherow, or a street address"
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
      ) : (
        <form
          id={`${tabsId}-sell-panel`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-sell`}
          className="home-hero-search__panel-form"
          onSubmit={(event) => {
            event.preventDefault()
            onSellSubmit()
          }}
        >
          <label className="home-hero-search__label" htmlFor={sellFieldId}>
            Home address
          </label>
          <div className="home-hero-search__row">
            <input
              id={sellFieldId}
              className="home-hero-search__input"
              type="text"
              name="address"
              autoComplete="street-address"
              placeholder="Enter your home address"
              value={sellAddress}
              onChange={(event) => setSellAddress(event.target.value)}
            />
            <button type="submit" className="home-hero-search__go">
              Value my home
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
