'use client'

/**
 * Homepage inventory Field. Photo-led cards a thumb can tap, town chips that
 * filter the same set the map plots. The Stage above carries the D11 H1.
 * Methodology captions stay off this surface.
 */
import { useMemo, useState } from 'react'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { V3Field } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import { filterHomeFieldByCity, type HomeFieldItem } from './home-field-items'
import './home-homes-field.css'

export function HomeHomesField({
  fieldItems,
  towns,
  count,
  emptyMessage,
}: {
  fieldItems: HomeFieldItem[]
  towns: readonly { label: string; city: string }[]
  count?: {
    value: string
    label: string
    source: string
    updatedAt: string | null
  }
  emptyMessage: string
}) {
  const [town, setTown] = useState<string | null>(null)
  const visible = useMemo(() => filterHomeFieldByCity(fieldItems, town), [fieldItems, town])
  const pins = useMemo(
    () =>
      visible.flatMap((item) =>
        item.lat != null && item.lng != null
          ? [{ id: item.id, href: item.href, priceLabel: item.priceLabel, title: item.title, lat: item.lat, lng: item.lng }]
          : [],
      ),
    [visible],
  )

  return (
    <div className="home-homes-field" id="homes">
      <header className="home-homes-field__head">
        {towns.length > 0 ? (
          <nav aria-label="Towns" className="home-homes-field__towns">
            <button
              type="button"
              className={cn('home-homes-field__chip', town == null && 'is-active')}
              aria-pressed={town == null}
              onClick={() => setTown(null)}
            >
              All
            </button>
            {towns.map((item) => (
              <button
                key={item.city}
                type="button"
                className={cn('home-homes-field__chip', town === item.city && 'is-active')}
                aria-pressed={town === item.city}
                onClick={() => setTown(item.city)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}
      </header>

      <V3Field
        id="listed"
        ariaLabel="Homes for sale across Central Oregon"
        items={visible}
        mapSlot={
          pins.length > 0 ? (
            <PlaceFieldMap
              pins={pins}
              placeName="Central Oregon"
              posterSrc={visible[0]?.photoSrc}
            />
          ) : undefined
        }
        count={
          count
            ? { value: count.value, label: count.label, source: count.source, updatedAt: count.updatedAt }
            : undefined
        }
        emptyMessage={
          town
            ? `No photographed active home in ${town} in this set.`
            : emptyMessage
        }
      />
    </div>
  )
}
