/**
 * Homepage inventory Field. The Stage above carries the D11 H1 and the
 * search action, so this section names itself through V3Field's ariaLabel.
 * Town filters sit in the Field lead, one row. Homes and the map share
 * one barrel frame. No leftover count caption.
 */
import { V3Button, V3Field, type V3FieldItem, type V3FieldMapSlot } from '@/components/site/v3'
import './home-homes-field.css'

export function HomeHomesField({
  fieldItems,
  towns,
  mapSlot,
  mapNote,
  listFlow,
  seeAll,
  emptyMessage,
}: {
  fieldItems: V3FieldItem[]
  towns: readonly { label: string; href: string }[]
  mapSlot?: V3FieldMapSlot
  mapNote?: string
  listFlow?: boolean
  seeAll?: { href: string; label: string }
  emptyMessage: string
}) {
  const [firstTown, ...restTowns] = towns
  const townLead = firstTown ? (
    <nav aria-label="Towns">
      <V3Button href={firstTown.href} variant="ghost">
        {firstTown.label}
      </V3Button>
      {restTowns.map((town) => (
        <V3Button key={town.href} href={town.href} variant="ghost">
          {town.label}
        </V3Button>
      ))}
    </nav>
  ) : null

  return (
    <V3Field
      id="homes"
      className="home-homes-field"
      ariaLabel="Homes for sale across Central Oregon"
      items={fieldItems}
      mapSlot={mapSlot}
      mapNote={mapNote}
      lead={townLead}
      listFlow={listFlow}
      action={seeAll}
      emptyMessage={emptyMessage}
    />
  )
}
