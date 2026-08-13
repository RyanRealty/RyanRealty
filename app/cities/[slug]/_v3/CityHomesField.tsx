/**
 * City inventory Field. Lives next to the page so the city route stays under
 * the 600-line floor. Photographs are the surface: no map slot, so V3Field
 * opens on live MLS photos that go to listings.
 */
import { V3Field, type V3FieldItem } from '@/components/site/v3'
import { cityFieldEmptyMessage } from './city-sections'

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
  return (
    <V3Field
      id="homes"
      ariaLabel={`Homes for sale in ${cityName}`}
      items={fieldItems}
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
