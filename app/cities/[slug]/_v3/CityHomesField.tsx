/**
 * City inventory Field. Map and list are the same set. The page H1 lives on
 * the Stage; this heading is the homes section, not the money-route head term.
 */
import { V3Field, V3Heading, V3SourceLine, type V3FieldItem, type V3Text } from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { fieldMapPins } from '@/app/central-oregon/_v3/nearby-field-items'
import { cityFieldEmptyMessage } from './city-sections'

export function CityHomesField({
  cityName,
  headline,
  fieldItems,
  tilesLength,
  caption,
  source,
}: {
  cityName: string
  headline: V3Text
  fieldItems: V3FieldItem[]
  tilesLength: number
  caption: string | null
  source: string
}) {
  const pins = fieldMapPins(fieldItems)
  const missing = fieldItems.length - pins.length
  const posterSrc = fieldItems.find((item) => item.photoSrc)?.photoSrc
  return (
    <>
      <V3Heading level={2} size="field" className="v3-field-place-name">
        {headline}
      </V3Heading>
      <V3Field
        id="homes"
        ariaLabel={`Homes for sale in ${cityName}`}
        items={fieldItems}
        mapSlot={
          fieldItems.length > 0 ? (
            <PlaceFieldMap pins={pins} placeName={cityName} posterSrc={posterSrc} />
          ) : undefined
        }
        mapNote={caption ?? undefined}
        footNote={
          missing > 0 && pins.length > 0
            ? missing === 1
              ? '1 of these carries no coordinates, so it is listed but not plotted.'
              : `${missing.toLocaleString('en-US')} of these carry no coordinates, so they are listed but not plotted.`
            : undefined
        }
        emptyMessage={cityFieldEmptyMessage(cityName, tilesLength)}
      />
      {fieldItems.length > 0 ? <V3SourceLine source={source} /> : null}
    </>
  )
}
