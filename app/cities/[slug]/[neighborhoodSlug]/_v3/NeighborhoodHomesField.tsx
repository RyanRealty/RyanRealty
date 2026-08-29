'use client'

/**
 * Neighborhood inventory Field. Lives next to the page so the route stays
 * readable. PUBLIC_UI.md §3: Field of this neighborhood's houses. 390 follows
 * the city/home Field: list first, map behind a Map toggle. Wide: map left,
 * list right.
 */
import { V3Field, V3Heading, V3SourceLine, type V3FieldItem, type V3Text } from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { nbhFieldEmptyMessage } from './neighborhood-sections'

export function NeighborhoodHomesField({
  placeName,
  headline,
  fieldItems,
  inventoryOk,
  caption,
  source,
  ownsHeading = true,
  seeAll,
}: {
  placeName: string
  /**
   * THE PAGE H1 when this Field opens the page. When V3Stage already carries
   * `${placeName} homes for sale`, ownsHeading is false so the Field does not
   * ship a second h1.
   */
  headline: V3Text
  fieldItems: V3FieldItem[]
  inventoryOk: boolean
  caption: string | null
  source: string
  ownsHeading?: boolean
  seeAll?: { href: string; label: string }
}) {
  return (
    <>
      {ownsHeading ? (
        <V3Heading level={1} size="field" className="v3-field-place-name">
          {headline}
        </V3Heading>
      ) : null}
      <V3Field
        id="homes"
        ariaLabel={`Homes for sale in ${placeName}`}
        items={fieldItems}
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
              placeName={placeName}
              posterSrc={fieldItems[0]?.photoSrc}
            />
          )
        }}
        listFirst
        mapToggle
        mapNote={caption ?? undefined}
        action={seeAll}
        emptyMessage={nbhFieldEmptyMessage(placeName, inventoryOk)}
      />
      {fieldItems.length > 0 ? <V3SourceLine source={source} /> : null}
    </>
  )
}
