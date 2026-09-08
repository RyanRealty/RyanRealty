'use client'

/**
 * Homepage hero search. Buy | Sell, the Redfin/Zillow hero pattern, built so
 * BOTH sides exist in the server HTML and both work with scripting off.
 *
 * WHY THAT MATTERS (site queue SITE-12). The Sell panel used to be rendered
 * only when React state said the Sell tab was open, so `curl /` returned a page
 * with no seller ask in it at all: not for a crawler, not for an answer engine,
 * not for a visitor whose JavaScript had not arrived. The panel is now always
 * in the document and the switch is a native radio group plus a CSS sibling
 * selector — no state, no effect, nothing to hydrate before the field is real.
 *
 *   curl -s http://localhost:3000/ | grep 'name="address"'   → the seller field
 *
 * BOTH FORMS SUBMIT WITHOUT JAVASCRIPT. Each is a real GET form with a real
 * action, so a submit lands somewhere useful before React is involved: Buy on
 * the inventory page, Sell on /sell with the typed address in the query. With
 * JavaScript the handlers do better — Buy parses the query into filters, Sell
 * stamps the ask source — but neither is load-bearing.
 *
 * ONE ADDRESS FIELD, NOT TWO. The Sell field is `AddressAutocomplete`, the same
 * component /sell uses, so a visitor gets the same Places behaviour, the same
 * degradation when Places is unavailable, and the same validated string in both
 * places. A second address input on the site is how two behaviours start.
 *
 * ATTRIBUTION. The Sell submit stamps `markAskSource('hero')` before it
 * navigates, which /sell's form reads once at submit and carries into the CMA
 * request — so a valuation that started on the homepage is countable in the row
 * it created, not only in GA4. The no-JS path cannot stamp session storage, so
 * those submits arrive unattributed rather than mis-attributed.
 */

import { useCallback, useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  SearchSuggestPanel,
  flattenSuggestions,
  useSearchSuggest,
  type SuggestItem,
} from '@/components/search/SearchSuggest'
import AddressAutocomplete from '@/components/seller-lp/AddressAutocomplete'
import { searchHrefForQuery } from '@/lib/parse-search-query'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { markAskSource } from '@/lib/ask-source'
import { trackEvent } from '@/lib/tracking'
import './home-hero-search.css'

/** Where a no-JS Buy submit lands: the regional inventory page. */
const BUY_ACTION = '/homes-for-sale'
/** Where a no-JS Sell submit lands: the valuation form, at its anchor. */
const SELL_ACTION = '/sell#get-value'

export function HomeHeroSearch({ valuationHref }: { valuationHref: string }) {
  const router = useRouter()
  const uid = useId()
  const [query, setQuery] = useState('')
  const [sellAddress, setSellAddress] = useState('')
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

  const onBuySubmit = useCallback(() => {
    const text = query.trim()
    try {
      trackEvent('search', { surface: 'home_hero', ...(text ? { search_term: text } : {}) })
    } catch {
      // tracking helper missing in some envs
    }
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
    const address = sellAddress.trim()
    // The denominator the node's accept test needs: seller asks that STARTED on
    // the homepage, countable per session before any of them reaches a contact
    // step. Fired for an empty field too — an empty submit is still an intent.
    try {
      trackEvent('address_submit', { form: 'get-value', surface: 'home_hero' })
    } catch {
      // tracking helper missing in some envs
    }
    try {
      markAskSource('hero') // click handler, never a render body (G37)
    } catch {
      // storage blocked — the submit still goes through, unattributed
    }
    if (!address) {
      go(valuationHref)
      return
    }
    const [path, hash] = valuationHref.split('#')
    const sep = path?.includes('?') ? '&' : '?'
    go(`${path}${sep}address=${encodeURIComponent(address)}${hash ? `#${hash}` : ''}`)
  }, [go, valuationHref, sellAddress])

  const buyFieldId = `${uid}-q`
  const sellFieldId = `${uid}-sell`
  const buyModeId = `${uid}-mode-buy`
  const sellModeId = `${uid}-mode-sell`

  return (
    <div className="home-hero-search">
      {/* The switch. Visually hidden, still focusable, and first in the DOM so
          plain sibling selectors carry its state to the tabs and the panels. */}
      <input
        type="radio"
        name={`${uid}-mode`}
        id={buyModeId}
        value="buy"
        defaultChecked
        className="home-hero-search__mode home-hero-search__mode--buy"
      />
      <input
        type="radio"
        name={`${uid}-mode`}
        id={sellModeId}
        value="sell"
        className="home-hero-search__mode home-hero-search__mode--sell"
      />

      <div className="home-hero-search__tabs">
        <label className="home-hero-search__tab home-hero-search__tab--buy" htmlFor={buyModeId}>
          Buy
        </label>
        <label className="home-hero-search__tab home-hero-search__tab--sell" htmlFor={sellModeId}>
          Sell
        </label>
      </div>

      <form
        action={BUY_ACTION}
        method="get"
        className="home-hero-search__panel-form home-hero-search__panel-form--buy"
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

      <form
        action={SELL_ACTION}
        method="get"
        className="home-hero-search__panel-form home-hero-search__panel-form--sell"
        onSubmit={(event) => {
          event.preventDefault()
          onSellSubmit()
        }}
      >
        <label className="home-hero-search__label" htmlFor={sellFieldId}>
          Home address
        </label>
        <div className="home-hero-search__row">
          <AddressAutocomplete
            id={sellFieldId}
            name="address"
            value={sellAddress}
            onChange={setSellAddress}
            placeholder="Enter your home address"
            className="home-hero-search__input"
            wrapperClassName="home-hero-search__address"
          />
          <button type="submit" className="home-hero-search__go">
            Value my home
          </button>
        </div>
      </form>
    </div>
  )
}
