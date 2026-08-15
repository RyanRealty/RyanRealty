/**
 * City inventory Field. Lives next to the page so the city route stays under
 * the 600-line floor. PUBLIC_UI.md §3: Field of this city's houses. Verdict is
 * a caption, never a number hero. Map and list are the same set.
 */
import { V3Field, V3SourceLine, type V3FieldItem } from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { fieldMapPins } from '@/app/central-oregon/_v3/nearby-field-items'
import { cityFieldEmptyMessage } from './city-sections'

export function CityHomesField({
  cityName,
  fieldItems,
  tilesLength,
  caption,
  source,
}: {
  cityName: string
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
      <p className="v3-heading v3-heading--field v3-field-place-name">{cityName}</p>
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
