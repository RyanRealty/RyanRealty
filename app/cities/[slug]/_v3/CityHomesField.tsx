/**
 * City inventory Field plus its map slot. Lives next to the page so the city
 * route stays under the 600-line floor after PlaceFieldMap landed on it.
 */
import { V3Field, type V3FieldItem } from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { fieldMapPins } from '@/app/central-oregon/_v3/nearby-field-items'
import { cityFieldEmptyMessage } from './city-sections'

export function cityMapPinCount(fieldItems: readonly V3FieldItem[]): number {
  return fieldMapPins(fieldItems).length
}

export function CityHomesField({
  cityName,
  fieldItems,
  inventory,
  tilesLength,
}: {
  cityName: string
  fieldItems: V3FieldItem[]
  inventory: { count: number; source: string; updatedAt: string | null }
  tilesLength: number
}) {
  const [firstFieldItem] = fieldItems
  const mapPins = fieldMapPins(fieldItems)
  return (
    <V3Field
      id="homes"
      ariaLabel={`Homes for sale in ${cityName}`}
      items={fieldItems}
      mapSlot={
        mapPins.length > 0 ? <PlaceFieldMap pins={mapPins} placeName={cityName} /> : undefined
      }
      mapNote={
        mapPins.length > 0
          ? `Every ${cityName} home listed here that reports coordinates. Select a pin to open that home.`
          : undefined
      }
      count={{
        value: inventory.count.toLocaleString('en-US'),
        label: `homes for sale in ${cityName}`,
        source: inventory.source,
        updatedAt: inventory.updatedAt,
      }}
      footNote={
        firstFieldItem
          ? `The ${fieldItems.length} most recently listed active homes with a ${cityName} address. The count above them is a different measure with its own source line, not a total of these rows.`
          : undefined
      }
      emptyMessage={cityFieldEmptyMessage(cityName, tilesLength)}
    />
  )
}
