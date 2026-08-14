/**
 * ZIP inventory Field. PUBLIC_UI.md §3: zip uses the city opening. Field of
 * this ZIP's houses. Count is a caption, never a number hero. Map and list
 * are the same set.
 */
import { V3Field, V3SourceLine, type V3FieldItem } from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { fieldMapPins } from '@/app/central-oregon/_v3/nearby-field-items'

export function ZipHomesField({
  zip,
  fieldItems,
  caption,
  source,
  emptyMessage,
}: {
  zip: string
  fieldItems: V3FieldItem[]
  caption: string | null
  source: string
  emptyMessage: string
}) {
  const pins = fieldMapPins(fieldItems)
  const missing = fieldItems.length - pins.length
  return (
    <>
      <V3Field
        id="homes"
        ariaLabel={`Active single-family listings in ${zip}`}
        items={fieldItems}
        mapSlot={
          fieldItems.length > 0 ? <PlaceFieldMap pins={pins} placeName={`ZIP ${zip}`} /> : undefined
        }
        mapNote={caption ?? undefined}
        footNote={
          missing > 0 && pins.length > 0
            ? missing === 1
              ? '1 of these carries no coordinates, so it is listed but not plotted.'
              : `${missing.toLocaleString('en-US')} of these carry no coordinates, so they are listed but not plotted.`
            : fieldItems.length > 0 && pins.length === 0
              ? `No active listing in ${zip} reports coordinates, so this map plots nothing.`
              : undefined
        }
        emptyMessage={emptyMessage}
      />
      {fieldItems.length > 0 ? <V3SourceLine source={source} /> : null}
    </>
  )
}
