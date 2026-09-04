'use client'

/**
 * Homepage inventory Field. Types that exist in the set are lead chips on
 * V3Field (tokens only). The living atlas above is the map — this is the
 * photographed list, not a second Google frame.
 */
import { useMemo, useState } from 'react'
import { V3Button, V3Field } from '@/components/site/v3'
import { inAtlasView, type AtlasViewBounds } from '@/lib/geo/atlas-camera'
import type { HomeFieldItem } from './home-field-items'
import { HOME_FIELD_LIMIT } from './home-constants'

const EMPTY_IN_VIEW =
  'No photographed homes in this view of the map. Zoom out or pan to see more.'

export function HomeHomesField({
  fieldItems,
  boundary: _boundary,
  listFlow,
  seeAll,
  emptyMessage,
  displayLimit = HOME_FIELD_LIMIT,
  bounds = null,
}: {
  fieldItems: HomeFieldItem[]
  boundary?: unknown
  listFlow?: boolean
  seeAll?: { href: string; label: string }
  emptyMessage: string
  displayLimit?: number
  /** Null (full frame) leaves the list unfiltered. */
  bounds?: AtlasViewBounds | null
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
  const inView = useMemo(
    () => fieldItems.filter((item) => inAtlasView(item.lat, item.lng, bounds)),
    [fieldItems, bounds],
  )
  const visible = useMemo(() => {
    const set =
      selectedTypes.length === 0
        ? inView
        : inView.filter((item) => selectedTypes.includes(item.typeKey))
    return set.slice(0, displayLimit)
  }, [inView, selectedTypes, displayLimit])
  const listEmptyMessage =
    bounds != null && fieldItems.length > 0 && inView.length === 0 ? EMPTY_IN_VIEW : emptyMessage

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
      emptyMessage={listEmptyMessage}
    />
  )
}
