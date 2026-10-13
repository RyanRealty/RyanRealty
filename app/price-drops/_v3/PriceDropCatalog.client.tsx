'use client'

/**
 * Every qualifying cut on the page, with city / price / beds filters and
 * load-more. The opening dials stay a preview; this is the catalog so a
 * 90-home week is not capped at 48 with no way to see the rest.
 */
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { V3Button, V3Heading, V3_ROOT_CLASS } from '@/components/site/v3'
import { listingRowPhotoSrc } from '@/lib/listing/row-photo'
import { cn } from '@/lib/utils'
import { PRICE_DROP_SIGNAL_DEFINITIONS, type PriceDropSignalKind } from '@/lib/price-drops/signals'
import {
  PRICE_DROP_BED_FILTERS,
  PRICE_DROP_CATALOG_PAGE_SIZE,
  PRICE_DROP_PRICE_FILTERS,
  PRICE_DROP_SIGNAL_FILTERS,
  catalogCityOptions,
  filterPriceDropCatalog,
  type PriceDropSignalFilter,
} from './drops-catalog'
import type { PriceDropFieldItem } from './drops-field-items'
import './price-drops-field.css'

export function PriceDropCatalog({
  id = 'all-cuts',
  items,
  showCityFilter = true,
  signalFilters = PRICE_DROP_SIGNAL_FILTERS,
}: {
  id?: string
  items: readonly PriceDropFieldItem[]
  showCityFilter?: boolean
  signalFilters?: ReadonlyArray<{ key: PriceDropSignalFilter; label: string }>
}) {
  const [city, setCity] = useState('')
  const [priceMax, setPriceMax] = useState<number | null>(null)
  const [bedsMin, setBedsMin] = useState<number | null>(null)
  const [signal, setSignal] = useState<PriceDropSignalFilter>('')
  const [shown, setShown] = useState(PRICE_DROP_CATALOG_PAGE_SIZE)

  const cities = useMemo(() => catalogCityOptions(items), [items])
  const filtered = useMemo(
    () => filterPriceDropCatalog(items, { city, priceMax, bedsMin, signal }),
    [items, city, priceMax, bedsMin, signal],
  )
  const visible = filtered.slice(0, shown)
  const remaining = filtered.length - visible.length

  if (items.length === 0) return null

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'pd-catalog')}
      aria-label="Every home that cut its asking price this week"
    >
      <header className="pd-catalog__head">
        <V3Heading level={2}>Every cut this week</V3Heading>
        <p className="pd-catalog__count">
          {filtered.length === items.length
            ? `${filtered.length} ${filtered.length === 1 ? 'home' : 'homes'}`
            : `${filtered.length} of ${items.length} homes`}
        </p>
      </header>

      <div className="pd-catalog__filters">
        {showCityFilter && cities.length > 1 ? (
          <label className="pd-catalog__field">
            <span>City</span>
            <select
              value={city}
              onChange={(event) => {
                setCity(event.target.value)
                setShown(PRICE_DROP_CATALOG_PAGE_SIZE)
              }}
            >
              <option value="">All cities</option>
              {cities.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <fieldset className="pd-catalog__chips">
          <legend>Price</legend>
          {PRICE_DROP_PRICE_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={cn('pd-catalog__chip', priceMax === option.max && 'is-on')}
              aria-pressed={priceMax === option.max}
              onClick={() => {
                setPriceMax(option.max)
                setShown(PRICE_DROP_CATALOG_PAGE_SIZE)
              }}
            >
              {option.label}
            </button>
          ))}
        </fieldset>

        <fieldset className="pd-catalog__chips">
          <legend>Beds</legend>
          {PRICE_DROP_BED_FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={cn('pd-catalog__chip', bedsMin === option.min && 'is-on')}
              aria-pressed={bedsMin === option.min}
              onClick={() => {
                setBedsMin(option.min)
                setShown(PRICE_DROP_CATALOG_PAGE_SIZE)
              }}
            >
              {option.label}
            </button>
          ))}
        </fieldset>

        {signalFilters.length > 1 ? (
          <fieldset className="pd-catalog__chips">
            <legend>Signals</legend>
            {signalFilters.map((option) => (
              <button
                key={option.key || 'any'}
                type="button"
                className={cn('pd-catalog__chip', signal === option.key && 'is-on')}
                aria-pressed={signal === option.key}
                onClick={() => {
                  setSignal(option.key)
                  setShown(PRICE_DROP_CATALOG_PAGE_SIZE)
                }}
              >
                {option.label}
              </button>
            ))}
          </fieldset>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="pd-catalog__empty">No cut this week matches those filters.</p>
      ) : (
        <ul className="pd-catalog__list" role="list">
          {visible.map((item) => {
            const signals = catalogRowSignals(item)
            return (
            <li key={item.id}>
              <Link href={item.href} className="pd-catalog__row">
                {item.photoSrc ? (
                  <img
                    className="pd-catalog__photo"
                    src={listingRowPhotoSrc(item.photoSrc)}
                    alt={item.title}
                    width={160}
                    height={120}
                    loading="lazy"
                  />
                ) : null}
                <span className="pd-catalog__copy">
                  <span className="pd-catalog__price">{item.priceLabel}</span>
                  <span className="pd-catalog__street">{item.title}</span>
                  {item.dropLine ? <span className="pd-catalog__drop">{item.dropLine}</span> : null}
                  {item.specs ? <span className="pd-catalog__specs">{item.specs}</span> : null}
                  {signals.length > 0 ? (
                    <span className="pd-catalog__signals">{signals.join(' · ')}</span>
                  ) : null}
                </span>
              </Link>
            </li>
            )
          })}
        </ul>
      )}

      {remaining > 0 ? (
        <div className="pd-catalog__more">
          <V3Button
            type="button"
            variant="ghost"
            onClick={() => setShown((n) => n + PRICE_DROP_CATALOG_PAGE_SIZE)}
          >
            {`Show ${Math.min(remaining, PRICE_DROP_CATALOG_PAGE_SIZE)} more`}
          </V3Button>
        </div>
      ) : null}
    </section>
  )
}

const ROW_SIGNAL_ORDER: PriceDropSignalKind[] = [
  'repeatCuts',
  'longDom',
  'ownerWillCarry',
  'sellerCredit',
  'bankOwned',
]

function catalogRowSignals(item: PriceDropFieldItem): string[] {
  return ROW_SIGNAL_ORDER.filter((kind) => item.signals?.[kind]).map(
    (kind) => PRICE_DROP_SIGNAL_DEFINITIONS[kind].label,
  )
}
