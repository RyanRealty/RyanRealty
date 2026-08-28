/**
 * ZIP inventory Field. PUBLIC_UI.md §3: zip uses the city opening. Field of
 * this ZIP's houses. Count is a caption, never a number hero. Map and list
 * are the same set.
 */
import { V3Field, V3Heading, V3SourceLine, type V3FieldItem, type V3Text } from '@/components/site/v3'
import { PlaceFieldMap } from '@/app/central-oregon/_v3/PlaceFieldMap.client'
import { fieldMapPins } from '@/app/central-oregon/_v3/nearby-field-items'

export function ZipHomesField({
  zip,
  headline,
  fieldItems,
  caption,
  source,
  emptyMessage,
  populationNote,
}: {
  zip: string
  /**
   * THE PAGE H1, passed from the route file so it carries the money head
   * term ("Homes for sale in 97702") instead of the bare ZIP digits. The
   * market Instrument below is level 2 and carries the market question.
   */
  headline: V3Text
  fieldItems: V3FieldItem[]
  caption: string | null
  source: string
  emptyMessage: string
  /**
   * §0: this list and the market Instrument's "detached homes for sale"
   * figure are two different populations of the same MLS PropertyType='A'
   * bucket — this list counts every sub type in it, the Instrument figure is
   * the single-family-only subset. One sentence connects both counts so a
   * reader (or a crawler comparing this list's length to the Dataset's
   * activeCount) never reads the gap as a disagreement.
   */
  populationNote?: string
}) {
  const pins = fieldMapPins(fieldItems)
  const missing = fieldItems.length - pins.length
  const posterSrc = fieldItems.find((item) => item.photoSrc)?.photoSrc
  return (
    <>
      <V3Heading level={1} size="field" className="v3-field-place-name">
        {headline}
      </V3Heading>
      <V3Field
        id="homes"
        ariaLabel={`Active single-family listings in ${zip}`}
        items={fieldItems}
        mapSlot={
          fieldItems.length > 0 ? (
            <PlaceFieldMap pins={pins} placeName={`ZIP ${zip}`} posterSrc={posterSrc} />
          ) : undefined
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
      {populationNote ? <p className="v3-field__note">{populationNote}</p> : null}
    </>
  )
}
