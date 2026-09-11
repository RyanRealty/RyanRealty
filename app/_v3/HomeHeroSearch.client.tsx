'use client'

/**
 * Homepage hero search. Buy | Sell, built so BOTH sides exist in the server
 * HTML and both work with scripting off (SITE-12). SITE-83 adapts catalog
 * modules into house primitives: V3Tabs (sliding indicator), V3MorphSearch
 * (field morphs into results). The live count on the navy chip is type, not
 * a digit wheel — AnimatedNumber paints cream tiles that read as a white hole.
 */

import { useCallback, useId, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { flattenSuggestions, useSearchSuggest } from '@/components/search/SearchSuggest'
import AddressAutocomplete from '@/components/seller-lp/AddressAutocomplete'
import { V3MorphSearch, V3Tabs, type V3MorphSearchItem } from '@/components/site/v3'
import { searchHrefForQuery } from '@/lib/parse-search-query'
import { publishRegionalSearchHref } from '@/lib/search/publish-regional-search-href'
import { markAskSource } from '@/lib/ask-source'
import { trackEvent } from '@/lib/tracking'
import type { HomeHeroLive } from './home-hero-inventory'
import './home-hero-search.css'

/** Where a no-JS Buy submit lands: the regional inventory page. */
const BUY_ACTION = '/homes-for-sale'
/** Where a no-JS Sell submit lands: the valuation form, at its anchor. */
const SELL_ACTION = '/sell#get-value'

/** MorphingSearch shows these when the query is empty — the demo opens onto a list, not a blank overlay. */
const PLACE_SEEDS: V3MorphSearchItem[] = [
  { id: '/homes-for-sale/bend', title: 'Bend', description: 'City' },
  { id: '/homes-for-sale/redmond', title: 'Redmond', description: 'City' },
  { id: '/homes-for-sale/sisters', title: 'Sisters', description: 'City' },
  { id: '/homes-for-sale/sunriver', title: 'Sunriver', description: 'Community' },
  { id: '/communities/tetherow', title: 'Tetherow', description: 'Bend' },
  { id: '/homes-for-sale/prineville', title: 'Prineville', description: 'City' },
  { id: '/homes-for-sale/la-pine', title: 'La Pine', description: 'City' },
  { id: '/homes-for-sale/madras', title: 'Madras', description: 'City' },
]

export function HomeHeroSearch({
  valuationHref,
  live,
}: {
  valuationHref: string
  live?: HomeHeroLive
}) {
  const router = useRouter()
  const uid = useId()
  const [query, setQuery] = useState('')
  const [sellAddress, setSellAddress] = useState('')
  const { suggestions } = useSearchSuggest(query)
  const items = useMemo(
    () =>
      flattenSuggestions(suggestions).filter(
        (item) =>
          item.kind === 'address' ||
          item.kind === 'city' ||
          item.kind === 'subdivision' ||
          item.kind === 'neighborhood' ||
          item.kind === 'zip',
      ),
    [suggestions],
  )
  const morphItems = useMemo<V3MorphSearchItem[]>(() => {
    const live = items.map((item) => ({
      id: item.href,
      title: item.label,
      description: item.sublabel,
    }))
    return live.length > 0 ? live : PLACE_SEEDS
  }, [items])

  const go = useCallback(
    (href: string) => {
      router.push(href)
    },
    [router],
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
    go(searchHrefForQuery(text))
  }, [query, go])

  const onSellSubmit = useCallback(() => {
    const address = sellAddress.trim()
    try {
      trackEvent('address_submit', { form: 'get-value', surface: 'home_hero' })
    } catch {
      // tracking helper missing in some envs
    }
    try {
      markAskSource('hero')
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

      {live ? (
        <p className="home-hero-search__live">
          <span className="home-hero-search__live-n">{live.forSaleLabel}</span>
          <span className="home-hero-search__live-label"> homes for sale</span>
        </p>
      ) : null}

      <V3Tabs
        label="Buy or sell"
        count={2}
        className="home-hero-search__tabs"
        items={[
          { value: 'buy', label: 'Buy', htmlFor: buyModeId },
          { value: 'sell', label: 'Sell', htmlFor: sellModeId },
        ]}
      />

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
          Find a home
        </label>
        <V3MorphSearch
          placeholder="Bend, Tetherow, or an address"
          items={morphItems}
          onQueryChange={setQuery}
          onSelect={(item) => go(item.id)}
        >
          <div className="v3-morph-search__field">
            <input
              id={buyFieldId}
              className="home-hero-search__input"
              type="search"
              name="q"
              autoComplete="off"
              placeholder="Bend, Tetherow, or an address"
              defaultValue=""
            />
          </div>
          <button type="submit" className="v3-morph-search__go home-hero-search__go">
            Search
          </button>
        </V3MorphSearch>
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
          Value your home
        </label>
        <V3MorphSearch>
          <div className="v3-morph-search__field">
            <AddressAutocomplete
              id={sellFieldId}
              name="address"
              value={sellAddress}
              onChange={setSellAddress}
              placeholder="Street address"
              className="home-hero-search__input"
              wrapperClassName="home-hero-search__address"
            />
          </div>
          <button type="submit" className="v3-morph-search__go home-hero-search__go">
            Value my home
          </button>
        </V3MorphSearch>
      </form>
    </div>
  )
}
