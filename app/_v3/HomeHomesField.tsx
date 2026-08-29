'use client'

/**
 * Homepage inventory Field. Types that exist in the set are lead chips on
 * V3Field (tokens only). Price range sits next to those chips. Towns are not
 * a second chip row — Stage search already takes a place. Map and list share
 * one frame: list first on 390, map behind a Map toggle; map left at 1280.
 */
import { useMemo, useState } from 'react'
import { V3Button, V3Field } from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import type { HomeFieldItem } from './home-field-items'
import { HOME_FIELD_LIMIT } from './home-constants'

const PRICE_STOPS = [
  { value: null, label: 'Any' },
  { value: 400_000, label: '$400,000' },
  { value: 500_000, label: '$500,000' },
  { value: 600_000, label: '$600,000' },
  { value: 750_000, label: '$750,000' },
  { value: 1_000_000, label: '$1,000,000' },
  { value: 1_500_000, label: '$1,500,000' },
  { value: 2_000_000, label: '$2,000,000' },
  { value: 3_000_000, label: '$3,000,000' },
] as const

function parseStop(value: string): number | null {
  if (value === '' || value === 'any') return null
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function HomeHomesField({
  fieldItems,
  boundary,
  listFlow,
  seeAll,
  emptyMessage,
  displayLimit = HOME_FIELD_LIMIT,
}: {
  fieldItems: HomeFieldItem[]
  boundary?: unknown
  listFlow?: boolean
  seeAll?: { href: string; label: string }
  emptyMessage: string
  displayLimit?: number
}) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [minPrice, setMinPrice] = useState<number | null>(null)
  const [maxPrice, setMaxPrice] = useState<number | null>(null)
  const types = useMemo(() => {
    const seen = new Set<string>()
    const next: { key: string; label: string; cat: 0 | 1 | 2 | 3 | 4 }[] = []
    for (const item of fieldItems) {
      if (seen.has(item.typeKey)) continue
      seen.add(item.typeKey)
      next.push({ key: item.typeKey, label: item.typeLabel, cat: item.cat })
    }
    return next
  }, [fieldItems])
  const visible = useMemo(() => {
    const set = fieldItems.filter((item) => {
      if (selectedTypes.length > 0 && !selectedTypes.includes(item.typeKey)) return false
      if (minPrice != null && item.listPrice < minPrice) return false
      if (maxPrice != null && item.listPrice > maxPrice) return false
      return true
    })
    return set.slice(0, displayLimit)
  }, [fieldItems, selectedTypes, minPrice, maxPrice, displayLimit])

  const typeLead = (
    <>
      {types.length > 1 ? (
        <nav aria-label="Property types">
          {types.map((type) => {
            const on = selectedTypes.includes(type.key)
            return (
              <V3Button
                key={type.key}
                type="button"
                variant="ghost"
                ariaPressed={on}
                onClick={() =>
                  setSelectedTypes((prev) =>
                    prev.includes(type.key)
                      ? prev.filter((key) => key !== type.key)
                      : [...prev, type.key],
                  )
                }
              >
                <span
                  className={`v3-field__mark v3-field__mark--cat-${type.cat}`}
                  aria-hidden="true"
                />
                {type.label}
              </V3Button>
            )
          })}
        </nav>
      ) : null}
      <div className="v3-field__range" role="group" aria-label="Price range">
        <label>
          <span className="v3-field__range-label">Min</span>
          <select
            value={minPrice ?? 'any'}
            onChange={(event) => setMinPrice(parseStop(event.target.value))}
          >
            {PRICE_STOPS.map((stop) => (
              <option key={`min-${stop.label}`} value={stop.value ?? 'any'}>
                {stop.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="v3-field__range-label">Max</span>
          <select
            value={maxPrice ?? 'any'}
            onChange={(event) => setMaxPrice(parseStop(event.target.value))}
          >
            {PRICE_STOPS.map((stop) => (
              <option key={`max-${stop.label}`} value={stop.value ?? 'any'}>
                {stop.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  )

  return (
    <V3Field
      id="homes"
      ariaLabel="Homes for sale across Central Oregon"
      items={visible}
      mapSlot={(binding) => {
        const pins = binding.items.flatMap((item) =>
          item.lat != null && item.lng != null
            ? [
                {
                  id: item.id,
                  href: item.href,
                  priceLabel: item.priceLabel,
                  title: item.title,
                  lat: item.lat,
                  lng: item.lng,
                  cat: item.cat,
                },
              ]
            : [],
        )
        if (pins.length === 0) return null
        return (
          <PlaceFieldMap
            pins={pins}
            placeName="Central Oregon"
            posterSrc={visible[0]?.photoSrc ?? fieldItems[0]?.photoSrc}
            boundary={boundary}
          />
        )
      }}
      lead={typeLead}
      listFlow={listFlow}
      listFirst
      mapToggle
      action={seeAll}
      emptyMessage={emptyMessage}
    />
  )
}
