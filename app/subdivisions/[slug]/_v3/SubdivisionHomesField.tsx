'use client'

/**
 * Subdivision inventory Field. Lives next to the page so the route stays
 * readable. PUBLIC_UI.md §3 Subdivision: Stage then one Field of this
 * neighborhood's houses. 390 follows city/neighborhood/community: list first,
 * map behind a Map toggle. Wide: map left, list right. Pins read --v3-cat.
 */
import { V3Field, V3Heading, V3SourceLine, type V3FieldItem, type V3Text } from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { subdivisionFaceFieldCount } from './subdivision-face'

export function SubdivisionHomesField({
  placeName,
  headline,
  fieldItems,
  inventoryOk,
  caption,
  source,
  liveCount,
  ownsHeading = true,
  seeAll,
  boundary,
}: {
  placeName: string
  /**
   * THE PAGE H1 when this Field opens the page. When V3Stage already carries
   * `Homes for sale in ${placeName}`, ownsHeading is false so the Field does
   * not ship a second h1.
   */
  headline: V3Text
  fieldItems: V3FieldItem[]
  inventoryOk: boolean
  caption: string | null
  source: string
  liveCount?: number | null
  ownsHeading?: boolean
  seeAll?: { href: string; label: string }
  boundary?: unknown
}) {
  const fieldCount = subdivisionFaceFieldCount({
    placeName,
    count: liveCount ?? fieldItems.length,
  })
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
        count={fieldCount ? { ...fieldCount, source } : undefined}
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
                    cat: item.cat ?? 0,
                  },
                ]
              : [],
          )
          if (pins.length === 0 && !boundary) return null
          return (
            <PlaceFieldMap
              pins={pins}
              boundary={boundary ?? undefined}
              placeName={placeName}
              posterSrc={fieldItems[0]?.photoSrc}
            />
          )
        }}
        listFirst
        mapToggle
        action={seeAll}
        emptyMessage={
          inventoryOk
            ? `No single-family home is listed in ${placeName} right now.`
            : `The inventory query for ${placeName} did not return, so this is not a claim that nothing is for sale.`
        }
      />
      {!caption && fieldItems.length > 0 ? <V3SourceLine source={source} /> : null}
    </>
  )
}
