'use client'

/**
 * City inventory Field. Lives next to the page so the city route stays under
 * the 600-line floor. PUBLIC_UI.md §3: Field of this city's houses. Verdict is
 * a caption, never a number hero. Map and list are the same set.
 *
 * Types that exist in the set are lead chips. 390 follows the homepage Field:
 * list first, map behind a Map toggle. Wide: map left, list right.
 */
import { useMemo, useState } from 'react'
import { V3Button, V3Field, V3Heading, V3SourceLine, type V3Text } from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import type { CityFieldItem } from './city-field-items'
import { cityFieldEmptyMessage } from './city-sections'

export function CityHomesField({
  cityName,
  headline,
  fieldItems,
  tilesLength,
  caption,
  source,
  ownsHeading = true,
  seeAll,
}: {
  cityName: string
  /**
   * THE PAGE H1 when this Field opens the page. When V3Stage already carries
   * `${cityName} homes for sale`, ownsHeading is false so the Field does not
   * ship a second h1.
   */
  headline: V3Text
  fieldItems: CityFieldItem[]
  tilesLength: number
  caption: string | null
  source: string
  ownsHeading?: boolean
  seeAll?: { href: string; label: string }
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
    if (selectedTypes.length === 0) return fieldItems
    return fieldItems.filter((item) => selectedTypes.includes(item.typeKey))
  }, [fieldItems, selectedTypes])

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
    <>
      {ownsHeading ? (
        <V3Heading level={1} size="field" className="v3-field-place-name">
          {headline}
        </V3Heading>
      ) : null}
      <V3Field
        id="homes"
        ariaLabel={`Homes for sale in ${cityName}`}
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
              placeName={cityName}
              posterSrc={visible[0]?.photoSrc ?? fieldItems[0]?.photoSrc}
            />
          )
        }}
        lead={typeLead}
        listFirst
        mapToggle
        mapNote={caption ?? undefined}
        action={seeAll}
        emptyMessage={cityFieldEmptyMessage(cityName, tilesLength)}
      />
      {fieldItems.length > 0 ? <V3SourceLine source={source} /> : null}
    </>
  )
}
