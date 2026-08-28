/**
 * City inventory as photographs, then a map of the same set. The page H1
 * lives on the Stage. This heading is the homes section.
 */
import { V3Field, V3Heading, V3SourceLine, type V3FieldItem, type V3Text } from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { fieldMapPins } from '@/app/central-oregon/_v3/nearby-field-items'
import { cityFieldEmptyMessage } from './city-sections'
import './city-map.css'

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
  return (
    <>
      <V3Heading level={2} size="field" className="v3-field-place-name">
        {headline}
      </V3Heading>
      <V3Field
        id="homes"
        ariaLabel={`Homes for sale in ${cityName}`}
        items={fieldItems}
        mapNote={caption ?? undefined}
        emptyMessage={cityFieldEmptyMessage(cityName, tilesLength)}
      />
      {fieldItems.length > 0 ? <V3SourceLine source={source} /> : null}
    </>
  )
}

export function CityMap({
  id = 'map',
  cityName,
  fieldItems,
  source,
}: {
  id?: string
  cityName: string
  fieldItems: V3FieldItem[]
  source: string
}) {
  const pins = fieldMapPins(fieldItems)
  if (pins.length === 0) return null
  const posterSrc = fieldItems.find((item) => item.photoSrc)?.photoSrc
  return (
    <>
      <V3Heading level={2} size="field" className="v3-field-place-name">
        Map
      </V3Heading>
      <V3Field
        id={id}
        ariaLabel={`Map of homes for sale in ${cityName}`}
        items={fieldItems}
        mapSlot={<PlaceFieldMap pins={pins} placeName={cityName} posterSrc={posterSrc} />}
      />
      <V3SourceLine source={source} />
    </>
  )
}

export function CityPhotoField({
  id,
  headline,
  ariaLabel,
  fieldItems,
  source,
}: {
  id: string
  cityName: string
  headline: V3Text
  ariaLabel: string
  fieldItems: V3FieldItem[]
  source: string
}) {
  if (fieldItems.length === 0) return null
  return (
    <>
      <V3Heading level={2} size="field" className="v3-field-place-name">
        {headline}
      </V3Heading>
      <V3Field id={id} ariaLabel={ariaLabel} items={fieldItems} />
      <V3SourceLine source={source} />
    </>
  )
}
