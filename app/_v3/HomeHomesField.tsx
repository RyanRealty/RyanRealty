'use client'

/**
 * Homepage inventory Field. The Stage above carries the D11 H1 and the
 * search action, so this section names itself through V3Field's ariaLabel.
 * Types that exist in the set are the toggle. Town chips stay as doors
 * into each city. Homes and the map share one barrel frame.
 */
import { useMemo, useState } from 'react'
import { V3Button, V3Field } from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import type { HomeFieldItem } from './home-field-items'
import {
  toggleHomeFieldType,
  typesInHomeField,
  visibleHomeField,
} from './home-field-types'
import { HOME_FIELD_LIMIT, homeFieldNote } from './home-constants'
import './home-homes-field.css'

export function HomeHomesField({
  fieldItems,
  towns,
  boundary,
  listFlow,
  seeAll,
  emptyMessage,
  displayLimit = HOME_FIELD_LIMIT,
}: {
  fieldItems: HomeFieldItem[]
  towns: readonly { label: string; href: string }[]
  boundary?: unknown
  listFlow?: boolean
  seeAll?: { href: string; label: string }
  emptyMessage: string
  displayLimit?: number
}) {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const types = useMemo(() => typesInHomeField(fieldItems), [fieldItems])
  const visible = useMemo(
    () => visibleHomeField(fieldItems, selectedTypes, displayLimit),
    [fieldItems, selectedTypes, displayLimit],
  )
  const pins = useMemo(
    () =>
      visible.flatMap((item) =>
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
      ),
    [visible],
  )

  const [firstTown, ...restTowns] = towns
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
              onClick={() => setSelectedTypes((prev) => toggleHomeFieldType(prev, type.key))}
            >
              <span
                className={`home-homes-field__swatch home-homes-field__swatch--cat-${type.cat}`}
                aria-hidden="true"
              />
              {type.label}
            </V3Button>
          )
        })}
      </nav>
    ) : null
  const townLead = firstTown ? (
    <nav aria-label="Towns">
      <V3Button href={firstTown.href} variant="ghost">
        {firstTown.label}
      </V3Button>
      {restTowns.map((town) => (
        <V3Button key={town.href} href={town.href} variant="ghost">
          {town.label}
        </V3Button>
      ))}
    </nav>
  ) : null

  return (
    <V3Field
      id="homes"
      className="home-homes-field"
      ariaLabel="Homes for sale across Central Oregon"
      items={visible}
      mapSlot={
        pins.length > 0 ? (
          <PlaceFieldMap
            pins={pins}
            placeName="Central Oregon"
            posterSrc={visible[0]?.photoSrc ?? fieldItems[0]?.photoSrc}
            boundary={boundary}
          />
        ) : undefined
      }
      mapNote={visible.length > 0 ? homeFieldNote(visible.length) : undefined}
      lead={
        typeLead || townLead ? (
          <>
            {typeLead}
            {townLead}
          </>
        ) : null
      }
      listFlow={listFlow}
      action={seeAll}
      emptyMessage={emptyMessage}
    />
  )
}
