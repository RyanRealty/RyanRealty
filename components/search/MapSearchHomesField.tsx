'use client'

/**
 * Flagship /homes-for-sale Field chrome. Consumes V3Field: photo doors +
 * the existing search-as-you-move map slot. Type chips match the homepage
 * Field lead. Hide subtraction stays at this edge.
 */

import { useMemo, useState } from 'react'
import ListingCardHideControl from '@/components/listing/ListingCardHideControl'
import { V3Button, V3Field, type V3FieldItem } from '@/components/site/v3'
import {
  searchFieldItems,
  type SearchFieldItem,
} from '@/app/search/_v3/search-field-items'
import type { ListingTileRow } from '@/app/actions/listings'
import type { ReactNode } from 'react'

export function MapSearchHomesField({
  listings,
  mapSlot,
  activeId,
  onActiveChange,
  onHiddenChange,
  count,
  leadExtra,
  emptyMessage,
}: {
  listings: readonly ListingTileRow[]
  mapSlot: ReactNode
  activeId?: string | null
  onActiveChange?: (id: string | null) => void
  onHiddenChange: (key: string, hidden: boolean) => void
  count?: {
    value: string
    label: string
    source: string
    updatedAt?: string | number | Date | null
  }
  leadExtra?: ReactNode
  emptyMessage: string
}) {
  const all = useMemo(() => searchFieldItems(listings), [listings])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])

  const types = useMemo(() => {
    const seen = new Set<string>()
    const next: { key: string; label: string; cat: 0 | 1 | 2 | 3 | 4 }[] = []
    for (const item of all) {
      if (seen.has(item.typeKey)) continue
      seen.add(item.typeKey)
      next.push({ key: item.typeKey, label: item.typeLabel, cat: item.cat })
    }
    return next
  }, [all])

  const visible =
    selectedTypes.length === 0
      ? all
      : all.filter((item) => selectedTypes.includes(item.typeKey))

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
      ariaLabel="Homes in this map view"
      items={visible}
      listAsDoors
      lead={
        <>
          {typeLead}
          {leadExtra}
        </>
      }
      count={count}
      emptyMessage={emptyMessage}
      activeId={activeId}
      onActiveChange={onActiveChange}
      itemChrome={(item: V3FieldItem) => {
        const row = item as SearchFieldItem
        return (
          <ListingCardHideControl
            listingKey={row.listingKey}
            addressLine={row.title}
            onVisibilityChange={onHiddenChange}
            className="left-1 top-1 right-auto size-7"
          />
        )
      }}
      mapSlot={mapSlot}
    />
  )
}
