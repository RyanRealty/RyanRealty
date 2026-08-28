'use client'

/**
 * Homepage inventory Field. Photo-led cards a thumb can tap, town chips that
 * filter the same set the map plots. The Stage above carries the D11 H1.
 * Methodology captions stay off this surface.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { V3Button, V3Field, type V3FieldMapSlot } from '@/components/site/v3'
import { cn } from '@/lib/utils'
import { filterHomeFieldByCity, type HomeFieldItem } from './home-field-items'
import './home-homes-field.css'

const WIDE_FIELD = '(min-width: 56.25rem)'
const MAP_STILL_HREF = '/homes-for-sale?view=map'

function useWideHomesField(): boolean {
  const [wide, setWide] = useState(false)

  useEffect(() => {
    const query = window.matchMedia(WIDE_FIELD)
    const sync = () => setWide(query.matches)
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return wide
}

function HomeMapStill({ href, posterSrc }: { href: string; posterSrc?: string }) {
  return (
    <Link href={href} className="home-homes-field__map-still">
      {posterSrc ? (
        <img
          className="home-homes-field__map-still-img"
          src={posterSrc}
          alt=""
          width={800}
          height={600}
        />
      ) : (
        <span className="home-homes-field__map-still-wash" aria-hidden="true" />
      )}
      <span className="home-homes-field__map-still-label">Open the map</span>
    </Link>
  )
}

export function HomeHomesField({
  fieldItems,
  towns,
  count,
  mapSlot,
  mapNote,
  mapStillHref = MAP_STILL_HREF,
  seeAll,
  emptyMessage,
}: {
  fieldItems: HomeFieldItem[]
  towns: readonly { label: string; href: string }[]
  count?: {
    value: string
    label: string
    source: string
    updatedAt: string | null
  }
  mapSlot?: V3FieldMapSlot
  mapNote?: string
  /** Phone tap-through. Desktop still mounts the live map. */
  mapStillHref?: string
  seeAll?: { href: string; label: string }
  emptyMessage: string
}) {
  const [town, setTown] = useState<string | null>(null)
  const wide = useWideHomesField()
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
  const posterSrc = visible[0]?.photoSrc
  const liveMap =
    pins.length > 0 ? (
      <PlaceFieldMap
        pins={pins}
        placeName="Central Oregon"
        posterSrc={posterSrc}
      />
    ) : mapSlot
  const mapForSlot = wide ? liveMap : <HomeMapStill href={mapStillHref} posterSrc={posterSrc} />

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
                key={item.href}
                type="button"
                className={cn('home-homes-field__chip', town === item.label && 'is-active')}
                aria-pressed={town === item.label}
                onClick={() => setTown(item.label)}
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
        mapSlot={mapForSlot}
        mapNote={mapNote}
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

      {seeAll ? (
        <div className="home-homes-field__more">
          <V3Button href={seeAll.href} variant="ghost">
            {seeAll.label}
          </V3Button>
        </div>
      ) : null}
    </div>
  )
}
