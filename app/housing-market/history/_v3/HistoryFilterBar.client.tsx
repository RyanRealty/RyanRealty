'use client'

/**
 * Closed-sales explorer filter. Every control is on screen. No Step N of 4.
 *
 * GET contract is unchanged: year, city, type, fireplace, min, max.
 * A native GET form works without JS; submit strips empty / "all" values so
 * the URL stays the same shape the old sheet produced.
 */

import { useMemo, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { V3_ROOT_CLASS, V3Button, V3Eyebrow, V3Heading, V3Select } from '@/components/site/v3'
import { ANALYTICS_CO_CITIES_PROPER } from '@/lib/data/analytics/co-cities'
import { labelPropertyType } from '@/lib/data/analytics/property-type-labels'
import { formatPrice } from '@/lib/format/money'
import {
  HISTORY_FROM_YEAR,
  HISTORY_PATH,
  HISTORY_TO_YEAR,
  historyQueryFromFormData,
} from './history-query'
import './history-filter-bar.css'

const YEAR_OPTIONS = Array.from({ length: HISTORY_TO_YEAR - HISTORY_FROM_YEAR + 1 }, (_, index) => {
  const year = HISTORY_FROM_YEAR + index
  return { value: String(year), label: String(year) }
})

const TYPE_OPTIONS = [
  { value: '', label: 'All types' },
  { value: 'A', label: labelPropertyType('A') },
  { value: 'B', label: labelPropertyType('B') },
  { value: 'C', label: labelPropertyType('C') },
  { value: 'D', label: labelPropertyType('D') },
]

const FIREPLACE_OPTIONS = [
  { value: '', label: 'Any' },
  { value: '1', label: 'Fireplace only' },
]

const PRICE_STOPS = [250_000, 400_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000]

function priceOptions(kind: 'min' | 'max', current?: number) {
  const options = [
    { value: '', label: kind === 'min' ? 'Any min' : 'Any max' },
    ...PRICE_STOPS.map((amount) => ({ value: String(amount), label: formatPrice(amount) })),
  ]
  if (current != null && Number.isFinite(current) && !options.some((option) => option.value === String(current))) {
    options.push({ value: String(current), label: formatPrice(current) })
    options.sort((a, b) => {
      if (!a.value) return -1
      if (!b.value) return 1
      return Number(a.value) - Number(b.value)
    })
  }
  return options
}

type Props = {
  year: number
  city?: string
  propertyType?: 'A' | 'B' | 'C' | 'D'
  fireplace: boolean
  minPrice?: number
  maxPrice?: number
}

export function HistoryFilterBar({
  year,
  city,
  propertyType,
  fireplace,
  minPrice,
  maxPrice,
}: Props) {
  const router = useRouter()

  const yearOptions = useMemo(() => {
    const options = [...YEAR_OPTIONS]
    const current = String(year)
    if (!options.some((option) => option.value === current)) {
      options.push({ value: current, label: current })
      options.sort((a, b) => Number(a.value) - Number(b.value))
    }
    return options
  }, [year])

  const cityOptions = useMemo(
    () => [{ value: '', label: 'All cities' }, ...ANALYTICS_CO_CITIES_PROPER.map((name) => ({ value: name, label: name }))],
    [],
  )

  const minOptions = useMemo(() => priceOptions('min', minPrice), [minPrice])
  const maxOptions = useMemo(() => priceOptions('max', maxPrice), [maxPrice])

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    router.push(historyQueryFromFormData(new FormData(event.currentTarget)))
  }

  return (
    <section
      id="query"
      className={`${V3_ROOT_CLASS} history-filter-bar`}
      aria-labelledby="history-filter-heading"
    >
      <header className="history-filter-bar__head">
        <V3Eyebrow>Filter</V3Eyebrow>
        <V3Heading id="history-filter-heading" level={2} size="field">
          Filter these sales
        </V3Heading>
      </header>
      <form className="history-filter-bar__form" method="get" action={HISTORY_PATH} onSubmit={onSubmit}>
        <div className="history-filter-bar__fields">
          <V3Select name="year" label="Year" required options={yearOptions} defaultValue={String(year)} />
          <V3Select name="city" label="City" options={cityOptions} defaultValue={city ?? ''} />
          <V3Select name="type" label="Type" options={TYPE_OPTIONS} defaultValue={propertyType ?? ''} />
          <V3Select
            name="fireplace"
            label="Fireplace"
            options={FIREPLACE_OPTIONS}
            defaultValue={fireplace ? '1' : ''}
          />
          <V3Select
            name="min"
            label="Min price"
            options={minOptions}
            defaultValue={minPrice != null ? String(minPrice) : ''}
          />
          <V3Select
            name="max"
            label="Max price"
            options={maxOptions}
            defaultValue={maxPrice != null ? String(maxPrice) : ''}
          />
        </div>
        <V3Button type="submit">Show sales</V3Button>
      </form>
    </section>
  )
}
