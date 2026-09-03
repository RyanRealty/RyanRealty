'use client'

/**
 * Homepage inventory Field. Types that exist in the set are lead chips on
 * V3Field (tokens only). The living atlas above is the map — this is the
 * photographed list, not a second Google frame.
 */
import { useMemo, useState } from 'react'
import { V3Button, V3Field } from '@/components/site/v3'
import type { HomeFieldItem } from './home-field-items'
import { HOME_FIELD_LIMIT } from './home-constants'

export function HomeHomesField({
  fieldItems,
  boundary: _boundary,
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
    const set =
      selectedTypes.length === 0
        ? fieldItems
        : fieldItems.filter((item) => selectedTypes.includes(item.typeKey))
    return set.slice(0, displayLimit)
  }, [fieldItems, selectedTypes, displayLimit])

  const typeLead =
    types.length > 1 ? (
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
    ) : null

  return (
    <V3Field
      id="homes"
      ariaLabel="Homes for sale across Central Oregon"
      items={visible}
      mapSlot={undefined}
      lead={typeLead}
      listFlow={listFlow}
      action={seeAll}
      emptyMessage={emptyMessage}
    />
  )
}
